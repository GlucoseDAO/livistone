# 12 — Gallery-quality posters (all 41 works)

**Needs:** 00. **Tiers:** all. **Branch:** `realism/12-posters`. Can run in parallel with 03 and 04.
See [README](README.md) for the shared workflow.

## Current state

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
