import { describe, expect, it } from 'vitest';
import { packProbeAtlas } from '../scripts/probe-atlas';

describe('saved reflection pixels', () => {
  it('preserves a tightly packed half-float readback, including subarray offsets', () => {
    const source = new Uint16Array(20); source.set([1, 2, 3, 4, 5, 6, 7, 8], 4);
    const pixels = packProbeAtlas(source.subarray(4, 12), 1, 2);
    expect([...pixels]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); expect(pixels.byteOffset).toBe(0); expect(pixels.buffer.byteLength).toBe(16);
  });
  it('removes WebGPU row padding without shifting the following rows', () => {
    const source = new Uint16Array(264).fill(65535);
    source.set([1, 2, 3, 4, 5, 6, 7, 8], 0); source.set([9, 10, 11, 12, 13, 14, 15, 16], 128); source.set([17, 18, 19, 20, 21, 22, 23, 24], 256);
    expect([...packProbeAtlas(source, 2, 3)]).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
  it('rejects truncated or unknown layouts instead of exporting shifted reflections', () => {
    expect(() => packProbeAtlas(new Uint16Array(263), 2, 3)).toThrow('Unexpected reflection readback layout');
  });
});
