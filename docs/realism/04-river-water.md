# 04 — River water shading rewrite

**Needs:** 02. **Tiers:** all, graded. **Branch:** `realism/04-river`.
See [README](README.md) for the shared workflow. The owner dislikes the current river.

## Current state

- **Material:** `src/world/river.ts`. A `MeshStandardMaterial` coloured `#46685c`, opaque and double-sided, patched with three summed sine ripples.
- **Flow:** a constant world offset, `riverTime*.42` in x. Ripples therefore ignore the river's bends, and the tributaries do not flow into it.
- **Edges:** bank tint and edge darkening come from `uv.y`, which encodes distance to the bank.
- **Mesh:** a flat sheet at y = −0.42, cut to the bank outline from a 1 m grid (`src/world/world.ts:162-180`).
- **Channels:** defined in `src/world/waterways.ts`, which provides the main river, both tributaries and `waterDistance`.
- **Result:** reads as opaque green paint, with a hard edge against the grass. No transparency, depth, Fresnel, foam or reflections of the banks.
- **cpu:** water becomes plain Lambert (`cpu-detail.ts`).

## Steps

1. **New `src/world/water-material.ts`.** It exports `waterMaterial(tier, opts)` and replaces `riverMaterial()`. The lake moves to it in 14.
2. **Bake per-vertex attributes** when the water mesh is built in `world.ts`:
   - `flow`: a unit 2D direction tangent to the nearest centreline in `waterways.ts`, pointing downstream. Tributaries point toward the confluence.
   - `along`: distance along the channel, so normal scrolling is continuous through bends.
   - `depth`: water level minus `terrainHeight(x, z)`, clamped to 0 or more.
   - `rock`: proximity to the instanced rocks that break the surface. Take their positions from the rock list in `src/world/stone.ts` / `world.ts:372`.
3. **Normal detail.** New `scripts/build-water-textures.py`, following the Pillow convention of the other bakers: a procedural, tileable water normal map (summed Gerstner/FFT-like octaves) at 256 and 512 px. No download needed.
   - Two-phase flow-map sampling (the standard flowmap technique) along `flow`, at two scales. Mobile uses one scale.
4. **Optics.**
   - **Absorption.** Beer–Lambert by `depth`: clear and warm brown over the riverbed in the shallows, teal-green when deep.
   - **Soft shoreline.** `alpha = smoothstep(0, ~0.25 m, depth)`. The material becomes transparent with `depthWrite: false`, rendered after opaque geometry.
   - **Reflection.** Schlick Fresnel blends the explicit `envMap` reflection (from 02) with the body colour.
   - **Sun glint.** A tight specular along `SUN_DIR` (from 02).
   - **Foam.** A noisy band where `depth` approaches 0, and around rocks (`rock`), moving along `flow`.
5. **Tiers.**
   - gpu: everything above.
   - mobile: one normal scale and a simpler foam noise.
   - cpu: opaque Lambert with absorption colour baked into vertex colours from `depth`. That keeps the soft-edge colour cue without transparency.
6. **Variants:**
   - a = clear shallow stream
   - b = deeper green garden river

## Tests

- `tests/waterways.test.ts`, `tests/living-waters.test.ts`.
- New `tests/water-material.test.ts` for the baked attributes:
  - `flow` is unit length and points downstream at known samples
  - `depth` is at least 0 and approaches 0 at the banks
- Specs: `tests/living-waters.spec.ts`.

## Views

`water` set, all profiles, day and night.

## Acceptance

- Ripples visibly follow every bend and the tributaries.
- The riverbed shows through in the shallows.
- There is no hard green edge at the banks.
- The surface reflects the sky with Fresnel.
- The owner picks a variant.
