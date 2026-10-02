# 05 — Golden-hour dawn and dusk

**Needs:** 02, and 01 for long shadows. **Tiers:** all. **Branch:** `realism/05-golden`.
See [README](README.md) for the shared workflow.

## Current state

- `src/game/daylight.ts` defines `TimeOfDay = 'auto' | 'day' | 'night'`.
  - `resolveNight` treats night as before 06:15 or from 19:30.
  - The setting is stored in `localStorage['livistone-time-of-day']`.
- `main.ts` caches one sky per boolean night state (`skies`, `main.ts:101,307`). It swaps lights, fog, exposure and emissions in `applyTimeOfDay` (`main.ts:305-320`).

## Steps

1. **`daylight.ts`.**
   - Change the type to `TimeOfDay = 'auto' | 'day' | 'golden' | 'night'`.
   - Add `resolvePhase(mode, date): 'day' | 'golden' | 'night'`. Auto gives golden for about 75 minutes before 06:15 and before 19:30.
   - Keep `resolveNight` as a wrapper for existing callers.
   - `parseTimeOfDay` accepts `'golden'` and stays defensive.
2. **`sky.ts`.** Add a golden preset:
   - low sun about 8° above the horizon
   - warm gradient and rosy cloud undersides
   - longer, warmer haze
   - a `SUN_DIR_GOLDEN` vector and a `HORIZON_HAZE.golden` colour
3. **`main.ts`.**
   - Key the `skies` cache by phase.
   - Use one preset table per phase: sun colour and intensity, hemisphere, exposure, `environmentIntensity`, fog and emission level.
   - At golden, night emissions are partial: lamps on, halos dim. The `night-lighting.ts` light pool runs at reduced intensity.
4. **`ui.ts` menu:** Auto / Day / Golden hour / Night.
5. Check that the 01 shadow frustum handles the low sun. Extend the far plane if needed.

## Tests

- Extend `tests/daylight.test.ts` with phase boundaries and parsing.
- Add a golden case to `tests/night.spec.ts`.

## Views

`exteriors`, `ground` and `water` at golden, all profiles.

## Acceptance

- Golden hour is visibly warm, with long shadows.
- Switching phase does not rebuild meshes or move the player.
- Each sky is baked once per phase.
