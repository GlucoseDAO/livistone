import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BLADE_CLEARANCE, bakeGrassField, createGrassField, grassClearance, grassFieldCounts, sampleGrassField } from '../src/world/grass-field';
import { PATH_CURVES, PATH_WIDTH, plantingAllowed } from '../src/world/landscape';
import { GARDEN_PATHS, GARDENS } from '../src/world/living-waters-layout';
import { waterDistance } from '../src/world/waterways';
import { mountainGeometry, terrainTiles } from '../src/world/mountains';
import { riverRockSites } from '../src/world/stone';
import { CIVIC_LANDMARKS } from '../src/game/content';
import { GLUCOSE_PAVILION } from '../src/world/glucose-layout';
import { STATION } from '../src/world/station-layout';

const rocks = riverRockSites(false), bake = bakeGrassField({ rocks });
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const points = (seed: number, count: number): [number, number][] => {
  const rand = random(seed);
  return Array.from({ length: count }, () => [bake.minX + rand() * (bake.width - 1) * 2, bake.minZ + rand() * (bake.depth - 1) * 2]);
};
/** Whether the vertex shader grows any blade rooted here (grass-field.ts: the clearance ramp starts at BLADE_CLEARANCE). */
const blades = (x: number, z: number): boolean => (sampleGrassField(bake, x, z)?.clearance ?? -1) >= BLADE_CLEARANCE;

describe('near grass field', () => {
  it('measures exactly the clearance plantingAllowed reserves', () => {
    let checked = 0;
    for (const [x, z] of points(5, 4000)) {
      const clearance = grassClearance(x, z);
      for (const radius of [0, BLADE_CLEARANCE, .6, 1.5]) {
        // The bisection resolves about a centimetre.
        if (Math.abs(clearance - radius) < .02) continue;
        expect(plantingAllowed(x, z, radius), `${x}, ${z}, r ${radius}`).toBe(clearance >= radius); checked++;
      }
    }
    expect(checked).toBeGreaterThan(15000);
  });

  it('grows blades only where plantingAllowed allows them, and everywhere it allows a full tuft', () => {
    let grown = 0, open = 0, shortened = 0;
    for (const [x, z] of points(9, 60000)) {
      // The 2 m lookup interpolates the clearance. At the corners of rectangular footprints that runs up to ~.3 m into
      // their reserved margins, which already lie beyond the buildings and displays; paths and water are checked below.
      if (blades(x, z)) { grown++; expect(grassClearance(x, z), `${x}, ${z}`).toBeGreaterThan(-.35); }
      if (plantingAllowed(x, z, .75)) { open++; if (sampleGrassField(bake, x, z)!.clearance < BLADE_CLEARANCE + .3) shortened++; }
    }
    expect(grown).toBeGreaterThan(30000);
    // Open meadow keeps full-height blades except beside the few river rocks and path junctions.
    expect(shortened / open).toBeLessThan(.02);
  });

  it('keeps paving, borders, water and indoor floors bare', () => {
    for (const curve of PATH_CURVES) for (let i = 0; i <= 200; i++) {
      const p = curve.getPoint(i / 200), tangent = curve.getTangent(i / 200), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      // Paving, border and kerb reach PATH_WIDTH / 2 + .28 (path-kerbs.ts).
      for (const offset of [0, .5, 1, PATH_WIDTH / 2, PATH_WIDTH / 2 + .28]) for (const side of [-1, 1]) expect(blades(p.x + normal.x * offset * side, p.z + normal.z * offset * side)).toBe(false);
    }
    for (const curve of GARDEN_PATHS) for (const p of curve.getPoints(120)) expect(blades(p.x + GARDENS.x, p.z + GARDENS.z)).toBe(false);
    for (const [x, z] of points(13, 30000)) if (waterDistance(x, z) < 0) expect(blades(x, z), `${x}, ${z}`).toBe(false);
    for (const l of CIVIC_LANDMARKS) for (let a = 0; a < 6.3; a += .3) for (const r of [0, 3, 6, 8]) expect(blades(l.x + Math.sin(a) * r, l.z + Math.cos(a) * r)).toBe(false);
    for (let a = 0; a < 6.3; a += .3) for (const r of [0, 4, 9]) expect(blades(GLUCOSE_PAVILION.x + Math.sin(a) * r, GLUCOSE_PAVILION.z + Math.cos(a) * r)).toBe(false);
    for (let x = STATION.x - STATION.halfLength; x <= STATION.x + STATION.halfLength; x += 2) for (let z = STATION.front; z <= STATION.back; z += 2) expect(blades(x, z)).toBe(false);
    for (const rock of rocks) if (rock.s > .4) expect(blades(rock.x, rock.z)).toBe(false);
  });

  it('shades the ground only where blades grow', () => {
    // The ground darkens its soil by the bake's grass amount (alpha), which follows the same clearance as the blades.
    for (const [x, z] of points(21, 20000)) {
      const i = Math.round((x - bake.minX) / 2), j = Math.round((z - bake.minZ) / 2), n = j * bake.width + i, clearance = bake.field[n * 4 + 1];
      if (clearance < BLADE_CLEARANCE) expect(bake.tint[n * 4 + 3]).toBe(0);
      if (clearance > .6 && bake.field[n * 4 + 2] === 1) expect(bake.tint[n * 4 + 3]).toBe(255);
    }
  });

  it('roots blades on the tiled terrain triangles the ground draws', () => {
    // Index the near two-metre cells of the drawn tiles (mountains.ts), then find the triangle under each blade site.
    const cells = new Map<string, number[][]>();
    for (const tile of terrainTiles(mountainGeometry(false))) {
      const p = tile.getAttribute('position').array;
      for (let v = 0; v < p.length; v += 9) {
        const key = `${Math.floor((p[v] + p[v + 3] + p[v + 6]) / 6)},${Math.floor((p[v + 2] + p[v + 5] + p[v + 8]) / 6)}`;
        cells.set(key, [...cells.get(key) ?? [], Array.from(p.slice(v, v + 9))]);
      }
    }
    let checked = 0;
    for (const [x, z] of points(17, 3000)) {
      if (!plantingAllowed(x, z, 0)) continue;
      for (const [x0, y0, z0, x1, y1, z1, x2, y2, z2] of cells.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? []) {
        const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2), a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d;
        if (a < -1e-6 || b < -1e-6 || a + b > 1 + 1e-6) continue;
        expect(sampleGrassField(bake, x, z)!.ground, `${x}, ${z}`).toBeCloseTo(a * y0 + b * y1 + (1 - a - b) * y2, 3); checked++;
      }
    }
    expect(checked).toBeGreaterThan(1500);
  });

  it('draws one field of about 50k blades on gpu and 19k on mobile, and none on cpu', () => {
    const gpu = grassFieldCounts('gpu')!, mobile = grassFieldCounts('mobile')!;
    expect(gpu.blades).toBeGreaterThan(45000); expect(gpu.blades).toBeLessThan(55000); expect(gpu.radius).toBe(22);
    expect(mobile.blades).toBeGreaterThan(17000); expect(mobile.blades).toBeLessThan(21000); expect(mobile.radius).toBe(12);
    expect(grassFieldCounts('cpu')).toBeNull(); expect(createGrassField('cpu')).toBeNull();
    for (const tier of ['gpu', 'mobile'] as const) {
      const { mesh: field, ground } = createGrassField(tier)!, geometry = field.geometry as THREE.InstancedBufferGeometry, counts = grassFieldCounts(tier)!;
      expect(ground.radius).toBe(counts.radius); expect([ground.width, ground.depth]).toEqual([bake.width, bake.depth]);
      // One draw: a single mesh instancing one patch, which casts no shadow and is never frustum-culled.
      expect(field).toBeInstanceOf(THREE.Mesh); expect(geometry.isInstancedBufferGeometry).toBe(true);
      expect(geometry.instanceCount).toBe(counts.instances); expect(geometry.index!.count / 3 * geometry.instanceCount).toBe(counts.triangles);
      expect(field.castShadow).toBe(false); expect(field.receiveShadow).toBe(true); expect(field.frustumCulled).toBe(false);
      geometry.dispose(); (field.material as THREE.Material).dispose();
    }
  });
});
