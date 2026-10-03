import * as THREE from 'three';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SURFACE_SETS, bakeMasonry, surfaceFiles, surfaceTint } from '../src/world/surfaces';
import { terrainHeight } from '../src/world/terrain';
import { WATER_LEVEL } from '../src/world/water-surface';

type Axis = 'x' | 'y' | 'z';
// The triplanar axes: X faces read (z, y), Z faces (x, y), top and bottom (x, z), in 4 m tiles.
const projected = (axis: Axis, x: number, y: number, z: number): [number, number] => axis === 'x' ? [z / 4, y / 4] : axis === 'z' ? [x / 4, y / 4] : [x / 4, z / 4];

describe('architectural surface maps', () => {
  it('matches the baked sets and ships every file each tier loads', () => {
    const sources = JSON.parse(readFileSync('public/textures/surfaces/sources.json', 'utf8')) as { stem: keyof typeof SURFACE_SETS; tileMetres: number; meanLinearAlbedo: number[]; meanRoughness: number }[];
    expect(sources.map(set => set.stem).sort()).toEqual(Object.keys(SURFACE_SETS).sort());
    for (const set of sources) {
      const known = SURFACE_SETS[set.stem];
      expect([known.tile, [...known.mean], known.roughness]).toEqual([set.tileMetres, set.meanLinearAlbedo, set.meanRoughness]);
    }
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) for (const file of surfaceFiles(tier)) expect(existsSync(`public/textures/surfaces/${file}`), file).toBe(true);
    // The cpu tier's Lambert copies use colour only.
    expect(surfaceFiles('cpu').every(file => file.includes('-albedo-'))).toBe(true);
  });

  it('tints each set back to the approved colour it replaces', () => {
    for (const [set, approved] of [['ashlar', '#f4f0df'], ['ashlar', '#e5dbc7'], ['terrazzo', '#ddd7c4'], ['brass', '#c2aa77'], ['brass', '#b99a55'], ['brass', '#d6a458']] as const) {
      const tint = surfaceTint(set, approved), mean = SURFACE_SETS[set].mean;
      expect('#' + new THREE.Color(tint.r * mean[0], tint.g * mean[1], tint.b * mean[2]).getHexString()).toBe(approved);
    }
  });

  it('boxes masonry UVs onto the triplanar axes and measures height above the ground or river', () => {
    const block = new THREE.BoxGeometry(2, 1, 3).translate(5, .5, 30), placement = new THREE.Matrix4().makeTranslation(0, 1, 0);
    bakeMasonry(block, placement);
    const p = block.getAttribute('position'), n = block.getAttribute('normal'), uv = block.getAttribute('uv'), clearance = block.getAttribute('surfaceClearance');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), axis: Axis = Math.abs(n.getX(i)) > .5 ? 'x' : Math.abs(n.getZ(i)) > .5 ? 'z' : 'y';
      const [u, v] = projected(axis, x, y, z);
      expect(uv.getX(i)).toBeCloseTo(u, 5); expect(uv.getY(i)).toBeCloseTo(v, 5);
      expect(clearance.getX(i)).toBeCloseTo(y + 1 - Math.max(terrainHeight(x, z), WATER_LEVEL), 4);
    }
    // Interior pieces stay clean of the weathering bands.
    const rim = new THREE.TorusGeometry(6, .2, 8, 36); bakeMasonry(rim, undefined, true);
    expect(Math.min(...rim.getAttribute('surfaceClearance').array)).toBeGreaterThan(5);
  });

  it('projects each triangle of a merged, non-indexed mesh along one axis', () => {
    const sphere = new THREE.SphereGeometry(1.3, 12, 8).toNonIndexed().translate(-2, 1, 18);
    bakeMasonry(sphere);
    const p = sphere.getAttribute('position'), uv = sphere.getAttribute('uv');
    for (let t = 0; t < p.count; t += 3) {
      const shared = (['x', 'y', 'z'] as const).filter(axis => [t, t + 1, t + 2].every(i => {
        const [u, v] = projected(axis, p.getX(i), p.getY(i), p.getZ(i));
        return Math.abs(uv.getX(i) - u) < 1e-5 && Math.abs(uv.getY(i) - v) < 1e-5;
      }));
      expect(shared.length, `triangle ${t / 3}`).toBeGreaterThan(0);
    }
  });
});
