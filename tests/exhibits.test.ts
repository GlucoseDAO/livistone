import { describe, expect, it } from 'vitest';
import { photoSize } from '../src/game/exhibits';
import { PIECE_STORIES } from '../src/game/piece-stories';
import { LANDMARKS, SPAWN } from '../src/game/content';

describe('photographs retain their proportions on planar displays and in the viewer', () => {
  it.each([[600, 1600], [2400, 900], [1024, 1024], [500, 2400]])('contains a %s × %s source without cropping or stretching', (width, height) => {
    const size = photoSize(width, height);
    expect(size.width / size.height).toBeCloseTo(width / height, 8);
    expect(size.width).toBeLessThanOrEqual(2.8); expect(size.height).toBeLessThanOrEqual(2.3);
    const viewer = photoSize(width, height, 358, 422);
    expect(viewer.width / viewer.height).toBeCloseTo(width / height, 8);
    expect(viewer.width).toBeLessThanOrEqual(358); expect(viewer.height).toBeLessThanOrEqual(422);
  });
});


describe('curated catalogue', () => {
  it('assigns each physical work exactly once and ships local thumbnails/full images', async () => {
    const { COLLECTION } = await import('../src/game/exhibits'); const { existsSync } = await import('node:fs');
    expect(COLLECTION).toHaveLength(35); expect(new Set(COLLECTION.map((p) => p.discovery)).size).toBe(35);
    for (const [location, count] of [['city-hall', 8], ['energy', 8], ['science', 9], ['station', 7]] as const) expect(COLLECTION.filter((p) => p.location === location)).toHaveLength(count);
    for (const piece of COLLECTION) { expect(piece.materials.length).toBeGreaterThan(0); expect(piece.year).toMatch(/^20\d\d$/); expect(PIECE_STORIES[piece.discovery]?.length).toBeGreaterThan(40); expect((piece.story ?? piece.description).length).toBeGreaterThan(40); for (const photo of piece.photos) { expect(existsSync('public/images/jewelry/' + photo.file)).toBe(true); expect(existsSync('public/images/jewelry/' + photo.thumb)).toBe(true); } }
  });
  it('lands at the station looking toward the city gate', () => {
    expect(SPAWN.yaw).toBe(0);
    expect(LANDMARKS.find((place) => place.id === 'station')!.entrance.yaw).toBe(0);
  });
});
