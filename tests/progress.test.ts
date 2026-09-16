import { describe, expect, it } from 'vitest';
import { parseProgress } from '../src/game/content';

describe('local discovery records', () => {
  it('recovers from damaged or unsupported saves without blocking exploration', () => {
    for (const value of [null, '{', 'null', '{"version":2}', '{"version":1,"discovered":42}']) {
      expect(parseProgress(value)).toEqual({ version: 1, discovered: [], visited: [] });
    }
  });
  it('keeps recognized discoveries once and discards unknown IDs', () => {
    expect(parseProgress(JSON.stringify({ version: 1, discovered: ['nut', 'nut', 'unknown', null], visited: ['energy', 'energy', 'missing'] }))).toEqual({ version: 1, discovered: ['nut'], visited: ['energy'] });
  });
});
