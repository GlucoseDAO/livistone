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

## Status (3 October 2026): built on the WebGPU branch, awaiting captures

Branch `realism/16-contact`, rebased onto Stage A (`realism/20-webgpu`).

- `src/world/contact-shadows.ts` puts every decal into one multiply-blended `MeshBasicNodeMaterial` batch, adding one draw call and one pipeline. The shared texture is a 64 px `DataTexture`. The batch covers crown and trunk patches per tree, bank rocks, lamp posts, poster and stand feet, place signs, plinths and station benches. Timeface posters hang on brackets over the core and get none.
- The multiply scales linear light before the output pass. Its `KEEP_DISPLAY` MRT writes zero to the `display` attachment, which multiply blending leaves unchanged, so the ground keeps its fog factor and far decals fade into the haze.
- Flat quads fit badly: across the real tree sites a 4 m disc deviates from the tangent plane by 0.31 m at the median and 1.28 m at p90. Terrain patches therefore reuse the rendered 2 m grid and diagonal. A test checks that every decal triangle is a terrain triangle. The polygon offset (−1, −4) holds against it on WebGPU.
- Tree patches are grouped by `forestCells`, which the consolidated `Forest` also plans its cells from. They stay out of the index until `Forest.onCells` reports their cell's trunks; the index is rewritten only when that changes.
- The batch hides in map mode: the map hides foliage, so the patches read as dotted blots around bare trunks.
- Counts: gpu 905 trees, 420 rocks and 86 object sites make 2,316 patches (42k vertices, 50.7k triangles). The mobile and cpu tiers have 506 trees and 230 rocks, giving 1,328 patches (28.6k triangles). Only nearby cells draw, about +7–13k triangles in walking views. The build takes 20–40 ms.
- `ground-cover.ts` `groundShadeField` bakes the `groundShade` terrain attribute from crowns, trunks and building footprints. Values run from 0.42 to 1, and 7% of vertices are below 1. The bake adds about 20–75 ms. The ground material reads it as its `aoNode`, so it dims indirect light only, on the standard (gpu, mobile) and Lambert (cpu) node materials alike; direct sun stays with the shadow maps.
- Strengths were retuned on WebGPU: crowns 0.3 and trunks 0.7, because the baked shade now covers crown-scale sky occlusion and tree shade sits in the tone curve's toe. Rocks are 0.85; feet, posts and plinths are unchanged.
- `cpu-detail.ts` skips meshes with `userData.keepGeometry`, which keeps the patches exact on the cpu tier.
- Dev switch: `?contact=off` leaves out both the decals and the baked shade.

Still to do: the before/after captures on the merged `main`.

### Software-tier review and the rock fix (3 October 2026)

The software captures changed almost nowhere. A black-decal diagnostic on the WebGL 2 fallback and on WebGPU (first recorded on `realism/16-contact`, `dc48e0d`) found:

- Tree patches do render on the cpu tier. `Forest.onCells` reports there and the index updates reach the GPU. In `arrival-meadow` the nearest tree stands just behind the meadow crest, which hides its pool. The quick views simply have few trees inside the cpu tier's 58 m forest range.
- The patches under the bank rocks were not a cpu bug: on every tier they lay entirely under the rocks. Their radius was capped at the rock's planting clearance (s × 1.45 + 0.25 m), while the rock's silhouette reaches about 1.57 × s.

Fixed on `fix/round-2-known-issues` (see [round-2-leftovers.md](round-2-leftovers.md), section 2):

- Each bank-rock patch now reaches past the silhouette (1.4 s by 1.0 s, `ROCK_STRETCH`) by `rockHalo(s)` = 0.55 s + 0.15 m, so the silhouette sits on the falloff's dark shoulder (at least 0.6 of full strength); strength is 0.9. Only one gpu rock beside a route gives up part of its halo, so no patch reaches the paving.
- The patches now cross the planting clearance onto the wet bank but stop short of the water's outline. Every decal vertex carries its `waterDistance` (`water` attribute, linear across a 2 m bank cell) and the material fades each patch per fragment from nothing at the waterline to full strength 0.25 m above the channel line (`CONTACT_WATER_FADE`). Rocks standing in the stream still get no patch.
- Counts: gpu 2,316 patches (43k vertices, 51.8k triangles), mobile and cpu 1,328 (29.2k triangles); still one draw.
- Not done: a stronger crown patch on the cpu tier, which has no sun shadows.

## On WebGPU (round 2)

On the gpu tier, try r186's screen-space shadow node (`sss` in `three/addons/tsl/display/SSSNode.js`, blurred) inside Stage A's output pipeline for fine contact shadows under small objects. Decals and the baked ground shade stay the mobile and cpu path, and the decals' material is a plain node material with multiply blending.
