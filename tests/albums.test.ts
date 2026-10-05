import { describe, expect, it } from 'vitest';
import { COLLECTION } from '../src/game/exhibits';
import { panelCollection, panelImages } from '../src/ui/album';

describe('building albums', () => {
  it('keeps pieces in their actual exhibition, including relocated works', () => {
    const ids = panelCollection('eyelense');
    expect(ids).toContain('deep-sea-pearl');
    expect(ids).not.toContain('nut');
    for (const piece of COLLECTION.filter(p => p.location === 'future-house')) expect(ids).toContain(piece.discovery);
    const images = panelImages('eyelense');
    expect(images.some(p => p.discovery === 'deep-sea-pearl')).toBe(true);
    expect(images.every(p => ids.includes(p.discovery!))).toBe(true);
  });
  it('keeps a gate reference photograph inside that gate’s album', () => {
    const images = panelImages('winter-gate-story');
    expect(images.length).toBeGreaterThan(0);
    expect(images.every(image => image.discovery === 'winter-gate-story')).toBe(true);
    expect(images.some(image => image.discovery === 'mitoring')).toBe(false);
  });
});
