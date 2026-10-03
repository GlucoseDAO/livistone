// The frame's single output pass. WebGPURenderer ignores `material.toneMapped` and mixes fog in linear light before its own
// output pass, so the game renders through a RenderPipeline instead. The scene writes an 8-bit `display` attachment next to
// its colour: red is a mask for paper, photographs, captions and signs (displayMaterial), green each surface's range-fog factor.
// The output tone-maps all but the masked pixels (render/tone.ts, ?tone=aces|agx|neutral), encodes sRGB, then mixes in the range
// fog toward the displayed horizon, as the classic renderer fogged after encoding: the map's fog and the cpu tier's linear fog.
// Walking on the gpu and mobile tiers, the aerial perspective (render/aerial.ts) fogs in linear light before this pass instead,
// and display materials fog themselves toward the displayed sky; cream paper stays #f4f0e5 up close by day and night. Ambient
// occlusion and bloom (sub-plan 18) belong before the tone mapping, and must leave display pixels alone.
import * as THREE from 'three';
import { Fn, float, mix, mrt, output, positionView, renderGroup, sRGBTransferEOTF, sRGBTransferOETF, smoothstep, texture, toneMappingExposure, uniform, vec4 } from 'three/tsl';
import type { Node, NodeBuilder } from 'three/webgpu';
import { aerialFactor, aerialSky } from './aerial';
import { toneMapNode, untoneMapNode } from './tone';

// @types/three r186 leaves these untyped; the casts only restore the shader types three itself infers.
const exposure = toneMappingExposure as unknown as Node<'float'>;
/** The sRGB transfer curve and its inverse, for colours the classic renderer mixed after encoding. */
export const toSRGB = (c: Node<'vec3'>): Node<'vec3'> => sRGBTransferOETF(c) as unknown as Node<'vec3'>, fromSRGB = (c: Node<'vec3'>): Node<'vec3'> => sRGBTransferEOTF(c) as unknown as Node<'vec3'>;

/** The colour the output pass shows for a linear radiance, before range fog: the active tone curve at the exposure, sRGB-encoded. */
export const displayed = (radiance: Node<'vec3'>): Node<'vec3'> => toSRGB(toneMapNode(radiance, exposure));

/** The range fog: main.ts keeps it at the map range, or the cpu tier's walking range, toward the displayed horizon (HORIZON_HAZE). */
// In the render group, as three's own fog: between frames a material without node properties refreshes only the shared
// groups, so an object-group uniform reaching it through the MRT keeps its first value (the map range the town loads in).
// `amount` is 0 while the aerial perspective fogs the walking view instead.
export const displayFog = { color: uniform(new THREE.Color()).setGroup(renderGroup), near: uniform(0).setGroup(renderGroup), far: uniform(1).setGroup(renderGroup), amount: uniform(1).setGroup(renderGroup) };
const RANGE = smoothstep(displayFog.near, displayFog.far, positionView.z.negate()).mul(displayFog.amount);
// Each surface's range-fog factor, or none for the background and other unfogged materials (decided per material at build).
const FOG = Fn((builder: NodeBuilder) => (builder.material as { fog?: boolean } | null)?.fog === false ? float(0) : RANGE)();
const DISPLAY = mrt({ display: vec4(1, RANGE, 0, 1) });

export class OutputPipeline {
  private readonly target: THREE.RenderTarget;
  private readonly targets: ReturnType<typeof mrt>;
  private readonly pipeline: THREE.RenderPipeline;
  private readonly size = new THREE.Vector2();
  constructor(private readonly renderer: THREE.WebGPURenderer, private readonly scene: THREE.Scene) {
    // The scene renders at top level into its own half-float target, with an 8-bit `display` attachment. A pass() node would
    // render it nested inside the output quad, whose deeper render context keys every shader apart from compile()'s.
    this.target = new THREE.RenderTarget(1, 1, { count: 2, type: renderer.getOutputBufferType(), samples: renderer.samples });
    this.target.textures[0].name = 'output'; this.target.textures[1].name = 'display'; this.target.textures[1].type = THREE.UnsignedByteType;
    // Other surfaces write a zero mask and their fog with their own alpha, under their own blending: opaque ones replace both,
    // glass over a poster tone-maps its share. MRT outputs besides `output` would otherwise be written unblended.
    this.targets = mrt({ output, display: vec4(0, FOG, 0, output.a) }); this.targets.setBlendMode('display', new THREE.BlendMode(THREE.MaterialBlending));
    const colour = texture(this.target.textures[0]), display = texture(this.target.textures[1]);
    const shown = mix(toneMapNode(colour.rgb as unknown as Node<'vec3'>, exposure), colour.rgb, display.r);
    // Linear sRGB working space to the sRGB canvas: same primaries, so only the transfer curve applies; fog mixes after it.
    this.pipeline = new THREE.RenderPipeline(renderer, vec4(mix(toSRGB(shown), toSRGB(displayFog.color as unknown as Node<'vec3'>), display.g), 1));
    this.pipeline.outputColorTransform = false;
  }
  render(camera: THREE.Camera): void {
    this.bind(); this.renderer.render(this.scene, camera); this.unbind();
    this.pipeline.render();
  }
  /**
   * Compile `parts` (the scene's main groups) for this target before the first frame. r186's compileAsync builds one object at
   * a time and waits for each pipeline in turn, so several parts compile side by side. Their node builds read the renderer's
   * target and MRT as they go, so both stay set until every part is done; nothing else renders while the town loads.
   */
  async compile(camera: THREE.Camera, parts: THREE.Object3D[], parallel = 6): Promise<void> {
    // A double-sided transmissive material renders a back pass and then a front pass. compileAsync sets each side while it
    // collects the two passes but builds them after restoring DoubleSide, so both would keep a double-sided shader and
    // pipeline (the hall glass drawn four layers deep). Compile them one side at a time instead: the cache keys hold the side.
    const twoPass = new Map<THREE.Material, THREE.Mesh[]>();
    for (const part of parts) part.traverse((object) => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const physical = material as THREE.MeshPhysicalNodeMaterial;
        if (material.side === THREE.DoubleSide && !material.forceSinglePass && (physical.transmission > 0 || physical.transmissionNode)) twoPass.set(material, [...twoPass.get(material) ?? [], mesh]);
      }
    });
    const queue = [...parts]; this.bind();
    try {
      for (const material of twoPass.keys()) material.side = THREE.FrontSide;
      await Promise.all(Array.from({ length: parallel }, async () => { for (let part = queue.shift(); part; part = queue.shift()) await this.renderer.compileAsync(part, camera, this.scene); }));
      for (const material of twoPass.keys()) material.side = THREE.BackSide;
      for (const mesh of new Set([...twoPass.values()].flat())) await this.renderer.compileAsync(mesh, camera, this.scene);
    } finally { for (const material of twoPass.keys()) material.side = THREE.DoubleSide; this.unbind(); }
  }
  private bind(): void {
    this.renderer.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) this.target.setSize(this.size.x, this.size.y);
    this.renderer.setRenderTarget(this.target); this.renderer.setMRT(this.targets);
  }
  private unbind(): void { this.renderer.setRenderTarget(null); this.renderer.setMRT(null); }
}

/**
 * Paper, photographs, captions and signs: exact colours, untouched by tone mapping. In the aerial walking view they fog
 * themselves toward the sky as displayed (the aerial factor is zero elsewhere); the map and the cpu tier fog them in the output pass.
 */
class DisplayNodeMaterial extends THREE.MeshBasicNodeMaterial {
  // Its own type keeps its shaders apart from a plain basic material's with the same properties.
  static get type(): string { return 'DisplayNodeMaterial'; }
  setupFog(_builder: NodeBuilder, outputNode: Node<'vec4'>): Node<'vec4'> {
    return vec4(mix(outputNode.rgb, toneMapNode(aerialSky, exposure), aerialFactor), outputNode.a) as unknown as Node<'vec4'>;
  }
}
/** The former `toneMapped: false` MeshBasicMaterial: exact colours, untouched by tone mapping, fogged toward the displayed sky. */
export function displayMaterial(parameters: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicNodeMaterial {
  const material = new DisplayNodeMaterial({ ...parameters, fog: true });
  material.mrtNode = DISPLAY; material.userData.display = true;
  return material;
}
/** For additive sprites: no mask and no fog of their own, so the surface behind them keeps both. */
export const KEEP_DISPLAY = mrt({ display: vec4(0) });

/**
 * The linear radiance that the output pass maps to `display` (linear, 0–1) over a black background. Additive night halos
 * were blended after encoding in the classic renderer; adding this instead shows the same halo over the dark night scene.
 */
export const untoneMapped = (display: Node<'vec3'>): Node<'vec3'> => untoneMapNode(display, exposure);
