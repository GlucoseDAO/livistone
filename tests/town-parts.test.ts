import { describe, expect, it } from 'vitest';
import { PART_MARGIN, around, footprintCentre, footprintDistance, footprintOf, neededAtArrival } from '../src/world/town-parts';
import { SPAWN } from '../src/game/content';
import { graphicsProfile } from '../src/game/graphics';
import { GARDENS } from '../src/world/living-waters-layout';
import { FUTURE_HOUSE } from '../src/world/elevated-layout';
import { ENHANCEMENT } from '../src/world/enhancement-layout';
import { WINTER } from '../src/world/winter-gate-layout';
import { STATION } from '../src/world/station-layout';
import { TRAIL_SAMPLES } from '../src/world/mountain-layout';

describe('progressive loading footprints', () => {
  it('measure from the nearest circle edge and centre', () => {
    const footprint = [...around(0, 0, 10), ...around(100, 0, 5)];
    expect(footprintDistance(footprint, { x: 30, z: 0 })).toBeCloseTo(20);
    expect(footprintDistance(footprint, { x: 0, z: 4 })).toBeLessThan(0);
    expect(footprintCentre(footprint, { x: 90, z: 0 })).toBeCloseTo(10);
  });

  it('chain circles along a line that cover every point with the margin', () => {
    const chain = footprintOf(TRAIL_SAMPLES, 12);
    expect(chain.length).toBeLessThan(TRAIL_SAMPLES.length);
    for (const point of TRAIL_SAMPLES) expect(footprintDistance(chain, point)).toBeLessThanOrEqual(-12 + 1e-6);
  });

  it('keep what the walking view reaches from the arrival point at loading, on every tier', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
      const fog = graphicsProfile(tier).fog;
      expect(neededAtArrival(around(SPAWN.x, SPAWN.z, 1), fog)).toBe(true);
      expect(neededAtArrival(around(STATION.x, STATION.z, 20), fog)).toBe(true);
      // Exactly at the view's edge plus the margin still counts as needed.
      expect(neededAtArrival(around(SPAWN.x, SPAWN.z - fog - PART_MARGIN - 5, 5), fog)).toBe(true);
      expect(neededAtArrival(around(SPAWN.x, SPAWN.z - fog - PART_MARGIN - 6, 5), fog)).toBe(false);
    }
  });

  it('let the distant places wait for the first view', () => {
    const fog = graphicsProfile('gpu').fog;
    for (const [name, footprint] of [['Living Waters', around(GARDENS.x, GARDENS.z, GARDENS.radius)], ['Future House', around(FUTURE_HOUSE.x, FUTURE_HOUSE.z, 32)], ['Enhancement', around(ENHANCEMENT.x, ENHANCEMENT.z, 45)], ['Eye of Winter', around(WINTER.x, WINTER.z, 40)], ['trail crags', footprintOf(TRAIL_SAMPLES, 60)]] as const)
      expect(neededAtArrival(footprint, fog), name).toBe(false);
  });
});
