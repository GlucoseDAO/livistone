# Realism round 1 — record (3 October 2026)

Sub-plans 00–04 were developed in parallel worktrees from `76104be`, reviewed with the before/after harness, then merged into `main` in order 00, 04, 03, 02, 01 (`a16ad0d`). 20 (WebGPU, Phase A) is parked on `realism/20-webgpu`.

## 01 — Sun shadows

- **The bug:** `main.ts` set `shadow.camera.bottom = shadow` (commit 28f72f2), giving the frustum zero height, so no sun shadows rendered.
- **The fix:**
  - The shadow box follows the player and is texel-snapped (`src/game/shadow-frame.ts`): ±50 m at 2048 on gpu, ±40 m at 1024 on mobile, placed 30% ahead of the view. The map keeps ±160 m.
  - Shadows fade out between 72% and 90% of the half-size (`src/world/shadow-fade.ts`).
  - Bias is 5 cm in world units; normal bias is 0.6 texel.
  - The shadow map re-bakes after a quarter-box drift, on tree detail changes, and at mode, time and quality switches. Shrub batches no longer force a re-bake.
  - Tree foliage casts shadows again.
- **Result:** 17–34% of pixels visibly changed on open views. Contrast is limited by ambient light (sub-plan 21).

## 03 — Ground

- **Assets:** CC0 Poly Haven 2K sets `leafy_grass`, `sparse_grass`, `brown_mud_leaves_01` and `gravel_floor_02`. Originals are git-ignored in `data/textures-src/`; provenance is in `public/textures/ground/sources.json`.
- **Packed maps:** albedo WebP plus a lossless RGBA nrh map (normal.xy, roughness, height). The nrh map is half the albedo resolution: 512 on gpu, 256 reduced.
- **Download per tier:** about 2.3 MB gpu, 570 KB mobile, 245 KB cpu.
- **Shader:** `src/world/ground-material.ts`.
  - gpu: hex tiling, reoriented detail normals.
  - mobile: a 2-tap blend, roughness only.
  - cpu: the colour path only.
  - All tiers: near/far scale blend, per-vertex macro patches, height blending, a tussock relief field.
- **Variants:** dev switch `?ground=b`; the default stays a until the owner picks.
- **Result:** 40–68% of pixels visibly changed on ground views.

## 02 and 04

See `02-light-sky.md` and `04-river.md`. The owner chose river look b on 3 October; `?look=a` stays as a dev switch. Light look b is the default; `?light=a` is dev only.

## Process lessons

- Agents iterated on captures and self-review, at 300–430k tokens each, while the owner saw few visible differences early on.
- Round 2 adds a capture budget, a checkpoint after the first capture, a visible-change gate, per-sub-plan dev switches, and stopping dev servers as soon as a branch merges (`docs/realism/NEXT.md`).
