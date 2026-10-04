// Screen-space stages between the scene pass and the output pass (realism sub-plan 18). Ambient occlusion grounds corners,
// eaves and feet; a restrained bloom picks up only what is brighter than the tone mapper's white (night halos, neon, lit
// signs, sun glints). OutputPipeline applies both to linear radiance before tone mapping and keeps `display` pixels (paper,
// photographs, captions, signs) exact. Screen-space reflections on the river and lake (sub-plan 15) read the same
// half-resolution depth and normals, into which the water writes its own surface and rippled normal.
import * as THREE from 'three';
import GTAONode from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { Fn, If, clamp, dot, float, getNormalFromDepth, getViewPosition, ivec2, luminance, max, min, mix, normalize, pmremTexture, pow, reflect, rtt, smoothstep, sqrt, texture, textureLoad, textureSize, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { PostMode } from '../game/graphics';

/** Occlusion radius and depth tolerance in metres, GTAO's samples and exponent, and how much of it reaches the lit colour. */
export const AO = { radius: 1.5, thickness: 1.2, samples: 16, power: 1.4, strength: 1 };
/**
 * Bloom gathers exposed radiance above `threshold` (1 shows as about 89% of white), at most `cap` above it per pixel, so a
 * neon tube or the gate's tourmaline glows without washing its neighbours white; `radius` 0 keeps the glow tight.
 */
export const BLOOM = { threshold: 1.2, cap: .6, strength: .5, radius: 0 };
/**
 * Water reflections: hits up to `distance` metres from the water plane, `thickness` metres of depth tolerance, ray steps per
 * half-resolution texel of ray (`quality`), and the water's roughness for the sky they replace.
 */
export const REFLECT = { distance: 100, thickness: .6, quality: Number(new URLSearchParams(location.search).get('rq') ?? .25), roughness: .05, blur: Number(new URLSearchParams(location.search).get('rb') ?? .2), ripple: Number(new URLSearchParams(location.search).get('rr') ?? .06), level: Number(new URLSearchParams(location.search).get('rl') ?? 0) };

/** The water attachment holds a view normal (xy) and the share of the water's colour that is reflection, premultiplied by
 *  the water's alpha, which it keeps in alpha; this returns the rippled view normal from it. */
const waterNormal = (water: Node<'vec4'>): Node<'vec3'> => {
  const xy = water.rg.div(max(water.a, 1e-3)).mul(2).sub(1);
  return vec3(xy, sqrt(max(float(1).sub(dot(xy, xy)), 0))) as unknown as Node<'vec3'>;
};

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
  /** Radiance to add on water: what screen-space reflection found, minus the sky the water already reflects there. */
  readonly reflection: Node<'vec3'> | null = null;
  // The sky lookups the reflection subtracts, one per shader build, kept to follow day and night.
  private readonly skies: { value: THREE.Texture | null }[] = [];
  private readonly half: HalfDepth | null = null;
  constructor(post: { mode: PostMode; reflections: boolean }, scene: { colour: THREE.Texture; display: THREE.Texture; depth: THREE.DepthTexture; water: THREE.Texture | null; environment: THREE.Texture | null }, readonly camera: THREE.PerspectiveCamera, exposure: Node<'float'>) {
    const { mode } = post, reflections = post.reflections && !!scene.water && !!scene.environment;
    if (mode === 'off' && !reflections) return;
    const colour = texture(scene.colour), display = texture(scene.display);
    this.half = new HalfDepth(scene.depth, camera);
    const depth = texture(this.half.target.depthTexture!), normal = texture(this.half.target.texture);
    if (reflections) {
      const water = texture(scene.water!) as unknown as Node<'vec4'>, cover = water.a;
      // Only water pixels trace: SSR discards every pixel whose `metalness` is 0.
      const traced = ssr(colour, depth, normal as unknown as Node<'vec3'>, { camera, metalnessNode: cover.greaterThan(.02).select(float(1), float(0)), roughnessNode: float(REFLECT.blur) });
      traced.resolutionScale = .5; traced.maxDistance.value = REFLECT.distance; traced.thickness.value = REFLECT.thickness; traced.quality.value = REFLECT.quality;
      const hits = traced.getTextureNode(), toWorld = uniform(camera.matrixWorld), fromClip = uniform(camera.projectionMatrixInverse);
      const environment = scene.environment!; (this as any).debugHits = hits; (this as any).debugWater = water; (this as any).debugDepth = depth; (this as any).debugNormal = normal;
      this.reflection = Fn(() => {
        const added = vec3(0).toVar();
        If(cover.greaterThan(.02), () => {
          // Rays leave along the flat surface the depth describes: rippled normals send grazing rays under the water,
          // where they hit the water itself. The ripples then shift where the mirror image is read, as on real water.
          const n = waterNormal(water), flat = normalize(normal.rgb), view = normalize(getViewPosition(uv(), float(.5), fromClip)).toVar();
          const ray = reflect(view, n).toVar(), mirror = reflect(view, flat), traced = hits.sample(uv().add(n.xy.sub(flat.xy).mul(vec2(REFLECT.ripple, -REFLECT.ripple)))).level(float(REFLECT.level));
          // The same sky the water's own material reflects (heroEnv, envMapIntensity 1), so a miss adds nothing.
          const sky = pmremTexture(environment, toWorld.mul(vec4(ray, 0)).xyz, float(REFLECT.roughness)); this.skies.push(sky as unknown as { value: THREE.Texture | null });
          // SSR's mirror path dims each hit by (1 + cos(view, ray)) / 2 and a falloff with height above the water; undo the
          // first and keep the second, which is close to 1 inside REFLECT.distance.
          const found = traced.rgb.div(max(dot(view, mirror).add(1).mul(.5), .25)), hit = smoothstep(0, .5, traced.a);
          const fresnel = float(.02).add(pow(float(1).sub(clamp(dot(n, view.negate()), 0, 1)), 5).mul(.98));
          const dbg = new URLSearchParams(location.search).get('rd');
          if (dbg === 'found') added.assign(found); else if (dbg === 'sky') added.assign(sky); else if (dbg === 'n') added.assign(n.mul(.5).add(.5)); else if (dbg === 'flat') added.assign(flat.mul(.5).add(.5)); else if (dbg === 'share') added.assign(vec3(water.b.div(max(cover, 1e-3)), fresnel.mul(10), hit));
          else added.assign(found.sub(sky).mul(hit).mul(fresnel).mul(water.b.div(max(cover, 1e-3))));
        });
        return added;
      })() as unknown as Node<'vec3'>;
    }
    if (mode === 'off') return;
    // Exposed as the tone mapper sees it, minus the threshold with a soft knee, so a halo's core blooms and not its whole disc.
    const exposed = colour.rgb.mul(exposure).mul(display.r.oneMinus()), level = luminance(exposed);
    this.glow = bloom(vec4(exposed.mul(min(max(level.sub(BLOOM.threshold), 0), BLOOM.cap).div(max(level, 1e-4))), 1), BLOOM.strength, BLOOM.radius, 0) as unknown as Node<'vec4'>;
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
  /** Whether walking frames run the half-resolution stages at all. */
  get walking(): boolean { return !!this.occlusion || !!this.reflection; }
  /** Before the output pass, for walking frames: the half-resolution depth and normals the stages read. */
  prepare(renderer: THREE.WebGPURenderer, environment: THREE.Texture | null): void {
    this.half?.render(renderer);
    // Day and night swap the sky; the reflections subtract the one the water currently shows.
    if (environment) for (const sky of this.skies) if (sky.value !== environment) sky.value = environment;
  }
}
