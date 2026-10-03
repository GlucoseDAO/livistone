# 07 — Reflection probes for the building-pieces

**Needs:** 02. **Tiers:** gpu and mobile; cpu has none. **Branch:** `realism/07-probes`.
See [README](README.md) for the shared workflow.

> **Status, 3 October 2026: approved by the owner.** Rebased onto `main` with the physical sky, distant ranges (exterior probes draw them, as the walking view's distant pass does), ambient occlusion and bloom (never run inside a bake). Review on today's `main`: `review/07-final` (the `materials` view set, desktop day and night, touch day). Load time grew by about 2.3–3.9 s here, over the 300 ms target; see the measurements linked below.
>
> Implemented on `realism/07-probes` (`src/world/probes.ts`, `tests/probes.test.ts`, dev switch `?probes=off`); measured load time and memory are in [docs/3d-game-plan.md](../3d-game-plan.md#reflection-probes-realism-07--3-october-2026). Exterior and interior probes as below; the river probes (step 1, third item) are not done. Interiors are 128 px on gpu and 64 on mobile. Review page: `review/07-probes`.

## Why

Today every metal, glass and amber surface reflects only the baked sky. Silver on City Hall, Energy and Science shows no gardens or neighbouring buildings. Interior brass reflects the outdoor sky.

## Steps

1. **New `src/world/probes.ts`.** After `Town.create`, bake `CubeCamera` probes once per phase and convert each with PMREM:
   - **Exterior:** City Hall, Energy, Science, Station, Gateway, Time Tower, Future House. Place each at the facade's mid-height, with that building hidden during its own bake.
   - **Interior:** one per civic hall and the station concourse.
   - **River:** 2–3 probes along the river, used by the 04 water on mobile.
   - Size 256 on gpu and 128 on mobile. Use a near plane and hide the details and grass groups during the bake.
2. **Assign** each probe as `envMap` to the materials tagged for that building, using the `userData` tags introduced in 02. Interior materials get the interior probe.
3. **Cache** per phase and bake lazily on the first switch to that phase. Dispose a probe's render targets when they are replaced.
4. Preserve night emissions and every separate quality tag: `gatewayGem`, `cityHallCrystal`, `mitoringAmber`, `stationAmber`.
5. Report the added load time (measured from snapshot timings) and GPU memory in `docs/3d-game-plan.md`.

## Tests

- Unit test with the DOM-independent parts: the probe list has a finite position inside each landmark footprint.
- Specs: `tests/graphics-profile.spec.ts`, `tests/night.spec.ts`, `tests/entrances.spec.ts`.

## Views

`exteriors` and `galleries`, day and night, desktop and touch.

## Acceptance

- Silver visibly reflects the surrounding town.
- Interior metals reflect their hall.
- Load-time increase is under about 300 ms on desktop. If it is more, report it.

## On WebGPU (round 2)

Bake with `CubeCamera` and the node `PMREMGenerator` after `renderer.init()`. The heroEnv re-pointing from 02 carries over unchanged.
