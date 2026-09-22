import { describe, expect, it } from 'vitest';
import { nightFromDate } from '../src/game/daylight';
import { DISCOVERIES } from '../src/game/content';
import { RESEARCH_POSTERS } from '../src/game/research';

describe('local night and exhibition sources', () => {
  it('treats midsummer noon as day and winter midnight as night', () => {
    expect(nightFromDate(new Date(2026, 5, 21, 12, 0, 0))).toBe(false);
    expect(nightFromDate(new Date(2026, 0, 15, 0, 30, 0))).toBe(true);
    expect(nightFromDate(new Date(2026, 8, 22, 23, 10, 0))).toBe(true);
    expect(nightFromDate(new Date(2026, 8, 22, 14, 0, 0))).toBe(false);
  });
  it('uses latitude for polar day and night when supplied', () => {
    expect(nightFromDate(new Date(2026, 5, 21, 2, 0, 0), 78)).toBe(false);
    expect(nightFromDate(new Date(2026, 11, 21, 13, 0, 0), 78)).toBe(true);
  });
  it('keeps train cabin announcements and the public Kyiv slides', () => {
    expect(DISCOVERIES.map((d) => d.id)).toEqual(expect.arrayContaining(['train-future', 'train-science', 'train-art', 'living-vittoria', 'living-dewdrop']));
    for (const id of ['train-future', 'train-science', 'train-art']) {
      const found = DISCOVERIES.find((d) => d.id === id)!;
      expect(found.links?.some((link) => link.url.includes('livia.glucosedao.org/pieces'))).toBe(true);
    }
    expect(RESEARCH_POSTERS.some((poster) => poster.links?.some((link) => link.url.includes('1KJa-wgU9ljGFznFV')))).toBe(true);
  });
});
