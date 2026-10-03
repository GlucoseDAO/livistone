import { meadowRelief } from './meadow-relief';
import { enhancementClearing, ENHANCEMENT } from './enhancement-layout';
import * as THREE from 'three';
import { waterDistance } from './waterways';
import { GARDENS, gardenHeight } from './living-waters-layout';
import { RAILWAY, railwayCorridor } from './station-layout';
import { futureClearing } from './elevated-layout';
import { FAR_RANGES, farRangeHeight, ridgeErosion } from './far-ranges';
import { mountainCalm, mountainShape } from './mountain-layout';

/** Dev-only `?ridges=classic`: the rounds 1–2 landscape, flat beyond about 400 m, with no distant ranges or far pass (sub-plan 26). */
export type RidgesLook = 'ranges' | 'classic';
export function ridgesLook(): RidgesLook {
  if (!import.meta.env?.DEV || typeof location === 'undefined') return 'ranges';
  return new URLSearchParams(location.search).get('ridges') === 'classic' ? 'classic' : 'ranges';
}
const RANGES = ridgesLook() === 'ranges';
/** The landscape height (shared with physics and planting); landscapeHeightOf(x, z, false) is the classic one, for tests. */
export function landscapeHeight(x: number, z: number): number { return landscapeHeightOf(x, z, RANGES); }

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
export function landscapeHeightOf(x: number, z: number, ranges: boolean): number {
  // Sub-plan 27 shapes the north ridge (the trailhead's slope, the benched climb, the plateau, the peaks and their couloir) with the
  // eroded ridges only, so the forest's seeded draws, which read the classic heights, stay put.
  return ranges ? mountainShape(x, z, ridgeHeightOf(x, z, ranges)) : ridgeHeightOf(x, z, ranges);
}
/** The eroded ridges before sub-plan 27 shapes them (mountain-layout.ts designs against it). */
export function ridgeHeight(x: number, z: number): number { return ridgeHeightOf(x, z, RANGES); }
function ridgeHeightOf(x: number, z: number, ranges: boolean): number {
  // Past the near box only the distant ranges stand; the river's carved channel ends there, inside the valley mist.
  if (ranges && Math.max(Math.abs(x), Math.abs(z + 20)) > FAR_RANGES.rise[0]) return farRangeHeight(x, z);
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
  // Where a ridge stands more than about 10 m high it carries eroded gullies and spurs (sub-plan 26); foothills, paths, the
  // ground over the railway bores and the hills that frame the Dark Nut portals keep their smooth heights.
  const portal = Math.min(Math.abs(Math.abs(x) - RAILWAY.portalX), Math.abs(Math.abs(x) - RAILWAY.exitX)) / 70 + Math.abs(z - RAILWAY.centerZ) / 70;
  const rugged = ranges ? THREE.MathUtils.smoothstep(mass * foothills, 10, 40) * THREE.MathUtils.smoothstep(Math.abs(z - RAILWAY.centerZ), 14, 40) * THREE.MathUtils.smoothstep(portal, .6, 1.1) : 0;
  const relief = mass * (.7 + .36 * fold * fold + .08 * terrainNoise(x * .12, z * .12) + (rugged && .55 * rugged * (1 - mountainCalm(x, z)) * ridgeErosion(x, z)));
  const riverValley = THREE.MathUtils.smoothstep(distance, 0, 25);
  // Grade the approaches and far exits into the same hillside that the tunnel bores cut through.
  const railShoulder = 1 - THREE.MathUtils.smoothstep(Math.abs(z - RAILWAY.centerZ), 9, 30);
  const approach = 1 - THREE.MathUtils.smoothstep(Math.abs(x), RAILWAY.portalX - 9, RAILWAY.portalX + 6);
  const exit = THREE.MathUtils.smoothstep(Math.abs(x), RAILWAY.exitX - 36, RAILWAY.exitX - 3);
  const hillMargin = THREE.MathUtils.smoothstep(Math.max(Math.abs(x - ENHANCEMENT.x) / 50, Math.abs(z - ENHANCEMENT.z) / 46), 1, 1.3);
  return meadowRelief(x, z) * (1 - foothills) + hillMargin * relief * foothills * riverValley * (1 - railShoulder * Math.max(approach, exit));
}
export function terrainHeight(x: number, z: number): number { return terrainHeightOf(x, z, RANGES); }
/** terrainHeight with or without the distant ranges and the ridges' erosion. */
export function terrainHeightOf(x: number, z: number, ranges: boolean): number {
  // The walkable floor follows the rail foundation under the visually open mountain bore.
  return railwayCorridor(x, z) ? 0 : landscapeHeightOf(x, z, ranges);
}
/**
 * Height of the triangulated two-metre town ground at (x, z): the collider below and the near grid of `mountainGeometry` share
 * these even-coordinate cells and their (x0, z1)–(x1, z0) diagonal. Small props placed on it neither float nor sink at bank kinks.
 */
export function terrainSurfaceHeight(x: number, z: number): number {
  const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, u = (x - x0) / 2, v = (z - z0) / 2;
  const h01 = terrainHeight(x0, z0 + 2), h10 = terrainHeight(x0 + 2, z0);
  if (u + v <= 1) { const h00 = terrainHeight(x0, z0); return h00 + (h10 - h00) * u + (h01 - h00) * v; }
  const h11 = terrainHeight(x0 + 2, z0 + 2); return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}
/** Upward unit normal of that same ground triangle. */
export function terrainSurfaceNormal(x: number, z: number): THREE.Vector3 {
  const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, upper = x - x0 + z - z0 > 2;
  const h01 = terrainHeight(x0, z0 + 2), h10 = terrainHeight(x0 + 2, z0);
  // Lower triangle: slopes from its (x0, z0) corner; upper triangle: from its (x1, z1) corner.
  const sx = upper ? terrainHeight(x0 + 2, z0 + 2) - h01 : h10 - terrainHeight(x0, z0), sz = upper ? terrainHeight(x0 + 2, z0 + 2) - h10 : h01 - terrainHeight(x0, z0);
  return new THREE.Vector3(-sx / 2, 1, -sz / 2).normalize();
}
/** The walking terrain's vertex lattice; the rendered ground near the town shares its 2 m vertices (mountains.ts). */
export const TERRAIN_GRID = { minX: -240, minZ: -296, columns: 241, rows: 224, step: 2 } as const;
export function townTerrainGeometry(): THREE.BufferGeometry {
  const { minX, minZ, columns, rows, step } = TERRAIN_GRID, width = (columns - 1) * step, depth = (rows - 1) * step;
  const geometry = new THREE.PlaneGeometry(width, depth, columns - 1, rows - 1).rotateX(-Math.PI / 2).translate(minX + width / 2, 0, minZ + depth / 2), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals(); return geometry;
}
/** Reads terrainHeight back from a townTerrainGeometry position array at one of its vertices, without recomputing it. */
export function terrainVertexHeight(positions: ArrayLike<number>, x: number, z: number): number {
  const i = Math.round((x - TERRAIN_GRID.minX) / TERRAIN_GRID.step), j = Math.round((z - TERRAIN_GRID.minZ) / TERRAIN_GRID.step);
  return i >= 0 && j >= 0 && i < TERRAIN_GRID.columns && j < TERRAIN_GRID.rows ? positions[(j * TERRAIN_GRID.columns + i) * 3 + 1] : terrainHeight(x, z);
}
