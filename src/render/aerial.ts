// Aerial perspective for the walking view on the gpu and mobile tiers (sub-plan 21), as the scene's fogNode: in linear light,
// before tone mapping, toward the sky's own radiance along each view ray, so near trees keep their colour, the middle distance
// gains gentle depth and far hills fade into the sky behind them rather than into one pale haze colour. Two parts:
//  - inscatter from a thin exponential atmosphere whose density falls off with height, so valley floors haze more than hillsides,
//    with blue extinguished a little faster than red, so distance turns slightly blue;
//  - a horizon fade that completes the fog at the tier's full-fog distance (GraphicsProfile.fog), where the walk camera's far plane
//    and the forest's tree culling stop: nothing disappears before it is entirely sky.
// The fog colour samples a small, blurred bake of the sky (sky.ts `haze`) whose lower half repeats the horizon, so rays toward the
// ground fade to the horizon haze rather than to the baked ground. The cpu tier keeps cheap linear fog and the map its range fog,
// both in the output pass (render/output.ts); there `on` is 0.
import * as THREE from 'three';
import { Fn, cameraPosition, cubeTexture, exp, float, length, max, min, mix, normalize, output, positionWorld, pow, renderGroup, select, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
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
  /** The horizon fade toward the sky begins here, metres, … */
  fade: number;
  /** … and is complete here: the tier's full-fog distance. */
  full: number;
}
/** The fade's smoothstep, raised to this power as a linear-light weight, thins out about as evenly as the classic fog did after sRGB encoding. */
export const FADE_GAMMA = 2.2;
/** The walk view's haze per tier. The fade spans the outer half of the full-fog distance. */
export function aerialParams(tier: GraphicsTier): Aerial {
  const full = graphicsProfile(tier).fog;
  return { start: 20, density: .0007, falloff: 24, floor: .3, tint: [.88, 1, 1.15], fade: full * .48, full };
}

/** Mean haze density between heights a and b, relative to the valley floor: the exponential falloff integrated along a straight ray. */
export function heightDensity(a: number, b: number, p: Pick<Aerial, 'falloff' | 'floor'>): number {
  const k = (b - a) / p.falloff, spread = Math.abs(k) < 1e-3 ? 1 - k / 2 : (1 - Math.exp(-k)) / k;
  return p.floor + (1 - p.floor) * Math.exp(-a / p.falloff) * spread;
}
/** Fog per channel (0 clear, 1 entirely sky) for a surface `distance` metres away at height `y`, seen from height `eye`. */
export function aerialFog(distance: number, eye: number, y: number, p: Aerial): [number, number, number] {
  const depth = p.density * Math.max(distance - p.start, 0) * heightDensity(eye, y, p), fade = THREE.MathUtils.smoothstep(distance, p.fade, p.full) ** FADE_GAMMA;
  return p.tint.map(t => 1 - Math.exp(-depth * t) * (1 - fade ** (1 / t))) as [number, number, number];
}

// Render-group uniforms, as three's own fog: shared by every material, refreshed once per frame, never a shader rebuild.
const scalar = (value: number) => uniform(value).setGroup(renderGroup), triple = () => uniform(new THREE.Vector3(1, 1, 1)).setGroup(renderGroup);
const params = {
  on: scalar(0), start: scalar(20), density: scalar(.0007), falloff: scalar(24), floor: scalar(.3), tint: triple(), fadeTint: triple(), fade: scalar(72), full: scalar(150),
};
/** Per-channel fog factor of the current fragment; zero when aerial perspective is off. */
export const aerialFactor = Fn(() => {
  const eye = cameraPosition.y, distance = length(positionWorld.sub(cameraPosition));
  const k = positionWorld.y.sub(eye).div(params.falloff), safe = select(k.greaterThanEqual(0), max(k, 1e-3), min(k, -1e-3));
  const density = params.floor.add(float(1).sub(params.floor).mul(exp(eye.negate().div(params.falloff))).mul(float(1).sub(exp(safe.negate())).div(safe)));
  const depth = params.density.mul(max(distance.sub(params.start), 0)).mul(density);
  const fade = pow(smoothstep(params.fade, params.full, distance), FADE_GAMMA);
  return vec3(1).sub(exp(params.tint.mul(depth).negate()).mul(vec3(1).sub(pow(vec3(fade), params.fadeTint)))).mul(params.on);
})() as unknown as Node<'vec3'>;
// The haze bake is 64 px a face; mip 3 (8 px, about 11° a texel) keeps the sky's gradient and cloud banks but no detail.
const sky = cubeTexture(new THREE.CubeTexture(), normalize(positionWorld.sub(cameraPosition)), float(3));
/** The sky's radiance behind the current fragment, blurred: what a fully fogged surface becomes. */
export const aerialSky = sky.rgb as unknown as Node<'vec3'>;
/** scene.fogNode on the gpu and mobile tiers: every fogged material mixes toward the sky before the output pass tone-maps it. */
export const aerialFogNode = Fn(() => vec4(mix(output.rgb, aerialSky, aerialFactor), output.a))();

/** Point the haze at a phase's blurred sky (sky.ts `haze`, or any cube where `on` stays 0), and switch it on with a tier's parameters or off. */
export function setAerial(haze: THREE.CubeTexture, aerial: Aerial | null): void {
  sky.value = haze; params.on.value = aerial ? 1 : 0;
  if (!aerial) return;
  params.start.value = aerial.start; params.density.value = aerial.density; params.falloff.value = aerial.falloff; params.floor.value = aerial.floor;
  params.tint.value.set(...aerial.tint); params.fadeTint.value.set(...aerial.tint.map(t => 1 / t) as [number, number, number]);
  params.fade.value = aerial.fade; params.full.value = aerial.full;
}
