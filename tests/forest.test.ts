import { describe, expect, it } from 'vitest';
import { forestLod } from '../src/world/forest';
import { aerialFog, aerialParams } from '../src/render/aerial';
import { graphicsProfile } from '../src/game/graphics';

describe('forest distance detail', () => {
  it('keeps full cards nearby, thins them, then hides cells only once their nearest tree is in full fog', () => {
    expect(forestLod(20, 10, 150)).toBe('full');
    expect(forestLod(50, 30, 150)).toBe('reduced');
    // A cell whose centre is far but whose nearest tree is not stays drawn.
    expect(forestLod(170, 149, 150)).toBe('reduced');
    expect(forestLod(180, 150, 150)).toBe('hidden');
  });

  it('culls trees on gpu and mobile only where the walking fog is complete', () => {
    for (const tier of ['gpu', 'mobile'] as const) {
      const profile = graphicsProfile(tier), reach = Math.min(profile.fog, profile.forest);
      expect(reach).toBe(profile.fog);
      // Whatever the heights of eye and tree, the fog is entire sky where trees stop.
      for (const [eye, y] of [[1.8, 0], [1.8, 45], [32, 2], [-1, 60]]) for (const channel of aerialFog(reach, eye, y, aerialParams(tier))) expect(channel).toBeCloseTo(1, 9);
    }
    // The cpu tier keeps its shorter forest inside its own linear fog.
    expect(graphicsProfile('cpu').forest).toBeLessThan(graphicsProfile('cpu').fog);
  });
});
