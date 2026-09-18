import { describe, expect, it } from 'vitest';
import { Journey } from '../src/game/journey';
describe('train travel state', () => {
  for (const outbound of [true, false]) it(`waits in the tunnel for loading and reaches a stationary arrival (${outbound ? 'outbound' : 'return'})`, () => {
    const trip = new Journey(outbound); let transfers = 0, completed = 0;
    for (let i = 0; i < 700; i++) { const event = trip.step(1 / 60, false); if (event === 'transfer') transfers++; }
    expect(trip.phase).toBe('waiting'); expect(trip.darkness).toBe(1); expect(transfers).toBe(0);
    const stopped = trip.offset; for (let i = 0; i < 100; i++) trip.step(1 / 60, false); expect(trip.offset).toBe(stopped);
    expect(trip.step(1 / 60, true)).toBe('transfer'); expect(trip.phase).toBe('arriving'); expect(trip.darkness).toBe(1);
    for (let i = 0; i < 700; i++) { if (trip.step(1 / 60, true) === 'complete') completed++; }
    expect(completed).toBe(1); expect(trip.offset).toBe(0); expect(trip.darkness).toBe(0);
  });
});
