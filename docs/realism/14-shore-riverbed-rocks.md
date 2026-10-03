# 14 — Shore, riverbed and rocks

**Needs:** 03, 04 and 20 Phase B for the shader steps. **Tiers:** all, graded. **Branch:** `realism/14-shore`.
See [README](README.md) for the shared workflow.

## Status (3 October 2026)

The renderer-independent part is done on `realism/14-shore` and is not merged: step 2 and step 3's geometry and colliders, plus a few rocks moved into the stream. Rocks now carry `uv` and a 0–1 `moss` attribute for the moss mask. Still to do in TSL after Stage A: step 1, the step 3 moss/triplanar mask, and step 4.

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
