// Tone mapping for the output pass (render/output.ts): Khronos PBR Neutral, the owner's choice over ACES and AgX (sub-plan 21,
// 3 October 2026), with CPU mirrors for the colours computed ahead of the GPU (the displayed horizon in sky.ts) and the tests.
// Neutral keeps base colours' hue and saturation up to about 80% of white and only then rolls highlights off toward white.
// Display materials (paper, photographs, signs) skip it.
import * as THREE from 'three';
import { Fn, float, max, min, neutralToneMapping, select, sqrt, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

type RGB = [number, number, number];
type V3 = Node<'vec3'>;
type F = Node<'float'>;

/**
 * Exposure gain inside the curve, so that 18% grey displays as under the classic ACES fit the town's lights and sky were tuned
 * with (rounds 1–2): mid-tones keep their level, contrast and highlights change. Bloom (render/post.ts) thresholds the plain
 * exposure, so it gathers the same radiance as before. tests/sky.test.ts checks the match.
 */
export const NEUTRAL_GAIN = 1.403;

/** Khronos PBR Neutral (three's NeutralToneMapping), per colour, on exposed radiance. */
function neutral(radiance: readonly number[]): RGB {
  const low = Math.min(...radiance), offset = low < .08 ? low - 6.25 * low * low : .04, c = radiance.map(v => v - offset), peak = Math.max(...c);
  if (peak < .76) return c as RGB;
  const newPeak = 1 - .0576 / (peak - .52), g = 1 - 1 / (.15 * (peak - newPeak) + 1);
  return c.map(v => v * newPeak / peak).map(v => v + (newPeak - v) * g) as RGB;
}

/** A linear radiance as the output pass displays it (linear, before sRGB encoding), on the CPU. */
export function toneMapped(radiance: readonly number[], exposure: number): THREE.Color {
  const [r, g, b] = neutral(radiance.map(v => v * exposure * NEUTRAL_GAIN)).map(v => THREE.MathUtils.clamp(v, 0, 1));
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}
/** The curve on the GPU: the radiance the scene renders, as displayed (linear, before sRGB encoding). */
export const toneMapNode = (radiance: V3, exposure: F): V3 => neutralToneMapping(radiance, exposure.mul(NEUTRAL_GAIN)) as unknown as V3;

// The inverse, for additive light that must raise the displayed colour by a set amount (night halos). It undoes the curve step
// by step; the display is held just below white, where the curve flattens out.
const neutralInverse = Fn(([display, exposure]: [V3, F]) => {
  const y = min(max(display, vec3(0)), vec3(.985)).toVar(), newPeak = max(y.r, max(y.g, y.b));
  // Above .76 the curve scaled the colour to newPeak and mixed it toward grey by g; peak is the brightest input channel.
  const peak = float(.0576).div(float(1).sub(newPeak)).add(.52), g = float(1).sub(float(1).div(peak.sub(newPeak).mul(.15).add(1)));
  const c = select(newPeak.lessThan(.76), y, y.sub(g.mul(newPeak)).div(float(1).sub(g)).mul(peak.div(newPeak))).toVar();
  // The toe offset: 6.25 x² below an input minimum of .08, .04 above.
  const low = min(c.r, min(c.g, c.b)), offset = select(low.lessThan(.04), sqrt(max(low, 0)).mul(.4).sub(low), float(.04));
  return c.add(offset).div(exposure);
});
/** The linear radiance that the output pass displays as `display` (linear, 0–1): the inverse of toneMapNode. */
export const untoneMapNode = (display: V3, exposure: F): V3 => neutralInverse(display, exposure.mul(NEUTRAL_GAIN)) as unknown as V3;
/** The CPU inverse, mirroring untoneMapNode step by step (tests check the round trip). */
export function untoneMapped(display: readonly number[], exposure: number): RGB {
  const y = display.map(v => THREE.MathUtils.clamp(v, 0, .985)), newPeak = Math.max(...y), peak = .0576 / (1 - newPeak) + .52, g = 1 - 1 / (.15 * (peak - newPeak) + 1);
  const c = newPeak < .76 ? y : y.map(v => (v - g * newPeak) / (1 - g) * peak / newPeak), low = Math.min(...c);
  const offset = low < .04 ? .4 * Math.sqrt(Math.max(low, 0)) - low : .04;
  return c.map(v => (v + offset) / (exposure * NEUTRAL_GAIN)) as RGB;
}
