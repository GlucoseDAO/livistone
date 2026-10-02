# 03 — Ground material rebuild

**Needs:** 02. **Tiers:** all, graded. **Branch:** `realism/03-ground`.
See [README](README.md) for the shared workflow. The owner dislikes the current ground, which reads mostly as a texture.

## Current state

- The visible ground is one mesh built in `src/world/mountains.ts:37-64`. Its shader patch is at `:70-99`.
- **Colour:** CC0 Poly Haven "Leafy Grass" and "Sparse Grass", 1K diffuse only, stored as `public/textures/ground/meadow-{512,1024}.webp` and `soil-*`. The meadow tiles every 2.8 m and the soil every 3.3 m.
- **Soil blend:** a linear lerp by the `groundSoil` vertex attribute, baked by `src/world/ground-cover.ts`.
- **Tinting:** spring green, desaturated.
- **Rock:** blended in triplanar on slopes, with a rock normal map on gpu only.
- **Missing:** grass and soil have no normal or roughness maps, there is no anti-tiling, and there is no large-scale variation. The patch also lacks a `customProgramCacheKey`.
- Provenance is in `public/textures/ground/ATTRIBUTION.md` and `sources.json`. Derivatives are built by `scripts/build-ground-textures.py`.

## Steps

1. **Assets.** Ask the owner for permission before downloading.
   - Fetch the full CC0 PBR sets: colour, normal (GL), roughness, displacement/height and AO. Take them for the same two Poly Haven grasses plus a forest-floor set and a gravel/wet-mud shore set; the shore set is used in 14.
   - Record every URL and SHA-256 in `sources.json`, and update `ATTRIBUTION.md`.
   - Extend `scripts/build-ground-textures.py` to pack per tier:
     - `albedo` as RGB WebP
     - `nrh` with normal.x, normal.y, roughness and height packed into one RGBA WebP, using lossless or high quality
   - Sizes: 512 for reduced tiers, 1024 for gpu.
2. **Shader** (`mountains.ts` patch), with `customProgramCacheKey` added:
   - **Anti-tiling.** Hex/stochastic tiling on gpu (3 taps, after Mikkelsen's practical real-time hex-tiling). A 2-tap rotated and offset blend on mobile. Plain sampling on cpu.
   - **Two-scale sampling.** Near scale about 2.5 m, far scale about 11 m, blended by view distance. This removes visible repetition at mid and far range.
   - **Macro variation (all tiers, ALU only).** Low-frequency world-space value noise at 30–80 m drives hue, value and wetness: dry yellowish patches, lush dark patches and clover-tinted areas. Keep the owner-approved subdued spring green as the centre of the palette.
   - **Height-based blending** between meadow, soil and rock, using each layer's height channel, instead of the linear lerp. Gives crisp, natural transitions at path wear and banks.
   - **Lighting.** gpu uses grass and soil normals (reoriented normal blending) and roughness. Mobile uses roughness only. cpu keeps the colour path, because `cpu-detail.ts` keeps only the terrain shader patch.
   - If the textures fail to load, keep the existing flat-colour fallback.
3. **Variants** (`?look=a|b`):
   - a = restrained, the current palette made physically plausible
   - b = richer meadow, with more visible soil, dry patches and stronger macro contrast

## Keep

- The meadow-relief contours (`meadow-relief.ts`).
- Soil and path wear from `ground-cover.ts`.
- The terrain collider.
- No extra terrain draw call and no per-frame CPU work.

## Tests

- `tests/meadow-relief.test.ts`, `tests/landscape.test.ts`, `tests/cpu-detail.test.ts`.
- Specs: `tests/ground.spec.ts`, `tests/graphics-profile.spec.ts`.

## Views

`ground` (all profiles), plus `exteriors` desktop. Day, and one golden set once 05 exists.

## Acceptance

- No visible tiling at 10–60 m.
- Grass shows small-scale light and shadow on gpu.
- Transitions to paths, soil and rock look natural.
- The owner picks a variant.
- The texture download size per tier is recorded in `docs/3d-game-plan.md`.
