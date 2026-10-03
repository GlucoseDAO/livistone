// Screen-space stages between the scene pass and the output pass (realism sub-plan 18). Ambient occlusion grounds corners,
// eaves and feet; a restrained bloom picks up only what is brighter than the tone mapper's white (night halos, neon, lit
// signs, sun glints). OutputPipeline applies both to linear radiance before tone mapping and keeps `display` pixels (paper,
// photographs, captions, signs) exact. Further screen-space nodes (reflections, sub-plan 15) belong here too: they can read
// the same half-resolution depth and normals.
import * as THREE from 'three';
import GTAONode from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { getNormalFromDepth, ivec2, luminance, max, min, rtt, texture, textureLoad, textureSize, uniform, uv, vec2, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { PostMode } from '../game/graphics';

/** Occlusion radius and depth tolerance in metres, GTAO's samples and exponent, and how much of it reaches the lit colour. */
export const AO = { radius: 1.5, thickness: 1.2, samples: 16, power: 1.4, strength: 1 };
/**
 * Bloom gathers exposed radiance above `threshold` (1 shows as about 89% of white), at most `cap` above it per pixel, so a
 * neon tube or the gate's tourmaline glows without washing its neighbours white; `radius` 0 keeps the glow tight.
 */
export const BLOOM = { threshold: 1.2, cap: .6, strength: .5, radius: 0 };

// The scene's depth is multisampled on WebGPU, which GTAO's gathers cannot read, and its own AO target is half size anyway.
// One small pass copies one sample per 2×2 block into a half-resolution depth target and stores the view normal rebuilt from
// the full-resolution depth beside it, so the scene pass needs no normal attachment.
class HalfDepth {
  readonly target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
  private readonly quad: THREE.QuadMesh;
  private readonly size = new THREE.Vector2();
  constructor(depth: THREE.DepthTexture, camera: THREE.PerspectiveCamera) {
    this.target.texture.name = 'post.normal'; this.target.depthTexture!.name = 'post.depth';
    const at = uv(), full = texture(depth), material = new THREE.NodeMaterial();
    material.fragmentNode = vec4(getNormalFromDepth(at, full, uniform(camera.projectionMatrixInverse)), 1);
    material.depthNode = textureLoad(full, ivec2(at.mul(vec2(textureSize(textureLoad(full)) as unknown as Node<'ivec2'>))));
    material.depthFunc = THREE.AlwaysDepth; material.name = 'post.halfDepth';
    this.quad = new THREE.QuadMesh(material); this.quad.name = 'Post · half depth';
  }
  render(renderer: THREE.WebGPURenderer): void {
    renderer.getDrawingBufferSize(this.size); const width = Math.round(this.size.x / 2), height = Math.round(this.size.y / 2);
    if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);
    renderer.setRenderTarget(this.target); this.quad.render(renderer); renderer.setRenderTarget(null);
  }
}

// GTAO reads its centre depth through a 2×2 gather when it runs below full resolution; on a depth that is already half size
// that minimum would pull foreground edges a texel down and right, so the centre is point-sampled like every other tap.
class HalfResolutionAO extends GTAONode {
  setSize(width: number, height: number): void { super.setSize(width, height); (this as unknown as { _resolutionScale: { value: number } })._resolutionScale.value = 1; }
}

export class ScreenSpace {
  /** Ambient occlusion, 1 where open, denoised at half resolution; null when the mode has none. */
  readonly occlusion: Node<'float'> | null = null;
  /** The SSGI experiment's one-bounce light (linear radiance), or null. */
  readonly bounce: Node<'vec3'> | null = null;
  /** Exposed radiance spread around what is brighter than white, or null. */
  readonly glow: Node<'vec4'> | null = null;
  private readonly half: HalfDepth | null = null;
  constructor(mode: PostMode, scene: { colour: THREE.Texture; display: THREE.Texture; depth: THREE.DepthTexture }, readonly camera: THREE.PerspectiveCamera, exposure: Node<'float'>) {
    if (mode === 'off') return;
    const colour = texture(scene.colour), display = texture(scene.display);
    // Exposed as the tone mapper sees it, minus the threshold with a soft knee, so a halo's core blooms and not its whole disc.
    const exposed = colour.rgb.mul(exposure).mul(display.r.oneMinus()), level = luminance(exposed);
    this.glow = bloom(vec4(exposed.mul(min(max(level.sub(BLOOM.threshold), 0), BLOOM.cap).div(max(level, 1e-4))), 1), BLOOM.strength, BLOOM.radius, 0) as unknown as Node<'vec4'>;
    this.half = new HalfDepth(scene.depth, camera);
    const depth = texture(this.half.target.depthTexture!), normal = texture(this.half.target.texture);
    if (mode === 'gi') {
      const gi = ssgi(colour, depth, normal, camera); gi.useTemporalFiltering = false; gi.sliceCount.value = 2; gi.stepCount.value = 6;
      this.occlusion = gi.getAONode().r as unknown as Node<'float'>; this.bounce = gi.getGINode().rgb as unknown as Node<'vec3'>;
      return;
    }
    const occlusion = new HalfResolutionAO(depth, normal, camera); occlusion.resolutionScale = .5;
    occlusion.radius.value = AO.radius; occlusion.thickness.value = AO.thickness; occlusion.samples.value = AO.samples; occlusion.scale.value = AO.power;
    // The raw AO is per-pixel noise; an edge-aware blur at the same half resolution, kept in an 8-bit target, smooths it.
    this.occlusion = rtt(denoise(occlusion.getTextureNode(), depth, normal, camera), null, null, { resolutionScale: .5, type: THREE.UnsignedByteType, format: THREE.RedFormat }).r as unknown as Node<'float'>;
  }
  /** Before the output pass, for frames that apply occlusion: the half-resolution depth and normals it reads. */
  prepare(renderer: THREE.WebGPURenderer): void { this.half?.render(renderer); }
}
