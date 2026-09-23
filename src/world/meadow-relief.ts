import { plantingAllowed } from './landscape';

const STEP = 2, MIN_X = -110, MIN_Z = -68, WIDTH = 111, DEPTH = 65;
const distances = new Float32Array(WIDTH * DEPTH), heights = new Float32Array(WIDTH * DEPTH);
// Bake clearance once. The extra margin keeps interpolated slopes outside authored footprints.
for (let j = 0; j < DEPTH; j++) for (let i = 0; i < WIDTH; i++) {
  distances[j * WIDTH + i] = i && j && i < WIDTH - 1 && j < DEPTH - 1 && plantingAllowed(MIN_X + i * STEP, MIN_Z + j * STEP, 2.5) ? 1000 : 0;
}
// A two-pass distance field lets broad rolls taper smoothly around paths and buildings.
for (const direction of [1, -1]) {
  for (let j = direction > 0 ? 1 : DEPTH - 2; direction > 0 ? j < DEPTH - 1 : j > 0; j += direction)
    for (let i = direction > 0 ? 1 : WIDTH - 2; direction > 0 ? i < WIDTH - 1 : i > 0; i += direction) {
      const n = j * WIDTH + i;
      distances[n] = Math.min(distances[n], distances[n - direction] + STEP, distances[n - direction * WIDTH] + STEP, distances[n - direction * WIDTH - 1] + STEP * Math.SQRT2, distances[n - direction * WIDTH + 1] + STEP * Math.SQRT2);
    }
}
for (let j = 0; j < DEPTH; j++) for (let i = 0; i < WIDTH; i++) {
  const n = j * WIDTH + i, x = MIN_X + i * STEP, z = MIN_Z + j * STEP;
  const t = Math.min(1, distances[n] / 7), clearance = t * t * (3 - 2 * t);
  const rolls = 1.5 + Math.sin(x * .095 + z * .04) * .6 + Math.sin(z * .135 - x * .035 + 1.7) * .4;
  heights[n] = clearance * rolls;
}
export function meadowRelief(x: number, z: number): number {
  const gx = (x - MIN_X) / STEP, gz = (z - MIN_Z) / STEP, i = Math.floor(gx), j = Math.floor(gz);
  if (i < 0 || j < 0 || i >= WIDTH - 1 || j >= DEPTH - 1) return 0;
  const u = gx - i, v = gz - j, n = j * WIDTH + i;
  return (heights[n] * (1 - u) + heights[n + 1] * u) * (1 - v) + (heights[n + WIDTH] * (1 - u) + heights[n + WIDTH + 1] * u) * v;
}
