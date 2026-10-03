# 17 — Wind and foliage edges

**Needs:** 00. **Tiers:** gpu and mobile; off on cpu and under `prefers-reduced-motion`. **Branch:** `realism/17-wind`.
See [README](README.md) for the shared workflow.

## Current state

- Nothing sways; the only time-driven shaders are the water.
- Trees are EZ-Tree GLBs with alpha-tested leaf cards at a 0.45 cutoff, double-sided, without alpha-to-coverage (`forest.ts`).
- MSAA is on only for fine pointers (`main.ts:79`).

## Steps

1. Share a `uWind` time uniform, updated once per frame.
2. Add height-scaled vertex sway through `onBeforeCompile` with a `customProgramCacheKey` to:
   - `forest.ts` foliage, with large slow motion plus leaf flutter
   - `planting.ts` grass, shrubs and flowers
   - the reeds in `living-waters.ts`
3. Use a per-instance phase from the instance matrix, so neighbouring plants do not move in lockstep.
4. Turn on `alphaToCoverage` for foliage when MSAA is on, for smoother leaf edges.
5. Give grass blades a base-to-tip colour gradient.
6. The harness `?capture=1` freezes wind time.

## Tests

- `tests/forest.test.ts`, `tests/cpu-detail.test.ts` (cpu has no wind patch).
- Specs: `tests/graphics-profile.spec.ts`.

## Views

`ground` and `exteriors`, desktop and touch. Frozen captures, plus a short screen recording for review.

## Acceptance

- Gentle, believable motion.
- No change on cpu.
- Reduced motion is respected.

## On WebGPU (round 2)

- Sway through `positionNode` on the foliage, shrub, grass and reed node materials. Take the per-instance phase from the instance matrix, and time from the game's wind uniform, never TSL's global `time`.
- `alphaToCoverage` needs MSAA, which `antialias` enables on fine pointers.
- Temporal AA (`TRAANode`) would smooth leaf edges further; consider it only if 25 leaves headroom.
