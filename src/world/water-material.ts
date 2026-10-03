import * as THREE from 'three';
import { Fn, abs, attribute, cameraPosition, cameraViewMatrix, clamp, color, cos, diffuseColor, distance, dot, exp, float, fract, max, min, mix, normalView, normalize, positionLocal, positionWorld, pow, property, sin, smoothstep, sqrt, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { PhysicalLightingModel } from 'three/webgpu';
import type { Node, NodeBuilder } from 'three/webgpu';
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

// Small self-contained node helpers, one per former GLSL function.
type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;
const LUMA = vec3(.2126, .7152, .0722);
// Two-phase flow map: the tile drifts along flow; each phase restarts while its weight is zero.
// In channel coordinates (along, across) flow is simply (1, 0), so stretched ripples follow every bend.
function flowSample(ripples: ReturnType<typeof texture>, p: V2, flow: V2, drift: F, phase: F, scale: V2, shift: V2): V3 {
  const a = fract(phase), b = fract(phase.add(.5)), w = abs(float(1).sub(a.mul(2)));
  const at = (uv: V2): V3 => (ripples.sample(uv) as unknown as Node<'vec4'>).rgb;
  const first = at(p.sub(flow.mul(drift).mul(a.sub(.5))).mul(scale).add(shift)), second = at(p.sub(flow.mul(drift).mul(b.sub(.5))).mul(scale).add(shift).add(vec2(.37, .61)));
  return mix(first, second, w);
}
// The map stores unit-normal x/y; return the surface slope (-dh/du, -dh/dv).
const slope = (texel: V3): V2 => { const n = texel.xy.mul(2).sub(1); return n.div(sqrt(max(float(1).sub(dot(n, n)), .04))); };
// Beer-Lambert: down to a bed depth metres below and back up the refracted view ray (water ior 1.333).
const transmittance = (depth: F, cosView: F, absorption: V3): V3 => {
  const cosRefracted = sqrt(float(1).sub(float(1).sub(cosView.mul(cosView)).div(1.777)));
  return exp(absorption.negate().mul(depth).mul(float(1).add(float(1).div(cosRefracted))));
};
const fresnel = (cosView: F): F => float(.02).add(pow(float(1).sub(cosView), 5).mul(.98));
// Noise is equalised, so a threshold at 1 - cover keeps roughly cover of the surface.
const foamCover = (noise: F, depth: F, rock: F, amount: number): F => {
  const edge = smoothstep(0, .03, depth).mul(float(1).sub(smoothstep(.03, .4, depth)));
  const cover = clamp(edge.mul(.6).add(rock.mul(.85)).mul(amount), 0, .92);
  // Soft, partly see-through foam: it never fully hides the water beneath.
  return smoothstep(float(1).sub(cover), float(1.2).sub(cover), noise).mul(smoothstep(0, .06, cover)).mul(.7);
};

// Values the surface stage computes once and the output stage reuses; each water shader declares its own copies.
const WATER = { normal: property('vec3', 'waterNormal'), fresnel: property('float', 'waterFresnel'), cover: property('float', 'waterCover'), foam: property('float', 'waterFoam'), shore: property('float', 'waterShore') };

/** Blends as (reflection + body) over the bed: alpha is the share of the bed the eye no longer sees. */
class WaterLighting extends PhysicalLightingModel {
  finish(builder: NodeBuilder): void {
    super.finish(builder);
    const { outgoingLight } = builder.context as unknown as { outgoingLight: V3 }, lights = (builder as unknown as { lightsNode: { totalDiffuseNode: V3; totalSpecularNode: V3 } }).lightsNode;
    const gloss = lights.totalSpecularNode.mul(WATER.foam.oneMinus()).toVar(), body = lights.totalDiffuseNode.mul(mix(WATER.fresnel.oneMinus().mul(WATER.cover), 1, WATER.foam));
    const alpha = mix(float(1).sub(WATER.fresnel.oneMinus().mul(WATER.cover.oneMinus())).mul(WATER.shore), 1, WATER.foam).toVar();
    // A sun glint brighter than the bed covers it, instead of being diluted by a low alpha.
    alpha.assign(clamp(max(alpha, min(1, max(max(gloss.x, gloss.y), gloss.z)).mul(WATER.shore)), 0, 1));
    outgoingLight.assign(gloss.add(body).mul(mix(WATER.shore, 1, WATER.foam)).div(max(alpha, .002)));
    diffuseColor.a.assign(alpha);
  }
}
class WaterNodeMaterial extends THREE.MeshPhysicalNodeMaterial {
  setupLightingModel(): WaterLighting { return new WaterLighting(); }
}

/**
 * River water. gpu: two flow-map ripple scales, depth absorption, soft transparent shoreline, Fresnel sky reflection,
 * sun glint from the scene's own lights, and foam along the waterline and round rocks. mobile: one ripple scale and
 * the cheaper single-sample foam. cpu: opaque Lambert reading vertex colours baked by `cpuWaterColour`.
 * The surface geometry must carry `flow`, `along`, `depth` and `rock` (see water-surface.ts).
 */
export function waterMaterial(tier: GraphicsTier, opts: { look?: WaterLook } = {}): THREE.Material {
  const look = opts.look ?? waterLook(), optics = LOOKS[look], time = uniform(0);
  if (tier === 'cpu') {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true }); material.name = 'River water';
    material.userData.time = time; return material;
  }
  const mobile = tier === 'mobile';
  const material = new WaterNodeMaterial({ color: '#ffffff', roughness: optics.roughness, metalness: 0, ior: 1.333, envMapIntensity: 1, transparent: true, depthWrite: false });
  material.name = 'River water';
  // heroEnv: sub-plan 02 gives tagged materials an explicit envMap so their own envMapIntensity applies.
  material.userData.time = time; material.userData.heroEnv = true; material.userData.look = look; material.userData.layers = mobile ? 1 : 2;
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1); flat.wrapS = flat.wrapT = THREE.RepeatWrapping; flat.needsUpdate = true;
  const ripples = texture(flat);
  // Loading needs the DOM; skipping it keeps the material constructible in Vitest.
  if (typeof document !== 'undefined') new THREE.TextureLoader().load(import.meta.env.BASE_URL + `textures/water/ripples-${mobile ? 256 : 512}.webp`, (map) => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.flipY = false; map.anisotropy = mobile ? 2 : 4;
    ripples.value = map; flat.dispose();
  }, undefined, () => { /* Flat water without ripples or foam stays readable if the map fails. */ });
  const flow = attribute<'vec2'>('flow', 'vec2'), along = attribute<'float'>('along', 'float'), across = attribute<'float'>('across', 'float'), depth = attribute<'float'>('depth', 'float'), rock = attribute<'float'>('rock', 'float');
  // The surface stage: ripples, normal, Fresnel, body cover and foam; diffuse colour is the inscattered body.
  material.colorNode = Fn(() => {
    const world = positionWorld, view = normalize(cameraPosition.sub(world)).toVar(), dir = normalize(flow.add(vec2(1e-5, 0))).toVar();
    // Slower over the shallow banks than in mid-channel.
    const drift = mix(.35, 1, smoothstep(0, 1.1, depth)).mul(optics.speed * 2.2).toVar(), phase = time.div(2.2).add(along.mul(.031)).toVar();
    const side = vec2(dir.y.negate(), dir.x);
    // Long ripples in channel space: 6.5 m along the flow, 2.6 m across, so gentler slopes along it.
    const a = flowSample(ripples, vec2(along, across), vec2(1, 0), drift, phase, vec2(1 / 6.5, 1 / 2.6), vec2(0)).toVar(), slopeA = slope(a);
    const gradient = dir.mul(slopeA.x).mul(.4).add(side.mul(slopeA.y)).mul(mobile ? .62 : .5).toVar(), noise = a.z.toVar();
    if (!mobile) {
      // Fine isotropic chop in world space: continuous through confluences, where channel coordinates bend.
      const b = flowSample(ripples, world.xz, dir, drift.mul(1.25), phase.mul(1.37).add(.21), vec2(1 / 1.27), vec2(.13, .71)).toVar();
      gradient.addAssign(slope(b).mul(.3)); noise.assign(b.z);
    }
    // Rocks stir the surface; far ripples settle so distant water reads as a sky mirror instead of aliasing.
    gradient.mulAssign(rock.mul(.7).add(1).mul(optics.ripple).mul(mix(1, .4, smoothstep(25, 140, distance(cameraPosition, world)))));
    WATER.normal.assign(normalize(vec3(gradient.x, 1, gradient.y)));
    WATER.fresnel.assign(fresnel(clamp(dot(WATER.normal, view), 0, 1)));
    const seen = dot(transmittance(depth, clamp(view.y, 0, 1), vec3(...optics.absorption)), LUMA).toVar();
    WATER.cover.assign(max(float(1).sub(seen), smoothstep(0, .25, depth).mul(optics.tint)));
    WATER.foam.assign(foamCover(noise, depth, rock, optics.foam));
    WATER.shore.assign(smoothstep(0, optics.shore, depth));
    return mix(mix(color(optics.shallow), color(optics.deep), smoothstep(0, .85, float(1).sub(seen))), vec3(.6, .63, .6), WATER.foam);
  })();
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(WATER.normal, 0)).xyz);
  material.roughnessNode = mix(optics.roughness, .75, WATER.foam);
  return material;
}

/**
 * Living Waters' shallow eyes (sub-plan 14, step 4): the river's look on an opaque sheet, since each eye is only a few
 * centimetres deep over the garden floor. Water's own Fresnel (ior 1.333) reflects the sky through heroEnv; vertex colours
 * keep each eye deepest at its centre, toward the river's deep body. Two crossing ripple trains run on `time`, which
 * LivingWaters.update drives from the game clock. Nothing emits, so at night the outer lake stays dark around the lit pavilion.
 * The cpu tier's Lambert copy keeps the colour and vertex colours.
 */
export function lakeWaterMaterial(time: Node<'float'>): THREE.MeshPhysicalNodeMaterial {
  const optics = LOOKS.b;
  const material = new THREE.MeshPhysicalNodeMaterial({ color: '#385c4a', vertexColors: true, metalness: 0, roughness: optics.roughness + .02, ior: 1.333, envMapIntensity: 1 });
  material.name = 'Lake water'; material.userData.heroEnv = true;
  const p = positionLocal.xz, ripple = vec2(sin(p.x.mul(2.8).add(p.y.mul(1.7)).sub(time.mul(.8))), cos(p.y.mul(3.1).sub(p.x.mul(1.4)).sub(time.mul(.6)))).mul(.047);
  material.normalNode = normalize(normalView.add(cameraViewMatrix.mul(vec4(ripple.x, 0, ripple.y, 0)).xyz));
  return material;
}
