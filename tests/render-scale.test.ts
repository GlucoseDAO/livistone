import { describe, expect, it } from 'vitest';
import { RenderScale, SCALE_RULES } from '../src/game/render-scale';

/** Feed one-second samples from a frame-rate model of the current scale; returns the scale after each second. */
function run(scaler: RenderScale, seconds: number, fps: (scale: number) => number): number[] {
  return Array.from({ length: seconds }, () => scaler.sample(fps(scaler.scale), 1));
}
const changes = (trace: number[]): number => trace.filter((scale, i) => i && scale !== trace[i - 1]).length;

describe('adaptive render scale', () => {
  it('stays put while the frame rate is inside the band', () => {
    const scaler = new RenderScale(SCALE_RULES.gpu, 1.5);
    expect(new Set(run(scaler, 60, () => 52))).toEqual(new Set([1.5]));
    expect(new Set(run(new RenderScale(SCALE_RULES.mobile, 1), 60, () => 30))).toEqual(new Set([1]));
  });
  it('lowers after two seconds under target, in proportion, and never below the floor', () => {
    const gpu = new RenderScale(SCALE_RULES.gpu, 1.5), trace = run(gpu, 12, () => 40);
    expect(trace[0]).toBe(1.5); expect(trace[1]).toBeCloseTo(1.5 * Math.sqrt(40 / 50), 2);
    expect(Math.min(...trace)).toBe(1); expect(trace.at(-1)).toBe(1);
    const mobile = new RenderScale(SCALE_RULES.mobile, 1);
    expect(Math.min(...run(mobile, 20, () => 10))).toBe(.75);
    // A device whose own pixel ratio is lower never scales above it.
    expect(new RenderScale(SCALE_RULES.gpu, 1).ceiling).toBe(1);
  });
  it('recovers by .05 every four seconds with 15% headroom, up to the ceiling', () => {
    const scaler = new RenderScale(SCALE_RULES.mobile, 1);
    run(scaler, 2, () => 10); expect(scaler.scale).toBe(.75);
    // Clearly lighter now (over three times the headroom): the failed scale is released and recovery runs to the ceiling.
    const trace = run(scaler, 40, () => 60);
    expect(trace.slice(0, 3)).toEqual([.75, .75, .75]); expect(trace[3]).toBe(.8); expect(trace[7]).toBe(.85);
    expect(trace.at(-1)).toBe(1); expect(Math.max(...trace)).toBe(1);
  });
  it('settles without oscillating on a pixel-bound and on a cliff-shaped frame rate', () => {
    // Frame time follows pixel count: 49 fps at 1.2, so 1.15 holds the target.
    const pixels = new RenderScale(SCALE_RULES.gpu, 1.5), smooth = run(pixels, 300, (scale) => 49 * (1.2 / scale) ** 2);
    expect(changes(smooth.slice(30))).toBe(0); expect(smooth.at(-1)).toBeGreaterThanOrEqual(1.1); expect(49 * (1.2 / smooth.at(-1)!) ** 2).toBeGreaterThanOrEqual(50);
    // A cliff above 1.1: recovery must not climb back over it again and again.
    const cliff = new RenderScale(SCALE_RULES.gpu, 1.5), stepped = run(cliff, 600, (scale) => scale > 1.1 ? 40 : 60);
    expect(changes(stepped.slice(60))).toBe(0); expect(stepped.at(-1)).toBeLessThanOrEqual(1.1); expect(stepped.at(-1)).toBeGreaterThanOrEqual(1);
    // Alternating samples around the target do not move it either.
    const noisy = new RenderScale(SCALE_RULES.gpu, 1.5); let second = 0;
    expect(changes(run(noisy, 120, () => (second++ % 2 ? 47 : 56)))).toBe(0);
  });
  it('keeps the software renderer rule: a step down per second under 18 fps, to .3, never back up', () => {
    const scaler = new RenderScale(SCALE_RULES.cpu, .55), trace = run(scaler, 10, () => 12);
    expect(trace.slice(0, 3)).toEqual([.5, .45, .4]); expect(trace.at(-1)).toBe(.3);
    expect(new Set(run(scaler, 60, () => 60))).toEqual(new Set([.3]));
  });
});
