# 14 — Shore, riverbed and rocks

**Needs:** 03, 04 and 20 Phase B for the shader steps. **Tiers:** all, graded. **Branch:** `realism/14-shore`.
See [README](README.md) for the shared workflow.

## Status (3 October 2026)

Implemented on `realism/14-shore`, rebased on the WebGPU branch and not merged: every step. Steps 1 and 3's moss are TSL (`src/world/shore-nodes.ts`); pebbles refill from the cells near the camera; the lake material is `lakeWaterMaterial` in `water-material.ts`. Captures wait for the WebGPU merge.

Follow-up on `fix/round-2-known-issues` ([round-2-leftovers.md](round-2-leftovers.md), section 2): the pebbles read as scattered marbles on the grass. They are now fewer (1,800 gpu, 600 mobile), smaller (median half-length 2.6 cm), bedded below the ground and in the bank's own browns, and lie in drifts along the waterline that end short of the grass. `tests/shore.test.ts` now evaluates `channelDistance`'s node graph against `waterDistance` at about 90k points, so the duplicated channel formulas cannot drift apart.

## Steps

1. **Terrain shader near water** (`mountains.ts`, using `waterDistance` and the 04 depth). The ground darkens and its roughness drops in a wet band at the waterline, plus:
   - a gravel and pebble shore layer from the 03 shore assets
   - under water, a darker riverbed
   - cheap animated caustics on gpu, visible through the transparent 04 water
2. **Pebbles.** Instanced, rounded, scattered along the shores with seeded placement and path clearance (gpu and mobile).
3. **Rocks** (`src/world/stone.ts:51-85`, `world.ts:372`).
   - Replace the faceted icosahedra with smoother subdivided, noise-displaced shapes with smooth normals.
   - Add a triplanar up-facing moss mask.
   - Keep the matching colliders: same instance transforms, colliders regenerated from the new shape.
4. **Lake** (`src/world/living-waters.ts`). Move it to `water-material.ts`. Keep the outer lake subdued at night around the briolette pavilion.

## Tests

- `tests/living-waters.test.ts`, `tests/waterways.test.ts`, `tests/physics.test.ts` (rock colliders).
- Specs: `tests/living-waters.spec.ts`.

## Views

`water` set, all profiles, day and night.

## Acceptance

- Banks read as natural shores rather than grass meeting paint.
- Rocks look rounded and mossy.
- The lake matches the river's look.

## On WebGPU (round 2)

Rock geometry, pebble placement and their colliders are renderer-independent and may be developed during Stage A, but merge after it. The wet band, riverbed, caustics and moss mask are TSL additions to the ported ground, water and rock materials.
