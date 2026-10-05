# Realism — next steps

Start here in a fresh session in `~/sources/livistone`. Read [README.md](README.md) and a sub-plan only when the task needs it; the rules for agents below are binding. This file lists what is still to do; delete a task here in the same push that merges it (AGENTS.md, Documentation duties). Round 2's plan is kept in [round-2.md](round-2.md).

Work from a worktree, not the owner's checkout `~/sources/livistone` (it holds another session's uncommitted STL docs). The integration worktree `~/sources/livistone-realism/integration` (branch `integration/round-3`) tracks `origin/main`; other sessions push to `main` too, so fetch and rebase before every push, and push small fixes promptly so their work can rebase on yours.

## Next, in order

### 1. Summit view (owner's decision: "clear view, desktop only") — first look awaiting the owner

Built on branch `realism/summit-view` (pushed, not merged): on the gpu tier, high on the plateau, the walking fog eases from 130 m to 330 m and the far plane, distant pass, haze and town culling follow; far forest cells draw crowns only. Review `review/summit-view/`; numbers and open points in [27](27-mountain-trail.md#summit-view-4-october-2026-branch-realismsummit-view-awaiting-the-owner). `plateau-view`: 131 → 368 calls, 2.41M → 6.75M triangles, headless 11 → about 5 fps. Open: far trees (160–300 m) read as sparse speckles; the dark dotted line along the ridge was the sky taking ambient occlusion, fixed on `main` (rebase the branch). The owner picks: impostor cards for far trees, a shorter summit fog (about 250 m), or merge as is.

### 2. Jepii Mici follow-ups (27)

- The crags read as rock now, but up close blocks look built (bevelled slabs) and the crest's rounded masses like pillows; the 60° terrain faces between and above blocks are smooth; a few fins remain at the wall foot in the waterfall slot. The 2 m terrain grid cannot draw sheer walls (they alias into fins): keep sheer rock in meshes.
- Conifers: the gorge and upper woods have only oak and ash. EZ-Tree (already a dev dependency) has `Pine Small/Medium/Large` presets; a spruce GLB via `scripts/generate-trees.mjs` (hard-coded to port 5173: make the URL configurable) and a mountain species mix above about 15 m would match the owner's photographs (spruce and larch above the gorge, dwarf pine on ledges). Budget the extra forest draws.
- The waterfall photo has grassy ledges with dwarf pines and larches on the cirque walls; the gully photo has the stream running out under a thick snow lip (the water branch's snow cave).
- Round 2's `mountain` set on touch and software (day) and desktop night is captured in `review/27-mountain-tiers/main/` (no before; for reference).

- Haze (21) against cloud: tall rock 100–130 m away (the north ridge's crags in `ridge-north`) fades into what the distant pass drew behind it, which there is cumulus, so the cliff reads as translucent with clouds through it. Before the haze follow-up it faded to the horizon haze instead (a pale cut-out). Owner to judge; one option is to fade toward the haze cube's blurred sky (no clouds) above the horizon and toward the distant pass only near and below it.

### 3. Tests and verification (task 6)

- Run the full suite on both backends on a quiet machine (the WebGL 2 fallback's post and night specs now allow 240 s, with the reason in each spec).
- Physical devices, Safari 26 (macOS, iOS), Firefox and an Android phone remain untested.

### 4. Parked work (task 7)

- **08 building materials:** WIP `5d893ca` on `realism/08-materials` (worktree `07-08-materials`), built on the old 07; rebase onto `main`, finish, review.
- **15 water reflections:** uncommitted work in worktree `15-reflections` (6 files, based on `36eca2b`); commit as WIP first, then rebase (conflicts with 21 in `output.ts` and `main.ts`).
- **05 golden hour:** not started; builds on 26's atmosphere and 21's haze.

### 5. Housekeeping (task 8)

- Stale remote branches `origin/realism/16-contact`, `origin/realism/21-on-round-2`: delete only with the owner's approval.
- Worktrees left: `integration` (tracks `origin/main`), `main-baseline` (detached, port 5194), `07-08-materials` and `15-reflections` (parked work above).

### 6. Loading time (after progressive loading, 6 October 2026)

What still holds the first view, measured on the production build (headless, one laptop; not device timings):

- **Shader preparation, about 6–7 s.** Mostly three.js generating node shaders on the main thread for the arrival area's materials; deferring distant parts barely changes it. Fewer distinct materials (merge near-identical ones, share variants) is the lever.
- **Texture uploads, about 1.5–2 s on the main thread.** `copyExternalImageToTexture` decodes images and reads painted canvases back synchronously; uploading `ImageBitmap`s (decoded off-thread) instead could move most of it off the main thread.
- **The ground (`mountains.ts`), about 1.5 s.** The whole ±520 m grid and its baked cover build before the first view; tiles beyond the arrival view could build later, as a progressive part per tile.
- **The Embryo Station and train, about 1–2 s**, all in the arrival view: profile before changing.
- **Walking straight ahead from the spawn stops after about 10 m** at the base of the station ring's silver shank (taller than the 0.32 m autostep), before progressive loading too. Decide whether the threshold should be walkable there.

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
