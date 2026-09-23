import { PATH_WIDTH } from './path-surface';
import { enhancementClearing } from './enhancement-layout';
import * as THREE from 'three';
export const GARDENS = { x: 0, z: -110, radius: 44, pavilionX: -10, pavilionZ: 0 };
export const GARDEN_PANELS = { vittoria: [-16, -52], dewdrop: [-13, -1.5], mycelium: [70, -23] } as const;
export type Point = [number, number];
const outline: Point[] = Array.from({ length: 80 }, (_, i) => { const angle = i * Math.PI / 40, r = 44 + Math.sin(angle * 3 + .5) * 1.2 + Math.sin(angle * 5) * .7; return [Math.cos(angle) * r, Math.sin(angle) * r]; });
const seeds: Point[] = [[-10, 0], [-16, -17], [-3, -19], [11, -23], [22, -13], [22, 4], [13, 19], [-3, 23], [-20, 19], [-30, 5], [-31, -12], [-24, -28], [-11, -35], [2, -36], [14, -35], [28, -27], [36, -16], [37, -4], [36, 11], [29, 26], [16, 35], [1, 36], [-13, 34], [-29, 29], [-39, 17], [-39, -3], [-35, -24], [4, -5], [7, 8]];
function clip(polygon: Point[], nx: number, nz: number, distance: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) { const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = a[0] * nx + a[1] * nz - distance, db = b[0] * nx + b[1] * nz - distance;
    if (da <= 0) result.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  } return result;
}
export const LAKE_OUTLINE = outline;
/** Insetting every shared cell boundary by 1.1 m leaves a continuous 2.2 m network, with many route choices. */
export const WATER_EYES = seeds.slice(1).map((seed, i) => {
  let polygon = outline;
  seeds.forEach((other, j) => { if (j === i + 1) return; const nx = other[0] - seed[0], nz = other[1] - seed[1], distance = (other[0] ** 2 + other[1] ** 2 - seed[0] ** 2 - seed[1] ** 2) / 2 - 1.1 * Math.hypot(nx, nz); polygon = clip(polygon, nx, nz, distance); });
  // The planted outer margin stays dry; only the inset cell is water.
  for (let j = 0; j < 48; j++) { const angle = j * Math.PI / 24; polygon = clip(polygon, Math.cos(angle), Math.sin(angle), 41.6); }
  return polygon;
}).filter((polygon) => polygon.length >= 3);
export function pointInPolygon(x: number, z: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside;
}
export function gardenHeight(x: number, z: number): number { return -.15 * (1 - THREE.MathUtils.smoothstep(Math.hypot(x, z), 42, 47)); }
export const GARDEN_PATHS = [
  [[-10, 0], [-10, -20], [-10, -40], [-16, -48], [-36, -40], [-48, -15], [-44, 16], [-23, 43], [-18, 45]],
  [[-16, -48], [12, -49], [39, -43], [61, -34], [74, -25]],
  [[-10, 0], [3, -1], [25, -3], [43, -4], [57, -13], [64, -23], [74, -25]],
  [[74, -25], [89, -19], [94, -2], [87, 19], [70, 22], [59, 9], [60, -9], [64, -23], [74, -25]],
  [[-10, 0], [-1, 0], [-1, 18], [-13, 34], [-18, 45], [-23, 56]],
  [[74, -25], [61, -34], [56, -21], [56, 5], [60, 27], [48, 46], [38, 58]],
].map((points) => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, .13, z))));
const pathSamples = GARDEN_PATHS.map((path) => path.getPoints(120));
export function rainPlantAllowed(x: number, z: number, radius: number): boolean {
  if (enhancementClearing(x + GARDENS.x, z + GARDENS.z, radius)) return false;
  if (Math.hypot(x - 75, z) < 5 + radius) return false;
  return pathSamples.every((points) => points.every((point) => Math.hypot(point.x - x, point.z - z) > PATH_WIDTH / 2 + .4 + radius));
}

/** Living Waters is a district in the town, with shared ground and full-footprint planting reservations. */
export function gardenClearing(x: number, z: number, radius: number): boolean {
  x -= GARDENS.x; z -= GARDENS.z;
  return Object.values(GARDEN_PANELS).some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.4 + radius) || Math.hypot(x, z) < 47 + radius || (x > 51 - radius && x < 104 + radius && z > -35 - radius && z < 32 + radius)
    || pathSamples.some(points => points.some(p => Math.hypot(p.x - x, p.z - z) < PATH_WIDTH / 2 + .4 + radius));
}
