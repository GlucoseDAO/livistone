# Realism round 2 — brief

Start here in a fresh session in `~/sources/livistone`. Read [README.md](README.md) and a sub-plan only when the task needs it.

> **Status, 3 October 2026 (end of the overnight run):** `main` (`ce434dd`) is on WebGPU, with sub-plans 13, 14, 16, 24 and 25 merged. **Continue from [round-2-leftovers.md](round-2-leftovers.md)**: verify `main` on both backends, fix the known issues, finish 21, then start 18, 17, 05, 07/08, 12 and 15. The plan below is kept as the round's record.

## Owner direction (3 October 2026)

1. **WebGPU first.** The Phase A spike convinced the owner: on the development laptop WebGPU rendered the same views at 2–5× the headless frame rate with half the draw calls (table in [20](20-webgpu-spike.md)). [20 Phase B](20-webgpu-spike.md#phase-b--migration-approved-3-october-2026) migrates the game to WebGPURenderer, with its WebGL 2 backend as the fallback. Fog, paper colour, night lighting and every other look must survive; parity is a gate.
2. **Then every task that needs no new files from Livia.** 09, 10, 11 and 19 (piece models, vitrines, viewer, AI reconstructions) wait for her exports. 08 uses reference photos that are already local, so it is in scope.
3. **Before/after side by side for every task.** `build-realism-comparison.ts` opens in Side-by-side mode. Link each page from `review/index.html`.
4. **Overnight runs are autonomous.** The orchestrating session plays the owner at checkpoints (visible-change gate, parity, budgets), merges gated branches into `main` and pushes. Pushing does not deploy.

## Where things stand

Round 1 merged 00–04 (`a16ad0d`): the capture harness, working sun shadows that follow the player, sun/sky/fog coherence, the rebuilt ground and the transparent river. Owner verdict: shadows and river are clear wins, 02 is mostly plumbing, the ground still reads as a texture close up, and the whole is still stylized. Records: `concepts/14-realism/round-1.md`, `02-light-sky.md`, `04-river.md`.

Since then: [22](22-igpu-detection.md) is done (newer Intel and AMD iGPUs probe as the mobile tier; desktop captures force `?graphics=gpu`).

## What the round-1 captures still show

From `review/combined-all` (desktop day unless noted):

| Cue that reads as stylized | Where | Sub-plan |
| --- | --- | --- |
| Flat ambient light, no ambient occlusion; shadows only where the sun is blocked | every exterior and interior | 21, 18 |
| Near-white linear haze from 42 to 130 m bleaches trees and hills that are not far away | arrival-meadow, north-meadow, garden-path, woodland-edge | 21 |
| Bare colour on large architecture: bridge, gateway abutments, plinths, interior floors, station platform | gateway-front, bridge-crossing, shore-closeup, energy-inside | 24 (new) |
| Faceted grey rocks, all on the dry bank | bridge-bank, shore-closeup, woodland-edge | 14 |
| The ground is a texture under the camera; grass tufts are sparse single blades | meadow-ground, science-front, garden-path | 13 |
| Foliage cards are flat-lit and motionless | north-meadow, arrival-meadow | 17 |

Budgets are already exceeded on classic WebGL: the gpu tier draws 540–1040 calls and 5.8–7.3M triangles per frame, and the mobile tier 260–520 calls and 1.4–1.6M triangles, against documented budgets of about 250 calls (desktop) and 120 calls with 200–400k triangles (mobile). About half of that is classic's transmission re-render, which WebGPU removes; [25](25-frame-budget.md) handles the rest before the heavier realism work lands.

## Plan

### Stage A — WebGPU migration (one agent, alone on the rendering code)

[20 Phase B](20-webgpu-spike.md): rebase the spike, port the six GLSL patches to TSL (ground, river, shadow fade, sky, rock, lake), add the output pipeline with a `display` mask for paper and signs, fix fog with the pre-tone-mapped horizon radiance, pass the parity gate on WebGPU and on the WebGL 2 fallback, then delete classic.

While Stage A runs, other agents may only develop renderer-independent parts (geometry, placement, offline texture bakes, tests) and must not merge before Stage A. Their before/after captures are taken on the WebGPU `main`.

### Stage B — realism on WebGPU, ordered by visible change per token

All shader code is TSL. Animate with the game's own time uniforms so `?capture=1` freezes them.

| Order | Sub-plan | Why now | Runs in parallel with |
| --- | --- | --- | --- |
| 1 | [25 Frame budget and adaptive resolution](25-frame-budget.md) (folds in 06) | Headroom before AO and grass add cost | 24, 14 geometry |
| 2 | [21 Contrast, aerial perspective, tone mapping](21-contrast-aerial.md) | Global; fixes the white haze and pale shade | 13 |
| 3 | [18 Ambient occlusion and restrained bloom](18-gpu-post.md) (promoted from experiment) | Global grounding; plugs into Stage A's output pipeline | 13, 24 |
| 4 | [13 Near-player grass field](13-near-player-grass.md) | The remaining ground complaint | 21, 18 |
| 5 | [24 Architectural surfaces](24-architecture-surfaces.md) (new) | Large bare-colour surfaces in key views | any |
| 6 | [14 Shore, riverbed and rocks](14-shore-riverbed-rocks.md) | River banks and faceted rocks | 24 |
| 7 | [16 Contact shadows](16-contact-shadows.md) + [17 Wind and foliage](17-wind.md) | Grounding where AO is off (cpu), and life | 14 |
| 8 | [05 Golden hour](05-golden-hour.md) | Mood; low risk after 21 | 12 |
| 9 | [07 Reflection probes](07-reflection-probes.md) → [08 Building materials](08-building-materials.md) | Metal and amber fidelity; 08 uses local reference photos | 12 |
| 10 | [12 Gallery posters](12-gallery-posters.md) | Fidelity and mobile memory | 05, 07 |
| 11 | [15 Water reflections](15-water-reflections.md) | Experiment: TSL screen-space reflections or a planar pass | — |

Tasks that edit `main.ts` or `sky.ts` (21, 18, 05, 25) merge one after another; rebase before each capture.

### Done or small

- [22 iGPU detection](22-igpu-detection.md): done (`9f30cf2`).
- [23 Flaky Living Waters spec](23-flaky-living-waters-spec.md): the spec waits on `snapshot().interaction` before checking the label.

### Parked

09, 10, 11, 19: waiting for Livia's exports.

## Open owner decisions

1. **Ground look** a (default) or b: both survive the port as uniforms; pick on `review/combined-04-03`.
2. **River look**: re-check a against b after 14.
3. **Tone mapping** (21): ACES (today), AgX or Neutral, offered as variants.
4. **Classic fallback**: Stage A deletes classic WebGL. Revisit only if the WebGL 2 fallback measures clearly worse than classic on touch or software.

## Rules for agents (binding)

1. **One sub-plan per agent, one worktree, one dev-server port.**
   - Worktrees go in `~/sources/livistone-realism/NN-slug`; ports start at 5181 (5185 is Stage A's).
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
LIVISTONE_PARAMS=backend=webgl …              # capture the WebGL 2 fallback (after Stage A)
bun scripts/build-realism-comparison.ts <reviewDir> --title "…"
LIVISTONE_BASE_URL=http://127.0.0.1:5181 npx playwright test tests/<spec>.spec.ts
```

View sets: `quick`, `exteriors`, `ground`, `water`, `galleries`, `all`, and `fixes` (the October 2026 owner reports, outside `all`). Times: `day`, `golden` (after 05), `night`. Headless WebGPU on Linux needs `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-low-power`; Stage A puts these in the harness and Playwright config.

Review pages are served from `~/sources/livistone-realism/review/` with `python3 -m http.server 5199 --bind 127.0.0.1`; `combined-all/` and `baseline-76104be/` hold the round-1 result and the original look. These files live outside git.
