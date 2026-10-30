import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/game/content';
import { placeFromUrl, placeUrl } from '../src/game/place-links';
import { MATSU_COURTYARD as C, COURTYARD_POSTER, COURTYARD_POSTER_ARRIVAL, courtyardLocal } from '../src/world/matsu-courtyard-layout';

describe('named place links', () => {
  it('places the Stump of Life reader beside the artwork on the lower floor, facing its courtyard poster', () => {
    const entrance = placeFromUrl('https://example.com/?place=stump-of-life', LANDMARKS)!.entrance;
    expect(entrance).toEqual(COURTYARD_POSTER_ARRIVAL);
    expect(courtyardLocal(entrance).x).toBeCloseTo(1.1, 8); expect(courtyardLocal(entrance).z).toBeCloseTo(3.7, 8);
    expect(entrance.y).toBeCloseTo(C.floorY + .85, 8);
    expect(entrance.yaw).toBeCloseTo(Math.atan2(entrance.x - COURTYARD_POSTER.x, entrance.z - COURTYARD_POSTER.z), 8);
  });

  it.each(LANDMARKS)('resolves the registered safe arrival for $id', landmark => {
    expect(placeFromUrl(`https://example.com/town/?place=${landmark.id}`, LANDMARKS)).toBe(landmark);
  });

  it.each(['', '?place=', '?place=missing-place', '?place=STUMP-OF-LIFE', '?place=https%3A%2F%2Fexample.com%2Funtrusted.glb'])('ignores an absent or unregistered destination: %s', search => {
    expect(placeFromUrl(`https://example.com/town/${search}`, LANDMARKS)).toBeUndefined();
  });

  it('changes only the named destination and preserves the rest of a shareable address', () => {
    const original = 'https://example.com/town/?graphics=mobile&tag=one&tag=two&place=station&proof=kept#artist-story';
    const result = new URL(placeUrl(original, 'stump-of-life', LANDMARKS)!);
    expect(result.origin).toBe('https://example.com');
    expect(result.pathname).toBe('/town/');
    expect(result.hash).toBe('#artist-story');
    expect(result.searchParams.get('place')).toBe('stump-of-life');
    expect(result.searchParams.get('graphics')).toBe('mobile');
    expect(result.searchParams.getAll('tag')).toEqual(['one', 'two']);
    expect(result.searchParams.get('proof')).toBe('kept');
    expect(new URL(original).searchParams.get('place')).toBe('station');
  });

  it('writes every registered place and refuses an arbitrary destination', () => {
    const original = 'https://example.com/?proof=kept';
    for (const landmark of LANDMARKS) expect(placeFromUrl(placeUrl(original, landmark.id, LANDMARKS)!, LANDMARKS)).toBe(landmark);
    expect(placeUrl(original, 'https://example.com/untrusted.glb', LANDMARKS)).toBeUndefined();
    expect(placeUrl(original, 'not-registered', LANDMARKS)).toBeUndefined();
  });
});
