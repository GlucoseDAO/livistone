import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { GARDEN_BRIDGES, TIME_TOWER, waterDistance } from './waterways';
import { stationClearing } from './station-layout';
import { gatewayClearing } from './gateway-layout';
import { glucoseClearing } from './glucose-layout';
import { gardenClearing } from './living-waters-layout';
import { futureClearing } from './elevated-layout';


// Reserved for future authored homes; the white dome placeholders have been removed.
export const HOME_SITES: number[][] = [];
export const PATH_WIDTH = 2.6;
const routes = [
  [[-29, 4], [-44, 2], [-46, -8], [-47.9, -12]],
  [[-66.1, -12], [-73, -17], [-78, -32], [-72, -43]],
  [[41, -8], [45, -10], [47.9, -12]],
  [[66.1, -12], [75, -18], [80, -34], [73, -44]],
  [[17, -31], [17, -35], [17, -39]],
  [[-9, -27], [0, -35], [10, -35], [17, -31], [28, -35]],
  [[0, 12], [2, 5], [-2, -4], [0, -14]],
  [[0, 7], [-10, 11], [-23, 10], [-30, 5], [-29, -3.5]],
  [[0, 7], [13, 12], [24, 9], [30, 3], [29, -6]],
  [[-29, 4], [-16, 1], [0, -10], [17, 0], [29, 2]],
  [[0, 40], [0, 49], [0, 58], [0, 64]],
  [[0, 49], [-12, 54], [-24, 56]],
  [[0, 49], [12, 54], [24, 56]],
  [[28, -35], [31, -29], [38, -28], [38, -31]],
  [[38, -49], [35, -52], [27, -56]],
  [[-9, -27], [-22, -32], [-27, -43], [-23, -54]],
  [[29, 2], [41, -8], [45, -28], [28, -35], [26, -47], [38, -52]],
];
export const PATH_CURVES = routes.map((path) => new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, .065, z))));
const pathSamples = PATH_CURVES.map((curve) => curve.getPoints(160));

/** Reserve the whole plant footprint, not just its stem, along the rendered routes. */
export function plantingAllowed(x: number, z: number, radius: number): boolean {
  if (futureClearing(x, z, radius)) return false;
  if (waterDistance(x, z) < radius + .35) return false;
  if (Math.hypot(x - TIME_TOWER.x, z - TIME_TOWER.z) < TIME_TOWER.radius + radius) return false;
  if (GARDEN_BRIDGES.some((b) => Math.abs(z - b.z) < 2 + radius && Math.abs(x - b.x) < 10 + radius)) return false;
  if (gardenClearing(x, z, radius) || stationClearing(x, z, radius) || gatewayClearing(x, z, radius) || glucoseClearing(x, z, radius)) return false;
  if (Math.abs(x) < 3.25 + radius && z > 11 - radius && z < 44 + radius) return false;
  for (const l of CIVIC_LANDMARKS) {
    const sx = 1 + (l.stretch.x - 1) * .85, sz = 1 + (l.stretch.z - 1) * .85;
    if (Math.hypot((x - l.x) / sx, (z - l.z) / sz) < 10.8 + radius / Math.min(sx, sz)) return false;
    if (Math.abs(x - l.x) < 3.3 + radius && z > l.z && z < l.z + 20 + radius) return false;
  }
  return !pathSamples.some((path) => path.some((p) => Math.hypot(p.x - x, p.z - z) < PATH_WIDTH / 2 + .3 + radius));
}
