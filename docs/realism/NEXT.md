# Realism round 3 — brief

Start here in a fresh session in `~/sources/livistone`. Read [README.md](README.md) and a sub-plan only when the task needs it; the rules for agents below are binding. Round 2's plan is kept in [round-2.md](round-2.md).

> **Status, 4 October 2026 (night):** `origin/main` carries round-3 tasks 1 and 4 and the Jepii Mici round 2 with its crags. Three finished or nearly finished branches wait to merge (below); merge them first, one at a time, before starting anything new (owner's instruction). The owner reviews everything visual.

## What landed on 4 October 2026 (pushed to `origin/main`)

| Commit | What |
| --- | --- |
| `7358bf6` | Task 1: top-bar time button (your time → day → night, `T`), pending pulse, menu select kept in sync (`tests/time-of-day.spec.ts`) |
| `dbb28cf`, `995cc9c` | Task 4, station round 2 (owner: deeper honey amber; keep the pierced silver plate; leave the ring view): honey amber with glowing folds, darker underside, warm outline; four platform lamps in the night light pool, which now fades a pooled light over its last 4 m; concourse glows −29%; `docs/realism/28-station.md` |
| `432f35f` … `da7cddc` | [27](27-mountain-trail.md) Jepii Mici round 2, in the owner's order: forbidden-trail board in the woods → benched forest switchbacks → rocky gorge (buttresses, narrow passage with a steel cable, stream) → gully of old snow the trail crosses (slab up to 1.7 m, boot prints baked by `scripts/build-snow-footprints.py`, boulders and branches on it) → rhododendron plateau on top (`alpine-plants.ts`: mats built from painted flower-cluster cards, buttercups, white flowers, moss campion; the round-1 "cactus" shrubs are gone). Near grid to z = -296, HUD stage names, lip fence on the meadow |
| `f98d619`-line (6 commits, `d0fb81d`) | 27 crags: `crags.ts` and `limestone.ts`, 352 limestone blocks lining the gorge, gully and crest in one draw (gpu 113k triangles) with one trimesh collider, jointed limestone on steep ground; `?crags=off|debug` |

The owner's reference photos for 27 (they show people: never commit them) are in `~/sources/livistone-realism/references/jepii-mici-2/`.

## Next, in order

### 1. Merge the waiting branches (each: rebase onto `origin/main`, gates, `git push origin <branch>:main` as a fast-forward)

Merge from a worktree: the owner's checkout `~/sources/livistone` holds another session's uncommitted STL docs and stays at `32e3e7e`; do not pull over it. The integration worktree `~/sources/livistone-realism/integration` (branch `integration/round-3`) is where the pushes above were made.

1. **Haze (task 3), `realism/21-haze`, finished** (4 commits on `0ea11ed`; the branch's `docs/realism/21-contrast-aerial.md` follow-up section has the numbers). The haze fades into what the distant pass drew; trees stop at 90% of full fog (desktop triangles 2.70M → 2.50M); the Mitoring amber keeps its hue at night; `?haze=classic`. Expect conflicts with the station in `night-lighting.ts` (a trial merge was clean) and docs. Gates: build, Vitest, post/night/graphics-profile on both backends.
2. **Mountain water, `realism/27-mountain-water`, finished, agent says ready** (9 commits, rebased onto `da7cddc`; pre-rebase backup branch `backup/27-mountain-water-edc50a8` to delete after the merge). `mountain-water.ts`: a 17.7 m waterfall from the plateau's lip into the gorge's pool with wet rock and mist, the gorge stream from under the snow (reusing the river's shader), the plateau brook, and the snow cave at the snout (a 1.5 m snow tongue with a 0.7 m lip over a 1.4 × 0.8 m mouth). +4 draws, a few thousand triangles. Full report: `~/sources/livistone-realism/review/27-mountain-water/REPORT.md`. Before merging: rebase onto `main` (the crags are in now), then check that no crag block stands on the waterfall's wall, over the streams or the cave (the crags keep a 3 m slot for the fall); capture the fall from the gorge floor (-17, -243, looking north, pitch 0.55). Also fix the cpu tier's `this.root.add(...plants.meshes)` with an empty array (a one-line length guard) and mention the water in README's Jepii Mici row. The owner may want a bigger, two-tier fall like the cirque photograph.
3. **Probes after load (task 2), `realism/07-probes-after-load`, finished, agent says ready** (6 commits on `0ea11ed`). Time to ready now matches `?probes=off`; the first night switch builds 1 shader instead of 177; one shared `ProbeEnvironment` node, bake one face a frame after ready, night prebaked in the background then re-baked under the moon. Full report with numbers: `~/sources/livistone-realism/review/07-probes-after-load/REPORT.md`. Before merging: run `tests/railway.spec.ts` and `tests/nearby.spec.ts` (not reached), and ask the owner about memory: both phases are now held within ~25 s of a visit (+213 MB textures on gpu); options are gpu-only prebake, a 512 px night sky prefilter (−75 MB), or a lazy night bake.

### 2. Summit view (owner's decision: "clear view, desktop only")

From the plateau (stand at `(-26, -258)` facing south, the `plateau-view` capture) the town is fog today. After the haze branch is in (its `Town.update` and `aerialParams(tier, full)` accept a per-frame full-fog distance and its forest re-selects only after 2 m of camera travel plus reach change): on the gpu tier only, grow the walking full-fog distance from `graphics.fog` (130 m) toward about 330 m as the walker stands high on the plateau (e.g. eye above 38 m and `plateauInside > -4`, eased over a few seconds), and feed it each frame to the walk camera's far plane, the distant pass's near plane (90%), `setFog`'s aerial parameters and `Town.update`. Measure the plateau view's draws, triangles and frame time before and after; mobile and cpu keep today's haze.

### 3. Jepii Mici follow-ups (27)

- The crags read as rock now, but up close blocks look built (bevelled slabs) and the crest's rounded masses like pillows; the 60° terrain faces between and above blocks are smooth; a few fins remain at the wall foot in the waterfall slot. The 2 m terrain grid cannot draw sheer walls (they alias into fins): keep sheer rock in meshes.
- Conifers: the gorge and upper woods have only oak and ash. EZ-Tree (already a dev dependency) has `Pine Small/Medium/Large` presets; a spruce GLB via `scripts/generate-trees.mjs` (hard-coded to port 5173: make the URL configurable) and a mountain species mix above about 15 m would match the owner's photographs (spruce and larch above the gorge, dwarf pine on ledges). Budget the extra forest draws.
- The waterfall photo has grassy ledges with dwarf pines and larches on the cirque walls; the gully photo has the stream running out under a thick snow lip (the water branch's snow cave).
- Faint dark lines in the sky in `ridge-north` and `trail-from-path` also appear with `?mountain=off` (from `main`'s sky or distant pass); not investigated.
- Not captured yet for round 2: touch and software captures of the `mountain` set, night views of the gorge and plateau.

### 4. Tests and verification (task 6)

- `tests/station.spec.ts` does not load under Playwright (`tsconfig.playwright.json` leaves `three` on the classic build, so `MeshBasicNodeMaterial` is undefined via `train.ts` → `render/output.ts`). Fix the resolution, not the spec.
- WebGL 2 runs of `tests/post.spec.ts` and `tests/night.spec.ts` time out at 120 s when the machine is loaded (main's own source too; night passed interleaved at 1.2–1.3 min on both). Run the full suite on a quiet machine on both backends; raise a timeout only with a written reason.
- Vitest under load: heavy files (path-network, railway, grass-field) hit the 5 s default; `--maxWorkers=1 --testTimeout=20000` passes 224/224.
- Physical devices, Safari 26 (macOS, iOS), Firefox and an Android phone remain untested.
- Regenerate the share images (`bun scripts/build-share-images.ts`) once the round-3 merges are in: the arrival path changed (station, haze).

### 5. Parked work (task 7)

- **08 building materials:** WIP `5d893ca` on `realism/08-materials` (worktree `07-08-materials`), built on the old 07; rebase onto `main`, finish, review.
- **15 water reflections:** uncommitted work in worktree `15-reflections` (6 files, based on `36eca2b`); commit as WIP first, then rebase (conflicts with 21 in `output.ts` and `main.ts`).
- **05 golden hour:** not started; builds on 26's atmosphere and 21's haze.

### 6. Housekeeping (task 8)

- Worktrees whose branches are merged or superseded can go: `07-merge`, `17-wind`, `21-contrast`, `27-mountain-trail`, `28-station`, `28-station-2`, `r3-time-button`, `27-jepii-mici-2`, `27-crags`, `fix-intersections`, `main-baseline` (detached) and, after the merges above, `21-haze`, `27-mountain-water`, `07-probes-after-load`, `integration`. Check each for uncommitted work first; stop any dev server it runs (`ss -ltnp | grep 51`).
- Stale remote branches `origin/realism/16-contact`, `origin/realism/21-on-round-2`: delete only with the owner's approval.
- The owner's checkout `~/sources/livistone`: `git pull --rebase` once the STL catalogue docs there are committed or set aside, never over them.

## Open owner decisions

1. **Ground look** a (default) or b (`review/combined-04-03`), **river look** a or b: unconfirmed.
2. **Grass colour** (13): the near blades read slightly lighter and yellower than the ground texture.
3. Round-3 decisions already made (4 October 2026): station amber deeper honey, keep the pierced plate, leave the ring view; summit view clear on desktop only.

## Rules for agents (binding)

1. **One sub-plan per agent, one worktree, one dev-server port.**
   - Worktrees go in `~/sources/livistone-realism/NN-slug`; ports start at 5181. Check `ss -ltn` for free ones; 5194 serves a detached baseline of `main` and 5199 the review pages.
   - Never touch the owner's dev server on 5173.
   - **Stop each dev server as soon as its branch is merged or parked.**
2. **Capture budget per agent:**
   - one `before` (or a symlink to a shared baseline)
   - at most two `after` captures, a first look and a final one
   - views: desktop day on the sub-plan's view set, `touch quick day`, and `software quick day` only once at the end
   - no self-review loops beyond that
3. **Checkpoint:** build the comparison page and report after the first `after` capture. The reviewer (the owner, or the orchestrating session overnight) decides whether to continue.
4. **Visible-change gate:** on the sub-plan's key views, at least about 15% of pixels must change by more than 20 levels; the review page's Difference mode reports this. Below that, either push harder before the checkpoint or report that the change is inherently subtle. Stage A is the exception: its gate is parity, not change.
5. **Every sub-plan names its own dev switch** (`?ground=`, `?light=`, `?look=` for the river, `?backend=` for the renderer, …), never a shared one. Captures pass several switches through `LIVISTONE_PARAMS="ground=b&light=a"`.
6. **TSL only after Stage A.** No `onBeforeCompile`, `ShaderMaterial` or GLSL strings. Never use TSL's global `time` for animation; use the game's time uniforms.
7. **Merging:**
   - Rebase onto `main` and resolve conflicts.
   - Gates: `bun run build`, `bun run test` (Vitest, not `bun test`), the sub-plan's Playwright specs run with `LIVISTONE_BASE_URL=http://127.0.0.1:<port>` on WebGPU, plus one run on the WebGL 2 fallback when the change touches materials or the render path.
   - Make a combined capture against the round's baseline when the change is visual.
   - Then `git merge --ff-only` into `main` and push.
8. **Scripts:** new scripts are TypeScript run with `bun scripts/<name>.ts`; pixel bakers stay Python/Pillow.
9. **Downloads** need the owner's explicit approval, naming files, source and size. Overnight runs therefore use procedural bakes and assets already on disk (`data/textures-src/ground/` holds the round-1 Poly Haven originals). Originals are git-ignored under `data/textures-src/`; only derivatives are committed, with attribution and SHA-256.

## Commands

```bash
bun run dev                                   # 5173, the owner's server
bun --bun vite --host 127.0.0.1 --port 5181 --strictPort   # a worktree's server
LIVISTONE_BENCHMARK_URL=http://127.0.0.1:5181 bun scripts/screenshot-realism.ts <out>/after desktop ground day
LIVISTONE_PARAMS=backend=webgl …              # capture the WebGL 2 fallback
bun scripts/build-realism-comparison.ts <reviewDir> --title "…"
LIVISTONE_BASE_URL=http://127.0.0.1:5181 npx playwright test tests/<spec>.spec.ts
```

View sets: `quick`, `exteriors`, `ground`, `water`, `galleries` and `all`; outside `all` (listed in `REVIEWED_ALONE` in the script) `fixes` (October 2026 owner reports), `skyline` (26; a view's optional sixth element is the teleport height), `lake` (water eyes and stand backs), `intersections` (the rill culvert), `materials` (07/08), `station` (28) and `mountain` (27). Times: `day`, `golden` (after 05), `night`. Headless WebGPU on Linux needs `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-low-power`; Stage A puts these in the harness and Playwright config.

Review pages are served from `~/sources/livistone-realism/review/` with `python3 -m http.server 5199 --bind 127.0.0.1`; `combined-all/` and `baseline-76104be/` hold the round-1 result and the original look. These files live outside git.
