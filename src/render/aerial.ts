// Aerial perspective for the walking view on the gpu and mobile tiers (sub-plan 21), as the scene's fogNode: in linear light,
// before tone mapping, so near trees keep their colour, the middle distance gains gentle depth and far shapes fade into whatever
// stands behind them rather than into one pale haze colour. Two parts:
//  - inscatter from a thin exponential atmosphere whose density falls off with height, so valley floors haze more than hillsides,
//    with blue extinguished a little faster than red, so distance turns slightly blue. Its colour is the sky's own radiance along
//    the view ray, from a small, blurred bake of the sky (sky.ts `haze`) whose lower half repeats the horizon;
//  - a horizon fade that completes the fog at the tier's full-fog distance (GraphicsProfile.fog), where the walk camera's far plane
//    stops. It fades toward what the distant pass drew behind the fragment (the sky, and the ranges in their valley mist, sub-plan
//    26), so a fully hazed surface is exactly the view without it: a far tree or the Enhancement hill no longer stands as a pale
//    cut-out of horizon haze in front of the darker ranges. OutputPipeline turns that on only for the town drawn over its distant
//    pass; without one (probe bakes, ?ridges=classic) the fade goes to the blurred sky, whose low rays settle on the horizon haze.
// The cpu tier keeps cheap linear fog and the map its range fog, both in the output pass (render/output.ts); there `on` is 0.
import * as THREE from 'three';
import { Fn, cameraPosition, cubeTexture, exp, float, length, max, min, mix, normalize, output, positionWorld, pow, renderGroup, screenUV, select, smoothstep, texture, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';

export interface Aerial {
  /** Metres of clear air before the haze begins. */
  start: number;
  /** Extinction per metre of the green channel at the valley floor (y = 0). */
  density: number;
  /** Scale height of the haze above the valley floor, metres. */
  falloff: number;
  /** Share of the density that does not thin out with height. */
  floor: number;
  /** Extinction per channel relative to green: blue scatters more, so distance turns slightly blue. */
  tint: readonly [number, number, number];
  /** The horizon fade toward what lies behind begins here, metres, … */
  fade: number;
  /** … and is complete here: the tier's full-fog distance. */
  full: number;
}
/** The fade's smoothstep, raised to this power as a linear-light weight, thins out about as evenly as the classic fog did after sRGB encoding. */
export const FADE_GAMMA = 2.2;
/**
 * The walk view's haze per tier. The fade spans the outer half of the full-fog distance: the tier's (GraphicsProfile.fog) unless
 * `full` gives another, so a view that may see further (a high viewpoint) can pass its own each frame; every part is a uniform.
 */
export function aerialParams(tier: GraphicsTier, full = graphicsProfile(tier).fog): Aerial {
  return { start: 20, density: .0007, falloff: 24, floor: .3, tint: [.88, 1, 1.15], fade: full * .48, full };
}
/**
 * Dev-only `?haze=classic`: the haze of sub-plan 21 as merged, for review. Fully hazed surfaces fade to the blurred sky (the
 * horizon haze low in the view) instead of the distant pass, trees draw until the fog is complete and the Mitoring amber keeps
 * its night hot spots.
 */
export function hazeLook(): 'behind' | 'classic' {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'behind';
  return new URLSearchParams(location.search).get('haze') === 'classic' ? 'classic' : 'behind';
}

/** Mean haze density between heights a and b, relative to the valley floor: the exponential falloff integrated along a straight ray. */
export function heightDensity(a: number, b: number, p: Pick<Aerial, 'falloff' | 'floor'>): number {
  const k = (b - a) / p.falloff, spread = Math.abs(k) < 1e-3 ? 1 - k / 2 : (1 - Math.exp(-k)) / k;
  return p.floor + (1 - p.floor) * Math.exp(-a / p.falloff) * spread;
}
/**
 * Fog per channel (0 clear, 1 entirely haze) for a surface `distance` metres away at height `y`, seen from height `eye`: one
 * minus the share of the surface's own colour that remains. The rest is inscattered sky and, by the fade, what lies behind.
 */
export function aerialFog(distance: number, eye: number, y: number, p: Aerial): [number, number, number] {
  const depth = p.density * Math.max(distance - p.start, 0) * heightDensity(eye, y, p), fade = THREE.MathUtils.smoothstep(distance, p.fade, p.full) ** FADE_GAMMA;
  return p.tint.map(t => 1 - Math.exp(-depth * t) * (1 - fade ** (1 / t))) as [number, number, number];
}

// Render-group uniforms, as three's own fog: shared by every material, refreshed once per render call, never a shader rebuild.
const scalar = (value: number) => uniform(value).setGroup(renderGroup), triple = () => uniform(new THREE.Vector3(1, 1, 1)).setGroup(renderGroup);
const params = {
  on: scalar(0), behind: scalar(0), start: scalar(20), density: scalar(.0007), falloff: scalar(24), floor: scalar(.3), tint: triple(), fadeTint: triple(), fade: scalar(62), full: scalar(130),
};
/** Per-channel transmittance of the haze between the eye and the current fragment: 1 where the air is clear. */
const extinction = Fn(() => {
  const eye = cameraPosition.y, distance = length(positionWorld.sub(cameraPosition));
  const k = positionWorld.y.sub(eye).div(params.falloff), safe = select(k.greaterThanEqual(0), max(k, 1e-3), min(k, -1e-3));
  const density = params.floor.add(float(1).sub(params.floor).mul(exp(eye.negate().div(params.falloff))).mul(float(1).sub(exp(safe.negate())).div(safe)));
  return exp(params.tint.mul(params.density.mul(max(distance.sub(params.start), 0)).mul(density)).negate());
})() as unknown as Node<'vec3'>;
/** Per-channel horizon fade of the current fragment: 0 near, 1 at the full-fog distance. */
const fade = Fn(() => pow(vec3(pow(smoothstep(params.fade, params.full, length(positionWorld.sub(cameraPosition))), FADE_GAMMA)), params.fadeTint))() as unknown as Node<'vec3'>;
/** Per-channel fog factor of the current fragment (aerialFog): how much of its own colour is gone; zero when aerial perspective is off. */
export const aerialFactor = Fn(() => vec3(1).sub(extinction.mul(vec3(1).sub(fade))).mul(params.on))() as unknown as Node<'vec3'>;
// The haze bake is 64 px a face and holds no clouds (sky.ts); mip 3 (8 px, about 11° a texel) keeps the sky's gradient, no detail.
const sky = cubeTexture(new THREE.CubeTexture(), normalize(positionWorld.sub(cameraPosition)), float(3));
/** The sky's radiance behind the current fragment, blurred: the colour of the air's inscattered light. */
export const aerialSky = sky.rgb as unknown as Node<'vec3'>;

/**
 * The distant pass's frame as the radiance the output pass shows for it (sky, ranges, their mist; render/output.ts fills it
 * between that pass and the town's): what a fully hazed town surface becomes, so the town meets the ranges in one colour.
 */
export const AERIAL_BEHIND = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
AERIAL_BEHIND.texture.name = 'aerial.behind';
// Level 0 explicitly: the fog runs after alpha tests, where an implicit-derivative sample would leave uniform control flow.
const drawnBehind = texture(AERIAL_BEHIND.texture, screenUV, float(0));
/**
 * What a fully hazed surface fades into: in front of the ranges (AERIAL_BEHIND's alpha, from the distant pass's depth) exactly
 * what that pass drew; in front of sky the blurred haze bake, the clear sky's gradient without clouds. Fading into the pass's sharp
 * cumulus, tall rock 100–130 m away (the north ridge's crags) read as translucent, clouds through the cliff (sub-plan 27, round 3).
 */
const behind = mix(aerialSky, drawnBehind.rgb, drawnBehind.a) as unknown as Node<'vec3'>;
/** What a fully hazed surface becomes: what the distant pass drew behind it, or without that pass the blurred sky. */
export const aerialTarget = select(params.behind.greaterThan(.5), behind, aerialSky) as unknown as Node<'vec3'>;
/** Haze a colour: the inscatter toward `air`, then the horizon fade toward `target`, both given in the colour's own space. */
export const aerialMix = (colour: Node<'vec3'>, air: Node<'vec3'>, target: Node<'vec3'>): Node<'vec3'> =>
  mix(mix(colour, air, vec3(1).sub(extinction).mul(params.on)), target, fade.mul(params.on)) as unknown as Node<'vec3'>;
/** scene.fogNode on the gpu and mobile tiers: every fogged material hazes before the output pass tone-maps it. */
export const aerialFogNode = Fn(() => vec4(aerialMix(output.rgb, aerialSky, aerialTarget), output.a))();

/** Point the haze at a phase's blurred sky (sky.ts `haze`, or any cube where `on` stays 0), and switch it on with a tier's parameters or off. */
export function setAerial(haze: THREE.CubeTexture, aerial: Aerial | null): void {
  sky.value = haze; params.on.value = aerial ? 1 : 0;
  if (!aerial) return;
  params.start.value = aerial.start; params.density.value = aerial.density; params.falloff.value = aerial.falloff; params.floor.value = aerial.floor;
  params.tint.value.set(...aerial.tint); params.fadeTint.value.set(...aerial.tint.map(t => 1 / t) as [number, number, number]);
  params.fade.value = aerial.fade; params.full.value = aerial.full;
}
/**
 * Fade toward AERIAL_BEHIND (on) or the blurred sky (off). The output pipeline turns it on only around the town's draw over a
 * freshly filled distant pass and off again, so probe bakes and every other render keep the sky.
 */
export function setAerialBehind(on: boolean): void { params.behind.value = on ? 1 : 0; }
