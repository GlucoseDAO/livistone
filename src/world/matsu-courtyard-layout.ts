import type { Footprint } from './town-parts';

export interface CourtyardPoint { x: number; z: number }
export interface CourtyardRect { minX: number; maxX: number; minZ: number; maxZ: number }
export const MATSU_COURTYARD = {
  x: 177, z: 42, yaw: -1.2, planScale: .7, floorY: .25, roofY: 3.65, upperFloorY: 3.6,
  stump: { x: -.8, z: 1.8 }, blend: 8, upperGroundY: 3.45,
  lower: { minX: -6.5, maxX: 5.5, minZ: -5.8, maxZ: 6.3 },
  upper: { minX: 5.7, maxX: 9.5, minZ: -1, maxZ: 8 },
  stairs: { minX: 4.1, maxX: 9.1, minZ: 6.8, maxZ: 11.8 },
  apron: { minX: 2.8, maxX: 6.1, minZ: 5.25, maxZ: 7.4 },
} as const;

export function courtyardWorld(point: CourtyardPoint): CourtyardPoint {
  const c = Math.cos(MATSU_COURTYARD.yaw), s = Math.sin(MATSU_COURTYARD.yaw);
  const x = point.x * MATSU_COURTYARD.planScale, z = point.z * MATSU_COURTYARD.planScale;
  return { x: MATSU_COURTYARD.x + c * x + s * z, z: MATSU_COURTYARD.z - s * x + c * z };
}
export function courtyardLocal(point: CourtyardPoint): CourtyardPoint {
  const c = Math.cos(MATSU_COURTYARD.yaw), s = Math.sin(MATSU_COURTYARD.yaw), dx = point.x - MATSU_COURTYARD.x, dz = point.z - MATSU_COURTYARD.z;
  return { x: (c * dx - s * dz) / MATSU_COURTYARD.planScale, z: (s * dx + c * dz) / MATSU_COURTYARD.planScale };
}
const facing = (from: CourtyardPoint, to: CourtyardPoint): number => Math.atan2(from.x - to.x, from.z - to.z);
const stump = courtyardWorld(MATSU_COURTYARD.stump);
const arrival = courtyardWorld({ x: 8, z: 6.8 }), lowerEntry = courtyardWorld({ x: 3.8, z: 6.1 });
export const COURTYARD_ARRIVAL = { ...arrival, y: MATSU_COURTYARD.upperFloorY + .85, yaw: facing(arrival, stump) };
export const COURTYARD_LOWER_ENTRY = { ...lowerEntry, y: MATSU_COURTYARD.floorY + .85, yaw: facing(lowerEntry, stump) };
export const COURTYARD_APPROACH: readonly CourtyardPoint[] = [{ x: 156, z: 35 }, { x: 163, z: 38 }, { x: 166, z: 43 }, lowerEntry];
/** Shared navigation guide; the architecture owns the actual treads, landings and their collision. */
export const COURTYARD_STAIRS = [
  { x: 8, y: 3.6, z: 6.8 }, { x: 8, y: 3.6, z: 7.1 }, { x: 8, y: 1.925, z: 10.5 }, { x: 8, y: 1.925, z: 11 },
  { x: 5.2, y: 1.925, z: 11 }, { x: 5.2, y: 1.925, z: 10.5 }, { x: 5.2, y: .25, z: 7.1 }, { x: 3.8, y: .25, z: 6.1 },
] as const;

const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smooth = (n: number, from: number, to: number): number => { const t = clamp((n - from) / (to - from)); return t * t * (3 - 2 * t); };
function rectDistance(point: CourtyardPoint, rect: CourtyardRect): number {
  return Math.hypot(Math.max(rect.minX - point.x, 0, point.x - rect.maxX), Math.max(rect.minZ - point.z, 0, point.z - rect.maxZ));
}
function approachDistance(x: number, z: number): number {
  let distance = Infinity;
  for (let i = 1; i < COURTYARD_APPROACH.length; i++) {
    const a = COURTYARD_APPROACH[i - 1], b = COURTYARD_APPROACH[i], dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
    distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return distance;
}
function coreDistance(point: CourtyardPoint): number {
  const m = MATSU_COURTYARD;
  return Math.min(rectDistance(point, m.lower), rectDistance(point, m.upper), rectDistance(point, m.stairs), rectDistance(point, m.apron));
}

/** Grade the walking shore route first, then the lower court and the upper terrace. Rendering and physics call the same field. */
export function courtyardTerrain(x: number, z: number, current: number): number {
  if (z < 35 || z >= 65 || x <= 155) return current;
  const m = MATSU_COURTYARD, point = courtyardLocal({ x, z }), path = (1 - smooth(approachDistance(x, z), 1, 4)) * smooth(x, 155, 156);
  let height = current * (1 - path);
  const lower = Math.min(rectDistance(point, m.lower), rectDistance(point, m.stairs), rectDistance(point, m.apron)), upper = rectDistance(point, m.upper), distance = Math.min(lower, upper);
  if (distance >= m.blend) return height;
  // The two-metre shared terrain grid needs a low shoulder beyond the court wall and below the whole stair footprint.
  // Its explicit terrace floor bridges this shoulder; raising the ground at x=5.7 would put interpolated soil inside the court.
  const stairDistance = Math.min(rectDistance(point, m.stairs), rectDistance(point, m.apron));
  const upperHeight = m.upperGroundY * smooth(point.x, m.lower.maxX + 2, 8) * smooth(stairDistance, 1.6, 3);
  const upperShare = lower === 0 ? 0 : upper === 0 ? 1 : lower / (lower + upper), target = upperHeight * upperShare;
  const mask = (1 - smooth(distance, 1.2, m.blend)) * smooth(z, 35, 35.5);
  height += (target - height) * mask;
  return height;
}

/** The entire construction, its heightfield blend and the narrow shore approach reserve their full ground footprint. */
export function courtyardGround(x: number, z: number, radius = 0): boolean {
  return coreDistance(courtyardLocal({ x, z })) < MATSU_COURTYARD.blend + radius / MATSU_COURTYARD.planScale || approachDistance(x, z) < 4 + radius;
}
export function courtyardClearing(x: number, z: number, radius = 0): boolean { return courtyardGround(x, z, radius + 2); }
/** A conservative producer footprint, including the complete switchback stairs and the shore route's grading margin. */
export function courtyardFootprint(): Footprint {
  const centre = courtyardWorld({ x: 1.5, z: 3 }), circles = [{ ...centre, radius: 21 }];
  for (let i = 1; i < COURTYARD_APPROACH.length; i++) {
    const a = COURTYARD_APPROACH[i - 1], b = COURTYARD_APPROACH[i], count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4);
    for (let k = 0; k <= count; k++) circles.push({ x: a.x + (b.x - a.x) * k / count, z: a.z + (b.z - a.z) * k / count, radius: 6 });
  }
  return circles;
}

function camera(name: string, local: CourtyardPoint, height: number, pitch: number, target: CourtyardPoint = MATSU_COURTYARD.stump): { name: string; x: number; z: number; yaw: number; pitch: number; height: number; hold: boolean } {
  const from = courtyardWorld(local), to = courtyardWorld(target);
  return { name, ...from, yaw: facing(from, to), pitch, height, hold: true };
}
export const COURTYARD_CAMERAS = [
  // From the open forecourt: the source's roof stays left, the glazed wall and warm stone lookout stay right.
  // Heights are capsule heights; the walking camera adds its .78 m eye offset.
  camera('courtyard-external-overlook', { x: 2.3, z: 11.9 }, 4.32, -.28, { x: 3.5, z: -1 }),
  camera('courtyard-interior', { x: -1.5, z: 5.1 }, MATSU_COURTYARD.floorY + .85, -.10, { x: 1.3, z: -.7 }),
] as const;
