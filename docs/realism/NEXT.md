# Realism round 2 — brief for a new session

Paste this file into a fresh Claude Code session started in `~/sources/livistone`. It is self-contained; read [README.md](README.md) and the linked sub-plans only when a task needs them.

## Where things stand (3 October 2026, `main` @ a16ad0d, pushed)

Round 1 merged five sub-plans into `main`.

| # | What landed | Visible effect (share of pixels changed by more than 20 levels, desktop day) | Dev switch left in |
| --- | --- | --- | --- |
| 00 | Capture harness, review page with Difference mode, `?capture=1` freeze, `LIVISTONE_BASE_URL` for Playwright | — | — |
| 01 | Sun shadows fixed: the frustum had zero height since 28f72f2. Shadow box follows the player (±50 m gpu / ±40 m mobile), texel-snapped, fades out at 36–45 m. Tree foliage casts shadows again. | 17–34% on open views | — |
| 02 | Sun and moon light come from the painted sky (`SUN_DIR`/`MOON_DIR`). Fog uses the sky's horizon colour. `scene.environmentIntensity` 0.9 day / 0.3 night with the hemisphere light lowered. `userData.heroEnv` materials get an explicit `envMap`. | 24–47% on water/metal/amber; about 2% on meadows | `?light=a` (old fill) |
| 03 | Ground: 2K CC0 Poly Haven PBR sets packed to WebP (albedo + RGBA normal/roughness/height), hex anti-tiling (gpu), two-scale sampling, macro patches, height blending, tussock relief | 40–68% on ground views | `?ground=b` (richer; default is a) |
| 04 | River: transparent water with baked flow, depth and rock attributes; Beer–Lambert absorption, soft shore, Fresnel, glint, waterline foam; CPU tier uses baked vertex colours | 24–41% on river views | `?look=a` (clear stream; default is b) |

Review pages are served from `~/sources/livistone-realism/review/` with `python3 -m http.server 5199 --bind 127.0.0.1`:

- `combined-all/`: everything merged, compared with the original baseline. This is the page to judge.
- `combined-04-03/`: river plus ground a and b side by side. Use it for the open ground decision.
- `01-shadows/`, `02-light-sky/`, `03-ground/`, `04-river/`, `20-webgpu/`: the per-sub-plan pages.
- `baseline-76104be/`: the original look, before any round-1 change.

These review files live outside git. If you need them on another machine, recapture.

## Owner verdict so far

- Shadows and river are clear wins.
- 02 is mostly plumbing.
- The ground is better but still reads as a texture close up.
- Overall: still stylized; realism needs bigger, visible steps rather than many small tweaks.

**Token rule from round 1:** each agent used 300–430k tokens, mostly on repeated captures and self-review. See the budget rules below.

## Open owner decisions (ask first, cheap)

1. **Ground look:** a (default, restrained) or b (richer soil and dry patches)? See `combined-04-03`. Make the winner the default and delete the other.
2. **River look:** re-check a against b after the riverbed exists (sub-plan 14).
3. **WebGPU:** continue Phase B (port the new ground and river shaders, then fix the issues below) or keep it parked?

## Round 2 plan, ordered by expected visible improvement per token

| Order | Sub-plan | Why now | Notes from round 1 |
| --- | --- | --- | --- |
| 1 | [13 Near-player grass field](13-near-player-grass.md) | The remaining ground complaint: close up it is still a texture | Sample the same macro-variation noise as `src/world/ground-material.ts`, so blades match the ground |
| 2 | [21 Sun/ambient contrast + aerial perspective](21-contrast-aerial.md) | Shadows read pale because ambient ≈ sun; far hills lack depth | 02 designed height-aware aerial fog but did not build it (`concepts/14-realism/02-light-sky.md`) |
| 3 | [14 Shore, riverbed and rocks](14-shore-riverbed-rocks.md) | The river still shows a grass bed; rocks are faceted and all on the dry bank | The water already bakes a `rock` attribute (`src/world/water-surface.ts`); `stone.riverRockSites` is the shared rock list; `gravel_floor_02` derivatives are already built under `public/textures/ground/` |
| 4 | [16 Contact shadows](16-contact-shadows.md) + [17 Wind](17-wind.md) | Cheap grounding and life | 01 turned on foliage shadow casting; keep the shadow-fade uniform in `src/world/shadow-fade.ts` in mind |
| 5 | [05 Golden hour](05-golden-hour.md) | A strong mood win with low risk | The sky phase plumbing (`SkyPhase`, `HORIZON_HAZE`, `FILL`) is in `sky.ts`/`main.ts` from 02 |
| 6 | [07 Reflection probes](07-reflection-probes.md) → [08 Building materials](08-building-materials.md) | Building-pieces fidelity | Tag materials with `userData.heroEnv`; 02's `pointReflections` assigns their `envMap` |
| 7 | [09 Piece models](09-piece-model-pipeline.md) → [10 Vitrines](10-vitrines.md) → [11 Viewer](11-inspection-viewer.md) | Real pieces in 3D | Unblocked for Mitoring and Nanot (STLs in `data/models/`). Nut of Power has no CAD; Embryo has CAD for the silver only; King's Chapel and Timeface exports are pending from Livia |
| 8 | [12 Gallery posters](12-gallery-posters.md) | Fidelity and mobile memory | — |
| — | [22 iGPU tier detection](22-igpu-detection.md) | Bug: newer Intel laptops get the full gpu tier | Small, do any time |
| — | [23 Flaky Living Waters spec](23-flaky-living-waters-spec.md) | Desktop interaction prompt sometimes misses its 5 s window under load | Small, do any time |
| later | [20 WebGPU](20-webgpu-spike.md) Phase B | Only if the owner says continue | Branch `realism/20-webgpu` (WIP 0889b07) has Phase A: build-time switch, TSL sky, rocks, lake, rain and CPU terrain. It must be rebased; the terrain (`mountains.ts`) and river code changed underneath it. Blockers: WebGPU ignores `toneMapped:false` (gallery paper), applies fog before tone mapping (dark hills at night), and renders glass slightly lighter. Headless WebGPU works only with `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-low-power` (Intel iGPU) |

## Rules for agents (learned in round 1, binding)

1. **One sub-plan per agent, one worktree, one dev-server port.**
   - Worktrees go in `~/sources/livistone-realism/NN-slug`; ports start at 5181.
   - Your own dev server on 5173 is never touched.
   - **Stop each dev server as soon as its branch is merged or parked.**
2. **Capture budget per agent:**
   - one `before` (or a symlink to a shared baseline)
   - at most two `after` captures, a first look and a final one
   - views: desktop day on the sub-plan's view set, `touch quick day`, and `software quick day` only once at the end
   - no self-review loops beyond that
3. **Checkpoint:** build the comparison page and report after the first `after` capture. The owner decides whether to continue before more work is done.
4. **Visible-change gate:** on the sub-plan's key views, at least about 15% of pixels must change by more than 20 levels; the review page's Difference mode reports this. Below that, either push harder before the checkpoint or report that the change is inherently subtle.
5. **Every sub-plan names its own dev switch** (`?ground=`, `?light=`, `?look=` for the river, …), never a shared one. Captures pass several switches through `LIVISTONE_PARAMS="ground=b&light=a"`.
6. **Merging:**
   - Rebase onto `main` and resolve conflicts.
   - Gates: `bun run build`, `bun run test` (Vitest, not `bun test`), the sub-plan's Playwright specs run with `LIVISTONE_BASE_URL=http://127.0.0.1:<port>`.
   - Make a combined capture against the original baseline.
   - Then `git merge --ff-only` into `main`, and push only when the owner asks.
7. **Scripts:** new scripts are TypeScript run with `bun scripts/<name>.ts`; pixel bakers stay Python/Pillow.
8. **Downloads** need the owner's explicit approval, naming files, source and size. Originals are git-ignored under `data/textures-src/`; only derivatives are committed, with attribution and SHA-256.

## Commands

```bash
bun run dev                                   # 5173, your server
bun --bun vite --host 127.0.0.1 --port 5181 --strictPort   # a worktree's server
LIVISTONE_BENCHMARK_URL=http://127.0.0.1:5181 bun scripts/screenshot-realism.ts <out>/after desktop ground day
bun scripts/build-realism-comparison.ts <reviewDir> --title "…"
LIVISTONE_BASE_URL=http://127.0.0.1:5181 npx playwright test tests/<spec>.spec.ts
```

View sets: `quick`, `exteriors`, `ground`, `water`, `galleries`, `all`. Times: `day`, `golden` (after 05), `night`.

## Housekeeping (done 3 October 2026)

- The merged worktrees and their branches `realism/00-harness` through `realism/04-river` are deleted.
- `realism/20-webgpu` (worktree `~/sources/livistone-realism/20-webgpu`) is parked, local only.
- The downloaded Poly Haven originals (72 MB) are in the main checkout's git-ignored `data/textures-src/ground/`, so ground and shore work needn't download them again.
- Concept notes exist for 02 and 04; `concepts/14-realism/round-1.md` covers 01 and 03.
