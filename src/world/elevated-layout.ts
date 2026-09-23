import * as THREE from 'three';
import { TIME_TOWER } from './waterways';

export const TOWER_WALK = { inner: 5.05, outer: 8.05, height: 25.5, turns: 2.5, base: .2 };
export function towerPoint(t: number, radius = 6.55): THREE.Vector3 {
  const angle = Math.PI / 2 + t * Math.PI * 2 * TOWER_WALK.turns;
  return new THREE.Vector3(TIME_TOWER.x + Math.sin(angle) * radius, TOWER_WALK.base + t * TOWER_WALK.height, TIME_TOWER.z + Math.cos(angle) * radius);
}
export const FUTURE_HOUSE = { x: -64, z: -110, floor: 12, radiusX: 9, radiusZ: 12 };
export const FUTURE_NECK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-35, .15, -105), new THREE.Vector3(-38, .3, -105), new THREE.Vector3(-42, 3, -106),
  new THREE.Vector3(-46, 6, -108), new THREE.Vector3(-50, 9, -110), new THREE.Vector3(-54, 12, -110), new THREE.Vector3(-57, 12, -110),
]);
export function futureClearing(x: number, z: number, radius = 0): boolean {
  return Math.hypot((x + 64) / (15 + radius), (z + 110) / (17 + radius)) < 1 || (x > -66 - radius && x < -34 + radius && Math.abs(z + 108) < 5 + radius);
}
