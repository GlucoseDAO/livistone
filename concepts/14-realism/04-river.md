# 04 — River water shading — 3 October 2026

Sub-plan [04](../../docs/realism/04-river-water.md), branch `realism/04-river`, based on the 00 harness (`76104be`).
The owner disliked the river: it read as opaque green paint with a hard edge against the grass.
This record covers what was built and how it was reviewed. The owner has not yet chosen a variant.

## Technique

**Surface** (`src/world/water-surface.ts`). The river is still one sheet at y = −0.42, clipped to the shared bank outline (`waterDistance` = −0.546, where `terrainHeight` meets the water) on a 1 m grid. It is now indexed (22,943 vertices, 39,995 triangles, the same triangles as before). Each vertex bakes:

- `flow`: the unit downstream tangent of the nearest centreline. The main river flows east (+x) and both tributaries flow south (+z) into it. Within about 4 m of each confluence the tributary direction blends smoothly into the river's.
- `along` and `across`: arc length along the channel and signed offset across it. Tributary `along` ends at the river's value at the confluence, so the coordinate keeps counting through the junction.
- `depth`: `−0.42 − terrainHeight`, at least 0. It is 0 on the outline and 1.58 m over the channel floor.
- `rock`: closeness (0–1, over a 0.9 m halo) to the footprints of the instanced river rocks. Their placement moved unchanged into `riverRockSites` in `stone.ts`, so the rocks, their colliders and the water share one list.

**Ripples** (`scripts/build-water-textures.py`). One seeded periodic wave spectrum with three soft wave-train headings gives a tileable normal map: 512 px for gpu, and 256 px for mobile, which is the same spectrum cropped. The blue channel holds an equalised foam noise. No downloads are used. The maps are lossless WebP, 236 KiB and 102 KiB.

**Shader** (`src/world/water-material.ts`, a `MeshPhysicalMaterial` patched through `onBeforeCompile`, ior 1.333).

- Two-phase flow-map sampling. The large layer works in channel coordinates (6.5 m along by 2.6 m across), so stretched ripples visibly follow every bend, even in frozen captures. On gpu, a fine isotropic world-space layer drifts along `flow` and stays continuous through the confluences. Drift slows over the shallow banks, and `along` offsets the phase so the pulsing is not global.
- Beer–Lambert absorption by `depth` along the refracted view ray, down and back up. The water body tints the bed warm brown in the shallows and teal-green when deep.
- Alpha is the share of the bed the eye no longer sees, `1 − (1 − F)(1 − cover)`, times `smoothstep(0, ~0.25 m, depth)`. The material is transparent with no depth write and `renderOrder = −1`, so it draws first among transparent objects.
- Schlick Fresnel (F0 0.02) weights the body against the standard environment reflection. Sun glint comes from the scene's own directional light through the standard specular; no sun direction is hard-coded. A glint brighter than the bed raises alpha, so it is not diluted.
- Foam: a noisy, partly see-through band where depth approaches 0, plus halos round rocks, moving with the flow.
- `userData.heroEnv = true`, for the explicit-envMap mechanism of sub-plan 02.

**Tiers.**

- gpu: everything above, with two ripple layers (four ripple-map fetches).
- mobile: one channel-space layer (two fetches), with foam from that same sample.
- cpu: opaque `MeshLambertMaterial`. Depth absorption is baked into vertex colours, from a wet olive bank to a sky-lifted teal body, on a 2 m-cell sheet of 11,442 triangles. `cpu-detail.ts` no longer simplifies that sheet, because simplifying would smear the bank gradient.

## Variants (`?look=a|b`, dev only; the owner chose b on 3 October 2026, so builds use b)

- **a — clear shallow stream**: lighter absorption (0.55/0.30/0.34 per m), so the bed reads through most of the channel. Faster drift (0.55 m/s), full ripple strength, livelier foam.
- **b — deeper green garden river**: about twice the absorption (1.2/0.62/0.78 per m), so the bed shows only near the banks. Slower drift (0.3 m/s), calmer and glassier surface, little foam.

## Review

- Page: `review/04-river/index.html` (served at http://127.0.0.1:5199/04-river/index.html). It contains `before` (a link to the shared 76104be baseline), `after-a` and `after-b`: desktop day and night (all views), touch day (all views), and software quick day.
- Flow direction was checked on an unfrozen dev server by phase-correlating frame pairs on water crops. The main river drifts east and both tributaries drift south toward the confluence.

## Metrics

Pixels changed versus the 76104be baseline (any channel over 12 levels), desktop day, a / b:

| View | a | b |
| --- | --- | --- |
| bridge-bank | 25.0% | 24.0% |
| shore-closeup | 41.9% | 40.9% |
| east-tributary | 7.5% | 6.8% |
| west-tributary | 1.8% | 1.5% |

The water covers only a small part of the frame in the two tributary views. Touch day matches desktop day within 0.5 points. The water mesh keeps 39,995 triangles and one draw call on gpu and mobile. The snapshot counters still show −1 call and −39,995 triangles on bridge-bank and east-tributary, and no change on west-tributary. That is unexplained (possibly when the transparent pass is counted) and needs checking. Software captures were not rerun in this pass.

Headless Chrome numbers are automation diagnostics, not device benchmarks; touch emulation is not a phone.

## Known limits

- The current rocks all sit on dry bank: planting clearance keeps them at least ~0.8 m from the waterline. Rock foam is therefore almost never visible today; the `rock` attribute is ready for in-stream rocks (sub-plan 14).
- The riverbed is still the meadow texture, so look a shows grass through clear water. Sub-plan 14 owns the darker riverbed, wet band and caustics.
- Until 02 merges, the water gets `scene.environmentIntensity` (0.5 by day), not its own `envMapIntensity` (1). A temporary local check at 1.0 shows stronger sky reflection that still reads well; after 02, both looks will be somewhat more reflective than these captures.
- There is no planar reflection of the bridge or the trees (sub-plan 15). The lake keeps its own material (sub-plan 14).
