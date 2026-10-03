# Realism round 3 — brief

Start here in a fresh session in `~/sources/livistone`. Read [README.md](README.md) and a sub-plan only when the task needs it; the rules for agents below are binding. Round 2's plan is kept in [round-2.md](round-2.md).

> **Status, 3 October 2026 (evening):** `main` (`77d7a8f` plus this brief, pushed) carries round 2 and the owner's evening requests. The owner reviews everything visual: report after the first capture (rule 3) and wait.

## What landed on 3 October 2026

| Commit | What | Owner decision |
| --- | --- | --- |
| `ba1a352` | Lake water eyes kept clear of the garden paving (`lake-eyes.ts`); Vittoria and Dewdrop stands two-sided | Option A: 0.3 m silver strip past the kerb, every split pool kept |
| `dce22d2` | [21](21-contrast-aerial.md) contrast a, aerial haze complete at `graphics.fog`, Neutral tone mapping | Contrast a + Neutral; b, AgX and ACES deleted |
| `4da8463` | The opal rill runs square across the Mycelium paths through a culvert with stone headwalls | Owner report |
| `d18e10c` | [17](17-wind.md) wind on trees, shrubs, flowers, tufts and reeds | "Merge if it does not kill performance": +0.3–2 ms GPU per frame, headless |
| `c8128e9` | [07](07-reflection-probes.md) reflection probes per building-piece and hall | Merged as is, knowing the load cost in task 2 |
| `d145480` | 28 Embryo station detail: footed ring threshold, ashlar coping, slatted benches, curtain-wall glazing, amber setting, lamps, bins, clock, departures board, map panel | First pass merged; round 2 questions in task 4 |
| `77d7a8f` | [27](27-mountain-trail.md) Jepii Mici trail, signs, walkable rhododendron plateau, snow couloir, map stop 11 | Merged after four passes |

Review pages (outside git, served on 5199): `review/fix-lake-posters`, `review/21-final`, `review/fix-intersections`, `review/07-final`, `review/28-station`, `review/27-mountain-trail`.

## Round 3 tasks, in order

### 1. A day / night / your-time button in the top bar (quick win)

The owner finds the time of day hidden too deep: today it is the `#time-of-day` select inside the pause menu (`src/ui/ui.ts`, options "Auto — local clock", Day, Night). Add one compact icon button to the top bar's `#tools` nav, beside the sound button (`#hud-sound`) and built the same way:
- One click cycles **Your time → Day → Night → Your time**. Your time (`'auto'`, the visitor's local clock) stays the default. Use the existing `TimeOfDay`, `readTimeOfDay` and `saveTimeOfDay` in `src/game/daylight.ts` and the `livistone-time-of-day` key, so saved choices carry over.
- The icon shows the current mode (a clock for your time, a sun, a moon). The `aria-label` and `title` name the mode and, for your time, what it resolves to now (e.g. "Time of day: your time (night now)"). It is enabled with the other tools once the town is ready and is visible and tappable on touch screens and narrow layouts.
- Keep the menu's select, relabelled "Your time — local clock", in sync with the button both ways. If a keyboard shortcut is added, it must not clash with W/A/S/D, arrows, E, M, Space or 1–4; document it in the controls and README.
- Switching already swaps sky, fog, lights and emissions without rebuilding meshes or moving the player. Until task 2 prebakes the night probes, the first switch to night can take a few seconds: show the switch as pending (e.g. the button's icon pulses) rather than looking unresponsive.
- Tests: a Playwright spec on desktop and touch viewports. The button is visible, labelled and cycles the three modes; the scene's phase follows (`snapshot()`); the choice survives a reload; the menu select stays in sync. Update CLAUDE.md's UI notes (next to the sound control) and README's controls.

### 2. Bake the reflection probes after load (07 follow-up)

Measured after the rebase (headless, loaded machine, `?probes=off` interleaved): time to ready +2.3–3.6 s on gpu and +3.9 s on mobile (about 11 s instead of 7); the first switch to night settles in 3.9–5.4 s instead of 1.7–2.2 s; texture memory +50 MB at load and +99 MB once both phases are baked; on the WebGL 2 fallback, ready to the tenth frame takes 7–12 s instead of 5–7 s. The bake itself is only 135–280 ms of main thread (330–810 ms on the fallback). Most of the cost is suspected to be about 22 extra shader builds for the per-building material copies and the first frame waiting 1.4–2.2 s on the bake's GPU work. That is unproven: measure first (WebGPU timestamp queries, `snapshot()` timings, a count of pipeline builds with and without probes).

Goal: time to ready within about 300 ms of `?probes=off` on gpu and mobile, and no hitch over about 100 ms after ready.
- Open with sky reflections (today's `?probes=off` look) and bake after ready, one probe face or one probe per idle frame, then swap each site's `pmremTexture` node value; nothing rebuilds, since the node already exists.
- Make the per-building material copies cheap or unnecessary: compile them inside `OutputPipeline.compile`/`warmUp` at load if they must exist, or share one material per class if three allows switching the probe texture per draw.
- Night: prebake the other phase in the background right after the day bake, not on the first switch; the switch then only swaps textures.
- Alternative to measure against the above: prebake every probe offline at build time and ship them as assets, as `scripts/build-share-images.ts` renders the share images from a dev server. The town is static apart from day and night, so 11 sites × 2 phases cover everything and the browser bakes nothing; the costs are the download (keep each cube small, e.g. RGBE or half-float WebP faces, and report total size) and a rebake whenever a building, the sky or the haze changes. Prebaking does not remove the per-building material copies, so measure their shader builds first.
- Consider gpu only (mobile pays the most and gains the least); ask the owner if the numbers stay high.
- Gates: `tests/post.spec.ts`, `tests/night.spec.ts`, `tests/graphics-profile.spec.ts` on both backends; readyMs and the first night switch measured with and without `?probes=off`, three interleaved pairs each, written into [07](07-reflection-probes.md) and `docs/3d-game-plan.md`.

### 3. Haze and ghost shapes (21 follow-up)

The aerial haze in `render/aerial.ts` settles on a brighter colour than the distant ranges' valley mist (`DISTANT_DISPLAY`, sub-plan 26) behind it, so fully hazed things read as pale cut-outs:
- far trees on the horizon (worst on touch at 110 m; `review/21-final` arrival-meadow)
- the violet Enhancement hill from `vittoria-lake`, which becomes a flat pale shape
- from the Jepii Mici plateau (`plateau-view`), the whole town about 250 m away, which is a flat pale band

Make the walking haze and the distant mist one colour where they meet (or let the haze fade toward what the distant pass drew behind), and hide trees a little before they are entirely haze. Trees drawn until full haze also raised desktop triangles by about a third (median 2.0M → 2.7M); win some back. For the plateau, decide with the owner whether an elevated viewpoint may see further (a longer `graphics.fog` above some height costs frame rate) or whether the haze should read as valley mist. Minor: the Mitoring amber's brightest spots turn peach-white at night under Neutral (`energy-front`, clipped pixels 0.93% → 1.91%).

### 4. Station round 2 (28)

The first pass is merged. The owner's questions are still open; ask before building:
1. The amber canopy barely changed from below (5.8% of pixels). Options: a wider, flatter silver bezel; a deeper honey colour with a darker underside and a stronger core glow; or silver prongs gripping its edge like a ring setting. Recommended: prongs.
2. Threshold: keep the pierced silver floor plate, or a stone collar with the paving cut round the ring. Recommended: stone collar.
3. Inside the ring the gold frame grid and the gallery behind it dominate the view from the path: thin the grid or simplify the gallery rails?
4. The departures and timetable copy, and where the clock and board hang, were the agent's choices.
5. Night was not captured; the lamp globes glow but add no point lights.

Also write `docs/realism/28-station.md` (the sub-plan has no doc yet; CLAUDE.md records its rules), and add 27 and 28 to [README.md](README.md).

### 5. Mountain follow-ups (27)

- From the plateau, most of the snow couloir hides behind the big rock wall (`snow-gully`): turn or move it toward the plateau, or lower the shoulder in front. From town it is faint in the haze (task 3 helps).
- The crag faces are smooth at the terrain's 2 m grid: add detail (normal map, triplanar rock, a few rock meshes) without new draw-heavy systems.
- An oak's leaves cover the danger board's left edge in `trailhead-signs`.
- The plateau stands about 33 m up, below higher crags, because walkable terrain ends at z = -270; reaching the summit means extending the near grid and its collider.
- Faint dark lines in the sky in `ridge-north` and `trail-from-path` also appear with `?mountain=off`, so they come from `main` (sky or distant pass); find them.
- The sun's direction shades only about a third of the snow; the rest is baked shade (`couloirShade`).

### 6. Tests and verification

- `tests/station.spec.ts` does not load: it imports `train.ts` → `render/output.ts`, and under `tsconfig.playwright.json` (empty `paths`) `three` resolves to the classic build, so `MeshBasicNodeMaterial` is undefined. This already happens on `main`. Fix the Playwright resolution or the import chain without weakening the spec.
- The full Playwright suite has not run on the combined result; only targeted specs did (living-waters, post, night, graphics-profile, entrances, railway, poster-text). Run the whole suite on WebGPU and on `LIVISTONE_BACKEND=webgl`.
- Software tier: no `software quick day` capture of the combined result yet.
- Physical devices, Safari 26 (macOS and iOS), Firefox and an Android phone remain untested. Record `snapshot().backend`, fps and time to ready on each.

### 7. Resume parked work

- **08 building materials:** WIP commit `5d893ca` on `realism/08-materials` (worktree `~/sources/livistone-realism/07-08-materials`): Nanot piece textures and per-piece maps, built on the old 07. Rebase onto `main`, finish, review.
- **15 water reflections:** uncommitted work in `~/sources/livistone-realism/15-reflections` (`game/graphics.ts`, `main.ts`, `render/output.ts`, `render/post.ts`, `render/renderer.ts`, `world/water-material.ts`), based on `36eca2b`, before 21. Commit it as WIP on its branch first, then rebase; expect conflicts with 21 in `output.ts` and `main.ts`.
- **05 golden hour:** not started; it builds on 26's atmosphere and 21's haze.

### 8. Housekeeping

- Remove the worktrees whose branches are merged: `07-merge`, `17-wind`, `21-contrast`, `27-mountain-trail`, `28-station`, `fix-intersections`, and the detached `main-baseline` (stop its server on 5194 first). Keep `07-08-materials` (08) and `15-reflections` (15). Delete their merged local branches.
- Stale remote branches `origin/realism/16-contact` and `origin/realism/21-on-round-2`: delete only with the owner's approval.
- The main checkout `~/sources/livistone` was left at `32e3e7e` with another session's uncommitted documentation edits (CLAUDE.md, README, `concepts/02-jewelry-models/notes.md`, `docs/jewelry-stl-catalogue.md`), so its `main` is behind `origin/main`. Run `git pull --rebase` once that work is committed or set aside, never over it.
- Pushing does not deploy; the live site at livistone.liviazaharia.com follows its own deployment.

## Open owner decisions

1. **Ground look** a (default) or b (`review/combined-04-03`), and **river look** a or b: still unconfirmed.
2. **Grass colour** (13): the near blades read slightly lighter and yellower than the ground texture.
3. The station round-2 questions (task 4) and the plateau's view distance (task 3).

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
