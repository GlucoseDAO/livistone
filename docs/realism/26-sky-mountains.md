# 26 — Physical sky and distant mountains

**Needs:** 20 Phase B (merged). **Tiers:** all (graded). **Branch:** `realism/26-sky-mountains`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Why

The owner (3 October 2026): "check if we can use more realistic skies in at least WebGPU mode, and same for mountains — mountains look too artificial."

- **Sky.** `sky.ts` painted a gradient, 2D fbm clouds and a large sun disc into a cube once per phase. The clouds had no thickness, no self-shadowing and no silver lining; the blue was one hand-picked ramp.
- **Mountains.** The ridges form a ring only 200–330 m from the town, 28–96 m high, and the land is flat beyond about 400 m. The walking camera stops at the fog's 130 m, so from the town the ring is either clipped or washed into a pale silhouette, and the horizon is empty sky. Up close (`railway-east-portal`, the Enhancement summit) the ridges are smooth Gaussian blobs, and steep faces show one brown rock photo stretched across them.

## Idea

1. **Bake a physically based sky.** The sky is baked once per phase, so an expensive model costs only startup time.
   - Single-scattering atmosphere (Rayleigh, Mie and ozone over a spherical planet, Hillaire 2020 coefficients, a hazy-day Mie), ray-marched per cube texel.
   - Fair-weather cumulus between 1.5 and 3.3 km, ray-marched through a seeded 3D Perlin–Worley texture: sunlight marched toward the sun (self-shadowing), a two-lobe phase (silver lining), three scattering octaves (bright interiors, Hillaire 2016), sky and ground ambient, fading into the air with distance.
   - Night: a moonlit gradient, stars of graded brightness and colour on a 3D grid (no pole squeeze), a faint Milky Way with dust lanes, the moon with maria.
2. **Keep the fog seam.** `HORIZON_RADIANCE` and `HORIZON_HAZE` are unchanged. One scalar gain (`SKY_GAIN`, from a CPU copy of the same atmosphere in `atmosphere.ts`) sets the bake's mean radiance 2° above the horizon to the fog's horizon, and the last few degrees blend to that exact colour, so fogged surfaces still meet the sky without a seam (`tests/sky.test.ts`).
3. **Distant ranges in a second pass.** New mountains (`far-ranges.ts`) stand only outside the 520 m terrain tiles: a ridged multifractal over domain-warped gradient noise, mixed with a derivative-damped fbm (eroded crests, smooth flanks), with the river and railway valley continuing east and west and bending away. `far-landscape.ts` meshes them as rings that span the same angle from the town (0.8° gpu, 1.6° mobile, 70% coarser past 6 km) out to 8.9 km, stitched to the tiles' exact edge, in six culled sectors. A second camera (117 m to 9.6 km) draws them and the sky first from a small scene of their own (`OutputPipeline.render(camera, distant)`), with a sun and sky light kept in step with the town's; the town then draws over them with only the depth cleared. Its own scene matters: `render()` walks and updates the whole scene graph, so a second pass over the town's scene cost a visible share of the frame. The town's own fog, far plane and draws are untouched; the map sees the ranges through `FAR_LAYER`.
4. **Their own aerial perspective** (`DISTANT_DISPLAY` in `render/output.ts`): a valley mist that is full below 25 m of altitude and gone by 150 m, so their feet meet the town's haze, times exponential haze (1.2 × 10⁻⁴ per metre) plus blue inscatter in the material. Forested lower slopes, a wandering treeline near 430 m, scree and grey limestone with strata on steep ground, canopy mottling and detail normals (gpu).
5. **The town's ridges up close.** Where a ridge stands over 10 m it carries eroded gullies and spurs (`ridgeErosion`); paths, entrances, the spawn, the railway grading and the hills around the Dark Nut portals keep their exact heights (`tests/far-ranges.test.ts`). The forest's seeded layout reads the uneroded ridges, so every tree, the town's included, stays where `main` has it and stands on the eroded ground. Steep ground turns the brown rock photo toward grey limestone, adds a second copy four times larger against the 15 m repeat, and bedding planes every few metres of altitude.
6. **The same light in the town.** The physical day sky lights about a quarter less than the painted one (its zenith is a deeper blue), which darkened shade by 8–18 grey levels in the first look. Its environment intensity is 1.35× the classic one (`PHYSICAL_DAY_FILL`), which matched `arrival-meadow` and `meadow-ground` within one level. The sky's and reflections' horizon still lands exactly on the fog colour, and the background counts as fully fogged at and below the horizon so a multisampled pixel at the walking far plane resolves to haze, not a dark seam.

## Tiers

| | gpu | mobile | cpu |
| --- | --- | --- | --- |
| Day sky bake | 1024 px faces (was 512), 56 cloud steps, 6 light steps; reflections from a second 512 bake | 512 (was 256), 40 / 5; reflections 256 | 128 (was 64), 20 / 3; no PMREM |
| Night sky bake | 1024 | 512 | 128 |
| Distant ranges | 0.8° rings (173k triangles), rock normal map, detail normals | 1.6° rings (45k triangles), colour only | none: no far pass, classic fog |
| Far pass | sky + ranges | sky + ranges | — |

## Dev switches

- `?sky=classic` — the rounds 1–2 painted sky, at its old bake sizes.
- `?ridges=classic` — the rounds 1–2 landscape: no distant ranges, no far pass, no ridge erosion, the old brown rock and the old 1.4 km terrain extent.

Both together reproduce `main` (same draw calls and triangles at `sky-up`).

## Views

- `fixes`: `sky-up`, `ridge-northwest`, `railway-east-portal` are the key views.
- New `skyline` set in `scripts/screenshot-realism.ts` (views may now carry a sixth, height, element): `valley-east`, `summit-northwest` and `summit-southwest` (from the Enhancement summit) and `ridge-north`.
- `all` day and night, `touch quick day`, `software quick day`.

## Acceptance

- The sky reads as a real summer sky: depth in the blue, lit cumulus with shaded bases; the night keeps its stars and moon.
- Distant mountains form a believable skyline from the town and from raised viewpoints, layered and blued by distance, without washing white.
- The town's 42–130 m fog, paper colour, night emissions and the map are unchanged.
- Draw calls stay within budget (desktop ≲ 250, mobile ≲ 120 where the baseline already was).
- Golden hour (05) can reuse the atmosphere by changing only the sun direction.

## Golden hour (05) on this sky

The atmosphere and clouds take the sun direction as their only phase input: `atmosphereRadiance(view, sun, gain)`, the cloud sunlight (`transmittance(altitude, sun.y)`) and the sun disc all redden through the same optical depths when the sun sits near 8°. 05 needs only `SUN_DIR_GOLDEN`, and can derive `HORIZON_RADIANCE.golden` from `horizonMean(SUN_DIR_GOLDEN) × SKY_GAIN` rather than painting it, which keeps its fog seam by construction. The CPU `transmittance` already handles the planet's shadow for a low sun. Not built or captured here.

## Compatibility with 21 (not merged)

21 replaces the walking fog with an aerial-perspective `fogNode` that fades to the sky behind each surface by its full-fog distance. This sub-plan leaves the town's fog alone, so 21 applies unchanged; the distant ranges keep their own `DISTANT_DISPLAY` fog (no range fade at 130 m, since they start beyond it) and draw in the far pass, which 21's per-tree culling does not touch. If 21 lands, its blurred sky bake (`haze`) can come from the physical sky as is.

## Not done, and limits

- **The ring's white silhouettes.** The town's ridges within 130 m still fog to white, now sometimes in front of the darker distant ranges (`ridge-northwest`, `summit-northwest`). Drawing the ring in the far pass with the mist was tried and dropped: below the mist top it became solid white walls hiding the ranges, and raising the ring out of the mist would need trees past 130 m (impostors).
- **No snow.** The approved concept shows forested ranges in summer haze; the ranges stay forest, grass, scree and limestone.
- **Headless only.** Time to ready and frame rates below are headless Chrome on the shared development laptop, not device benchmarks.

## Results (3 October 2026, `realism/26-sky-mountains`)

Review pages, served from `~/sources/livistone-realism/review/`: `26-sky-mountains/` (desktop `all` day and night, touch and software `quick` day), `26-sky-mountains-fixes/` (desktop and touch `fixes`; touch is before only), `26-sky-mountains-skyline/` (desktop day and night). `after-first-look` is the checkpoint capture; `after` is the final code. Headless Chrome on the shared development laptop's integrated GPU while other agents captured: frame rates swung by 2–4× between identical runs and are not reported; none of this is a device benchmark.

| Set | Draw calls, mean (max) before → after | Triangles, mean | Distant pass (ranges) | Pixels changed > 20 levels, median | Time to ready |
| --- | --- | --- | --- | --- | --- |
| desktop `all` day (33) | 148 (236) → 151 (238) | 1.89 → 2.00 M | 4.5 calls, 131k triangles | 29.8% | 13.6 → 11.1 s |
| desktop `all` night | 186 (303) → 189 (305) | 1.89 → 2.00 M | same | 1.7% | 10.8 → 9.5 s |
| desktop `fixes` day (14) | 150 (247) → 154 (251) | 1.89 → 2.01 M | 5.1, 146k | 28.3% | 11.1 → 11.5 s |
| desktop `skyline` day (4) | 65 (120) → 68 (124) | 1.32 → 1.43 M | 4.5, 130k | 35.7% | 11.1 → 9.2 s |
| touch `quick` day (8) | 162 (223) → 165 (226) | 0.75 → 0.76 M | 4.8, 35k | 30.8% | 9.0 → 9.8 s |
| software `quick` day (8) | 131 (181) → 131 (181) | 0.39 → 0.39 M | none | 25.3% | 11.6 → 12.6 s |

- Key views (desktop day): `sky-up` 75% of pixels changed, `ridge-northwest` 41%, `railway-east-portal` 19%; `valley-east` 36%, `summit-southwest` 40%. The `junction-*` views change 3–4% (sky only).
- The distant pass adds three to six draws per walking view. The worst desktop view, `city-hall-north`, goes from 247 to 251 calls. Mobile adds about three; it was already above 120 in these views.
- Time to ready moved within run-to-run noise: the larger day bake and the second reflection bake cost less than the load's variance.
- Gates on the final commit: `bun run build`; `bun run test`, 171 Vitest tests (new `tests/far-ranges.test.ts`, extended `tests/sky.test.ts` and `tests/frame-budget.test.ts`); Playwright `night`, `graphics-profile`, `railway`, `ground`, `navigation`: 14/14 on WebGPU; on the WebGL 2 fallback 12/14, then the two that timed out under load (`graphics-profile` gpu walking too slowly, `night` waiting on a click) passed on the single rerun, 4/4. An earlier run of the same five specs on both backends, before the distant pass moved to its own scene, was 14/14 each.
- Not verified: physical devices, Safari, Firefox; golden hour (05) on this sky.
