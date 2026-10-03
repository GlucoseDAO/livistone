import { describe, expect, it } from 'vitest';
import { paperBackground } from '../scripts/paper-background.mjs';

const PAPER = [244, 240, 229];
/** A studio shot in miniature: a vignetted, slightly blue sweep; a red stone; a silver ring whose hole shows the sweep; a soft shadow. */
function studio(width = 240, height = 180, sweep = (x: number, y: number) => 252 - 10 * (((x - 120) / 120) ** 2 + ((y - 90) / 90) ** 2)): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, s = sweep(x, y), stone = Math.hypot(x - 70, y - 80), ring = Math.hypot(x - 170, y - 80), shadow = Math.hypot((x - 70) / 2.2, y - 112);
    let c = [s, s, s + 3];
    if (shadow < 12) c = c.map((v) => v * (.78 + .22 * shadow / 12));
    if (stone < 22) c = [190, 35, 45];
    if (ring < 34 && ring > 22) c = [150, 152, 156];
    rgb.set(c.map((v) => Math.round(Math.min(255, v))), i);
  }
  return rgb;
}
const at = (rgb: Uint8Array, width: number, x: number, y: number): number[] => Array.from(rgb.subarray((y * width + x) * 3, (y * width + x) * 3 + 3));

describe('catalogue photographs on paper (sub-plan 12)', () => {
  it('turns the white sweep and the enclosed hole of a ring into exact paper and keeps the jewel', () => {
    const out = paperBackground(studio(), 240, 180)!;
    expect(out).not.toBeNull();
    for (const [x, y] of [[2, 2], [237, 177], [120, 10], [5, 170], [170, 80]]) expect(at(out, 240, x, y), `${x}, ${y}`).toEqual(PAPER);
    expect(at(out, 240, 70, 80)).toEqual([190, 35, 45]);
    expect(at(out, 240, 170, 52)).toEqual([150, 152, 156]);
  });
  it('keeps shadows as darker paper that deepens smoothly', () => {
    const out = paperBackground(studio(), 240, 180)!, row = Array.from({ length: 34 }, (_, i) => at(out, 240, 70 + i, 112));
    const core = row[0];
    expect(core[0]).toBeLessThan(PAPER[0] - 10); expect(core[0]).toBeGreaterThan(core[2]);
    // Toward the shadow's rim the paper returns without a jump larger than the shadow's own gradient.
    for (let i = 1; i < row.length; i++) expect(Math.abs(row[i][0] - row[i - 1][0])).toBeLessThan(8);
    expect(row.at(-1)).toEqual(PAPER);
  });
  it('leaves backgrounds that are not a white sweep alone', () => {
    expect(paperBackground(studio(240, 180, () => 120), 240, 180)).toBeNull();
  });
});
