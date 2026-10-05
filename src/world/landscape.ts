import { EYELENSE, eyelenseClearing, eyelenseGround } from './eyelense-gate-layout';
import { rotundaGround, rotundaClearing } from './concept-rotunda-layout';
import { introductionClearing } from './introduction-layout';
import { enhancementClearing, enhancementGround } from './enhancement-layout';
import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { GARDEN_BRIDGES, TIME_TOWER, waterDistance } from './waterways';
import { stationClearing } from './station-layout';
import { gatewayApproachWidth, gatewayClearing } from './gateway-layout';
import { glucoseClearing } from './glucose-layout';
import { GARDEN_PATHS, GARDEN_PATH_CLEARANCE, GARDENS, gardenFootprint, gardenGround } from './living-waters-layout';
import { PathNetwork } from './path-network';
import { futureClearing, futureGround } from './elevated-layout';
import { winterClearing, winterGround } from './winter-gate-layout';


// Reserved for future authored homes; the white dome placeholders have been removed.
export const HOME_SITES: number[][] = [];
export { PATH_WIDTH } from './path-surface';
import { PATH_WIDTH } from './path-surface';
const routes = [
  [[80, -34], [86, -35], [92, -36], [EYELENSE.x - EYELENSE.forecourtHalfZ + 2, EYELENSE.z]],
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
/** Paved width along a town route: the bridge apron's taper on the gateway approach, PATH_WIDTH elsewhere. */
export function routeWidth(road: number, p: THREE.Vector3): number {
  return PATH_CURVES[road].points.every(point => point.x === 0 && point.z >= 40) ? gatewayApproachWidth(p.z) : PATH_WIDTH;
}
/** Routes keep this much clear ground beyond their centreline, plus the plant's own radius. */
export const PATH_CLEARANCE = PATH_WIDTH / 2 + .3;
/** Water keeps this much clear bank, plus the plant's own radius. */
export const WATER_CLEARANCE = .35;
/** Town routes (group 0) and the lake garden's paths (group 1) as one network: one merged paving and one clearance field. */
export const WALKING_NETWORK = new PathNetwork([
  ...PATH_CURVES.map((curve, road) => ({ curve, width: (p: THREE.Vector3) => routeWidth(road, p), margin: PATH_CLEARANCE - PATH_WIDTH / 2, group: 0 })),
  ...GARDEN_PATHS.map(path => ({ curve: new THREE.CatmullRomCurve3(path.points.map(p => new THREE.Vector3(p.x + GARDENS.x, p.y, p.z + GARDENS.z))), width: PATH_WIDTH, margin: GARDEN_PATH_CLEARANCE - PATH_WIDTH / 2, group: 1 })),
]);

/** Reserve the whole plant footprint, not just its stem, along the rendered routes. */
export function plantingAllowed(x: number, z: number, radius: number): boolean {
  return grassAllowed(x, z, radius) && !canopyReserved(x, z, radius);
}
/** Where the near grass field may grow blades (grass-field.ts): off water, paving and everything that stands on the ground. */
export function grassAllowed(x: number, z: number, radius: number): boolean {
  return waterDistance(x, z) >= radius + WATER_CLEARANCE && !groundReserved(x, z, radius) && pathAllows(x, z, radius);
}
/** Every authored clearance except the water itself: routes, bridges, the tower and the civic, station, gateway and garden grounds. In-stream rocks and shore pebbles bring their own water band. */
export function layoutAllows(x: number, z: number, radius: number): boolean {
  return !footprintReserved(x, z, radius) && pathAllows(x, z, radius);
}
/** The merged paving with its fillets, plus each network's planting margin. */
function pathAllows(x: number, z: number, radius: number): boolean { return WALKING_NETWORK.clearance(x, z, Math.max(0, radius) + 1) >= radius; }
/**
 * Every authored footprint except the water and the walking routes: what stands on the ground (groundReserved) and the
 * clearings kept for canopies. Cheap to test, unlike the path field.
 */
export function footprintReserved(x: number, z: number, radius: number): boolean {
  return groundReserved(x, z, radius) || canopyReserved(x, z, radius);
}
/** Clearings kept free of trees, shrubs and flowers but not of grass: the mycelium grove and lake margin, the meadow round the Enhancement hill and the ground under the Future House camel. */
function canopyReserved(x: number, z: number, radius: number): boolean {
  if (rotundaClearing(x, z, radius)) return true;
  return gardenFootprint(x, z, radius) || enhancementClearing(x, z, radius) || futureClearing(x, z, radius) || winterClearing(x, z, radius) || eyelenseClearing(x, z, radius);
}
/** Ground something stands on or covers, which neither plants nor grass may grow through (grass-field.ts bisects its radius). */
export function groundReserved(x: number, z: number, radius: number): boolean {
  if (rotundaGround(x, z, radius)) return true;
  if (eyelenseGround(x, z, radius)) return true;
  if (introductionClearing(x, z, radius) || winterGround(x, z, radius)) return true;
  if (futureGround(x, z, radius) || enhancementGround(x, z, radius)) return true;
  if (Math.hypot(x - TIME_TOWER.x, z - TIME_TOWER.z) < TIME_TOWER.radius + radius) return true;
  if (GARDEN_BRIDGES.some((b) => Math.abs(z - b.z) < 2 + radius && Math.abs(x - b.x) < 10 + radius)) return true;
  if (gardenGround(x, z, radius) || stationClearing(x, z, radius) || gatewayClearing(x, z, radius) || glucoseClearing(x, z, radius)) return true;
  if (Math.abs(x) < 3.25 + radius && z > 11 - radius && z < 44 + radius) return true;
  for (const l of CIVIC_LANDMARKS) {
    const sx = 1 + (l.stretch.x - 1) * .85, sz = 1 + (l.stretch.z - 1) * .85;
    if (Math.hypot((x - l.x) / sx, (z - l.z) / sz) < 10.8 + radius / Math.min(sx, sz)) return true;
    if (Math.abs(x - l.x) < 3.3 + radius && z > l.z && z < l.z + 20 + radius) return true;
  }
  return false;
}
