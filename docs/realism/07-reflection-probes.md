# 07 — Reflection probes for the building-pieces

**Needs:** 02. **Tiers:** gpu and mobile; cpu has none. **Branch:** `realism/07-probes`.
See [README](README.md) for the shared workflow.

> **Status, 4 October 2026 (round 3, task 2):** the probes bake after the town is ready, a face a frame, and the night is prebaked in the background; time to ready is back to `?probes=off`'s and the first switch to night only swaps textures. Branch `realism/07-probes-after-load`; see [After load](#after-load-round-3-task-2). Parity review: `review/07-probes-after-load` (the `materials` set) and `review/07-probes-after-load-city-hall`.
>
> **Status, 3 October 2026: approved by the owner.** Rebased onto `main` with the physical sky, distant ranges (exterior probes draw them, as the walking view's distant pass does), ambient occlusion and bloom (never run inside a bake). Review on today's `main`: `review/07-final` (the `materials` view set, desktop day and night, touch day). Load time grew by about 2.3–3.9 s here, over the 300 ms target; see the measurements linked below.
>
> Implemented on `realism/07-probes` (`src/world/probes.ts`, `tests/probes.test.ts`, dev switch `?probes=off`); measured load time and memory are in [docs/3d-game-plan.md](../3d-game-plan.md#reflection-probes-realism-07--34-october-2026). Exterior and interior probes as below; the river probes (step 1, third item) are not done. Interiors are 128 px on gpu and 64 on mobile. Review page: `review/07-probes`.

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

## After load (round 3, task 2)

Branch `realism/07-probes-after-load`, 3–4 October 2026. All numbers are headless Chrome on the development laptop's integrated GPU over WebGPU, shared with other agents' captures and builds, measured with `scripts/probe-timings.ts` (a fresh browser per run, three pairs interleaved with `?probes=off`; desktop forces the gpu tier, touch emulation probes as mobile) and the dev-only `snapshot().load` marks and `snapshot().shaders` counts. They compare pairs; they are not device benchmarks.

### What the load-time bake cost (main at 0ea11ed)

| | gpu | mobile |
| --- | --- | --- |
| Time to ready, probes against `?probes=off` | 19.6 / 17.9, 19.7 / 20.3, 22.4 / 17.5 s | 15.4 / 11.8, 13.0 / 13.9, 13.0 / 14.2 s |
| From the shadow pass to ready (in-page) | 3.3–5.8 s against 0.5–0.8 s | 1.5–3.7 s against 0.3–0.4 s |
| of which the bake's main thread | 1.4–2.8 s | 0.2–0.7 s |
| Shader builds at load | +31–32 (pipelines +4) | +30–31 (pipelines +4) |
| First switch to night: main thread, until three frames drew | 3.4–3.7 s, 3.8–4.2 s (off: 0.05–0.11 s, 1.3–1.9 s) | 1.6–2.7 s, 2.4–5.4 s (off: 0.02–0.11 s, 1.5–1.6 s) |
| Shaders built by that switch | 177 (off: 115) | 166 (off: 106) |

Time to ready on its own is mostly compile noise here (3.5–11 s from run to run); the in-page interval after the shadow pass isolates the bake. It was not the shader builds: the per-building material copies built about 24 more node graphs whose WGSL was the town's own (4 more pipelines), well under the bake. The bake drew 66 faces of the whole town plus 42 distant-pass faces; on gpu about 70% of its main thread was `queue.writeBuffer` (every drawn object's uniforms again for each face, per a CPU profile), and the first frame then waited 1.8–3.5 s for its GPU work. Each face costs this GPU 35–75 ms with the distant pass, each prefilter 60–70 ms. The night switch rebuilt every lit shader because three keys the scene environment by texture.

### What changed

- **One environment node.** `ProbeEnvironment` (a `PMREMNode` updated per drawn object) is the scene's and the distant scene's `environmentNode` and the `envNode` of every reflective scope material and heroEnv material. Each object reflects its site's probe (`userData.probe`) or the phase's sky, so shared materials are no longer copied and a phase switch or a finished probe builds nothing. Its texture and size are object uniforms: three re-uploads them every frame for materials with node properties (all `envNode` ones), and for the others only when a watched material property changes, so a phase switch sets `envMapRotation.order` per phase (zero angles; `refreshEnvironment`). heroEnv materials keep an `envMap` for their own `envMapIntensity`; the first after-load version had lost it on probe surfaces, which then reflected about a fifth too dimly.
- **The bake after ready.** `ProbeBake` bakes one face a frame from the second frame after ready, and each site's prefilter as a step of its own (one `PMREMGenerator` per size, kept until both phases are done); each site shows as soon as it is done. Steps see the town as the loading map did (`bakeCamera`, game time 0), with the walking fog and every other building reflecting the sky, as before. Each face draws the distant pass first (exterior faces with the ranges, interior faces the sky alone) and the town over it, so the town never draws a background of its own in a bake.
- **Shadows.** The bake needs every building's shadow, which only the map's whole-town box holds. Loading's warm-up render draws it (three left `needsUpdate` set after that first render into a new depth texture, so the old bake's first face drew it again with City Hall's envelope hidden; it is cleared now), and `frameShadow` holds it until the shown phase's bake ends: walking frames take it at their own fade, with 15.6 cm texels instead of 4.9 cm, then the walking box returns.
- **Night prebaked.** After the shown phase, the night bakes in the background: its sky first in 15 steps (`skyBake`, which `createSky` now drains in one go), then its probes, the scene in the night's state around each step (`phaseState`) and back. The moon is unshadowed in those faces, because the shadow map holds the sun's box for the walking view; drawing the moon's box and the sun's again around every step would cost two whole-town shadow passes a frame. Unshadowed, the moon lit the halls and plazas through their own shells (the Mitoring's interior view and the Nanot silver changed about 14% of their pixels against the old night), so those probes are provisional: the first switch to night shows them at once and bakes the night again in the background under the moon's held whole-town box, replacing them site by site. A night load bakes the day only once shown: an unshadowed sun would light the halls' interiors. The distant sky is one `cubeTexture` node whose cube a phase swaps (a background per texture rebuilt its shader on every night step), and the night halos share one opacity node (33 halo shaders became one).

### Result (branch at 1f22719)

Time to ready is again `?probes=off`'s; the probes' work moved into the frames after it. Draw calls and triangles of the walking view are unchanged.

| | gpu | mobile |
| --- | --- | --- |
| Time to ready, probes against `?probes=off` | 14.3 / 14.0, 13.7 / 16.1, 12.4 / 13.6 s | 12.3 / 12.8, 13.3 / 11.6, 9.7 / 10.6 s |
| From the compile to ready (in-page) | 0.62–0.76 s against 0.58–0.69 s (+17 to +124 ms) | 0.45–0.48 s against 0.60–0.65 s |
| Day bake after ready (77 steps) | 9.3–11.7 s, 0.44–0.55 s main thread in all | 3.5–5.0 s, 0.33–0.52 s |
| Night sky (15 steps), then the night (77) | 1.3–2.0 s, then 8.4–11.9 s | 0.5–0.8 s, then 3.1–5.3 s |
| Frames until both are baked (median, 95th percentile, longest) | 83–133, 283–367, 417–483 ms (off over ten seconds: 83–133, 167–300, 167–483) | 17, 50–100, 100–283 ms (off: 17, 17–50, 100–300) |
| First switch to night (measured at 1f22719, before the re-bake): main thread, until three frames drew | 1–2 ms, 181–548 ms (off: 31–75 ms, 284–919 ms) | 1 ms, 78–161 ms (off: 16–38 ms, 115–306 ms) |
| Shaders built by that switch | 1, the night halo (off: 6, the night sky's) | 1 (off: 6) |
| Texture memory at ready, after the bakes, after the first night | 343, 548, 556 MB (off: 343, 343, 458) | 182, 232, 236 MB (off: 182, 187, 216) |

The first walking frames are as cheap as `?probes=off`'s; on gpu here they already run at 8–12 fps, and the bake adds about 50–75 ms of GPU to a frame (each face renders the whole town within 140 m), so the 95th percentile rises by about 100 ms while it runs. The longest frame after ready, about 420–480 ms on gpu, is most likely the night sky's prefilter (340 ms alone with the loop paused): a 1024 px cube into a 3072 × 4096 map, as heavy as it was at the first switch before (mobile prefilters a 512 px cube). Both phases cost 98 MB of probes on gpu once baked, as before, and 20 MB on mobile; what is new is that every visit holds them within half a minute of ready, together with the night sky (115 MB gpu, 29 MB mobile) that only the first switch to night used to create. The first switch to night shows the prebaked probes and then bakes them again (77 frames, the walking view on the moon's whole-town box meanwhile).

### Parity

`review/07-probes-after-load` compares the `materials` set, desktop day, on main at 0ea11ed (before) and on the branch at 1f22719 (after, captured once both phases had baked; the capture harness now waits for `snapshot().probes.baking` to be null). At most 0.39% of pixels change by more than 20 levels (`embryo-station-platform`; `science-front` 0.31%, the other 14 views 0.08% or less) and 1.6–6.7% by more than 2, the same noise as two captures of `?probes=off` (2.2–3.1%). City Hall is the exception (`review/07-probes-after-load-city-hall`): the old bake drew its shadow map again at its first face, three having left `needsUpdate` set, with City Hall's own envelope hidden and the trees at map detail, so the hall cast no shadow into any old probe and its own probes saw a sunlit floor. Now its shell shadows the hall. `city-hall-gallery` changes 3.0% of pixels by more than 20 levels, `catalogue-poster` 3.2% (partly the gallery photographs' sharper residency after the longer wait), `city-hall-front` 0.6%; the Energy views do not change.

By night, `review/07-probes-after-load-night` compares what a visitor sees after the first switch (loaded by day): before, the old bake at the switch; after, the re-bake under the moon at 43ab8ca. `science-inside` changes 0.05% of pixels by more than 20 levels, `gateway-gem` 2.9%, `energy-inside` 3.1%, `time-tower-close` 3.6%, `nanot-close` 5.2% and `station-ring-close` 6.3%: the old night bake also drew its moon's shadow map at its first face (City Hall hidden, trees at map detail) and at the game time of the switch, where the re-bake holds the map drawn from the walking view.

### Offline prebake, estimated instead of built

Twenty-two probes per tier would ship as files rendered from a dev server, as `scripts/build-share-images.ts` renders the share images: gpu faces of 256 px (exterior) and 128 px (interior), mobile 128 and 64. As RGBE in lossless WebP or PNG that is about 10–15 MB for both phases on gpu and 2.5–4 MB on mobile; as RGBM in lossy WebP about 1.5–2.5 MB and 0.5 MB, with some banding in sky gradients and clipped highlights. The browser would still decode and upload them and prefilter each one (eleven prefilter steps a phase, about 60 ms of this GPU each at 256 px), unless the prefiltered cube-UV maps shipped instead, about four times the data. It saves the 132 face steps, not the environment node work above, and it needs a rebake (minutes, with a GPU browser) whenever a building, a material, the sky, the haze, the tone mapping or the town near a probe changes; 08, 15, 28 and 05 change exactly those. About one to two days to build (the bake script, an encoder and manifest, loaders that decode into half-float cubes, a staleness check). Not worth it while the runtime bake costs nothing at load.

### Limits

- Until the shown phase's probes are baked (about 77 frames: 9–12 s on gpu and 3.5–5 s on mobile here), the walking view keeps the whole-town shadow box, 15.6 cm texels instead of 4.9 cm, without re-baking for near trees; then the walking box returns.
- Every visit now holds both phases' probes and the night sky within half a minute (see the memory row). Prebaking only on gpu, or prefiltering the night's reflections from a 512 px cube as the day's are (the night sky's background stays 1024 px), would cut it; both are the owner's call.

### Night sky memory (owner's choice, 4 October 2026)

Of the three options above the owner chose the 512 px prefilter: the night's reflections now prefilter from the day's reflection size (`skyDay / 2`: 512 px on gpu, 256 on mobile), the background still from the full bake. Stars are redrawn a texel wide at that size with the same light each (`physicalNight(size, haze, starsOf)`), so mirror-like water shows them softer, not missing. Measured headless on gpu (texture bytes from `renderer.info`, the night shown at load): 432 → 360 MB at ready, 489 → 417 MB once both phases had baked (−72 MB); the night's sky bake 891 → 697 ms. `review/07-night-512` (water set, desktop night, before 861c66c, after cad4041): at most 0.02% of pixels change by more than 20 levels. Physical devices remain unmeasured.
- The prebaked night is provisional until the first switch to night, and the re-bake then costs another 77 frames.
- Physical devices, Safari and Firefox are unmeasured, and so are the WebGL 2 fallback's timings; it passes the post, night and graphics-profile specs.
