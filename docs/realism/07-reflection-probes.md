# 07 — Reflection probes for the building-pieces

**Needs:** 02. **Tiers:** gpu and mobile; cpu has none. **Branch:** `realism/07-probes`.
See [README](README.md) for the shared workflow.

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
