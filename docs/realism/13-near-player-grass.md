# 13 — Near-player grass field

**Needs:** 03 and 20 Phase B (TSL). **Tiers:** gpu and mobile; cpu has none. **Branch:** `realism/13-grass`.
See [README](README.md) for the shared workflow.

## Status (3 October 2026)

Built on `realism/13-grass`, on top of 20 Phase B; the before/after captures wait for Stage A to reach `main`.

- **Field.** `src/world/grass-field.ts` draws one `InstancedBufferGeometry` of blade patches in three nested levels (1×, 2×, 4× cell size). gpu: 22 × 22 cells per level from 0.5 m, 36 blades each, radius 22 m, 52,272 blades. mobile: 16 × 16 from 0.375 m, 25 blades, radius 12 m, 19,200 blades (first captured with 16 blades, 12,288 in all, which read as scattered blades beyond about 3 m). Each cell wraps to its copy nearest the camera, so every level re-centres on its own snapped world grid and blades never swim; a level thins out blade by blade before its tile edge.
- **Bake** (about 35–70 ms at load, 0.6 MB of textures). On the terrain's own 2 m vertices: the rendered height (read back from the walking collider), a signed clearance that equals `plantingAllowed` at every point (`footprintReserved`, binned path samples, water), a density from soil wear and slope, and the ground's baked occlusion, in RGBA32F read with `textureLoad`; the ground's vertex tint and a grass amount in RGBA8. Blades stand on the same triangles the terrain tiles draw.
- **Shader.** Blades stand on the terrain mesh's own triangles, start 0.25 m beyond reserved ground (paths, kerbs, water, halls, station, large rocks), thin over worn soil, banks and steep slopes, take the ground's macro palette and vertex tint and 16's baked crown and wall occlusion (as their aoNode), run dark-rooted to dry tips, and fade by distance into the meadow's average colour. Wind comes from the shared `src/world/wind.ts` clock (game time, frozen by `?capture=1`, still under reduced motion).
- **Ground.** The soil between blades takes the canopy's shade from the bake's grass amount, fading with the field.
- **Tufts.** Inside the field radius the sparse `planting.ts` tufts sank into the ground: next to real blades they read as sticks. Flowers, shrubs and the tuft islands beyond the radius stay.
- **Switches.** `?grass=off` drops the field (and the ground shade); `?eye=<metres>` sets the camera height above the ground for low captures.
- **Cost.** One draw call; gpu 261,360 triangles (366k vertices), mobile 57,600 (96k vertices), cpu none. Rocks under about 40 cm are below the 2 m grid, so a few short bank blades can still meet them.

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
