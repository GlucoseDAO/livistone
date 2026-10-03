# 24 — Architectural surfaces

**Needs:** 20 Phase B (TSL). Texture bakes can start earlier. **Tiers:** all, graded. **Branch:** `realism/24-surfaces`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

Follow-up (October 2026, `fix/round-2-known-issues`): after sub-plan 25 merged the poster feet per collection, the brass brushing on each foot's top ran at that foot's yaw. Brass is now `userData.objectSpace`, and `mergeStatic` bakes each part's own frame for it; see [round-2-leftovers.md](round-2-leftovers.md), section 2.

## Why

The round-1 captures show large surfaces in plain colour: the white bridge deck and arch, the gateway's stone abutments, poster plinths and stands, the grey interior floors of the halls, and the station platform. Next to the textured paving and kerbs they read as untextured CG. This is architecture that is not one of Livia's pieces; 08 covers the piece-buildings.

## Steps

1. **Inventory.** List the materials without maps that cover the most screen area in the key views below, with file and line. Expected: `bridge.ts` (deck, arch, posts), `gateway.ts` / `gateway-materials.ts` (abutments; the silver and tourmaline stay with 08e), hall floors and plinth rings in `world.ts`, `planar-exhibition.ts` feet and frames, `station.ts` platform and foyer floor, sign posts in `place-sign.ts`.
2. **Procedural bakes, no downloads.** A new `scripts/build-surface-textures.py` (Pillow + numpy, seeded), packed like the ground maps: an albedo WebP plus an `nrh` WebP (normal x/y, roughness, height), 1024 px on gpu and 512 px reduced:
   - pale limestone ashlar with fine pitting and slight per-block tone variation (bridge, abutments, plinth rings)
   - honed terrazzo or cast stone (hall floors, station platform)
   - an oak or brushed-brass variation map for stands, if the inventory shows they matter
   Record the generator and seeds in `public/textures/surfaces/ATTRIBUTION.md` (generated, no third-party sources).
3. **Mapping in TSL.** `triplanarTexture` in world space for curved shapes such as the bridge arch; box-projected or existing UVs where they are clean. Keep texel density close to the paving's.
4. **Weathering.** A subtle grime and damp gradient toward the ground (world height above the local terrain) and slightly rougher, darker undersides. No new geometry.
5. **Tiers.** gpu: albedo, normal, roughness. mobile: albedo and roughness. cpu: albedo only, through the Lambert conversion in `cpu-detail.ts`.
6. **Dev switch** `?surfaces=off` to compare against the flat colours.

## Keep

- Every collider and the walking surfaces unchanged.
- The approved colours as the average tone; texture adds variation, not a new palette.
- Separate quality tags for hero materials (`gatewayGem`, `cityHallCrystal`, `mitoringAmber`, `stationAmber`).

## Tests

- Existing: `tests/gateway.test.ts`, `tests/station.test.ts`, `tests/cpu-detail.test.ts`.
- Specs: `tests/gateway.spec.ts`, `tests/station.spec.ts`, `tests/graphics-profile.spec.ts`.

## Views

`gateway-front`, `gateway-side`, `bridge-crossing`, `bridge-bank`, `shore-closeup`, `energy-inside`, `science-inside`, `city-hall-gallery`, `embryo-station-platform`, desktop and touch, day; one night set.

## Acceptance

- Bridge, abutments, floors and platform read as stone or cast surfaces at walking distance.
- No draw-call increase; added texture download per tier recorded in `docs/3d-game-plan.md`.
- The visible-change gate holds on the key views.
