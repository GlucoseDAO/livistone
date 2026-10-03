# 12 — Gallery-quality posters (all 41 works)

**Needs:** 00. **Tiers:** all. **Branch:** `realism/12-posters`. Can run in parallel with 03 and 04.
See [README](README.md) for the shared workflow.

## Status (3 October 2026, branch `realism/12-posters`)

Done: steps 1, 2 and 4; step 3 (the second detail photo) is skipped.

- **True colours.** `scripts/paper-background.mjs` (pure pixel code, unit-tested) fits the sweep's colour across the frame, floods it from the border and from large enclosed holes, and composites a straight-alpha cut-out (shadows as translucent black that hand over to the photographed pixels as they deepen) over paper. 66 catalogue photographs and the First Ring and Moldavian Vault renders were regenerated; the eight listed non-white backgrounds are byte-identical. An alpha cut-out alone tripled the files, and lossy WebP cannot store `#f4f0e5` (no YUV triple decodes to it; flat paper returns as `#f5efe6`), so the derivatives stay opaque and `paperPhotoMaterial()` keys colours within three levels of paper to the exact value. The photo colour is no longer multiplied by the paper. The gateway poster and the Vittoria stand use the same material.
- **Physical presence.** A 4.5 cm bevelled brass rail (the `stand` brass of sub-plan 24) on a lit board (`POSTER_BOARD` in `poster-layout.ts`, colliders from the same outline) frames the unlit paper; neither carries the display mask. Rails merge with the feet, so each collection still draws its stands twice (`scripts/frame-budget.ts`: posters 156 calls built, 21.4 per view, before and after; triangles 1,344 → 4,416 built). The feet keep sub-plan 16's contact patches. Captions bake a picture-light pool that dims their lower corners by up to 7%; their top row, the backing and the photographs' paper stay exactly `#f4f0e5`, day and night.
- **Residency.** `PosterResidency` keeps full thumbnails and captions for the two collections last approached within 40 m; every poster keeps a 96 px photograph and a 128 px caption for distance. Maps swap on the existing materials with one sampler setup, so nothing rebuilds: `tests/poster-text.spec.ts` cycles the halls and checks node builds and shader programs through the dev-only `window.__posters()`. Captions are 640 px wide on mobile and cpu; anisotropy is 8/4/1. Dev-only `?posters=all` restores the old everything-resident profile.
- **Poster texture memory** (measured with `__posters()` while visiting every collection, mip chains included; before = all 41 resident with 960 px captions, every tier): before 223 MiB on every tier. After, gpu: 42 MiB at the station, peak 100 MiB (Science and City Hall); mobile and cpu: 29 MiB at the station, peak 67 MiB. Headless numbers; not a device measurement.
- **Captures** (`review/12-posters`, against `baseline-47dc3b9`): draw calls identical on every view and tier. Pixels changed by more than 20 levels on the key views: 4–9% (city-hall-gallery 5.6%, energy-gallery 3.9%, science-gallery 8.9%, catalogue-poster 4.1%, embryo-station-platform 0.7%), so under the 15% gate: the paper, which most of a poster is, is meant to stay identical, and the rails are thin. Paper samples on the backing, the photograph's background and the caption top read exactly `#f4f0e5` by day and night.

## Current state (before this sub-plan)

- `src/world/planar-exhibition.ts` builds each poster:
  - a cream frame box
  - a brass foot
  - a canvas caption, 960 px wide
  - a paper backing
  - the photo, using `MeshBasicMaterial` with `toneMapped:false`, colour `#f4f0e5`, and anisotropy 4 on every tier
- The paper colour multiplies the whole photo, not just its white background (`:64`).
- All 41 posters keep their textures resident, which is about 90 MB of photos and 140 MB of captions uncompressed, on every tier.
- Rules that stay:
  - photos are uncropped
  - posters load thumbnails; full images load only for inspection
  - gallery paper stays unlit and non-tone-mapped, so it looks the same at night

## Steps

1. **True photo colours.**
   - In `scripts/build-catalogue.mjs` (the existing Sharp step), replace near-white studio backgrounds with exact paper `#f4f0e5`. Use a feathered mask flood-filled from the corners, with tolerance against shadows under the piece.
   - Skip the photos whose backgrounds are not white: sunfinder-1/2, art-nouveau, peas-in-pod, wormy, camel-dali, eyelense-1 and timeface-2.
   - Set the photo material colour to white, so the jewel keeps its true colours.
   - Record the change in `data/catalogue/README.md`. Regenerate derivatives and their hashes.
2. **Physical presence.**
   - A thin bevelled frame, lit `MeshStandardMaterial` in brass or oak, around the unlit paper.
   - A soft contact-shadow quad under the foot. Share the decal texture with 16 if that already exists.
   - A subtle baked light-pool gradient in the backing canvas, with the paper itself still unlit.
3. **Optional second detail photo.** Use the piece's second photo as a small inset, as planned in `docs/3d-game-plan.md:99`.
4. **Residency.**
   - Create caption and photo textures only for the hall the player is in or approaching, with an LRU of 2 halls. Dispose them on leaving.
   - Caption canvases are 640 px wide on mobile and cpu.
   - Anisotropy is 8, 4 and 1 for gpu, mobile and cpu.
   - Keep `window.__posterText` working for `tests/poster-text.spec.ts`.

## Tests

- `tests/exhibits.test.ts`: counts unchanged.
- `tests/exploration.spec.ts`: no full images before interaction.
- `tests/poster-text.spec.ts`: add the 640-wide size to its canvas list.
- Specs: `tests/gateway.spec.ts`, `tests/navigation.spec.ts`.

## Views

`galleries` and catalogue-poster, all profiles, day and night.

## Acceptance

- The jewel colours match the website photos.
- The posters read as framed gallery prints.
- Mobile GPU texture memory is measurably lower.

## On WebGPU (round 2)

Stage A replaces `toneMapped:false` with the `display` mask (`mrtNode`). Paper, photos and captions keep `display = 1`; the new lit frames do not.
