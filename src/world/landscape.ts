import * as THREE from 'three';
import { LANDMARKS } from '../game/content';

export const HOME_SITES = [[-49, -23], [-38, -40], [-15, -48], [12, -52], [39, -41], [53, -22], [-53, 2], [52, 3], [-24, 52], [24, 52]];
export const PATH_WIDTH = 4.2;
const routes = [
  [[0, 12], [0, 4], [0, -14]],
  [[0, 7], [-13, 5], [-29, 4], [-29, -3.5]],
  [[0, 7], [14, 6], [29, 2], [29, -6]],
  [[-29, 4], [-16, 1], [0, -10], [17, 0], [29, 2]],
  [[0, 40], [0, 49], [-12, 54], [-24, 56]],
  [[0, 49], [12, 54], [24, 56]],
];
export const PATH_CURVES = routes.map((path) => new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, .065, z))));
const pathSamples = PATH_CURVES.map((curve) => curve.getPoints(160));

/** Reserve the whole plant footprint, not just its stem, along the rendered routes. */
export function plantingAllowed(x: number, z: number, radius: number): boolean {
  if (Math.abs(x) < 3.25 + radius && z > 11 - radius && z < 44 + radius) return false;
  if (HOME_SITES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 6.6 + radius)) return false;
  for (const l of LANDMARKS) {
    const sx = 1 + (l.stretch.x - 1) * .85, sz = 1 + (l.stretch.z - 1) * .85;
    if (Math.hypot((x - l.x) / sx, (z - l.z) / sz) < 12.4 + radius / Math.min(sx, sz)) return false;
    if (Math.abs(x - l.x) < 3.3 + radius && z > l.z && z < l.z + 20 + radius) return false;
  }
  return !pathSamples.some((path) => path.some((p) => Math.hypot(p.x - x, p.z - z) < PATH_WIDTH / 2 + .3 + radius));
}
