# 27 — Jepii Mici trail, rhododendrons and snow

**Needs:** 26 (merged). **Tiers:** all (graded). **Branch:** `realism/27-mountain-trail`. **Review:** `review/27-mountain-trail/`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Owner request (3 October 2026)

"I want to modify the mountains. Make a tourist route and put a 'Jepi Mici' pointer sign there together with danger sign like on the photo. Also, put nice flowers like photo on at least part of the mountain and a bit of the snow like on another mountain."

The real trail is **Jepii Mici** (Bucegi, Romania): marked with a blue cross, closed in winter. The signs use that spelling.

## What and where

All layout lives in `src/world/mountain-layout.ts` (DOM-free fields); `src/world/mountain-trail.ts` builds what stands on it.

- **Trail.** Leaves the north lake-garden path at (-5, -159) through an opening in its kerb, runs north through the woods to the trailhead at (-9, -177), then switchbacks up the north ridge's open slope to a log barrier at (-27, -221), 4.3 m inside the walking bound and 9.5 m higher, so nobody following the trail walks into `main.ts`'s out-of-bounds reset. Past the barrier the worn line continues up toward the crags to (-23, -276), 170 m from the path. It is baked bare earth in the ground cover's `groundSoil` (no paving, no kerbs), which also thins the near grass field to its edges. Trees within 3.3 m of it, at the trailhead, on the rhododendron meadow and in the snow gully are taken out of the forest after its seeded draws, so every other tree keeps its place (`tests/far-ranges.test.ts` records 892/498 trees).
- **Trailhead.** A 1.6 × 0.9 m white board with a blue painted border and red hand-lettered warnings in Romanian and English (ATENȚIE! · ATTENTION! / TRASEU ÎNCHIS! TRAIL CLOSED! / PERICOL DE MOARTE! DEATH HAZARD! / INTERZIS! · FORBIDDEN!) hangs across the trail on four cream ropes tied to posts; its lower edge is 1.8 m up, so a walker passes beneath. Left of it, a white arrow pointer with a black outline, the blue-cross mark and JEPII MICI, lettered on both faces; on the right post, two small boards (TRASEU DIFICIL · DIFFICULT TRAIL, ÎNCHIS IARNA · CLOSED IN WINTER). Blue-cross blazes mark the posts and nine trail-side boulders, which lean with the slope and are seated like the river rocks (`seatedHeight`), in their own matte grey material. Every sign face, post, rope and blaze maps into one 2048 × 1024 canvas atlas (1024 × 512 on mobile and cpu) on one lit material: one draw. Not the Livia-style `place-sign.ts`. The barrier (`TRAIL_BARRIER`) is two posts and two log rails with a small TRASEU ÎNCHIS · TRAIL CLOSED board, one collider over its span and a boulder at each end. Board, posts, pointer and barrier have colliders; the mesh is clickable and E opens the trail's journal story.
- **Rhododendrons** (*Rhododendron myrtifolium*, bujor de munte). Five drifts on the north ridge's slope east of the trail, from the woods' edge up toward the crags (x -30…14, z -205…-245), patchy and thinning above 30 m. Up close: one instanced draw of low cushions (gpu 520, mobile 220, none on cpu), 15–35 cm high and up to about 2 m across, overlapping into drifts. Each is built from small jittered clumps (gpu 34, mobile 16) with a broken outline: magenta-pink blossom (#c8378f to #e05ab0) over most of the top with leaves beneath, olive foliage round the skirt and in the gaps; a TSL Worley pattern about 3.5 cm across breaks each clump into single flowers. The ground's baked `groundPaint.x` carries the drift's pink only with distance (a light olive undergrowth near the walker; on cpu blossom clumps up close too), with tiny yellow flowers in the grass. Limestone boulders (gpu 16, mobile 9) lie among them.
- **Snow.** A tongue of old avalanche snow in a gully carved 4.5 m into the western summit's south-east face, across the saddle from the trail: from (-53, -277), about 80 m up, down to its snout at about (-47, -247), with a wet runnel below. `terrain.ts` carves the gully only with the eroded ridges, so the forest's draws are unchanged; the ground material paints the snow from `groundPaint.y` (lumpy edge, dirt streaks down the fall line, debris, a dark wet rim, lumpy normals on gpu) and the meltwater from `.z`. No new draws, no emission. It is in view from every point of the trail and shows from town as a pale streak through the haze (`ridge-north`).
- **Map.** Jepii Mici is destination 11, after Materialized Enhancements (not a civic landmark). Choosing it arrives on the garden path at (-5, -159) facing the trailhead (yaw 0.2). Its journal story keeps the facts (a steep Bucegi trail marked with a blue cross, closed in winter) apart from the Livistone fiction (everything in the scene).

## Switch

Dev-only `?mountain=off` restores the mountains before this sub-plan: no trail, carve, paint attribute, signs, boulders or cushions; the full forest, the closed kerb and the original reeds. The map destination and journal story stay.

## Budget (day, WebGPU; `review/27-mountain-trail/{before,after}/{desktop,touch}/day/captures.json`)

Calls / triangles, before (`main` 9489bd3) → after, and the share of pixels changing by more than 20 levels.

| View | Desktop (gpu) | Changed | Touch (mobile) | Changed |
| --- | --- | --- | --- | --- |
| trail-from-path | 56 / 2.14 M → 59 / 2.30 M | 42 % | 42 / 931k → 43 / 916k | 39 % |
| trailhead-signs | 55 / 2.02 M → 58 / 2.19 M | 39 % | 40 / 862k → 43 / 823k | 41 % |
| mountain-flowers | 52 / 1.28 M → 53 / 1.41 M | 66 % | 37 / 609k → 40 / 529k | 46 % |
| snow-gully | 49 / 1.31 M → 52 / 1.37 M | 58 % | 34 / 420k → 37 / 426k | 59 % |
| ridge-north | 58 / 1.54 M → 61 / 1.76 M | 23 % | 46 / 807k → 49 / 675k | 19 % |

Three new draws: the signs and barrier (one mesh, about 1k triangles), the cushions (one; 248k triangles on gpu, 49k on mobile) and the trail boulders (one, 9k). Terrain, snow, bloom and trail paint add none. The 13 (mobile 8) trees taken off the trail, meadow and gully lower the touch totals.

## Captures

`bun scripts/screenshot-realism.ts <dir> desktop mountain day` (set `mountain`, outside `all`): `trail-from-path`, `trailhead-signs`, `mountain-flowers`, `snow-gully` and the existing `ridge-north`. `map-jepii-mici.png` in the review folder is a one-off screenshot of the map panel. `tests/mountain-trail.test.ts` walks a Rapier capsule from the map arrival under the board to the barrier, keeps pushing up the painted trail and checks that it stays behind the barrier and inside `TOWN_BOUNDS`, and keeps trunks, boulders and cushions off the trail; `tests/entrances.spec.ts` includes the new map destination.

## Open

- The cushions now read as blossom-covered mounds, but their clumps are still faceted up close (most visibly on mobile, with fewer, larger clumps), and between drifts at 8–15 m the partly pink ground reads slightly brown.
- The snow reads clean white from the trail; its dirt and debris only show close up.
- `after-first-look/` holds the first pass (smooth domes with pink spots, boulders in the river rocks' draw); software captures were not taken.
