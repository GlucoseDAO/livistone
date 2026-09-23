import { meadowRelief } from './meadow-relief';
import { enhancementClearing, ENHANCEMENT } from './enhancement-layout';
import * as THREE from 'three';
import { waterDistance } from './waterways';
import { GARDENS, gardenHeight } from './living-waters-layout';
import { RAILWAY, railwayCorridor } from './station-layout';
import { futureClearing } from './elevated-layout';

function hash(x: number, z: number): number { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
export function terrainNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
// Overlapping elongated massifs make a river valley, not a circular wall around a flat disc.
const ridges = [
  [-155, -196, 155, 73, -.65, 70], [15, -277, 170, 66, .16, 106], [166, -215, 124, 70, -.78, 83],
  [-231, -48, 175, 69, 1.2, 64], [218, -28, 151, 74, 1.45, 76],
  [-242, 103, 125, 69, .3, 71], [238, 106, 137, 73, -.18, 65],
];
export function landscapeHeight(x: number, z: number): number {
  if (Math.hypot(x - GARDENS.x, z - GARDENS.z) < 48) return gardenHeight(x - GARDENS.x, z - GARDENS.z);
  if (futureClearing(x, z, 5) || enhancementClearing(x, z, 2)) return 0;
  const distance = waterDistance(x, z);
  if (distance < -2.6) return -2;
  if (distance < 0) return distance / 2.6 * 2;
  const clearing = Math.min(Math.hypot(x / 88, (z + 12) / 64), Math.hypot(x / 57, (z + 110) / 57), Math.hypot((x - 77) / 40, (z + 110) / 46), Math.hypot((x + 14) / 61, (z - 65) / 31), Math.hypot((x - 20) / 66, (z + 148) / 22));
  const foothills = THREE.MathUtils.smoothstep(clearing, .98, 1.8);
  if (!foothills) return meadowRelief(x, z);
  let mass = 0;
  for (const [cx, cz, length, width, angle, height] of ridges) {
    const dx = x - cx, dz = z - cz, u = dx * Math.cos(angle) + dz * Math.sin(angle), v = -dx * Math.sin(angle) + dz * Math.cos(angle);
    const ridge = height * Math.exp(-1.8 * (u / length) ** 2 - 2.4 * (v / width) ** 2);
    mass = Math.max(mass, ridge) + Math.min(mass, ridge) * .22;
  }
  const warp = terrainNoise(x * .009, z * .009) * 2;
  const fold = 1 - Math.abs(terrainNoise(x * .033 + warp, z * .033) * 2 - 1);
  const relief = mass * (.7 + .36 * fold * fold + .08 * terrainNoise(x * .12, z * .12));
  const riverValley = THREE.MathUtils.smoothstep(distance, 0, 25);
  // Grade the approaches and far exits into the same hillside that the tunnel bores cut through.
  const railShoulder = 1 - THREE.MathUtils.smoothstep(Math.abs(z - RAILWAY.centerZ), 9, 30);
  const approach = 1 - THREE.MathUtils.smoothstep(Math.abs(x), RAILWAY.portalX - 9, RAILWAY.portalX + 6);
  const exit = THREE.MathUtils.smoothstep(Math.abs(x), RAILWAY.exitX - 36, RAILWAY.exitX - 3);
  const hillMargin = THREE.MathUtils.smoothstep(Math.max(Math.abs(x - ENHANCEMENT.x) / 50, Math.abs(z - ENHANCEMENT.z) / 46), 1, 1.3);
  return meadowRelief(x, z) * (1 - foothills) + hillMargin * relief * foothills * riverValley * (1 - railShoulder * Math.max(approach, exit));
}
export function terrainHeight(x: number, z: number): number {
  // The walkable floor follows the rail foundation under the visually open mountain bore.
  return railwayCorridor(x, z) ? 0 : landscapeHeight(x, z);
}
export function townTerrainGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(480, 420, 240, 210).rotateX(-Math.PI / 2).translate(0, 0, -60), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals(); return geometry;
}
