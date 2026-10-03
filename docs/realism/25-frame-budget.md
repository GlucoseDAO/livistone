# 25 — Frame budget and adaptive resolution

**Needs:** 20 Phase B. Folds in [06](06-adaptive-resolution.md). **Tiers:** all. **Branch:** `realism/25-budget`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Why

On classic WebGL the gpu tier drew 540–1040 calls and 5.8–7.3M triangles per frame in town views, and the mobile tier 260–520 calls and 1.4–1.6M triangles, against documented budgets of about 250 calls on desktop and 120 calls with 200–400k triangles on mobile (`docs/3d-game-plan.md`). WebGPU halves both by dropping classic's transmission re-render, which still leaves the town over budget. Stage B adds ambient occlusion, a grass field and more materials, so headroom comes first.

## Steps

1. **Measure on WebGPU.** A dev-only breakdown of draw calls and triangles by top-level group (forest, planting, architecture per landmark, terrain, water, exhibitions), exposed as an added `snapshot().budget` field and printed by the capture harness. Record the top contributors per tier on `quick` and `exteriors`.
2. **Cut the largest contributors**, for example:
   - trees: fewer triangles in the far ring (a simplified GLB level or a camera-facing impostor), and no shadow casting beyond the shadow box
   - static architecture: merge opaque meshes by material within spatial cells on gpu and mobile, reusing the batching `cpu-detail.ts` already does for the cpu tier, while keeping frustum culling per cell
   - instanced planting: cull whole chunks by distance and frustum before submission
   - WebGPU only: try `BundleGroup` for static architecture and keep it only if headless frame time drops
3. **Adaptive resolution (06).** Move the cpu-only scaler in `main.ts` into a pure `src/game/render-scale.ts` with hysteresis: lower quickly after 2 s below target, recover by +0.05 every 4 s when more than 15% above target. Targets: mobile ≥ 28 fps (floor 0.75), gpu ≥ 50 fps (floor 1.0, ceiling 1.5), cpu unchanged. `?capture=1` freezes the scale.
4. **Record** the before/after budget table per tier in `docs/3d-game-plan.md`, saying plainly that headless numbers are not device benchmarks.

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

- The gpu tier is near 250 calls per town view on WebGPU; the mobile tier's calls and triangles drop measurably toward its budget.
- No visible loss within walking range: median view under 3% of pixels changed by more than 20 levels.
- The render scale settles without oscillating.
