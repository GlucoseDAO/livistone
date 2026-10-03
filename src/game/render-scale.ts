import type { GraphicsTier } from './graphics';

/** How one graphics tier trades resolution for frame rate (sub-plans 06 and 25). */
export interface ScaleRule {
  /** Frames per second to hold. */ target: number;
  /** Render scale bounds; the ceiling also stops at the tier's own pixel ratio. */ floor: number; ceiling: number;
  /** Seconds continuously under the target before lowering. */ lowerAfter: number;
  /** Seconds continuously above target × (1 + headroom) before each raise; Infinity never raises. */ raiseEvery: number; headroom: number;
  /** Raise step, and the smallest fall. */ step: number;
  /** Lower in proportion to the shortfall (frame cost follows pixel count, the square of the scale) rather than one step. */ proportional: boolean;
}
export const SCALE_RULES: Record<GraphicsTier, ScaleRule> = {
  gpu: { target: 50, floor: 1, ceiling: 1.5, lowerAfter: 2, raiseEvery: 4, headroom: .15, step: .05, proportional: true },
  mobile: { target: 28, floor: .75, ceiling: 1, lowerAfter: 2, raiseEvery: 4, headroom: .15, step: .05, proportional: true },
  // The software renderer keeps its earlier rule: a step down after every second under 18 fps, to .3, and never back up.
  cpu: { target: 18, floor: .3, ceiling: .55, lowerAfter: 1, raiseEvery: Infinity, headroom: 0, step: .05, proportional: false },
};
const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Hysteresis on one-second frame-rate samples: lower soon after a sustained shortfall, recover slowly while there is clear
 * headroom, and stay put in between. A scale that failed stays out of reach until the frame rate shows three times the usual
 * headroom (the scene got lighter), so recovery never bounces back into it. Pure: main.ts feeds it samples and applies the
 * scale; ?capture=1 does not feed it.
 */
export class RenderScale {
  private below = 0;
  private above = 0;
  private failed = Infinity;
  private clear = 0;
  readonly ceiling: number;
  readonly floor: number;
  scale: number;
  constructor(readonly rule: ScaleRule, start: number) {
    this.ceiling = round(Math.min(rule.ceiling, start)); this.floor = round(Math.min(rule.floor, this.ceiling)); this.scale = this.ceiling;
  }
  /** One frame-rate sample over `seconds`; returns the scale to render at from now on. */
  sample(fps: number, seconds: number): number {
    const { target, lowerAfter, raiseEvery, headroom, step, proportional } = this.rule;
    this.clear = fps > target * (1 + 3 * headroom) ? this.clear + seconds : 0;
    if (this.clear >= raiseEvery) this.failed = Infinity;
    if (fps < target) {
      this.above = 0; this.below += seconds;
      if (this.below >= lowerAfter && this.scale > this.floor) {
        const scaled = proportional ? this.scale * Math.sqrt(Math.max(fps, 1) / target) : Infinity;
        this.failed = this.scale; this.below = 0;
        this.scale = round(Math.max(this.floor, Math.min(this.scale - step, scaled)));
      }
    } else if (fps > target * (1 + headroom)) {
      this.below = 0; this.above += seconds;
      const next = round(Math.min(this.ceiling, this.scale + step));
      if (this.above >= raiseEvery && next > this.scale && next < this.failed) { this.scale = next; this.above = 0; }
    } else { this.below = 0; this.above = 0; }
    return this.scale;
  }
}
