import * as THREE from 'three';
import { TIME_TOWER } from './waterways';

export const TOWER_WALK = { inner: 5.05, outer: 8.05, height: 25.5, turns: 2.5, base: .2 };
export function towerPoint(t: number, radius = 6.55): THREE.Vector3 {
  const angle = Math.PI / 2 + t * Math.PI * 2 * TOWER_WALK.turns;
  return new THREE.Vector3(TIME_TOWER.x + Math.sin(angle) * radius, TOWER_WALK.base + t * TOWER_WALK.height, TIME_TOWER.z + Math.cos(angle) * radius);
}
export const FUTURE_HOUSE = { x: -64, z: -110, floor: 12, radiusX: 9, radiusZ: 12 };
/** The neck walkway's width; its guard rails stand on both edges. */
export const NECK_WIDTH = 3.6;
/**
 * The neck runs straight in plan from the lake path's end (its foot) to the cabin's east threshold, so a visitor walking ahead
 * stays between the rails, and climbs at one even grade (31°, 33° at most) between short eased landings. The earlier S-bend peaked at
 * 41.5° against the character controller's 45° limit, right where its inner rail turned across the walking line, and stalled
 * anyone holding forward there. Level from the threshold, where the deck's top meets it, into the cabin.
 */
const NECK_FOOT = new THREE.Vector3(-35, .15, -105), NECK_THRESHOLD = new THREE.Vector3(-55, FUTURE_HOUSE.floor, -110);
function neckPoints(): THREE.Vector3[] {
  const ease = .1, grade = 1 / (1 - ease), rise = NECK_THRESHOLD.y - NECK_FOOT.y, points: THREE.Vector3[] = [];
  // The height under a trapezoidal grade: it eases in over the first tenth and out over the last.
  const height = (t: number): number => t < ease ? grade * t * t / (2 * ease) : t > 1 - ease ? 1 - grade * (1 - t) ** 2 / (2 * ease) : grade * (t - ease / 2);
  for (let i = 0; i <= 24; i++) { const t = i / 24; points.push(NECK_FOOT.clone().lerp(NECK_THRESHOLD, t).setY(NECK_FOOT.y + rise * height(t))); }
  points.push(new THREE.Vector3(-57, FUTURE_HOUSE.floor, -110));
  return points;
}
export const FUTURE_NECK = new THREE.CatmullRomCurve3(neckPoints());
/** The map arrival: on the lake path just before the foot, facing straight up the neck. */
export const NECK_ARRIVAL = { x: NECK_FOOT.x + .97, z: NECK_FOOT.z + .25, yaw: Math.atan2(NECK_FOOT.x - NECK_THRESHOLD.x, NECK_FOOT.z - NECK_THRESHOLD.z) };
export function futureClearing(x: number, z: number, radius = 0): boolean {
  return Math.hypot((x + 64) / (15 + radius), (z + 110) / (17 + radius)) < 1 || (x > -66 - radius && x < -33.5 + radius && Math.abs(z + 107.75) < 5.25 + radius);
}
