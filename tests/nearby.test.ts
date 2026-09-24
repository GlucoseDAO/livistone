import { describe, expect, it } from 'vitest';
import { nearbyArchitecture, storyFor } from '../src/game/nearby';
import { DISCOVERIES, LANDMARKS, SPAWN } from '../src/game/content';

describe('nearby stories along the visitor route', () => {
  it('introduces the ring gateway on arrival and the Nut as you cross into town', () => {
    expect(nearbyArchitecture(SPAWN.x, SPAWN.z)?.id).toBe('embryo-station');
    expect(nearbyArchitecture(0, 39)?.id).toBe('kings-chapel');
    expect(nearbyArchitecture(0, 10)?.id).toBe('nut');
    expect(nearbyArchitecture(-29, 4)?.id).toBe('mitoring');
    expect(nearbyArchitecture(29, -1)?.id).toBe('nanot');
    expect(nearbyArchitecture(190, -220)).toBeNull();
  });
  it('keeps every architectural hint linked to a real readable story', () => {
    for (const place of LANDMARKS) {
      const story = nearbyArchitecture(place.x, place.z)!;
      expect(DISCOVERIES.some(d => d.id === story.id), story.id).toBe(true);
    }
    expect(storyFor('nut')?.sentence).toContain('In Livia Lore');
    expect(storyFor('missing')).toBeNull();
  });
});
