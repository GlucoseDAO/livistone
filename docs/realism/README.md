# Realism sub-plans

Livistone is getting more realistic in small, separately reviewed steps. Each file in this folder is one sub-plan that a single agent can carry out on its own branch, with before/after screenshots for every device tier. Nothing is changed in one big sweep.

Planned on 3 October 2026 against commit `5a95bfd`. Line numbers refer to that commit; re-check them before editing.

## Status (3 October 2026)

Round 1: 00–04 are merged into `main` (`a16ad0d`). Round 2 began the same day; **start from [NEXT.md](NEXT.md)**, which has the owner's direction, the evidence, the stage order and the binding agent rules.

- The owner approved the WebGPU migration ([20 Phase B](20-webgpu-spike.md)); it runs first and alone on the rendering code. Later shader work is TSL only.
- New in round 2: [21 contrast and aerial perspective](21-contrast-aerial.md), [22 iGPU tier detection](22-igpu-detection.md) (done), [23 flaky Living Waters spec](23-flaky-living-waters-spec.md) (done), [24 architectural surfaces](24-architecture-surfaces.md), [25 frame budget and adaptive resolution](25-frame-budget.md).
- Parked until Livia sends exports: 09, 10, 11, 19.

## Owner decisions (3 October 2026)

- Stay on WebGL2 for now. A measured WebGPURenderer spike, using its automatic WebGL2 fallback, is optional sub-plan 20.
- Photo posters stay, upgraded to gallery quality. Glass vitrines holding real 3D pieces are added. This changes the earlier "no pedestal tables" rule, which sub-plan 10 must update in CLAUDE.md.
- 3D sources are Grasshopper exports from Livia, and some are large. Start with the pieces that became buildings.
- AI image-to-3D reconstructions need Livia's sign-off for each piece, and must be labelled as interpretations.
- Add a golden-hour dawn/dusk phase.
- Order of work: quick wins first, then ground and river (the owner dislikes both today), then the pieces, then further world polish.
- An earlier environment pass was rejected as "too subtle" (`concepts/03-landscape/notes.md`). Aim for visible change, and offer A/B variants wherever the choice is a matter of taste.

## Key findings

1. **Sun shadows are broken.** `src/main.ts:98` sets `shadow.camera.bottom = shadow`; it should be `-shadow`. This regressed in 28f72f2. The frustum has zero height, so no sun shadows render.
2. **Per-material reflection strength is ignored.** In r186, any material without its own `envMap` gets `scene.environmentIntensity` (0.5 by day) instead of its own `envMapIntensity` (`node_modules/three/src/renderers/WebGLRenderer.js:2736`). The silver's 1.7 and the river's 1.25 do nothing.
3. **Sun and fog disagree with the sky.** The sun drawn in the sky (`sky.ts:11`) and the shadow-casting light (`main.ts:100`) point in different directions. Fog colours are hard-coded (`main.ts:91`) instead of taken from the sky.
4. **The ground is only colour.** It uses two Poly Haven 1K colour maps tiled every 2.8 m and 3.3 m, with no normal or roughness maps, no anti-tiling, and a linear soil blend (`mountains.ts:70-99`).
5. **The river is an opaque flat sheet.**
   - It is a standard material with three sine ripples.
   - Its flow is a fixed world-space offset, so it ignores the bends.
   - It has no transparency, depth, Fresnel or foam, and ends at a hard edge against the grass (`river.ts`).
   - The rocks are faceted icosahedra.
6. **Posters are unlit and memory-heavy.** The paper tint multiplies the whole photo (`planar-exhibition.ts:64`). About 230 MB of poster textures stay resident on every tier.
7. **3D sources per building-piece** (confirmed by the owner on 3 October 2026):
   - **Mitoring:** STL in the repo (`data/models/+3mito.stl`, 985k triangles).
   - **Nanot:** STL in the repo (`data/models/bila.stl`, 2.25M triangles).
   - **Embryo:** a CAD model of the silver part only; the amber stone is real. Waiting for Livia's export.
   - **King's Chapel, Timeface:** waiting for Livia's exports.
   - **Nut of Power:** no CAD model exists, because it was made from a real walnut. It stays photo-based. Any 3D version would be a reconstruction (19) that needs Livia's sign-off.

## Blocked and unblocked work

Livia needs time to send exports, so do the unblocked work first.

- **Unblocked:** 00–08, 12–18. Also 09–11 piloted with Mitoring and Nanot.
- **Waiting for Livia:**
  - Embryo silver, King's Chapel and Timeface vitrines (09 and 10 extensions).
  - All of 19.

## Shared workflow (every sub-plan)

New scripts are TypeScript, run with `bun scripts/<name>.ts`. Bun runs TypeScript and the Playwright library directly; this was checked with Bun 1.4.2 and Chrome 154. Sub-plan 00 adds `scripts/**/*.ts` to `tsconfig.json`, so `bun run build` type-checks them. Avoid `enum` and `namespace`, so Node's type stripping also works. Pixel-baking scripts stay Python/Pillow, extending the existing `scripts/build-*-textures.py` bakers.

1. **Branch.** Create `realism/NN-slug` from `main` in its own git worktree. Never stack unreviewed sub-plans.
2. **Before.** On `main`, run `bun scripts/screenshot-realism.ts output/testing/realism/NN-slug/before <profile> [viewSet] [time]` for each profile:
   - `desktop` → gpu tier
   - `touch` → mobile tier
   - `software` → real SwiftShader, cpu tier; use the `quick` view set because it renders at 0–1 fps.
   (The harness is built in [00](00-harness.md).)
3. **Implement only this sub-plan.**
4. **After.** Capture the same views into `after/`. Where the choice is a matter of taste, capture `after-a/` and `after-b/` behind a dev-only `?look=a|b` switch, and delete the losing variant before merging.
5. **Review page.** `bun scripts/build-realism-comparison.ts output/testing/realism/NN-slug` writes `index.html` with sliders, a variant picker, and draw-call and triangle deltas.
6. **Gates.**
   - `bun run build` and `bun run test` (Vitest, not `bun test`) must pass.
   - Run the Playwright specs the sub-plan lists: `bun run test:browser -- tests/<name>.spec.ts`.
   - Keep the `window.__livistone` hook's shape stable.
7. **Owner review.** The owner reviews the page, then the branch is merged or discarded. Record approved views in `concepts/14-realism/notes.md`; add to it, never rewrite it. Update README, `docs/3d-game-plan.md` and CLAUDE.md where behaviour or conventions change, then run `bun run docs:sync`.
8. **Budgets** (`docs/3d-game-plan.md:372-376`):
   - mobile: under 120 draw calls and 200–400k triangles
   - desktop: under about 250 draw calls
   Headless fps and touch emulation are not device benchmarks; say so.

## Index and dependencies

| # | Sub-plan | Needs | Tiers | Main files |
| --- | --- | --- | --- | --- |
| 00 ✅ | [Before/after harness](00-harness.md) | — | all | `scripts/` |
| 01 ✅ | [Fix sun shadows + following frustum](01-shadows.md) | 00 | gpu, mobile | `main.ts`, new `game/shadow-frame.ts` |
| 02 ✅ | [Light and sky coherence](02-light-sky-coherence.md) | 01 | all | `sky.ts`, `main.ts` |
| 03 ✅ | [Ground material rebuild](03-ground-material.md) | 02 | all (graded) | `mountains.ts`, `scripts/build-ground-textures.py` |
| 04 ✅ | [River water shading rewrite](04-river-water.md) | 02 | all (graded) | new `world/water-material.ts`, `river.ts`, `world.ts` |
| 05 | [Golden-hour dawn/dusk](05-golden-hour.md) | 02 | all | `daylight.ts`, `sky.ts`, `main.ts`, `ui.ts` |
| 06 → 25 | [Adaptive resolution](06-adaptive-resolution.md) (folded into 25) | 00 | gpu, mobile | `main.ts` |
| 07 | [Reflection probes](07-reflection-probes.md) | 02 | gpu, mobile | new `world/probes.ts` |
| 08 | [Building-piece materials a–e](08-building-materials.md) | 07 | all (graded) | per-building modules + bake scripts |
| 09 | [Piece-model pipeline](09-piece-model-pipeline.md) | 00 | offline | new `scripts/build-piece-models.ts` |
| 10 | [Glass vitrines](10-vitrines.md) | 09 | all (graded) | new `world/vitrine.ts`, `poster-layout.ts` |
| 11 | [3D inspection viewer](11-inspection-viewer.md) | 10 | all | `ui/gallery.ts`, `main.ts` |
| 12 | [Gallery-quality posters](12-gallery-posters.md) | 00 | all | `planar-exhibition.ts`, `build-catalogue.mjs` |
| 13 | [Near-player grass field](13-near-player-grass.md) | 03 | gpu, mobile | new `world/grass-field.ts` |
| 14 | [Shore, riverbed and rocks](14-shore-riverbed-rocks.md) | 03, 04 | all (graded) | `mountains.ts`, `stone.ts`, `living-waters.ts` |
| 15 | [Water reflections (experiment)](15-water-reflections.md) | 04 | gpu | `water-material.ts`, `main.ts` |
| 16 | [Contact shadows](16-contact-shadows.md) | 00 | all | new `world/contact-shadows.ts`, `ground-cover.ts` |
| 17 | [Wind](17-wind.md) | 00 | gpu, mobile | `forest.ts`, `planting.ts`, `living-waters.ts` |
| 18 | [Ambient occlusion and restrained bloom](18-gpu-post.md) | 20 B | gpu (mobile if 25 allows) | render pipeline |
| 19 | [AI reconstructions (gated)](19-ai-reconstructions.md) | 09 | offline | manifest only |
| 20 | [WebGPURenderer migration with WebGL2 fallback](20-webgpu-spike.md) (Phase A ✅, Phase B approved) | 00, 03, 04 | all | `main.ts`, `src/render/`, TSL ports of every GLSL patch |
| 21 | [Sun/ambient contrast and aerial perspective](21-contrast-aerial.md) | 01, 02 (merged) | all | `main.ts`, fog chunk |
| 22 ✅ | [iGPU tier detection](22-igpu-detection.md) | — | probe | `game/graphics.ts` |
| 23 ✅ | [Flaky Living Waters spec](23-flaky-living-waters-spec.md) | — | test | `tests/living-waters.spec.ts` |
| 24 | [Architectural surfaces](24-architecture-surfaces.md) | 20 B | all (graded) | new `scripts/build-surface-textures.py`, `bridge.ts`, `gateway.ts`, `world.ts`, `station.ts` |
| 25 | [Frame budget and adaptive resolution](25-frame-budget.md) | 20 B | all | `forest.ts`, `planting.ts`, `cpu-detail.ts`, new `game/render-scale.ts` |

Round 2: 20 Phase B runs alone on the render path. After it, 21, 18, 05 and 25 edit `main.ts` and merge one after another; 13, 14, 16, 17, 24 and 12 touch separate files and can run in parallel worktrees. Shader code is TSL only.
