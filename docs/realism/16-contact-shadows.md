# 16 — Contact shadows and grounding

**Needs:** 00. **Tiers:** all; cpu, which has no shadows, gains the most. **Branch:** `realism/16-contact-shadows`.
See [README](README.md) for the shared workflow.

## Steps

1. **New `src/world/contact-shadows.ts`.** One instanced batch of soft radial-gradient decal quads:
   - one shared 64–128 px texture
   - multiply blending, `depthWrite: false`, polygon offset
   - placed under trees, rocks, benches, poster feet, vitrines and lamp posts
   - follows the terrain height, with no per-frame CPU work
2. **Baked ground shade.** In `src/world/ground-cover.ts`, darken ground vertices near tree trunks, building footprints and walls. This adds no draw call.
3. Respect the existing visibility culling, and hide the decals in map mode where needed.

## Tests

- New `tests/contact-shadows.test.ts`: decal positions sit on the terrain and avoid paths where they would look wrong.
- `tests/cpu-detail.test.ts`.

## Views

`ground`, `exteriors` and `galleries`, all profiles.

## Acceptance

- Objects look seated on the ground on every tier, including software.
- One to two extra draw calls at most.

## On WebGPU (round 2)

On the gpu tier, try r186's screen-space shadow node (`sss` in `three/addons/tsl/display/SSSNode.js`, blurred) inside Stage A's output pipeline for fine contact shadows under small objects. Decals and the baked ground shade stay the mobile and cpu path, and the decals' material is a plain node material with multiply blending.
