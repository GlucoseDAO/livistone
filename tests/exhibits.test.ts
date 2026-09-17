import { describe, expect, it } from 'vitest';
import { photoSize } from '../src/game/exhibits';

describe('photographs retain their proportions on curved displays and in the viewer', () => {
  it.each([[600, 1600], [2400, 900], [1024, 1024], [500, 2400]])('contains a %s × %s source without cropping or stretching', (width, height) => {
    const size = photoSize(width, height);
    expect(size.width / size.height).toBeCloseTo(width / height, 8);
    expect(size.width).toBeLessThanOrEqual(2.8); expect(size.height).toBeLessThanOrEqual(2.3);
    const viewer = photoSize(width, height, 358, 422);
    expect(viewer.width / viewer.height).toBeCloseTo(width / height, 8);
    expect(viewer.width).toBeLessThanOrEqual(358); expect(viewer.height).toBeLessThanOrEqual(422);
  });
});


describe('curved text control hit regions', () => {
  it('maps every drawn button to the same UV region used by raycasting', async () => {
    const { TEXT_ACTIONS, TEXT_WIDTH, TEXT_HEIGHT, textAction } = await import('../src/world/exhibition-text');
    for (const r of TEXT_ACTIONS) expect(textAction((r.x + r.width / 2) / TEXT_WIDTH, 1 - (r.y + r.height / 2) / TEXT_HEIGHT)).toBe(r.action);
    expect(textAction(.5, .9)).toBeUndefined();
  });
});
