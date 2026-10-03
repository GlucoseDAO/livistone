# Realism round 2 — record

The round-2 brief as it stood when the round closed on 3 October 2026; the next round starts from [NEXT.md](NEXT.md). Leftovers and their resolution: [round-2-leftovers.md](round-2-leftovers.md).

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

### After round 2 (owner request, 3 October 2026)

- [27 Jepii Mici trail, alpine plateau and snow couloir](27-mountain-trail.md): a forested trailhead with Romanian trail signs, a benched climb to a walkable plateau of rhododendrons and moss campion below limestone crags, and old snow in a shaded couloir between two peaks; view set `mountain`, switch `?mountain=off`.
- [26 Physical sky and distant mountains](26-sky-mountains.md): a baked single-scattering sky with ray-marched cumulus, distant ranges in a second camera pass, eroded ridges and limestone strata. Edits `sky.ts`, `main.ts` and `render/output.ts`, so it merges in turn with 21, 18 and 05; 05 builds its golden sky on this atmosphere.

### Done or small

- [22 iGPU detection](22-igpu-detection.md): done (`9f30cf2`).
- [23 Flaky Living Waters spec](23-flaky-living-waters-spec.md): the spec waits on `snapshot().interaction` before checking the label.

### Parked

09, 10, 11, 19: waiting for Livia's exports.

## Open owner decisions

1. **Ground look** a (default) or b: both survive the port as uniforms; pick on `review/combined-04-03`.
2. **River look**: re-check a against b after 14.
3. **Tone mapping** (21): decided 3 October 2026, Neutral with contrast a; built on `realism/21-on-round-2`, see [21](21-contrast-aerial.md#owner-decision-and-rebase-onto-main-3-october-2026).
4. **Classic fallback**: Stage A deletes classic WebGL. Revisit only if the WebGL 2 fallback measures clearly worse than classic on touch or software.
