# 18 — Ambient occlusion and restrained bloom

**Needs:** 20 Phase B (its output pipeline and `display` mask). **Tiers:** gpu; mobile at reduced resolution only if 25's measurements allow. **Branch:** `realism/18-post`.
See [README](README.md) for the shared workflow.

## Idea

- `GTAOPass` at half resolution, then `OutputPass`, from the three addons with no new dependency.
- Optionally a very restrained night bloom for the halos and neon.

## Blocker to solve first

- Gallery paper and signs are `toneMapped:false` (an owner rule: they look the same at night).
- With a composer, tone mapping moves into `OutputPass` and applies to the whole frame, so the paper colour would shift.
- Possible solutions to evaluate:
  - a mask in the alpha or stencil that skips tone mapping for those pixels
  - drawing the unlit boards after the output pass, with depth from the main pass
- Ship only if paper colour and night consistency survive pixel-exactly.

## Measure

- Headless frame time and draw calls before and after.
- The owner reviews AO strength; aim for "subtle ambient occlusion where affordable" (`docs/3d-game-plan.md:330`).

## Acceptance

- Visible grounding in corners and under eaves.
- The paper looks unchanged.
- When the owner has not approved it, the branch is discarded.

## Round 2 update (WebGPU)

Promoted from experiment: flat ambient light is the most visible stylized cue left after round 1. The tone-mapping blocker above is solved by Stage A: paper and signs carry the `display` mask, and AO and bloom skip those pixels.

- **AO:** `ao()` from `three/addons/tsl/display/GTAONode.js` at half resolution on the scene pass's depth and normals, denoised, multiplied into the lit colour before tone mapping.
- **Variant `?post=gi`:** `ssgi()` (`SSGINode.js`) for one-bounce screen-space light, if the frame time allows.
- **Bloom:** `bloom()` with a threshold above 1, so only night halos, neon and sun glints bloom.
- **Dev switch:** `?post=off|ao|gi`.
- Record frame time (headless, informational) and draw calls before and after.

## Result (3 October 2026, branch `realism/18-post`)

Built on WebGPU `main` (`47dc3b9`); awaiting the owner's review.

**What runs where.**

- `src/render/post.ts` holds the screen-space stages; `OutputPipeline` (`render/output.ts`) composites them in linear radiance before the classic ACES fit.
- The scene depth is multisampled on WebGPU, and GTAO's gathers cannot read a multisampled texture. One quad pass therefore copies one depth sample per 2×2 block into a half-resolution depth target, and writes the view normal rebuilt from the full-resolution depth (`getNormalFromDepth`) beside it. The scene pass gets no normal attachment.
- **AO:** `GTAONode` at half resolution (radius 1.5 m, thickness 1.2 m, 16 samples, exponent 1.4) reads that depth and those normals; its centre tap is point-sampled because the depth is already half size. `DenoiseNode` runs into an 8-bit half-resolution target. The output multiplies the result into the lit colour, weighted by the `display` attachment's blue channel:
  - opaque surfaces write 1;
  - display materials (paper, photographs, captions, signs) and transparent ones write 0, so water, glass and halos keep their own light from the occlusion of the surface behind them, in proportion to their opacity;
  - `material.userData.occlusion` lowers it: the near grass field uses 0.4, because the screen-space pass reads a dense, sunlit blade field as one deep crease and turned the meadow murky at full strength.
  The occlusion also fades with each surface's fog factor.
- **Bloom:** `BloomNode` on exposed radiance (the value the ACES fit sees) above 1.2, at most 0.6 above it per pixel, strength 0.5, radius 0. The cap keeps the neon gate from washing the green tourmaline and its neighbours white; an uncapped threshold of 1.1 did. Display pixels neither feed nor receive it.
- **Not only indirect light.** The occlusion multiplies all lit radiance, not only the ambient share: separating them would need an albedo attachment at full multisampled resolution or a depth pre-pass that doubles the draw calls. Sunlit creases therefore darken a little too; the grass weight and the fog fade keep it restrained.
- **Tiers.** gpu runs AO and bloom (`GraphicsProfile.post = 'ao'`); mobile and cpu run neither. The map camera and the Gentle visual-detail setting skip the occlusion (its radius is in metres and its uniforms follow the walk camera) but keep the bloom, so night looks the same. Both output variants are built during `OutputPipeline.compile`.
- **Dev switch** `?post=off|ao|gi`. `gi` swaps GTAO for `SSGINode` (2 slices × 6 steps, no temporal filter): it costs 14–20 ms of GPU time per frame at 1280×800 on the dev laptop and is visibly grainy without TRAA, so it stays a dev-only experiment.
- `?capture=1` stays deterministic (no temporal jitter), and adaptive resolution resizes every stage with the drawing buffer. The WebGL 2 fallback renders the same stages (checked by eye on the garden path by day and at the gateway by night, and by `tests/post.spec.ts`).

**Measured** on the dev laptop's Intel RPL-S iGPU (gen-12lp), headless Chrome WebGPU, 1280×800, gpu tier forced, other agents sharing the GPU. GPU times come from WebGPU timestamp queries, two runs per view; they are informational, not a device benchmark.

| Stage | GPU ms, arrival-meadow | GPU ms, city-hall-gallery |
| --- | --- | --- |
| Half-resolution depth and normals | 0.79 | 0.77 |
| GTAO | 1.93 | 2.43 |
| Denoise | 1.12 | 1.39 |
| Bloom (high pass, 10 blurs, composite) | 0.70 | 0.71 |
| Whole frame, `?post=off` → shipped | 2.1–2.3 → 6.8 | 3.3–3.5 → 8.7 |

- The stages add about 1.5–2 ms of main-thread time per frame, 15 draw calls while walking (12 in the map) and 27.8 kB to the main chunk (8.4 kB gzip).
- Headless frame rates on the shared iGPU were too noisy to separate the cost: 16–24 fps without, 13–16 with in the steadiest run.
- On the mobile tier the bloom alone costs about 0.7 ms; the occlusion stages would add another 3.8–4.6 ms on this iGPU (measured on the gpu tier at the same size). Mobile therefore stays off until a physical phone or tablet is measured.

**Captures** (review page `review/18-post/`, before = `baseline-47dc3b9`; share of pixels changed by more than 20 levels):

- Desktop day, all 33 views: median 7.9%. Key views: city-hall-gallery 6.4%, energy-inside 2.1%, gateway-front 5.5%, garden-path 22.3%. Highest: path-edge 33.9%, science-side 24.7%, science-front 19.2%, north-meadow 18.3%. The frame darkens by 1.5–14 levels on average.
- Desktop night, all 33 views: median 2.1%, highest gateway-side 7.7%. The bloom shows on the gate's neon and tourmaline, lamp cores and the Nanot silver.
- Touch and software `quick`: at most 0.2% (parity), because those tiers run neither stage.
- Draw calls +15 while walking, +12 in the map; triangles +30.
- The visible-change gate (about 15%) is met only where grass or foliage fills the frame. Elsewhere ambient occlusion is inherently subtle: corners, kerbs, stand feet, foliage interiors and the walnut and silver folds. The paper stays exact, checked by `tests/post.spec.ts` on both backends.

**Gates.** `bun run build` and `bun run test` (167 Vitest tests, one new for the tier choice) pass. The night, graphics-profile, poster-text, introduction, navigation and gateway specs and the new `tests/post.spec.ts` pass on WebGPU (14/14) and on the WebGL 2 fallback. On the fallback, the desktop gateway walk and the introduction jump first timed out at 2–12 fps under GPU contention from other jobs. That run used the mobile tier, which has no post stages. The introduction passed on rerun. The gateway walk timed out once more, then passed when run alone against this branch and against a `main` server.
