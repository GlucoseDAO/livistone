// Distant mountain ranges beyond the town's ±520 m terrain (sub-plan 26). Each range is a ridged multifractal (Musgrave 1994)
// over domain-warped gradient noise, mixed with a derivative-damped fbm that keeps detail on crests and smooths it out of the
// valleys, so the slopes read as eroded rather than as smooth blobs. The river and railway valley continues east and west and
// bends away, so its far ends close against slopes instead of an empty horizon. Zero inside the near box: walking ground,
// colliders, planting and the railway portals keep their heights.
import * as THREE from 'three';

/** Where the ranges begin and end: Chebyshev distance from the town for the rise, radius for the far fade. */
export const FAR_RANGES = { rise: [600, 1500], fade: [7200, 8800], valleyZ: 55 } as const;

const permutation = new Uint8Array(512);
{
  let seed = 2611; const order = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { seed = (seed * 1664525 + 1013904223) >>> 0; const j = seed % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  for (let i = 0; i < 512; i++) permutation[i] = order[i & 255];
}
const GRADIENTS = Array.from({ length: 16 }, (_, i) => [Math.cos(i / 16 * Math.PI * 2 + .3), Math.sin(i / 16 * Math.PI * 2 + .3)]);
const noise = { value: 0, dx: 0, dz: 0 };
/** Gradient noise with its analytic derivatives (after Quilez), about ±0.7; writes into `noise`. */
function gradientNoise(x: number, z: number): typeof noise {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, i = ix & 255, j = iz & 255;
  const g = (a: number, b: number): number[] => GRADIENTS[permutation[permutation[i + a] + j + b] & 15];
  const ga = g(0, 0), gb = g(1, 0), gc = g(0, 1), gd = g(1, 1);
  const va = ga[0] * fx + ga[1] * fz, vb = gb[0] * (fx - 1) + gb[1] * fz, vc = gc[0] * fx + gc[1] * (fz - 1), vd = gd[0] * (fx - 1) + gd[1] * (fz - 1);
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1), duz = 30 * fz * fz * (fz * (fz - 2) + 1), k = va - vb - vc + vd;
  noise.value = va + ux * (vb - va) + uz * (vc - va) + ux * uz * k;
  noise.dx = ga[0] + ux * (gb[0] - ga[0]) + uz * (gc[0] - ga[0]) + ux * uz * (ga[0] - gb[0] - gc[0] + gd[0]) + dux * (uz * k + vb - va);
  noise.dz = ga[1] + ux * (gb[1] - ga[1]) + uz * (gc[1] - ga[1]) + ux * uz * (ga[1] - gb[1] - gc[1] + gd[1]) + duz * (ux * k + vc - va);
  return noise;
}
/** Ridged multifractal, about 0–1: sharp crests where |noise| crosses zero, each octave weighted by the one before. */
function ridged(x: number, z: number, octaves: number): number {
  let sum = 0, amplitude = .5, weight = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(gradientNoise(x, z).value) * 1.45; n *= n * weight; weight = Math.min(1, Math.max(0, n * 1.8));
    sum += n * amplitude; total += amplitude; amplitude *= .5;
    const rx = .8 * x - .6 * z, rz = .6 * x + .8 * z; x = rx * 2.03 + 3.1; z = rz * 2.03 - 7.7;
  }
  return sum / total;
}
/** fbm whose octaves fade where the accumulated slope is steep (Quilez, "Elevated"): eroded crests, smooth flanks. About -0.6–0.6. */
function eroded(x: number, z: number, octaves: number): number {
  let sum = 0, amplitude = 1, dx = 0, dz = 0;
  for (let i = 0; i < octaves; i++) {
    const n = gradientNoise(x, z); dx += n.dx; dz += n.dz;
    sum += amplitude * n.value / (1 + dx * dx + dz * dz); amplitude *= .5;
    const rx = .8 * x - .6 * z, rz = .6 * x + .8 * z; x = rx * 2.01 - 1.3; z = rz * 2.01 + 4.9;
  }
  return sum;
}

/** Eroded detail for the town's own ridges outside the walking bounds (terrain.ts): about ±0.6, gullies some 50 m apart. */
export function ridgeErosion(x: number, z: number): number { return eroded(x / 55 + 7.3, z / 55 - 2.1, 5); }

/** Height of the far ranges at (x, z), metres; exactly 0 inside the near box. */
export function farRangeHeight(x: number, z: number): number {
  const box = Math.max(Math.abs(x), Math.abs(z + 20));
  if (box <= FAR_RANGES.rise[0]) return 0;
  const radius = Math.hypot(x, z), rise = THREE.MathUtils.smoothstep(box, FAR_RANGES.rise[0], FAR_RANGES.rise[1]) * (1 - THREE.MathUtils.smoothstep(radius, FAR_RANGES.fade[0], FAR_RANGES.fade[1]));
  if (!rise) return 0;
  // The river and railway valley: it keeps the town's line out to about 700 m, then meanders north and south and narrows to a gorge.
  const bend = THREE.MathUtils.smoothstep(Math.abs(x), 700, 2800), centre = FAR_RANGES.valleyZ + Math.sin(x / 2100 + .6 * Math.sign(x)) * 1100 * bend;
  const half = 190 + Math.abs(x) * .06, valley = THREE.MathUtils.smoothstep(Math.abs(z - centre), half, half + 1300);
  if (!valley) return 0;
  // A slowly varying envelope makes separate massifs and saddles rather than one even wall.
  gradientNoise(x / 4300 + 11.3, z / 4300 - 5.1); const massif = .55 + noise.value * .85;
  gradientNoise(x / 2600 - 3.7, z / 2600 + 8.2); const wx = noise.value; gradientNoise(x / 2600 + 6.1, z / 2600 - 2.4); const wz = noise.value;
  const u = (x + wx * 700) / 2300, v = (z + wz * 700) / 2300;
  const shape = .62 * ridged(u, v, 6) + .38 * (eroded(u * 1.6 + 4.2, v * 1.6 - 1.9, 6) * .7 + .5);
  return Math.max(0, 1050 * massif * rise * valley * Math.pow(Math.max(shape, 0), 1.45));
}
