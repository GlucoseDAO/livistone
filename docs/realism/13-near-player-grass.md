# 13 — Near-player grass field

**Needs:** 03 and 20 Phase B (TSL). **Tiers:** gpu and mobile; cpu has none. **Branch:** `realism/13-grass`.
See [README](README.md) for the shared workflow.

## Why

Close up, the ground is only a texture. A dense, continuous lawn of real blades near the camera hides the texture where it is most visible, while the 03 material handles mid and far range.

## Steps

1. **New `src/world/grass-field.ts`.** One instanced draw call of blade clumps in a disc around the camera.
   - gpu: radius about 22 m, about 50k blades.
   - mobile: radius about 12 m, about 12k blades.
   - The field re-centres on a snapped grid, so the blades do not swim.
2. **Baked lookup `DataTexture`s**, built once at load on the existing 2 m grid (`terrain.ts`, `meadow-relief.ts`):
   - terrain height
   - a grass-allowed mask from `plantingAllowed(x, z, r)`, the paths, `waterDistance` and building, station and lake clearances
3. **Vertex shader.**
   - Sample the height and mask, so there are no blades on paths, in water or indoors.
   - Fade blades by distance into the 03 ground colour and macro variation.
   - Add a gentle wind sway, shared with 17, which is off under reduced motion.
4. **Map mode** hides the field. The existing flowers, shrubs and tuft islands in `planting.ts` stay.

## Tests

- New `tests/grass-field.test.ts`: the mask agrees with `plantingAllowed` and the path clearance at sampled points.
- Specs: `tests/ground.spec.ts`, `tests/navigation.spec.ts`, `tests/graphics-profile.spec.ts`.

## Views

`ground` set at low and standing eye height, desktop and touch.

## Acceptance

- No bare texture is visible within the field radius.
- No blades on paths or in water.
- The cost per tier is recorded in `docs/3d-game-plan.md` (one extra draw call).

## On WebGPU (round 2)

- Write the blade material in TSL: an instanced node material whose `positionNode` samples the baked height and mask textures and whose colour matches `ground-material.ts` macro variation.
- It must run on the WebGL 2 fallback, so do not depend on compute shaders. A compute culling path for WebGPU devices is optional and must be measured against the plain instanced draw.
- Wind time comes from the game's own uniform, shared with 17, so `?capture=1` freezes it.
