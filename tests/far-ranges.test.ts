import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FAR_RANGES, farRangeHeight } from '../src/world/far-ranges';
import { farLandscapeGeometry } from '../src/world/far-landscape';
import { mountainGeometry, terrainEdge } from '../src/world/mountains';
import { landscapeHeightOf, terrainHeight } from '../src/world/terrain';
import { forestSites } from '../src/world/forest-layout';
import { PATH_CURVES } from '../src/world/landscape';
import { LANDMARKS, SPAWN } from '../src/game/content';
import { RAILWAY, STATION } from '../src/world/station-layout';

// forestSites on main@47dc3b9: tier, count, first and last site (x, z). Sub-plan 27 then took the trees standing on the Jepii Mici
// trail, its plateau, the peaks and the couloir out after the draws, so every other site is unchanged, and appended a few round
// the trailhead (the last site is one of them).
const FOREST: [boolean, number, [number, number], [number, number]][] = [
  [false, 910, [-27.918645669706166, -199.93845618027262], [-22.31657310872749, -199.0044028444865]],
  [true, 517, [-27.918645669706166, -199.93845618027262], [-18.43786784085531, -205.5658622716235]],
];

describe('distant ranges (sub-plan 26)', () => {
  it('stand only outside the near box, rise to real mountains and keep the river and railway valley open', () => {
    for (let x = -600; x <= 600; x += 25) for (let z = -620; z <= 580; z += 25) expect(farRangeHeight(x, z)).toBe(0);
    let peak = 0; for (let a = 0; a < 360; a += 5) for (const r of [2000, 3000, 4500]) peak = Math.max(peak, farRangeHeight(Math.sin(a * Math.PI / 180) * r, Math.cos(a * Math.PI / 180) * r));
    expect(peak).toBeGreaterThan(450); expect(peak).toBeLessThan(1100);
    // Out to 700 m east and west the valley floor carries the river and the rail line at the town's level.
    for (const x of [-700, -650, 650, 700]) for (const z of [26, FAR_RANGES.valleyZ, RAILWAY.centerZ]) expect(farRangeHeight(x, z)).toBe(0);
  });

  it('leave every path, entrance, the spawn and the railway grading exactly as the classic landscape had them', () => {
    const points: [number, number][] = [[SPAWN.x, SPAWN.z], ...LANDMARKS.map((l): [number, number] => [l.entrance.x, l.entrance.z])];
    for (const curve of PATH_CURVES) for (const p of curve.getPoints(60)) points.push([p.x, p.z]);
    for (let x = -STATION.railHalfLength; x <= STATION.railHalfLength; x += 8) for (const z of RAILWAY.tracks) points.push([x, z]);
    for (const [x, z] of points) expect(landscapeHeightOf(x, z, true), `${x}, ${z}`).toBe(landscapeHeightOf(x, z, false));
  });

  it('share the tiles’ outer edge vertex for vertex, face up, and cover every triangle once across the sectors', () => {
    for (const mobile of [true, false]) {
      const edge = terrainEdge(mobile), sectors = farLandscapeGeometry(mobile, edge), tiles = mountainGeometry(mobile, undefined, false);
      expect(sectors).toHaveLength(6);
      const key = (x: number, y: number, z: number): string => `${Math.fround(x)},${Math.fround(y)},${Math.fround(z)}`, ground = new Set<string>();
      const p = tiles.getAttribute('position'); for (let i = 0; i < p.count; i++) ground.add(key(p.getX(i), p.getY(i), p.getZ(i)));
      const far = new Set<string>(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let triangles = 0;
      for (const sector of sectors) {
        const position = sector.getAttribute('position'), index = sector.index!;
        for (let i = 0; i < position.count; i++) far.add(key(position.getX(i), position.getY(i), position.getZ(i)));
        for (let i = 0; i < index.count; i += 3) {
          a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
          expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeGreaterThan(0); triangles++;
        }
        sector.dispose();
      }
      for (const point of edge) expect(ground.has(key(point.x, landscapeHeightOf(point.x, point.z, true), point.z)) && far.has(key(point.x, landscapeHeightOf(point.x, point.z, true), point.z))).toBe(true);
      expect(triangles).toBeGreaterThan(mobile ? 20000 : 90000); expect(triangles).toBeLessThan(mobile ? 90000 : 300000);
      tiles.dispose();
    }
  }, 60000);

  it('keep the seeded woodland where it was, standing on the eroded ridges', () => {
    for (const [mobile, count, first, last] of FOREST) {
      const sites = forestSites(mobile);
      expect(sites).toHaveLength(count);
      for (const [site, [x, z]] of [[sites[0], first], [sites[sites.length - 1], last]] as const) { expect(site.x).toBeCloseTo(x, 6); expect(site.z).toBeCloseTo(z, 6); expect(site.y).toBe(terrainHeight(site.x, site.z)); }
    }
  });
});
