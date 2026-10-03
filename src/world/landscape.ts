import { introductionClearing } from './introduction-layout';
import { enhancementClearing } from './enhancement-layout';
import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { GARDEN_BRIDGES, TIME_TOWER, waterDistance } from './waterways';
import { stationClearing } from './station-layout';
import { gatewayClearing } from './gateway-layout';
import { glucoseClearing } from './glucose-layout';
import { gardenFootprint, gardenPathNear } from './living-waters-layout';
import { futureClearing } from './elevated-layout';


// Reserved for future authored homes; the white dome placeholders have been removed.
export const HOME_SITES: number[][] = [];
export { PATH_WIDTH } from './path-surface';
import { PATH_WIDTH } from './path-surface';
const routes = [
  [[100, -154.617], [108, -159], [112, -170], [111, -178]],
  [[74, -135], [89, -142], [98, -149], [100, -154.617]],
  [[-29, 4], [-44, 2], [-46, -8], [-47.9, -12]],
  [[-66.1, -12], [-73, -17], [-78, -32], [-72, -43], [-66, -65], [-54, -83], [-44, -94]],
  [[41, -8], [45, -10], [47.9, -12]],
  [[66.1, -12], [75, -18], [80, -34], [73, -44], [62, -50], [59, -62], [47, -64], [38, -52]],
  [[17, -31], [17, -35], [17, -39]],
  [[-9, -27], [0, -35], [10, -35], [17, -31], [28, -35]],
  [[0, 12], [2, 5], [-2, -4], [0, -14]],
  [[0, 7], [-10, 11], [-23, 10], [-30, 5], [-29, -3.5]],
  [[0, 7], [13, 12], [24, 9], [30, 3], [29, -6]],
  [[-29, 4], [-16, 1], [0, -10], [17, 0], [29, 2]],
  [[0, 40], [0, 49], [0, 58], [0, 64]],
  [[0, 49], [-12, 54], [-24, 56], [-26, 60]],
  [[28, -35], [31, -29], [38, -25], [38, -31]],
  [[38, -49], [38, -52]],
  [[-9, -27], [-22, -32], [-27, -43], [-23, -54]],
  [[29, 2], [41, -8], [45, -28], [28, -35], [26, -47], [38, -52]],
];
export const PATH_CURVES = routes.map((path) => new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, .13, z))));
const pathSamples = PATH_CURVES.map((curve) => curve.getPoints(160));
// The same route samples, binned into 8 m cells: a clearance query scans the nearby cells instead of every route.
const PATH_CELL = 8, pathBins = new Map<number, THREE.Vector3[]>(), pathKey = (i: number, j: number): number => (i + 512) * 1024 + j + 512;
for (const p of pathSamples.flat()) { const key = pathKey(Math.floor(p.x / PATH_CELL), Math.floor(p.z / PATH_CELL)), bin = pathBins.get(key); if (bin) bin.push(p); else pathBins.set(key, [p]); }
function nearRoute(x: number, z: number, reach: number): boolean {
  const k = Math.ceil(reach / PATH_CELL), ci = Math.floor(x / PATH_CELL), cj = Math.floor(z / PATH_CELL);
  for (let i = ci - k; i <= ci + k; i++) for (let j = cj - k; j <= cj + k; j++) for (const p of pathBins.get(pathKey(i, j)) ?? []) if (Math.hypot(p.x - x, p.z - z) < reach) return true;
  return false;
}
/** Routes keep this much clear ground beyond their centreline, plus the plant's own radius. */
export const PATH_CLEARANCE = PATH_WIDTH / 2 + .3;
/** Water keeps this much clear bank, plus the plant's own radius. */
export const WATER_CLEARANCE = .35;

/** Reserve the whole plant footprint, not just its stem, along the rendered routes. */
export function plantingAllowed(x: number, z: number, radius: number): boolean {
  return waterDistance(x, z) >= radius + WATER_CLEARANCE && layoutAllows(x, z, radius);
}
/** Every authored clearance except the water itself: routes, bridges, the tower and the civic, station, gateway and garden grounds. In-stream rocks and shore pebbles bring their own water band. */
export function layoutAllows(x: number, z: number, radius: number): boolean {
  return !footprintReserved(x, z, radius) && !gardenPathNear(x, z, radius) && !nearRoute(x, z, PATH_CLEARANCE + radius);
}
/**
 * Every authored footprint except the water and the walking routes: buildings, station, gateway, displays and the gardens'
 * lake and grove. Cheap to test, unlike the path scans; the grass field (grass-field.ts) measures those separately.
 */
export function footprintReserved(x: number, z: number, radius: number): boolean {
  if (introductionClearing(x, z, radius)) return true;
  if (futureClearing(x, z, radius) || enhancementClearing(x, z, radius)) return true;
  if (Math.hypot(x - TIME_TOWER.x, z - TIME_TOWER.z) < TIME_TOWER.radius + radius) return true;
  if (GARDEN_BRIDGES.some((b) => Math.abs(z - b.z) < 2 + radius && Math.abs(x - b.x) < 10 + radius)) return true;
  if (gardenFootprint(x, z, radius) || stationClearing(x, z, radius) || gatewayClearing(x, z, radius) || glucoseClearing(x, z, radius)) return true;
  if (Math.abs(x) < 3.25 + radius && z > 11 - radius && z < 44 + radius) return true;
  for (const l of CIVIC_LANDMARKS) {
    const sx = 1 + (l.stretch.x - 1) * .85, sz = 1 + (l.stretch.z - 1) * .85;
    if (Math.hypot((x - l.x) / sx, (z - l.z) / sz) < 10.8 + radius / Math.min(sx, sz)) return true;
    if (Math.abs(x - l.x) < 3.3 + radius && z > l.z && z < l.z + 20 + radius) return true;
  }
  return false;
}
