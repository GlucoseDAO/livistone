import * as THREE from 'three';
import type { GraphicsTier } from '../game/graphics';

/** Review variants (docs/realism/04-river-water.md): a = clear shallow stream, b = deeper green garden river. */
export type WaterLook = 'a' | 'b';
/** The owner chose the deeper look b (3 Oct 2026); dev-only `?look=a` keeps the clear stream for re-review once the riverbed exists (sub-plan 14). */
export function waterLook(): WaterLook {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'b';
  return new URLSearchParams(location.search).get('look') === 'a' ? 'a' : 'b';
}

interface Optics {
  /** Effective extinction per metre of light path (red, green, blue), absorption plus out-scatter. */
  absorption: [number, number, number];
  /** Inscattered body colour over a shallow bed and in deep water (sRGB). */
  shallow: string; deep: string;
  /** Least share of the bed the water body veils once it is a quarter of a metre deep. */
  tint: number;
  /** Depth in metres over which the shoreline fades in. */
  shore: number;
  /** Surface drift in m/s, ripple slope gain, foam amount and base roughness. */
  speed: number; ripple: number; foam: number; roughness: number;
}
const LOOKS: Record<WaterLook, Optics> = {
  a: { absorption: [.55, .3, .34], shallow: '#a08452', deep: '#1f5a55', tint: .3, shore: .22, speed: .55, ripple: 1, foam: .75, roughness: .07 },
  b: { absorption: [1.2, .62, .78], shallow: '#7a7146', deep: '#21493b', tint: .38, shore: .3, speed: .3, ripple: .55, foam: .35, roughness: .05 },
};
const luminance = ([r, g, b]: [number, number, number]): number => r * .2126 + g * .7152 + b * .0722;

/** CPU tier: no transparency, so bake the same depth absorption into vertex colours, from wet bank to deep body. */
export function cpuWaterColour(look: WaterLook = waterLook()): (depth: number, rock: number) => THREE.Color {
  const optics = LOOKS[look], bank = new THREE.Color('#5f6544'), shallow = new THREE.Color(optics.shallow), foam = new THREE.Color('#c9cdc4');
  // No environment reflection on this tier: lift the deep body a little toward the sky colour instead.
  const deep = new THREE.Color(optics.deep).lerp(new THREE.Color('#9dbcc6'), .22), extinction = luminance(optics.absorption);
  return (depth, rock) => {
    const cover = 1 - Math.exp(-extinction * depth * 5);
    return bank.clone().lerp(shallow, THREE.MathUtils.smoothstep(depth, 0, optics.shore) * .5).lerp(deep, cover).lerp(foam, rock * optics.foam * .35);
  };
}

// Small self-contained GLSL helpers, so a later WebGPU/TSL port can translate them one by one.
const WATER_GLSL = /* glsl */`
uniform float waterTime;
uniform sampler2D waterRipples;
uniform vec3 waterAbsorption;
uniform vec3 waterShallow;
uniform vec3 waterDeep;
uniform vec4 waterMotion; // x drift m/s, y ripple gain, z foam amount, w shoreline fade depth (m)
uniform float waterTint;
varying vec2 vWaterFlow;
varying float vWaterAlong;
varying float vWaterAcross;
varying float vWaterDepth;
varying float vWaterRock;
varying vec3 vWaterWorld;
// Two-phase flow map: the tile drifts along flow; each phase restarts while its weight is zero.
// In channel coordinates (along, across) flow is simply (1, 0), so stretched ripples follow every bend.
vec3 waterFlowSample(vec2 p, vec2 flow, float drift, float phase, vec2 scale, vec2 shift) {
  float a = fract(phase), b = fract(phase + .5), w = abs(1. - 2. * a);
  vec3 first = texture2D(waterRipples, (p - flow * drift * (a - .5)) * scale + shift).rgb;
  vec3 second = texture2D(waterRipples, (p - flow * drift * (b - .5)) * scale + shift + vec2(.37, .61)).rgb;
  return mix(first, second, w);
}
// The map stores unit-normal x/y; return the surface slope (-dh/du, -dh/dv).
vec2 waterSlope(vec3 texel) {
  vec2 n = texel.rg * 2. - 1.;
  return n / sqrt(max(1. - dot(n, n), .04));
}
// Beer-Lambert: down to a bed depth metres below and back up the refracted view ray (water ior 1.333).
vec3 waterTransmittance(float depth, float cosView, vec3 absorption) {
  float cosRefracted = sqrt(1. - (1. - cosView * cosView) / 1.777);
  return exp(-absorption * depth * (1. + 1. / cosRefracted));
}
float waterFresnel(float cosView) { return .02 + .98 * pow(1. - cosView, 5.); }
// Noise is equalised, so a threshold at 1 - cover keeps roughly cover of the surface.
float waterFoam(float noise, float depth, float rock, float amount) {
  float edge = smoothstep(.0, .03, depth) * (1. - smoothstep(.03, .4, depth));
  float cover = clamp(amount * (edge * .6 + rock * .85), 0., .92);
  // Soft, partly see-through foam: it never fully hides the water beneath.
  return smoothstep(1. - cover, 1. - cover + .2, noise) * smoothstep(.0, .06, cover) * .7;
}
`;

/**
 * River water. gpu: two flow-map ripple scales, depth absorption, soft transparent shoreline, Fresnel sky reflection,
 * sun glint from the scene's own lights, and foam along the waterline and round rocks. mobile: one ripple scale and
 * the cheaper single-sample foam. cpu: opaque Lambert reading vertex colours baked by `cpuWaterColour`.
 * The surface geometry must carry `flow`, `along`, `depth` and `rock` (see water-surface.ts).
 */
export function waterMaterial(tier: GraphicsTier, opts: { look?: WaterLook } = {}): THREE.Material {
  const look = opts.look ?? waterLook(), optics = LOOKS[look], time = { value: 0 };
  if (tier === 'cpu') {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true }); material.name = 'River water';
    material.userData.time = time; return material;
  }
  const mobile = tier === 'mobile';
  const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: optics.roughness, metalness: 0, ior: 1.333, envMapIntensity: 1, transparent: true, depthWrite: false });
  material.name = 'River water';
  // heroEnv: sub-plan 02 gives tagged materials an explicit envMap so their own envMapIntensity applies.
  material.userData.time = time; material.userData.heroEnv = true;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1); flat.needsUpdate = true;
  const ripples = { value: flat as THREE.Texture };
  // Loading needs the DOM; skipping it keeps the material constructible in Vitest.
  if (typeof document !== 'undefined') new THREE.TextureLoader().load(import.meta.env.BASE_URL + `textures/water/ripples-${mobile ? 256 : 512}.webp`, (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.flipY = false; texture.anisotropy = mobile ? 2 : 4;
    ripples.value = texture; flat.dispose();
  }, undefined, () => { /* Flat water without ripples or foam stays readable if the map fails. */ });
  const uniforms = {
    waterTime: time, waterRipples: ripples, waterTint: { value: optics.tint },
    waterAbsorption: { value: new THREE.Vector3(...optics.absorption) },
    waterShallow: { value: new THREE.Color(optics.shallow) }, waterDeep: { value: new THREE.Color(optics.deep) },
    waterMotion: { value: new THREE.Vector4(optics.speed, optics.ripple, optics.foam, optics.shore) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 flow;
      attribute float along;
      attribute float across;
      attribute float depth;
      attribute float rock;
      varying vec2 vWaterFlow;
      varying float vWaterAlong;
      varying float vWaterAcross;
      varying float vWaterDepth;
      varying float vWaterRock;
      varying vec3 vWaterWorld;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vWaterFlow = flow; vWaterAlong = along; vWaterAcross = across; vWaterDepth = depth; vWaterRock = rock;
      vWaterWorld = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n#define WATER_LAYERS ${mobile ? 1 : 2}\n${WATER_GLSL}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 waterView = normalize(cameraPosition - vWaterWorld);
      vec2 waterDir = normalize(vWaterFlow + vec2(1e-5, 0.));
      // Slower over the shallow banks than in mid-channel.
      float waterDrift = waterMotion.x * mix(.35, 1., smoothstep(.0, 1.1, vWaterDepth)) * 2.2;
      float waterPhase = waterTime / 2.2 + vWaterAlong * .031;
      vec2 waterSide = vec2(-waterDir.y, waterDir.x);
      // Long ripples in channel space: 6.5 m along the flow, 2.6 m across, so gentler slopes along it.
      vec3 waterA = waterFlowSample(vec2(vWaterAlong, vWaterAcross), vec2(1., 0.), waterDrift, waterPhase, vec2(1. / 6.5, 1. / 2.6), vec2(0.));
      vec2 waterSlopeA = waterSlope(waterA);
      vec2 waterGradient = (waterDir * waterSlopeA.x * .4 + waterSide * waterSlopeA.y) * (WATER_LAYERS > 1 ? .5 : .62);
      float waterNoise = waterA.b;
      #if WATER_LAYERS > 1
        // Fine isotropic chop in world space: continuous through confluences, where channel coordinates bend.
        vec3 waterB = waterFlowSample(vWaterWorld.xz, waterDir, waterDrift * 1.25, waterPhase * 1.37 + .21, vec2(1. / 1.27), vec2(.13, .71));
        waterGradient += waterSlope(waterB) * .3;
        waterNoise = waterB.b;
      #endif
      // Rocks stir the surface; far ripples settle so distant water reads as a sky mirror instead of aliasing.
      waterGradient *= waterMotion.y * (1. + vWaterRock * .7) * mix(1., .4, smoothstep(25., 140., distance(cameraPosition, vWaterWorld)));
      vec3 waterNormal = normalize(vec3(waterGradient.x, 1., waterGradient.y));
      normal = normalize((viewMatrix * vec4(waterNormal, 0.)).xyz);
      float waterFres = waterFresnel(clamp(dot(waterNormal, waterView), 0., 1.));
      float waterSeen = dot(waterTransmittance(vWaterDepth, clamp(waterView.y, 0., 1.), waterAbsorption), vec3(.2126, .7152, .0722));
      float waterCover = max(1. - waterSeen, waterTint * smoothstep(.0, .25, vWaterDepth));
      float waterFoamCover = waterFoam(waterNoise, vWaterDepth, vWaterRock, waterMotion.z);
      diffuseColor.rgb = mix(mix(waterShallow, waterDeep, smoothstep(.0, .85, 1. - waterSeen)), vec3(.6, .63, .6), waterFoamCover);
      roughnessFactor = mix(roughnessFactor, .75, waterFoamCover);`);
    // Blend as (reflection + body) over the bed: alpha is the share of the bed the eye no longer sees.
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float waterShore = smoothstep(.0, waterMotion.w, vWaterDepth);
      vec3 waterGloss = totalSpecular * (1. - waterFoamCover);
      vec3 waterBody = totalDiffuse * mix((1. - waterFres) * waterCover, 1., waterFoamCover);
      vec3 waterLight = (waterGloss + waterBody) * mix(waterShore, 1., waterFoamCover) + totalEmissiveRadiance;
      float waterAlpha = mix((1. - (1. - waterFres) * (1. - waterCover)) * waterShore, 1., waterFoamCover);
      // A sun glint brighter than the bed covers it, instead of being diluted by a low alpha.
      waterAlpha = clamp(max(waterAlpha, min(1., max(max(waterGloss.r, waterGloss.g), waterGloss.b)) * waterShore), 0., 1.);
      gl_FragColor = vec4(waterLight / max(waterAlpha, .002), waterAlpha);`);
  };
  material.customProgramCacheKey = () => `livistone-water-v1-${tier}-${look}`;
  return material;
}
