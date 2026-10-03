# 25 — Frame budget and adaptive resolution

**Needs:** 20 Phase B. Folds in [06](06-adaptive-resolution.md). **Tiers:** all. **Branch:** `realism/25-budget`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Why

On classic WebGL the gpu tier drew 540–1040 calls and 5.8–7.3M triangles per frame in town views, and the mobile tier 260–520 calls and 1.4–1.6M triangles, against documented budgets of about 250 calls on desktop and 120 calls with 200–400k triangles on mobile (`docs/3d-game-plan.md`). WebGPU halves both by dropping classic's transmission re-render, which still leaves the town over budget. Stage B adds ambient occlusion, a grass field and more materials, so headroom comes first.

## Where the cost is (3 October 2026, classic, round-1 poses replayed in memory)

Per-view averages: gpu 612 calls / 5.41M triangles, of which the main pass is 312 / 2.82M; mobile 346 / 1.35M (no transmission pass).

| Rank | Producer | gpu main pass | mobile | Why |
| --- | --- | --- | --- | --- |
| — | Classic transmission re-render | 49% of calls, 48% of triangles | — | Six transmissive materials; even the distant Dewdrop gem triggers it. Gone on WebGPU. |
| 1 | Mycelium grove (`mycelium.ts`, `living-waters.ts:184–220`) | ~1.1M triangles (39%) | ~515k (38%) | 23,296-triangle crowns (11,264 mobile), 70 / 49 instances in two instanced meshes with 35–42 m bounding spheres, no LOD or cull; drawn in 21 of 33 views, usually 61–150 m away |
| 2 | Trees (`forest.ts`) | 550k, 16 calls | 179k, 10 calls | 905 / 506 sites; branches never reduced |
| 3 | Terrain (`mountains.ts:42–69`) | 352k | 240k | One mesh, always drawn |
| 4 | Planting (`planting.ts`) | ~196k, flowers in 107 batches | ~44k, 97 batches | No LOD; four flowers per batch |
| 5 | Posters (`planar-exhibition.ts:45–67`) | ~67 calls | ~74 calls | 41 × 5 meshes in separate groups; hall interiors drawn from outside |
| 6 | Living Waters fragments (`living-waters.ts:47–60`) | ~85 calls | ~120 calls (35%) | One mesh plus one tube per water cell, separate path ribbons and joins |
| 7 | Beyond the fog | 54 calls, 334k triangles | — | Walk camera far plane 150 m (`main.ts:52`), fog ends at 130 m |

Smaller: river rocks 73k / 41k (180 triangles each), glucose pavilion 66 meshes, enhancement hill 47 marker meshes, train 186k in 33 meshes.

## Steps

1. **Measure on WebGPU.** A dev-only breakdown of draw calls and triangles by top-level group, exposed as an added `snapshot().budget` field and printed by the capture harness.
2. **Cut, largest first:**
   - **Mycelium:** spatial cells with distance culling, and a crown of about 2k triangles for the small ring shrubs and distant crowns, keeping the photographed silhouette near the paths.
   - **Camera far plane** at the fog end (130 m walking), so fully fogged objects are not drawn; keep the map camera as it is.
   - **Static clutter:** merge Living Waters water cells, tubes, ribbons and joins the way `world.ts:189–191` merges the town paths; merge poster frames and feet; instance glucose atoms and bonds and the enhancement markers; hide hall interiors beyond a short distance.
   - **Trees:** simplified branches for distant cells, then camera-facing impostors beyond about 50 m if the silhouettes hold; no shadow casting beyond the shadow box.
   - **Terrain:** coarser far cells and tiles that can be culled.
   - **Planting:** one flower geometry with per-instance colour; shrub LOD; rocks at about 80 triangles if 14 has not replaced them.
   - **WebGPU only:** try `BundleGroup` for static architecture; keep it only if headless frame time drops.
3. **Adaptive resolution (06).** Move the cpu-only scaler in `main.ts` into a pure `src/game/render-scale.ts` with hysteresis: lower quickly after 2 s below target, recover by +0.05 every 4 s when more than 15% above target. Targets: mobile ≥ 28 fps (floor 0.75), gpu ≥ 50 fps (floor 1.0, ceiling 1.5), cpu unchanged. `?capture=1` freezes the scale. r186's `FSR1Node` could upscale a lower internal resolution later; measure before adopting it.
4. **Record** the before/after budget table per tier in `docs/3d-game-plan.md`, saying plainly that headless numbers are not device benchmarks.

## Part one — renderer-independent geometry (3 October 2026, branch `realism/25-budget`)

Done before the WebGPU merge: the mycelium grove's detail batches, the Living Waters merges, the glucose pavilion merge by material and the enhancement markers. `bun scripts/frame-budget.ts` replays the 33 capture poses in memory (main pass only, classic and WebGPU alike); `tests/frame-budget.test.ts` pins loose ceilings.

| Group, per capture view | gpu before → after | mobile before → after |
| --- | --- | --- |
| Mycelium grove | 3.8 calls, 1.11M triangles, drawn in 21/33 → 0.8, 25k, 8/33 | 3.8, 377k, 21/33 → 0.6, 9k, 6/33 |
| Lake, paths, pavilion | 84.9 → 18.3 calls (177 → 36 built) | same calls; triangles +2k from larger merged bounds |
| Glucose Commons | 28.2 → 7.0 calls (65 → 15 built) | 28.2 → 7.4 (65 → 16 built) |
| Enhancement climb markers | 4.1 → 0.4 calls (39 → 2 built) | same |

The grove's worst view is now inside it: about 640k triangles on gpu (was 1.75M) and 267k on mobile, from crowns within 36 m at full detail; the light crown measured 4.2% of pixels changed at 18 m and 1.2% at 36 m, so the switch stays at 36 m per unit of crown scale. Colliders, seeded matrices, drainage routes, night halos and the full-detail geometry hash identically to `main`. Classic WebGL snapshots (all passes) dropped from 1039 to 691 calls at east-tributary (gpu) and from 441 to 222 at glucose-pavilion (mobile); headless numbers are not device benchmarks.

## Keep

- Every collider, the walking surfaces and the foliage look within walking range.
- The `window.__livistone` hook shape (only add fields).

## Tests

- New `tests/render-scale.test.ts`: hysteresis, floors, no oscillation on synthetic fps traces.
- Existing: `tests/forest.test.ts`, `tests/cpu-detail.test.ts`, `tests/graphics.test.ts`.
- Specs: `tests/graphics-profile.spec.ts`, `tests/navigation.spec.ts`.

## Views

`all` on desktop and touch, day; `quick` on software. This sub-plan has no visible-change gate: the pixels should stay close while calls and triangles drop.

## Acceptance

- On WebGPU the gpu tier is near 250 calls per town view and under 2M triangles; the mobile tier is under about 200 calls and 800k triangles, on the way to its documented budget.
- No visible loss within walking range: median view under 3% of pixels changed by more than 20 levels.
- The render scale settles without oscillating.
