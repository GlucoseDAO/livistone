import { describe, expect, it } from 'vitest';
import { MATSU_COURTYARD as C, COURTYARD_ARRIVAL, COURTYARD_LOWER_ENTRY, COURTYARD_APPROACH, COURTYARD_STAIRS, courtyardWorld, courtyardLocal, courtyardTerrain, courtyardGround, courtyardClearing, courtyardFootprint, courtyardApproachDistance } from '../src/world/matsu-courtyard-layout';

describe('Matsu proposal courtyard layout', () => {
  it('faces the open coastal vista with a compact footprint and safe upper and lower arrivals', () => {
    expect(C.yaw).toBe(-1.2);
    for (const point of [{ x: -6.5, z: -5.8 }, C.stump, { x: 9.5, z: 11.8 }]) {
      const local = courtyardLocal(courtyardWorld(point)); expect(local.x).toBeCloseTo(point.x, 10); expect(local.z).toBeCloseTo(point.z, 10);
    }
    expect(C.planScale).toBe(.7);
    const upper = courtyardWorld({ x: 8, z: 6.8 }), lower = courtyardWorld({ x: 3.8, z: 6.1 });
    expect(COURTYARD_ARRIVAL.x).toBeCloseTo(upper.x, 8); expect(COURTYARD_ARRIVAL.z).toBeCloseTo(upper.z, 8); expect(COURTYARD_ARRIVAL.y).toBeCloseTo(4.45, 8);
    expect(COURTYARD_LOWER_ENTRY.x).toBeCloseTo(lower.x, 8); expect(COURTYARD_LOWER_ENTRY.z).toBeCloseTo(lower.z, 8);
    expect(COURTYARD_APPROACH.at(-1)).toEqual({ x: COURTYARD_LOWER_ENTRY.x, z: COURTYARD_LOWER_ENTRY.z });
  });

  it('keeps terrain below the court and explicit stairs, while preserving the sea and railway', () => {
    for (const local of [C.stump, { x: -5.6, z: -4.5 }, { x: 5.6, z: 5.5 }, ...COURTYARD_STAIRS]) {
      const p = courtyardWorld(local); expect(courtyardTerrain(p.x, p.z, 12)).toBeCloseTo(0, 8);
    }
    const high = courtyardWorld({ x: 8.8, z: 0 }); expect(courtyardTerrain(high.x, high.z, 12)).toBeCloseTo(3.45, 8);
    for (const z of [20, 34.99, 65, 80]) for (const x of [150, 170, 185, 200]) if (x <= 150 || courtyardApproachDistance(x, z) >= 8) expect(courtyardTerrain(x, z, 7.25)).toBe(7.25);
    // The first road threshold straddles z=35: its complete supporting terrain cell must be graded too.
    expect(courtyardTerrain(155, 36, -2)).toBeCloseTo(0, 8);
    for (const p of COURTYARD_APPROACH) expect(courtyardTerrain(p.x, p.z, 12)).toBeCloseTo(0, 8);
  });

  it('reserves full construction, stair, approach and canopy footprints', () => {
    const footprint = courtyardFootprint();
    for (const local of [{ x: -6.5, z: -5.8 }, { x: 9.5, z: 8 }, { x: 9.1, z: 11.8 }, { x: 2.8, z: 7.4 }]) {
      const p = courtyardWorld(local); expect(courtyardGround(p.x, p.z)).toBe(true); expect(courtyardClearing(p.x, p.z, 4)).toBe(true);
      expect(footprint.some(circle => Math.hypot(circle.x - p.x, circle.z - p.z) < circle.radius)).toBe(true);
    }
    for (const p of COURTYARD_APPROACH) expect(courtyardGround(p.x, p.z, 1)).toBe(true);
    expect(courtyardGround(0, 0)).toBe(false); expect(courtyardClearing(0, 0, 4)).toBe(false);
  });

  it('keeps the shared two-metre terrain triangles below the complete lower floor', () => {
    const height = (x: number, z: number): number => {
      const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, u = (x - x0) / 2, v = (z - z0) / 2;
      const h01 = courtyardTerrain(x0, z0 + 2, 12), h10 = courtyardTerrain(x0 + 2, z0, 12);
      if (u + v <= 1) { const h00 = courtyardTerrain(x0, z0, 12); return h00 + (h10 - h00) * u + (h01 - h00) * v; }
      const h11 = courtyardTerrain(x0 + 2, z0 + 2, 12); return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
    };
    for (let x = -5.6; x <= 5.61; x += .4) for (let z = -4.5; z <= 5.51; z += .4) {
      const point = courtyardWorld({ x, z }); expect(height(point.x, point.z), `local ${x}, ${z}`).toBeLessThan(.12);
    }
  });
});
