# 02 — Light and sky coherence

**Needs:** 01. **Tiers:** all. **Branch:** `realism/02-light-sky`.
See [README](README.md) for the shared workflow.

## Problems

- The sky shader's sun is at (-35, 70, 35) (`src/world/sky.ts:11`) and its moon at (25, 38, -70) (`:12`). The directional light comes from (-55, 150, 40) toward (0, 0, -60) (`src/main.ts:100`). Highlights and shadows therefore disagree with the visible sun.
- Fog is hard-coded to `#c3d8df` by day and `#1a2433` by night (`main.ts:91,182,317`), not the sky's horizon colour.
- In r186, any material without its own `envMap` gets `scene.environmentIntensity` (0.5 day, 0.2 night; `main.ts:102,312`) in place of its own `envMapIntensity` (`three/src/renderers/WebGLRenderer.js:2736`). Silver, amber, gems and water lose their tuned reflection strength. 14 `envMapIntensity` values in `src/` currently have no effect.

## Steps

1. **Shared directions.** Export `SUN_DIR` and `MOON_DIR` (normalised `THREE.Vector3`) from `sky.ts`. Use them in the sky shader uniforms and for the directional light. After 01, the light sits at target + DIR × distance.
2. **Shared haze colour.** Export `HORIZON_HAZE` per phase (day and night now; golden comes in 05) from `sky.ts`, matching the shader's horizon colour. Use it for `scene.fog.color` and the map background.
3. **Reflection strength.**
   - Raise `scene.environmentIntensity` to about 0.9 by day and 0.3 at night.
   - Lower the hemisphere light (`main.ts:93`, currently 1.2 by day) so overall exposure is unchanged.
   - Give tagged hero materials an explicit `envMap = sky.environment`, so their own `envMapIntensity` applies: jewelry silver, Mitoring silver, gateway silver, brass, City Hall crystal, the station and Mitoring ambers, gems, opal, and river and lake water.
   - Re-point them on day/night switch by extending the existing loop at `main.ts:305-320`, which already re-points CPU Lambert envMaps.
   - Use `userData` tags; do not add new globals.
4. **Variants.**
   - a = coherence only (steps 1–2)
   - b = a plus the reflection-strength change (step 3)

## Tests

- `tests/mitoring-materials.test.ts`, `tests/gateway.test.ts`, `tests/city-hall.test.ts`: update them if they assert intensities.
- Specs: `tests/night.spec.ts`, `tests/graphics-profile.spec.ts`.

## Views

`exteriors` day and night, all profiles; the `water` set by day.

## Acceptance

- The sun disc, shading direction and shadows agree.
- The distant haze blends into the sky with no visible band.
- Silver reads as polished metal rather than grey plastic.
- Night emissions are unchanged.
