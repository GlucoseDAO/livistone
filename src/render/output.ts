// The frame's single output pass. WebGPURenderer ignores `material.toneMapped` and mixes fog in linear light before its own
// output pass, so the game renders through a RenderPipeline instead. The scene writes an 8-bit `display` attachment next to
// its colour: red is a mask for paper, photographs, captions and signs (displayMaterial), green each surface's range-fog factor,
// blue how far ambient occlusion reaches the pixel (opaque surfaces 1, display and transparent ones 0, blended by their coverage).
// The output tone-maps all but the masked pixels (Khronos PBR Neutral, render/tone.ts), encodes sRGB, then mixes in the range fog
// toward the displayed horizon, as the classic renderer fogged after encoding: the map's fog, the cpu tier's linear fog and the
// distant ranges' valley mist. Walking on the gpu and mobile tiers, the aerial perspective (render/aerial.ts) fogs the town in
// linear light before this pass instead, display materials fog themselves toward the displayed sky, and occlusion fades with
// that haze; cream paper stays #f4f0e5 up close by day and night. Ambient occlusion and bloom (sub-plan 18, render/post.ts) act
// on the linear radiance before tone mapping and leave display pixels alone.
import * as THREE from 'three';
import { Fn, abs, exp, float, length, materialReference, max, mix, mrt, normalize, output, positionLocal, positionView, positionWorld, renderGroup, sRGBTransferEOTF, sRGBTransferOETF, smoothstep, texture, toneMappingExposure, uniform, vec3, vec4 } from 'three/tsl';
import type { Node, NodeBuilder } from 'three/webgpu';
import type { PostMode } from '../game/graphics';
import { AO, ScreenSpace } from './post';
import { AERIAL_BEHIND, aerialFactor, aerialMix, aerialSky, aerialTarget, hazeLook, setAerialBehind } from './aerial';
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
// `mist` and `aerial` shape only the distant ranges (DISTANT_DISPLAY); `amount` is 0 while the aerial perspective fogs the
// walking town instead.
export const displayFog = {
  color: uniform(new THREE.Color()).setGroup(renderGroup), near: uniform(0).setGroup(renderGroup), far: uniform(1).setGroup(renderGroup),
  mist: uniform(new THREE.Vector2(1e6, 2e6)).setGroup(renderGroup), aerial: uniform(0).setGroup(renderGroup), amount: uniform(1).setGroup(renderGroup),
};
const DEPTH = smoothstep(displayFog.near, displayFog.far, positionView.z.negate()), RANGE = DEPTH.mul(displayFog.amount);
// Each surface's range-fog factor, or none for the background and other unfogged materials (decided per material at build). The
// sky counts as fully fogged at and below the horizon, where it already shows the haze: a multisampled pixel at the walking far
// plane, half fogged ground and half sky, then resolves to haze rather than a dark seam.
const FOG = Fn((builder: NodeBuilder) => {
  const material = builder.material as { fog?: boolean; name?: string } | null;
  if (material?.name === 'Background.material') return float(1).sub(smoothstep(0, .04, normalize(positionLocal).y));
  return material?.fog === false ? float(0) : RANGE;
})();
// Occlusion is found on the depth buffer, which water, glass and other transparent surfaces leave to what lies behind them;
// they write 0 and so keep their own light from that surface's occlusion in proportion to their opacity. A material's
// `userData.occlusion` (0–1) lowers it where screen-space occlusion overstates thin geometry. Surfaces in the aerial haze keep
// only the clear share of it, as range-fogged ones do in the output pass, so the haze is not darkened.
const SOLID = Fn((builder: NodeBuilder) => {
  const material = builder.material as { transparent?: boolean; depthWrite?: boolean; fog?: boolean; userData?: { occlusion?: number } } | null;
  // Occlusion follows the depth buffer, so a surface that writes none takes none. The sky background was the case that showed:
  // the half-resolution occlusion of a far ridge, dark where GTAO rebuilds it against the sky, spread onto the sky beside it in
  // the output pass's upsampling and drew a dark line along the ridge.
  const solid = float(!material || material.transparent || material.depthWrite === false ? 0 : material.userData?.occlusion ?? 1);
  return material?.fog === false ? solid : solid.mul(aerialFactor.g.oneMinus());
})();
const DISPLAY = mrt({ display: vec4(1, RANGE, 0, 1) });
/**
 * The distant ranges' fog (sub-plan 26), walking: a valley mist, full below `mist.x` metres of altitude and gone above `mist.y`,
 * so their feet meet the town's haze while the crests rise out of it, times aerial haze per metre of distance. The map sets
 * mist everywhere and no aerial haze, which is exactly the range fog of every other surface. The ranges lie beyond the town's
 * full-fog distance and draw in their own pass without the aerial perspective, so they keep this fog while walking.
 */
export const DISTANT_DISPLAY = mrt({ display: vec4(0, Fn(() => {
  const mist = float(1).sub(smoothstep(displayFog.mist.x, displayFog.mist.y, positionWorld.y));
  return float(1).sub(float(1).sub(DEPTH.mul(mist)).mul(exp(displayFog.aerial.mul(max(length(positionView).sub(displayFog.near), 0)).negate())));
})(), 0, 1) });

export class OutputPipeline {
  private readonly target: THREE.RenderTarget;
  private readonly targets: ReturnType<typeof mrt>;
  private readonly post: ScreenSpace;
  // One output pass with occlusion (the walk camera) and one without (the map, gentle detail); both carry the bloom.
  private readonly pipelines = new Map<boolean, THREE.RenderPipeline>();
  /** Copies the distant pass into AERIAL_BEHIND as the radiance this pipeline shows for it; none under dev-only ?haze=classic. */
  private readonly behind: THREE.QuadMesh | null = null;
  private readonly size = new THREE.Vector2();
  constructor(private readonly renderer: THREE.WebGPURenderer, private readonly scene: THREE.Scene, post: PostMode, walkCamera: THREE.PerspectiveCamera) {
    // The scene renders at top level into its own half-float target, with an 8-bit `display` attachment. A pass() node would
    // render it nested inside the output quad, whose deeper render context keys every shader apart from compile()'s.
    this.target = new THREE.RenderTarget(1, 1, { count: 2, type: renderer.getOutputBufferType(), samples: renderer.samples, depthTexture: new THREE.DepthTexture(1, 1) });
    this.target.textures[0].name = 'output'; this.target.textures[1].name = 'display'; this.target.textures[1].type = THREE.UnsignedByteType;
    // Other surfaces write a zero mask and their fog with their own alpha, under their own blending: opaque ones replace both,
    // glass over a poster tone-maps its share. MRT outputs besides `output` would otherwise be written unblended.
    this.targets = mrt({ output, display: vec4(0, FOG, SOLID, output.a) }); this.targets.setBlendMode('display', new THREE.BlendMode(THREE.MaterialBlending));
    this.post = new ScreenSpace(post, { colour: this.target.textures[0], display: this.target.textures[1], depth: this.target.depthTexture! }, walkCamera, exposure);
    if (hazeLook() === 'behind') {
      // The distant pass as the output pass below shows it (tone-mapped, its mist mixed in after encoding; it has no paper and no
      // occlusion), turned back into linear radiance: a town surface hazed into this colour displays as the ranges behind it.
      const drawn = texture(this.target.textures[0]), shown = texture(this.target.textures[1]), material = new THREE.NodeMaterial();
      const display = fromSRGB(mix(toSRGB(toneMapNode(drawn.rgb as unknown as Node<'vec3'>, exposure)), toSRGB(displayFog.color as unknown as Node<'vec3'>), shown.g) as unknown as Node<'vec3'>);
      material.fragmentNode = vec4(untoneMapNode(display, exposure), 1); material.name = 'aerial.behind';
      // Sized once, before anything compiles, and never resized: a resize gives the target a new texture, and r186 refreshes the
      // object-group bindings of materials without node properties only when the material changes, so they would go on sampling
      // the destroyed one. Read by screenUV, it need not follow the render scale: the largest buffer the game draws (the screen at
      // up to 1.5 pixels a point, main.ts), at most 1920 × 1080's worth of pixels.
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.5), w = (globalThis.screen?.width || 1920) * ratio, h = (globalThis.screen?.height || 1080) * ratio, k = Math.min(1, Math.sqrt(1920 * 1080 / (w * h)));
      AERIAL_BEHIND.setSize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
      this.behind = new THREE.QuadMesh(material); this.behind.name = 'Aerial · behind';
    }
  }
  /**
   * Occlusion follows the walk camera's depth and projection; the map's far view and gentle detail go without it. `distant`, when
   * walking with the distant ranges: a small scene of the sky and the ranges, drawn first by a camera that reaches past the
   * walking far plane. Its own scene keeps that pass from walking and updating the whole town graph a second time. The town then
   * draws over it with only the depth cleared, so everything near stays in front, and the ranges' cleared depth and zero
   * occlusion reach keep ambient occlusion off them.
   */
  render(camera: THREE.Camera, occlusion = true, distant?: { scene: THREE.Scene; camera: THREE.Camera }): void {
    this.bind();
    if (distant) {
      const background = this.scene.background, clear = this.renderer.autoClearColor;
      this.renderer.render(distant.scene, distant.camera);
      // The town's haze fades into what that pass drew (render/aerial.ts), copied out first: it cannot read its own target.
      if (this.behind) { this.renderer.setMRT(null); this.renderer.setRenderTarget(AERIAL_BEHIND); this.behind.render(this.renderer); this.bind(); setAerialBehind(true); }
      this.scene.background = null; this.renderer.autoClearColor = false;
      try { this.renderer.render(this.scene, camera); } finally { this.scene.background = background; this.renderer.autoClearColor = clear; setAerialBehind(false); }
    } else this.renderer.render(this.scene, camera);
    this.unbind();
    const ao = occlusion && camera === this.post.camera && !!this.post.occlusion;
    if (ao) this.post.prepare(this.renderer);
    this.pipeline(ao).render();
  }
  private pipeline(occlusion: boolean): THREE.RenderPipeline {
    let pipeline = this.pipelines.get(occlusion); if (pipeline) return pipeline;
    const colour = texture(this.target.textures[0]), display = texture(this.target.textures[1]), open = display.r.oneMinus();
    let radiance = colour.rgb as unknown as Node<'vec3'>;
    if (occlusion && this.post.occlusion) {
      // A fogged surface fades toward the horizon after tone mapping; its occlusion fades with it, so haze is not darkened.
      const reach = display.b.mul(display.g.oneMinus()).mul(AO.strength);
      radiance = radiance.mul(mix(float(1), this.post.occlusion, reach));
      if (this.post.bounce) radiance = radiance.add(this.post.bounce.mul(reach));
    }
    if (this.post.glow) radiance = radiance.add(this.post.glow.rgb.mul(open).div(exposure));
    const shown = mix(toneMapNode(radiance, exposure), colour.rgb, display.r);
    // Linear sRGB working space to the sRGB canvas: same primaries, so only the transfer curve applies; fog mixes after it.
    pipeline = new THREE.RenderPipeline(this.renderer, vec4(mix(toSRGB(shown as unknown as Node<'vec3'>), toSRGB(displayFog.color as unknown as Node<'vec3'>), display.g), 1));
    pipeline.outputColorTransform = false; this.pipelines.set(occlusion, pipeline);
    return pipeline;
  }
  /**
   * Compile `parts` (the scene's main groups) for this target before the first frame. r186's compileAsync builds one object at
   * a time and waits for each pipeline in turn, so several parts compile side by side. Their node builds read the renderer's
   * target and MRT as they go, so both stay set until every part is done; nothing else renders while the town loads.
   */
  async compile(camera: THREE.Camera, parts: THREE.Object3D[], parallel = 6, scene = this.scene): Promise<void> {
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
      await Promise.all(Array.from({ length: parallel }, async () => { for (let part = queue.shift(); part; part = queue.shift()) await this.renderer.compileAsync(part, camera, scene); }));
      for (const material of twoPass.keys()) material.side = THREE.BackSide;
      for (const mesh of new Set([...twoPass.values()].flat())) await this.renderer.compileAsync(mesh, camera, scene);
    } finally { for (const material of twoPass.keys()) material.side = THREE.DoubleSide; this.unbind(); }
    // The output passes and their screen-space stages build their shaders on first use: build both now, not on the first map.
    for (const occlusion of [true, false]) { if (occlusion && this.post.occlusion) this.post.prepare(this.renderer); this.pipeline(occlusion && !!this.post.occlusion).render(); }
    if (this.behind) { this.renderer.setMRT(null); this.renderer.setRenderTarget(AERIAL_BEHIND); this.behind.render(this.renderer); this.unbind(); }
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
    return vec4(aerialMix(outputNode.rgb, toneMapNode(aerialSky, exposure), toneMapNode(aerialTarget, exposure)), outputNode.a) as unknown as Node<'vec4'>;
  }
}
/** The former `toneMapped: false` MeshBasicMaterial: exact colours, untouched by tone mapping, fogged toward the displayed sky. */
export function displayMaterial(parameters: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicNodeMaterial {
  const material = new DisplayNodeMaterial({ ...parameters, fog: true });
  material.mrtNode = DISPLAY; material.userData.display = true;
  return material;
}
/** The posters' cream paper, sRGB-encoded (#f4f0e5): backings, margins, captions and the photographs' studio backgrounds. */
const PAPER = vec3(0xf4 / 255, 0xf0 / 255, 0xe5 / 255);
// Each material's own map through a reference, so every photograph shares one node graph and one shader, and a map swapped
// for a sharper one (planar-exhibition.ts residency) rebinds without a rebuild.
const photoMap = materialReference('map', 'texture') as unknown as Node<'vec4'>;
const PAPER_KEY = Fn(() => {
  const colour = toSRGB(photoMap.rgb).toVar(), offset = abs(colour.sub(PAPER));
  return vec4(fromSRGB(mix(PAPER, colour, smoothstep(3 / 255, 7 / 255, max(offset.x, max(offset.y, offset.z))))), 1);
})();
/**
 * A catalogue photograph on paper: build-catalogue.mjs bakes the studio sweep to paper, but lossy WebP returns #f4f0e5 as
 * #f5efe6, so colours within three levels of paper key to the exact value (fading out by seven) and the print meets its
 * backing paper without a seam. The jewel keeps its photographed colours. Unlit and masked like every displayMaterial.
 */
export function paperPhotoMaterial(map: THREE.Texture): THREE.MeshBasicNodeMaterial {
  const material = displayMaterial({ map }); material.colorNode = PAPER_KEY; return material;
}
/** For additive sprites: no mask and no fog of their own, so the surface behind them keeps both. */
export const KEEP_DISPLAY = mrt({ display: vec4(0) });

/**
 * The linear radiance that the output pass maps to `display` (linear, 0–1) over a black background. Additive night halos
 * were blended after encoding in the classic renderer; adding this instead shows the same halo over the dark night scene.
 */
export const untoneMapped = (display: Node<'vec3'>): Node<'vec3'> => untoneMapNode(display, exposure);
