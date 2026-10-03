# Round 2 leftovers — test and finish plan

Open a fresh Claude Code session in `~/sources/livistone` and point it at this file. It is self-contained; read [NEXT.md](NEXT.md) for the binding agent rules (worktree per sub-plan, capture budget, side-by-side review page) before starting any sub-plan.

## State on 3 October 2026 (`main` @ `ce434dd`, pushed)

Merged into `main` at the owner's request, as is:

| Sub-plan | What landed |
| --- | --- |
| 20 WebGPU (Phase B complete) | `WebGPURenderer` with its WebGL 2 fallback; every shader in TSL; output pipeline with a `display` mask so paper and signs keep their exact colours; display-space fog; per-light static shadows; B7 docs with the measured table in `docs/3d-game-plan.md` |
| 13 Grass field | One instanced draw of blades to 22 m (12 m, 19.2k blades on mobile), seated on the rendered ground; old tufts sink inside it |
| 14 Shore and rocks | Rounded morph-blended boulders with trimesh colliders, in-stream rocks, pebbles refilled near the camera, wet band, gravel, riverbed silt, caustics (gpu), rock moss, lake on `water-material.ts` |
| 16 Contact shadows | One multiply decal batch on terrain triangles, `groundShade` as the ground's indirect occlusion, `userData.keepGeometry` cpu opt-out |
| 24 Surfaces | Generated ashlar, terrazzo and brass maps (no downloads); hall paving at its true 4 m scale |
| 25 Frame budget | Mycelium detail levels, static batches, terrain tiles, far plane at the fog end, hidden far interiors, twigless far trees, one flower mesh, adaptive resolution, `snapshot().budget` |

WebGPU checkpoint 2 (headless, development laptop, informational): time to ready desktop 15.5 s classic → 12.4 s WebGPU (15.4 s fallback); touch 9.5 → 9.4 s (10.5 s fallback); software 8.9 → 11.7 s (fallback). Playwright 47/47 on WebGPU and 47/47 on the fallback, on `realism/20-webgpu` before the round-2 tasks were merged. Parity: median changed pixels desktop 1.9% day, 1.0% night, touch 0.4%.

Round-2 effect against the WebGPU baseline (desktop day, 33 views): draw calls 296 → about 145, triangles 3.0M → about 1.6M.

Review pages: `~/sources/livistone-realism/review/index.html`. Serve them with `python3 -m http.server 5199 --bind 127.0.0.1` from that folder and open http://127.0.0.1:5199/.

## 1. Verify `main` first

1. `bun install --frozen-lockfile`, `bun run build`, `bun run test` (Vitest; 163 tests passed at merge).
2. Browser suites on `main`, both backends. Start a dev server on a free port (never 5173 if the owner runs one):
   ```bash
   bun --bun vite --host 127.0.0.1 --port 5181 --strictPort
   LIVISTONE_BASE_URL=http://127.0.0.1:5181 npx playwright test
   LIVISTONE_BACKEND=webgl LIVISTONE_BASE_URL=http://127.0.0.1:5181 npx playwright test
   ```
   - The combined round-2 tasks (13, 14, 16, 24, 25) had no completed Playwright run at merge time. See "Browser suite at merge" at the end of this file.
   - Commit `0d99aa5` (cpu-tier eye lead) had no Playwright run.
   - Fix failures without weakening assertions; a timing failure needs a written reason before any timeout is raised.
3. Software tier: `LIVISTONE_BENCHMARK_URL=http://127.0.0.1:5181 bun scripts/screenshot-realism.ts <out> software quick day`. Three software views were 10–12% away from classic at checkpoint 2; look at them.
4. Not verified anywhere yet: physical devices, Safari 26 (macOS and iOS), Firefox, an Android phone. Record `snapshot().backend`, fps and time to ready on each, and say plainly what is untested.

## 2. Known issues to fix

1. **16, rock patches hidden under rocks (every tier).** The patch radius stops at the planting clearance (`s × 1.45 + 0.25 m`), but rocks are about `1.57 × s` wide, so the patch is entirely covered. Widen the patches and fade them toward the water. Keep `rockContactSites`: rocks standing in the stream get no patch. The diagnosis is on `realism/16-contact` (`dc48e0d`, a docs note not on `main`). Tree decals do work on the cpu tier; in `arrival-meadow` the tree base sits behind the meadow crest.
   - **Fixed** in `944b7e4` (branch `fix/round-2-known-issues`). Each bank-rock patch reaches past the silhouette by `rockHalo(s)` = 0.55 s + 0.15 m (strength 0.9), so the silhouette sits on the falloff's dark shoulder; the halo shrinks only beside a route (one gpu rock), so no patch reaches the paving. Every decal vertex carries its `waterDistance` and the material fades each patch out toward the waterline (`CONTACT_WATER_FADE`); patches cross the planting clearance onto the wet bank but never the water's outline. Stream rocks still get none. Still one draw: gpu 51.8k triangles (was 50.7k), mobile/cpu 29.2k (28.6k). The `dc48e0d` diagnosis is folded into [16](16-contact-shadows.md). Visible as darker ground at the rock feet on touch `east-tributary` and desktop `west-tributary`/`bridge-bank`; the darkening is mostly under 20 levels, so it barely registers in the review page's changed-pixel share (0.06–0.3%). Not done: a stronger crown patch on the cpu tier.
2. **14, pebbles on the grass read as scattered marbles.** Fewer, smaller, more embedded, clustered at the waterline. The shore shader in `shore-nodes.ts` duplicates the channel formulas of `waterways.ts`; keep them in step or bake the channel field into a texture.
   - **Fixed** in `944b7e4`. Pebbles are now 1,800 gpu / 600 mobile (3,200 / 1,100 before), median half-length 2.6 cm (max 8 cm, was 12 cm), bedded below the ground (`PEBBLE_BED`, under half shows), coloured in the bank's own greys and browns, rougher, and laid in drifts a metre or three long along the waterline: 95% lie within 0.35 m of it and none reaches the grass (`tests/pebbles.test.ts`). The duplication stays, pinned by a test: `tests/shore.test.ts` evaluates the TSL `channelDistance` node graph on the CPU against `waterDistance` at about 90k points (whole town, banks, tributary ends) and fails on a 0.01 m change to either formula. No visible mismatch was found, so no texture bake.
3. **24, brass on merged poster feet.** The brass maps by local position, so on the merged feet the pattern lands at different spots. Check up close; fix the mapping if it shows.
   - **Fixed** in `944b7e4`. It showed: close probes at City Hall feet turned 20° and 48° had their top-face brushing running diagonally across the foot, at the foot's yaw in the hall frame; a foot at yaw 0 was right. Brass is now `userData.objectSpace`, and `mergeStatic` bakes each merged part's own position, normal and rotation (`surfacePosition`, `surfaceNormal`, `surfaceRotation`); the triplanar reads them when the vertex layout has them (three builds a material per layout), so unmerged brass shares the same material. Brushing now runs along every foot (`city-hall-gallery` and the probes).
4. **25, far plane at the fog end.** It hides fully fogged silhouettes between 130 and 150 m (the Enhancement hill in four views). Revisit together with 21's single full-fog distance. Headless fps for 25 alone read lower (18 → 14) while other captures shared the GPU; re-measure on a quiet machine.
5. **20, fallback speed on the mobile tier.** Headless fps on the WebGL 2 fallback's mobile tier is about 25% below classic. Measure on a real older device before optimising (for example a lighter output pipeline on the fallback).
6. **13, grass colour.** The blades read slightly lighter and yellower than the ground texture; ask the owner.
7. **Harness.** `north-meadow`'s capsule sinks into a meadow roll, so its standing eye is about 1.1 m. Teleports use a fixed height; consider a ground-relative one, and recapture baselines afterwards.
   - **Fixed** in `bc73725`, its own commit. The dev hook gains an additive `standingHeight(x, z)`: the player capsule is cast down from 2.2 m above the terrain, so each view stands on its ground, bridge deck or floor (a kerb under the capsule's rim holds it as walking does). `teleport` and the hook's other fields are unchanged; the harness falls back to the fixed 1.05 against a server without the hook and records `teleport` in `captures.json`. Checked over all 41 harness views: settled heights changed only for `north-meadow` (+0.53 m), `science-front` (+0.58), `bridge-crossing` (+0.31, it had sunk into the deck), `city-hall-far` (+0.28), `future-house-neck` (+0.07) and `east-tributary` (+2 mm); every gallery, interior, platform and other view lands exactly where it did. Review: `review/known-issues-harness` (old harness vs new, desktop day, `ground` + `quick` + those views): changed pixels 49% `north-meadow`, 47% `science-front`, 38% `city-hall-far`, 35% `bridge-crossing`, 17% `future-house-neck`, 3.7% `east-tributary` (near grass), 0.1% or less elsewhere.
   - **Baselines captured before `bc73725` are not comparable for those six views** (`ground`: north-meadow; `exteriors`: science-front, bridge-crossing; `water` and `quick`: east-tributary, marginally; `fixes`: city-hall-far, future-house-neck), including `baseline-47dc3b9` and `baseline-47dc3b9-fixes`. Recapture a `before` for them with this harness. `north-meadow` is now a standing view; low-eye ground captures use `LIVISTONE_PARAMS=eye=<metres>`.

## 3. Sub-plan 21 (contrast, aerial perspective, tone mapping) — not merged

Status at wrap-up: see "Sub-plan 21 at wrap-up" at the end of this file. To finish:

1. Rebase `realism/21-on-round-2` onto `main`. Expect conflicts with 13: `main.ts` (`?eye` and the far plane), `ground-material.ts`, and forest culling against the twigless far trees and contact-decal cells. The walk camera's far plane should follow 21's single full-fog distance (`graphics.fog`).
2. `bun run build`, `bun run test`, then the sub-plan's Playwright specs on both backends.
3. Capture with `before` = `main`, and `after-a` and `after-b` with `LIVISTONE_PARAMS=contrast=a|b`: desktop `all` day and night, touch `quick` day. Add tone variants (`tone=agx`, `tone=neutral`) on 3–4 views, and software `quick` once. Build `review/21-contrast` and link it from `review/index.html`.
4. The owner picks contrast a or b and the tone mapping. Then delete the losing variants and merge.

## 4. Not started (no files from Livia needed)

In order of expected visible change:

1. **18 Ambient occlusion and restrained bloom.** Merged into `main` (`b41c688`, `619a902`).
2. **17 Wind and foliage.** Merged into `main`: trees, shrubs, flowers, tufts and reeds sway on the shared wind clock; leaf cards use alpha-to-coverage. See [17-wind.md](17-wind.md#outcome-round-2-realism17-wind-3-october-2026).
3. **05 Golden hour.** A TSL sky preset; `HORIZON_HAZE.golden` and `HORIZON_RADIANCE.golden`.
4. **07 Reflection probes → 08 building materials.** 08 uses the local reference photos. *07 approved by the owner on 3 October 2026 and rebased onto `main` (branch `realism/07-probes`, review `review/07-final`); its load-time cost is in [docs/3d-game-plan.md](../3d-game-plan.md#reflection-probes-realism-07--34-october-2026).*
5. **12 Gallery posters.** Real paper colour, frames, residency.
6. **15 Water reflections.** The `ssr()` node first.

09, 10, 11 and 19 stay parked until Livia sends exports.

## 5. Housekeeping

Done on 3 October 2026:

- Worktrees removed: `13-grass`, `14-shore`, `20-webgpu`, `24-surfaces`, `25-budget`, `25-part1`, `25-part2`, `round-2`, `webgpu-baseline`. None had uncommitted work. Their git-ignored captures (`output/testing/`) moved to `~/sources/livistone-realism/worktree-output/<name>/`. Kept: `16-contact`, `21-contrast` and `review/`.
- Every branch below was checked before listing it for deletion. The four `wip/*` snapshots are superseded by their sub-plan commits (the only line missing from `main` is a `// TEMP-DEBUG` window hook in `wip/20-webgpu`), and `realism/25-budget` was rebased as `f308232` on `main`.

- The owner ran the branch and remote steps: `origin` is `git@github.com:GlucoseDAO/livistone.git`; the `wip/*` backups and the merged `realism/*` branches are deleted on origin and locally. The older local branches `realism/13-grass`, `realism/21-contrast` (pre-rebase copies), `realism/20-webgpu-rebased` (every commit on `main` as a patch) and `codex/before-stl-push-cleanup` (its only extra content was the two STLs, identical to the git-ignored copies in `data/models/`) are deleted too.

Still kept: `realism/16-contact` until its note is merged, `realism/21-on-round-2` until 21 is decided, and `city-hall-realism` (merged, but checked out in the Codex worktree `~/.codex/worktrees/city-hall-realism`).

## Sub-plan 21 at wrap-up

- Branch `realism/21-on-round-2`, commit `4367395`, pushed. It is built on round-2 at `f308232`, so it predates 13's grass field and the WebGPU wrap-up commits. Build and Vitest pass (166 tests).
- Captures in `review/21-contrast/` (`before` = round-2 at `f308232`):
  - `after-a` and `after-b`: desktop `all` day and night, touch `quick` day
  - `after-agx` and `after-neutral`: four desktop views
- Medians, share of pixels changed by more than 20 levels:
  - a: day 12.2% (key views 14.5%, just under the gate), night 0.5%, touch 8.7%
  - b: day 19.2% (key views 22.6%), night 0.6%, touch 14.6%
  - tone variants: agx 45%, neutral 49%
  - Paper stays exactly `#f4f0e5`; night emissions are unchanged.
- Full-fog distance: 130 m on gpu, 110 m on mobile. 150/120 cost about 21% of desktop fps. Desktop triangles rise to 2.3–2.8M on the wooded views, against round-2's 1.6–2.0M, because trees now draw out to full fog; mobile stays at or under 1.23M.
- Not done:
  - the software `quick` capture
  - the rebase onto `main`
- Watch: the Enhancement hill now fades out of `vittoria-lake`, where the old fog still showed it pale, and mobile is hazier from about 80 to 110 m.
- Any culling in 13's grass field tied to `WALK_FOG` or the forest range must switch to `graphics.fog`.

## Browser suite at merge

The full Playwright run on WebGPU against `realism/round-2` (13, 14, 16, 24 and 25 on top of WebGPU) finished after the merge: 45 of 47 passed in 17.4 minutes. Both failures were `tests/ground.spec.ts`, which expected exactly three ground textures, while sub-plan 14's shore layer loads a fourth (the gravel scan). The spec now counts the three layers and the gravel separately and passes on WebGPU and on the WebGL 2 fallback. The full fallback suite has not been run on the merged code; do that in step 1.2.
