import { describe, expect, it } from 'vitest';
import { aerialFog, aerialParams, heightDensity } from '../src/render/aerial';
import { graphicsProfile } from '../src/game/graphics';

const gpu = aerialParams('gpu'), mobile = aerialParams('mobile');

describe('height falloff', () => {
  it('integrates the exponential density along the ray', () => {
    for (const [a, b] of [[1.8, 0], [1.8, 40], [30, 2], [0, 0], [-2, 12]]) {
      // Midpoint sum of floor + (1 - floor) e^(-y / falloff) between the two heights.
      let sum = 0; const steps = 4000;
      for (let i = 0; i < steps; i++) { const y = a + (b - a) * (i + .5) / steps; sum += gpu.floor + (1 - gpu.floor) * Math.exp(-y / gpu.falloff); }
      expect(heightDensity(a, b, gpu)).toBeCloseTo(sum / steps, 4);
      expect(heightDensity(a, b, gpu)).toBeCloseTo(heightDensity(b, a, gpu), 9);
    }
  });

  it('is densest on the valley floor and thins toward its floor share up the hills', () => {
    expect(heightDensity(0, 0, gpu)).toBeCloseTo(1, 9);
    expect(heightDensity(1.8, 30, gpu)).toBeLessThan(heightDensity(1.8, 0, gpu));
    expect(heightDensity(1.8, 60, gpu)).toBeLessThan(heightDensity(1.8, 30, gpu));
    expect(heightDensity(400, 400, gpu)).toBeCloseTo(gpu.floor, 3);
  });
});

describe('aerial perspective', () => {
  it('leaves the near scene clear and the middle distance only gently hazed', () => {
    for (const p of [gpu, mobile]) {
      for (const channel of aerialFog(p.start, 1.8, 0, p)) expect(channel).toBe(0);
      expect(Math.max(...aerialFog(40, 1.8, 0, p))).toBeLessThan(.02);
    }
    // Linear light: 5% of sky over a dark tree already reads as about a fifth of the way to the sky.
    expect(Math.max(...aerialFog(70, 1.8, 0, gpu))).toBeLessThan(.05);
    // Where the old fog (42–130 m, mixed after encoding) was half way, this haze is still under a sixth.
    expect(aerialFog(86, 1.8, 0, gpu)[1]).toBeLessThan(.15);
  });

  it('thickens steadily with distance and is entire sky at the full-fog distance', () => {
    for (const p of [gpu, mobile]) {
      let previous = [0, 0, 0];
      for (let d = 0; d <= p.full + 20; d += 2.5) {
        const fog = aerialFog(d, 1.8, 2, p);
        fog.forEach((channel, i) => { expect(channel).toBeGreaterThanOrEqual(previous[i] - 1e-12); expect(channel).toBeLessThanOrEqual(1); });
        previous = fog;
      }
      for (const [eye, y] of [[1.8, 0], [1.8, 60], [35, 0], [35, 35]]) for (const channel of aerialFog(p.full, eye, y, p)) expect(channel).toBeCloseTo(1, 9);
      // Most of the way there just before it, so the far plane and tree culling there change nothing visible.
      expect(Math.min(...aerialFog(p.full - 3, 1.8, 0, p))).toBeGreaterThan(.97);
    }
    expect(gpu.full).toBe(graphicsProfile('gpu').fog); expect(mobile.full).toBe(graphicsProfile('mobile').fog); expect(mobile.full).toBeLessThan(gpu.full);
  });

  it('shifts distance slightly toward blue', () => {
    for (const d of [60, 100, 120]) {
      const [r, g, b] = aerialFog(d, 1.8, 0, gpu);
      expect(b).toBeGreaterThan(g); expect(g).toBeGreaterThan(r);
      expect(b / g).toBeLessThan(1.6);
    }
  });

  it('hazes hillsides less than the valley floor at the same distance', () => {
    const floor = aerialFog(70, 1.8, 0, gpu)[1], hill = aerialFog(70, 1.8, 30, gpu)[1];
    expect(hill).toBeLessThan(floor * .85); expect(hill).toBeGreaterThan(0);
  });
});
