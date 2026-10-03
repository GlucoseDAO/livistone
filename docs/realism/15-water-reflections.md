# 15 — Water reflections (gpu-only experiment)

**Needs:** 04. **Tiers:** gpu only. **Branch:** `realism/15-reflections`.
See [README](README.md) for the shared workflow.

## Steps

- **Planar reflection pass** for the river and lake: about half resolution, a mirrored camera and a clip plane at the water level.
  - Render only the sky, buildings, the bridge and trees, using a layer mask that excludes grass, details and particles.
  - Skip the pass when no water is in the view frustum.
- **Mix:** the reflection texture distorted by the 04 normals, blended through Fresnel in `water-material.ts`.
- mobile and cpu keep the probe or sky reflection from 07 and 02.

## Measure

- Draw calls, triangles and headless frame time, before and after, on the `water` views.
- Ship only if the owner prefers it and the cost fits the desktop budget (under about 250 draw calls).

## Acceptance

- The bridge and the trees on the bank are visibly reflected.
- When the owner has not approved it, the branch is discarded.

## On WebGPU (round 2)

Prefer r186's `ssr()` (`three/addons/tsl/display/SSRNode.js`) in Stage A's pipeline on the gpu tier, blended by the water's Fresnel. Fall back to a planar pass only if screen-space reflection misses what matters, such as the bridge when it leaves the screen.
