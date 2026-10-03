import * as THREE from 'three';
import { dot, float, floor, fract, mix, renderGroup, sin, uniform, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * The town's one wind clock, shared by every swaying plant (the near grass field now, foliage in realism sub-plan 17). It
 * follows the game's own elapsed time, which `?capture=1` freezes, never TSL's global `time`, and stands still under
 * prefers-reduced-motion. In the render group, so all materials read one value per frame.
 */
export const windTime = uniform(0).setGroup(renderGroup);
/** Prevailing wind, blowing toward +x+z (unit vector in the ground plane). */
export const WIND_DIRECTION = new THREE.Vector2(.8, .6);

const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
/** Once per frame with the game's elapsed seconds. */
export function updateWind(time: number): void { windTime.value = reducedMotion?.matches ? 0 : time; }

type F = Node<'float'>; type V2 = Node<'vec2'>;
// A sin-free hash (Hoskins) keeps large world coordinates stable, as in ground-material.ts.
const hash = (p: V2): F => { const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); };
const noise = (p: V2): F => {
  const i = floor(p).toVar(), f = fract(p).toVar(), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), u.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x), u.y);
};

/**
 * Horizontal sway of a plant tip at world position `xz`, in metres per metre of height: slow gusts roll across the ground
 * along the wind, and each plant flutters at its own `phase` (0–1). Callers scale it by height and bend.
 */
export function windSway(xz: V2, phase: F): V2 {
  const t = windTime, along = xz.x.mul(WIND_DIRECTION.x).add(xz.y.mul(WIND_DIRECTION.y));
  // Gust fronts about 18 m apart travel downwind at 2.5 m/s; between them the plants lean less.
  const gust = noise(vec2(along.sub(t.mul(2.5)).div(18), xz.x.mul(WIND_DIRECTION.y).sub(xz.y.mul(WIND_DIRECTION.x)).div(26))).toVar();
  const flutter = sin(t.mul(mix(1.7, 2.6, phase)).add(phase.mul(6.2831853)).add(along.mul(.35))).mul(.35);
  const lean = gust.mul(gust).mul(.75).add(.1).add(flutter.mul(gust.mul(.6).add(.4)));
  return vec2(WIND_DIRECTION.x, WIND_DIRECTION.y).mul(lean);
}
