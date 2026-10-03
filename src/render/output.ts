// The frame's single output pass. WebGPURenderer ignores `material.toneMapped` and mixes fog in linear light before its own
// output pass, so the game renders through a RenderPipeline instead: the scene pass writes an MRT `display` mask, and the
// output mixes the ACES-mapped colour with the untouched one by that mask before encoding sRGB. Paper, photographs, captions
// and signs set the mask (displayMaterial), so cream paper stays #f4f0e5 by day and night. Ambient occlusion and bloom
// (sub-plan 18) belong between the scene pass and this mix, and must leave display pixels alone.
import * as THREE from 'three';
import { Fn, float, mat3, max, min, mix, mrt, output, positionView, sRGBTransferEOTF, sRGBTransferOETF, smoothstep, sqrt, texture, toneMappingExposure, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

// @types/three r186 leaves these untyped; the casts only restore the shader types three itself infers.
const exposure = toneMappingExposure as unknown as Node<'float'>;
/** The sRGB transfer curve and its inverse, for colours the classic renderer mixed after encoding. */
export const toSRGB = (c: Node<'vec3'>): Node<'vec3'> => sRGBTransferOETF(c) as unknown as Node<'vec3'>, fromSRGB = (c: Node<'vec3'>): Node<'vec3'> => sRGBTransferEOTF(c) as unknown as Node<'vec3'>;

// The classic renderer's ACES filmic fit, as sky.ts's acesFilmic() computes it on the CPU. three's TSL copy multiplies the
// linear denominator term by .983729 as well (about .4% brighter mid-tones); the classic form keeps HORIZON_HAZE exact.
// Matrix3.set takes rows, as TSL's mat3 of nine numbers does.
const ACES_IN = new THREE.Matrix3().set(.59719, .35458, .04823, .076, .90834, .01566, .0284, .13383, .83777);
const ACES_OUT = new THREE.Matrix3().set(1.60475, -.53108, -.07367, -.10208, 1.10813, -.00605, -.00327, -.07276, 1.07602);
const acesFilmic = Fn(([radiance, exposure]: [Node<'vec3'>, Node<'float'>]) => {
  const v = mat3(ACES_IN).mul(radiance.mul(exposure).div(.6)).toVar();
  return mat3(ACES_OUT).mul(v.mul(v.add(.0245786)).sub(.000090537).div(v.mul(v.mul(.983729).add(.432951)).add(.238081))).clamp(0, 1);
});

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
    // Other surfaces write a zero mask with their own alpha, under their own blending: opaque ones clear it, glass over a poster
    // tone-maps its share, additive halos leave it alone. MRT outputs besides `output` would otherwise be written unblended.
    this.targets = mrt({ output, display: vec4(0, 0, 0, output.a) }); this.targets.setBlendMode('display', new THREE.BlendMode(THREE.MaterialBlending));
    const colour = texture(this.target.textures[0]), display = texture(this.target.textures[1]).r;
    const shown = mix(acesFilmic(colour.rgb, exposure), colour.rgb, display);
    // Linear sRGB working space to the sRGB canvas: same primaries, so only the transfer curve applies.
    this.pipeline = new THREE.RenderPipeline(renderer, vec4(toSRGB(shown), 1));
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
    const queue = [...parts]; this.bind();
    try { await Promise.all(Array.from({ length: parallel }, async () => { for (let part = queue.shift(); part; part = queue.shift()) await this.renderer.compileAsync(part, camera, this.scene); })); }
    finally { this.unbind(); }
  }
  private bind(): void {
    this.renderer.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) this.target.setSize(this.size.x, this.size.y);
    this.renderer.setRenderTarget(this.target); this.renderer.setMRT(this.targets);
  }
  private unbind(): void { this.renderer.setRenderTarget(null); this.renderer.setMRT(null); }
}

/** Display-space fog for display materials; main.ts keeps it equal to scene.fog's range with the tone-mapped HORIZON_HAZE. */
export const displayFog = { color: uniform(new THREE.Color()), near: uniform(0), far: uniform(1) };
const DISPLAY = mrt({ display: float(1) });
// The classic renderer fogged these after encoding sRGB, toward the displayed haze; doing the same and decoding back to
// linear lets the output pass encode it again unchanged.
const DISPLAY_OUTPUT = vec4(fromSRGB(mix(toSRGB(output.rgb), toSRGB(displayFog.color as unknown as Node<'vec3'>), smoothstep(displayFog.near, displayFog.far, positionView.z.negate()))), output.a);

/** The former `toneMapped: false` MeshBasicMaterial: exact colours, untouched by tone mapping, fogged as before. */
export function displayMaterial(parameters: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({ ...parameters, fog: false });
  material.mrtNode = DISPLAY; material.outputNode = DISPLAY_OUTPUT; material.userData.display = true;
  return material;
}

const ACES_IN_INVERSE = ACES_IN.clone().invert(), ACES_OUT_INVERSE = ACES_OUT.clone().invert();
// The fit maps this small radiance (per channel, after the input matrix) to zero; subtracting it keeps black at zero.
const ACES_ZERO = (Math.sqrt(.0245786 ** 2 + 4 * .000090537) - .0245786) / 2;
/**
 * The linear radiance that the output pass maps to `display` (linear, 0–1) over a black background. Additive night halos
 * were blended after encoding in the classic renderer; adding this instead shows the same halo over the dark night scene.
 */
export const untoneMapped = Fn(([display]: [Node<'vec3'>]) => {
  const v = mat3(ACES_OUT_INVERSE).mul(min(display, vec3(.985))).clamp(0, 1.01).toVar();
  // (1 - .983729 v) x² + (.0245786 - .432951 v) x - (.000090537 + .238081 v) = 0, positive root.
  const a = float(1).sub(v.mul(.983729)), b = float(.0245786).sub(v.mul(.432951)), c = float(.000090537).add(v.mul(.238081));
  const x = b.negate().add(sqrt(b.mul(b).add(a.mul(c).mul(4)))).div(a.mul(2));
  return max(mat3(ACES_IN_INVERSE).mul(x).sub(ACES_ZERO), vec3(0)).mul(.6).div(exposure);
});
