# Owner garden review — 5 October 2026

Requested together by Livia: floating-ring light; a planted concept rotunda beyond Eyelense; clearer lake topaz and STL-informed coiling silver; folding navigation; Jepii Mici fireflies; reflective inner Winter topaz; compact stationary map markers.

The review branch is `realism/29-owner-gardens`, served locally on 5181. The baseline remains on 5173. Existing scene captures support direct comparisons through `scripts/screenshot-realism.ts`: `concept-rotunda`, `concept-panel`, `dewdrop-topaz`, `mycelium-ring`, `winter-gate-front`, and `woods-switchback`. Day/night and device-tier switches use the established harness.

The Swiss Blue source is `03_PARAM 2019/swiss blue/swiss blue2.stl`, read from Livia’s local PARAMETRIC directory. It contains one connected silver shank with concave band, rolled shoulders and curled free tips. The optimized 16k-triangle source is shown beside the lake interpretation; the original is never added to Git. `public/models/jewelry/sources.json` records its hash and simplification error (1.3% of the source feature thickness). The architectural coil interprets that section around the topaz above the walking entrances.

Five existing concept PNGs are used, with uncropped 1440-pixel WebP derivatives and hashes in `public/images/concepts/sources.json`. Ten panels deliberately await concepts for their named spaces. No reference photo or game screenshot is presented as generated concept art.

## Validation

- Production build and type-check pass. All 275 unit assertions passed across the main run and isolated reruns; the large mountain-water test needed a 60-second timeout on this Windows machine. The focused garden, night-light and Winter tests passed again after the final correctness fixes.
- First day review: five desktop views captured without page errors, compared with four baseline views at `output/testing/realism/29-owner-gardens/index.html`. The rotunda changes 84.8% of its view above a 20-level luminance difference. The lake changes 12.6%; the small inner Winter gem occupies little of its wide view (0.7%), so that change is inherently localized.
- Desktop and touch navigation passed. The first keyboard run exposed a focus-order issue, fixed by hiding the folding tab while a dialog is open; the keyboard rerun passes. Desktop lake stories/reload, continuous civic-to-lake walking and Winter arrival/walkthrough pass. The new folding-navigation, stationary-map and rotunda-walk scenario passes on WebGPU and WebGL, as does Winter arrival/walkthrough. The map test waits for the first projection frame; the WebGL Winter test needs a longer cold-start allowance with probes disabled (passed in two minutes).
- Final captures: four desktop night views, eight touch/day views and eight software/day views, all without page errors. Inspected ring emission, trail halos and local light, translucent lake topaz and Winter facets at night, plus the lake on both reduced tiers. Touch used WebGPU (37.2-second cold ready); real SwiftShader used WebGL fallback (36.6 seconds). Software intentionally omits advanced gem refraction and halo sprites. These timings describe this headless machine, not visitor-device performance.
- Saved reflections are regenerated for both renderers and both texture sizes, day and night. The Windows baker uses D3D11, matching the review harness; fallback cold startup is allowed four minutes.

Physical-device performance and Safari are not tested by the desktop capture harness. Five real concept derivatives are ready; the other ten spaces await artwork from the owner.

## Subsequent owner corrections

The owner requested actual garden arches, dimensional flowers and new generated images for the ten missing spaces. Those follow-ups, the older-Intel performance improvement and removal of exterior Winter lamps are recorded in [30-garden-arches.md](30-garden-arches.md). The empty-slot statements above describe the first review only.
