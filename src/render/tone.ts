// Tone mapping for the output pass (render/output.ts), with CPU mirrors for the colours computed ahead of the GPU: the displayed
// horizon (sky.ts) and the tests. Dev-only `?tone=aces|agx|neutral` (sub-plan 21); ACES, the classic renderer's look, stays the
// default until the owner chooses. Display materials (paper, photographs, signs) skip tone mapping under every variant.
import * as THREE from 'three';
import { Fn, Loop, exp2, float, mat3, max, min, mix, pow, select, sqrt, step, vec3 } from 'three/tsl';
import { agxToneMapping, neutralToneMapping } from 'three/tsl';
import type { Node } from 'three/webgpu';

export type Tone = 'aces' | 'agx' | 'neutral';
export function toneVariant(): Tone {
  if (!import.meta.env.DEV || typeof location === 'undefined') return 'aces';
  const tone = new URLSearchParams(location.search).get('tone');
  return tone === 'agx' || tone === 'neutral' ? tone : 'aces';
}
export const TONE = toneVariant();

type RGB = [number, number, number];
const columns = (c: readonly RGB[]): THREE.Matrix3 => new THREE.Matrix3().set(c[0][0], c[1][0], c[2][0], c[0][1], c[1][1], c[2][1], c[0][2], c[1][2], c[2][2]);
const apply = (m: THREE.Matrix3, v: readonly number[]): RGB => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix3(m).toArray() as RGB;
const clamp01 = (v: number): number => THREE.MathUtils.clamp(v, 0, 1);

// The classic renderer's ACES filmic fit. three's TSL copy multiplies the linear denominator term by .983729 as well (about .4%
// brighter mid-tones); the classic form keeps the round-1 horizon exact. Matrix3.set takes rows.
const ACES_IN = new THREE.Matrix3().set(.59719, .35458, .04823, .076, .90834, .01566, .0284, .13383, .83777);
const ACES_OUT = new THREE.Matrix3().set(1.60475, -.53108, -.07367, -.10208, 1.10813, -.00605, -.00327, -.07276, 1.07602);
const acesFit = (v: number): number => (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .432951) + .238081);

// three's AgX (r186 ToneMappingFunctions.js); its matrices are listed by column, as TSL's mat3(vec3, vec3, vec3) builds them.
const SRGB_TO_REC2020 = columns([[.6274, .0691, .0164], [.3293, .9195, .088], [.0433, .0113, .8956]]);
const REC2020_TO_SRGB = columns([[1.6605, -.1246, -.0182], [-.5876, 1.1329, -.1006], [-.0728, -.0083, 1.1187]]);
const AGX_INSET = columns([[.856627153315983, .137318972929847, .11189821299995], [.0951212405381588, .761241990602591, .0767994186031903], [.0482516061458583, .101439036467562, .811302368396859]]);
const AGX_OUTSET = columns([[1.1271005818144368, -.1413297634984383, -.14132976349843826], [-.11060664309660323, 1.157823702216272, -.11060664309660294], [-.016493938717834573, -.016493938717834257, 1.2519364065950405]]);
const AGX_MIN = -12.47393, AGX_MAX = 4.026069;
const agxCurve = (x: number): number => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + .4298 * x2 + .1191 * x - .00232; };

const TONE_CURVES: Record<Tone, (radiance: readonly number[]) => RGB> = {
  aces: (radiance) => apply(ACES_OUT, apply(ACES_IN, radiance.map(v => v / .6)).map(acesFit)).map(clamp01) as RGB,
  agx: (radiance) => {
    const inset = apply(AGX_INSET, apply(SRGB_TO_REC2020, radiance)).map(v => agxCurve(clamp01((Math.log2(Math.max(v, 1e-10)) - AGX_MIN) / (AGX_MAX - AGX_MIN))));
    return apply(REC2020_TO_SRGB, apply(AGX_OUTSET, inset).map(v => Math.max(0, v) ** 2.2)).map(clamp01) as RGB;
  },
  neutral: (radiance) => {
    const low = Math.min(...radiance), offset = low < .08 ? low - 6.25 * low * low : .04, c = radiance.map(v => v - offset), peak = Math.max(...c);
    if (peak < .76) return c as RGB;
    const newPeak = 1 - .0576 / (peak - .52), g = 1 - 1 / (.15 * (peak - newPeak) + 1);
    return c.map(v => v * newPeak / peak).map(v => v + (newPeak - v) * g) as RGB;
  },
};

/**
 * Exposure gain per curve, so that 18% grey displays as under ACES at the day exposure: the variants compare contrast and
 * highlight handling at matched mid-tones. tests/sky.test.ts checks the match.
 */
export const TONE_GAIN: Record<Tone, number> = { aces: 1, agx: .969, neutral: 1.403 };

/** A linear radiance as the output pass displays it (linear, before sRGB encoding), on the CPU. */
export function toneMapped(radiance: readonly number[], exposure: number, tone: Tone = TONE): THREE.Color {
  const [r, g, b] = TONE_CURVES[tone](radiance.map(v => v * exposure * TONE_GAIN[tone]));
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}
/** Three's classic ACES filmic curve on the CPU, as the output pass applies it on the GPU. */
export const acesFilmic = (radiance: readonly number[], exposure: number): THREE.Color => toneMapped(radiance, exposure, 'aces');

// ---- GPU ----

type V3 = Node<'vec3'>;
type F = Node<'float'>;
const acesNode = Fn(([radiance, exposure]: [V3, F]) => {
  const v = mat3(ACES_IN).mul(radiance.mul(exposure).div(.6)).toVar();
  return mat3(ACES_OUT).mul(v.mul(v.add(.0245786)).sub(.000090537).div(v.mul(v.mul(.983729).add(.432951)).add(.238081))).clamp(0, 1);
});
/** The active curve on the GPU: the radiance the scene renders, as displayed (linear, before sRGB encoding). */
export const toneMapNode = (radiance: V3, exposure: F): V3 => {
  const gained = exposure.mul(TONE_GAIN[TONE]);
  if (TONE === 'agx') return agxToneMapping(radiance, gained) as unknown as V3;
  if (TONE === 'neutral') return neutralToneMapping(radiance, gained) as unknown as V3;
  return acesNode(radiance, gained) as unknown as V3;
};

// Inverses for additive light that must raise the displayed colour by a set amount (night halos). Each undoes its curve step by
// step; the display is held just below white, where every curve flattens out.
const ACES_IN_INVERSE = ACES_IN.clone().invert(), ACES_OUT_INVERSE = ACES_OUT.clone().invert();
// The fit maps this small radiance (per channel, after the input matrix) to zero; subtracting it keeps black at zero.
const ACES_ZERO = (Math.sqrt(.0245786 ** 2 + 4 * .000090537) - .0245786) / 2;
const acesInverse = Fn(([display, exposure]: [V3, F]) => {
  const v = mat3(ACES_OUT_INVERSE).mul(min(display, vec3(.985))).clamp(0, 1.01).toVar();
  // (1 - .983729 v) x² + (.0245786 - .432951 v) x - (.000090537 + .238081 v) = 0, positive root.
  const a = float(1).sub(v.mul(.983729)), b = float(.0245786).sub(v.mul(.432951)), c = float(.000090537).add(v.mul(.238081));
  const x = b.negate().add(sqrt(b.mul(b).add(a.mul(c).mul(4)))).div(a.mul(2));
  return max(mat3(ACES_IN_INVERSE).mul(x).sub(ACES_ZERO), vec3(0)).mul(.6).div(exposure);
});
const neutralInverse = Fn(([display, exposure]: [V3, F]) => {
  const y = min(max(display, vec3(0)), vec3(.985)).toVar(), newPeak = max(y.r, max(y.g, y.b));
  // Above .76 the curve scaled the colour to newPeak and mixed it toward grey by g; peak is the brightest input channel.
  const peak = float(.0576).div(float(1).sub(newPeak)).add(.52), g = float(1).sub(float(1).div(peak.sub(newPeak).mul(.15).add(1)));
  const c = select(newPeak.lessThan(.76), y, y.sub(g.mul(newPeak)).div(float(1).sub(g)).mul(peak.div(newPeak))).toVar();
  // The toe offset: 6.25 x² below an input minimum of .08, .04 above.
  const low = min(c.r, min(c.g, c.b)), offset = select(low.lessThan(.04), sqrt(max(low, 0)).mul(.4).sub(low), float(.04));
  return c.add(offset).div(exposure);
});
const AGX_DECODE = { outset: AGX_OUTSET.clone().invert(), display: REC2020_TO_SRGB.clone().invert(), inset: AGX_INSET.clone().multiply(SRGB_TO_REC2020).invert() };
const agxInverse = Fn(([display, exposure]: [V3, F]) => {
  const outset = mat3(AGX_DECODE.outset).mul(pow(max(mat3(AGX_DECODE.display).mul(min(max(display, vec3(0)), vec3(.985))), vec3(0)), vec3(1 / 2.2))).toVar();
  // The contrast polynomial rises monotonically over [0, 1]: bisect each channel (arithmetic steps, valid on both backends).
  const lo = vec3(0).toVar(), hi = vec3(1).toVar();
  Loop(16, () => {
    const x = lo.add(hi).mul(.5).toVar(), x2 = x.mul(x), x4 = x2.mul(x2);
    const curve = x4.mul(x2).mul(15.5).sub(x4.mul(x).mul(40.14)).add(x4.mul(31.96)).sub(x2.mul(x).mul(6.868)).add(x2.mul(.4298)).add(x.mul(.1191)).sub(.00232);
    const below = step(curve, outset);
    lo.assign(mix(lo, x, below)); hi.assign(mix(x, hi, below));
  });
  const encoded = exp2(lo.add(hi).mul(.5).mul(AGX_MAX - AGX_MIN).add(AGX_MIN));
  return max(mat3(AGX_DECODE.inset).mul(encoded), vec3(0)).div(exposure);
});
/** The linear radiance that the output pass displays as `display` (linear, 0–1): the inverse of toneMapNode. */
export const untoneMapNode = (display: V3, exposure: F): V3 => {
  const gained = exposure.mul(TONE_GAIN[TONE]);
  const inverse = TONE === 'agx' ? agxInverse : TONE === 'neutral' ? neutralInverse : acesInverse;
  return inverse(display, gained) as unknown as V3;
};
/** The CPU inverse, mirroring untoneMapNode step by step (tests check the round trip). */
export function untoneMapped(display: readonly number[], exposure: number, tone: Tone = TONE): RGB {
  const gained = exposure * TONE_GAIN[tone], y = display.map(v => THREE.MathUtils.clamp(v, 0, .985));
  if (tone === 'neutral') {
    const newPeak = Math.max(...y), peak = .0576 / (1 - newPeak) + .52, g = 1 - 1 / (.15 * (peak - newPeak) + 1);
    const c = newPeak < .76 ? y : y.map(v => (v - g * newPeak) / (1 - g) * peak / newPeak), low = Math.min(...c);
    const offset = low < .04 ? .4 * Math.sqrt(Math.max(low, 0)) - low : .04;
    return c.map(v => (v + offset) / gained) as RGB;
  }
  if (tone === 'agx') {
    const outset = apply(AGX_DECODE.outset, apply(AGX_DECODE.display, y).map(v => Math.max(v, 0) ** (1 / 2.2)));
    const encoded = outset.map(p => { let lo = 0, hi = 1; for (let i = 0; i < 16; i++) { const x = (lo + hi) / 2; if (agxCurve(x) <= p) lo = x; else hi = x; } return 2 ** ((lo + hi) / 2 * (AGX_MAX - AGX_MIN) + AGX_MIN); });
    return apply(AGX_DECODE.inset, encoded).map(v => Math.max(v, 0) / gained) as RGB;
  }
  const v = apply(ACES_OUT_INVERSE, y).map(v => THREE.MathUtils.clamp(v, 0, 1.01));
  const x = v.map(v => { const a = 1 - .983729 * v, b = .0245786 - .432951 * v, c = .000090537 + .238081 * v; return (-b + Math.sqrt(b * b + 4 * a * c)) / (2 * a); });
  return apply(ACES_IN_INVERSE, x).map(v => Math.max(v - ACES_ZERO, 0) * .6 / gained) as RGB;
}
