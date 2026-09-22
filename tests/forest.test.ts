import { describe, expect, it } from 'vitest';
import { forestLod } from '../src/world/forest';

describe('forest distance detail', () => {
  it('keeps full cards nearby, thins them, then hides them in the fog', () => {
    expect(forestLod(20, 130)).toBe('full');
    expect(forestLod(50, 130)).toBe('reduced');
    expect(forestLod(94, 130)).toBe('hidden');
    expect(forestLod(93, 130)).toBe('reduced');
  });
});
