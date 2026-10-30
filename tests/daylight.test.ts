import { describe, expect, it, vi } from 'vitest';
import { nextTimeOfDay, nightFromDate, parseTimeOfDay, readTimeOfDay, resolveNight, saveTimeOfDay, timeOfDayHelp, timeOfDayLabel } from '../src/game/daylight';
import { DISCOVERIES } from '../src/game/content';
import { RESEARCH_POSTERS } from '../src/game/research';

describe('local night and exhibition sources', () => {
  it('overrides an incorrect clock and rejects unknown saved settings', () => {
    expect(resolveNight('day', new Date(2026, 8, 23, 0))).toBe(false);
    expect(resolveNight('night', new Date(2026, 8, 23, 12))).toBe(true);
    expect(resolveNight('auto', new Date(2026, 8, 23, 12))).toBe(false);
    expect(parseTimeOfDay('broken')).toBe('auto'); expect(parseTimeOfDay(null)).toBe('auto');
  });
  it('uses day on the reported October morning and keeps the local dawn/dusk boundaries', () => {
    expect(resolveNight('auto', new Date(2026, 9, 30, 10, 21))).toBe(false);
    expect(nightFromDate(new Date(2026, 9, 30, 6, 14))).toBe(true);
    expect(nightFromDate(new Date(2026, 9, 30, 6, 15))).toBe(false);
    expect(nightFromDate(new Date(2026, 9, 30, 19, 29))).toBe(false);
    expect(nightFromDate(new Date(2026, 9, 30, 19, 30))).toBe(true);
  });
  it('preserves saved manual night in the morning until the visitor chooses the local clock', () => {
    const saved = new Map<string, string>(), morning = new Date(2026, 9, 30, 10, 21);
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
    try {
      saveTimeOfDay('night');
      expect(readTimeOfDay()).toBe('night'); expect(resolveNight(readTimeOfDay(), morning)).toBe(true);
      expect(timeOfDayHelp(readTimeOfDay())).toContain('Manual night is saved on this device');
      expect(timeOfDayHelp(readTimeOfDay())).toContain('Choose Your time');
      saveTimeOfDay(nextTimeOfDay(readTimeOfDay()));
      expect(readTimeOfDay()).toBe('auto'); expect(resolveNight(readTimeOfDay(), morning)).toBe(false);
      expect(resolveNight(readTimeOfDay(), new Date(2026, 9, 30, 20))).toBe(true);
      expect(readTimeOfDay()).toBe('auto');
    } finally { vi.unstubAllGlobals(); }
  });
  it('cycles the top-bar button through your time, day and night and names what your time gives now', () => {
    expect(nextTimeOfDay('auto')).toBe('day'); expect(nextTimeOfDay('day')).toBe('night'); expect(nextTimeOfDay('night')).toBe('auto');
    expect(timeOfDayLabel('auto', true)).toBe('Time of day: your time (night now)'); expect(timeOfDayLabel('auto', false)).toBe('Time of day: your time (day now)');
    expect(timeOfDayLabel('day', true)).toBe('Time of day: day'); expect(timeOfDayLabel('night', false)).toBe('Time of day: night');
  });
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
