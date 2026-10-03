# Livia's 3D models in Livistone: plan and status (4 October 2026)

This is the working plan for bringing Livia's jewelry STLs into the town as real 3D models. It records the owner's decisions, what is already built, and what comes next. Background lives in two other documents: [jewelry-stl-catalogue.md](jewelry-stl-catalogue.md) covers which file is the latest for each work, and [jewelry-stl-inclusion-analysis.md](jewelry-stl-inclusion-analysis.md) covers mesh health and decimation limits.

## Owner decisions (interview, 3–4 October 2026)

- **Posters stay exactly as they are.** One poster per piece, same board, no duplicates.
- **One hovering model per building.** In each building, one poster piece that has a usable STL also hovers above its poster as a decimated silver model.
  - The piece changes **every hour** and is the same for every visitor.
  - Only that one model per building downloads.
  - The budget is deliberately **small**.
- **Mycelium Ring:** one model floating above the blue opal orb at the centre of the Mycelium grove.
- **Two new locations, both moon gates:**
  - **West meadow, beyond the Ministry of Energy:** the **Eye of Winter double moon gate**, the owner's earlier request in `concepts/06-town-extension/notes.md`.
  - **East strip, beyond the Ministry of Science:** the **Eyelense moon gate**. The two crescent faces stand upright as the frame. The colour-changing lens hangs in the upper eye as a large tinted glass disc that darkens in daylight and clears at night, and visitors walk under it.
- **Unpublished 2026 work may be used.** Captions say "new work, 2026" and do not invent artist text.
- **Map numbering follows the route:** … Ministry of Energy → Eye of Winter Gate → Ministry of Science → Eyelense Gate → City Hall …. Save IDs do not change.
- **Original print models are never committed.** Only optimized derivatives go into git, through Git LFS. This rule is in AGENTS.md.
- **Commit intermediate results** as each part works. Show in-game renders, before and after side by side, for every model placed.

## Status

| Part | State |
| --- | --- |
| 0. Offline pipeline `scripts/build-jewelry-models.ts` + manifest `data/catalogue/models.json` | **Done.** 22 models built; provenance (SHA-256, dates, triangles, deviation) in `public/models/jewelry/sources.json` |
| 1. Hovering featured model per building (`src/game/featured.ts`, `planar-exhibition.ts`) | **Done, desktop-verified** (captures below). Touch and software captures and a Playwright spec are still to do |
| 2. Mycelium Ring above the opal orb (`living-waters.ts`) | **Done, desktop-verified** |
| 3a. Eye of Winter Gate (west) | Not started. Models are built (`eye-of-winter-base`, `eye-of-winter-half`); a concept image needs owner approval first |
| 3b. Eyelense Gate (east) | Not started. Models are built (`eyelense-1`, `eyelense-2`); a concept image needs owner approval first |
| Frame budget | The script now reads jewelry GLBs and classifies "hovering jewelry models". It has not been run to completion: the earlier attempt hung waiting for poster photos under Bun |
| Docs | This page and AGENTS.md (the never-commit-originals rule). README, the game plan status and the catalogue "In Livistone" column wait until the gates exist |

### How it works now

- **Candidates per building** (`FEATURED_CANDIDATES` in `src/game/featured.ts`):

  | Building | Candidates |
  | --- | --- |
  | City Hall | Nucalong, Nocciola |
  | Energy | Splash, Ice, Amberear |
  | Science | Mountain of Gold, Beanut, Hessonite, Vittoria Amazonica |
  | Station | Inline, La Navette |
  | Timeface | Wormy, Peas in Pod, Art Nouveau, Moldavian Vault, First Ring |
  | Future House | Deep Sea Pearl |

  Pieces that became architecture are excluded: Mitoring, Nanot, Eye of Winter, Eyelense and Mycelium.
- **Selection.**
  - `featuredPiece(building, townHour())` picks the piece; `townHour` counts whole hours since the epoch.
  - Under `?capture=1` the hour is pinned to 0.
  - Dev-only `?featured=<id>` pins one piece, and `?featured=off` removes every model (including the ring) for before/after reviews.
- **Placement** (`PlanarExhibition.feature`):
  - One shared silver material (`heroEnv`). The mesh is a child of its poster's group, so it hides with the room beyond `ROOM_RANGE`.
  - The model hovers 0.45 m above the board at ×1.35 of its 1.3 m manifest size.
  - `HOVER_SITE` holds per-building overrides: Energy moves 1 m inward away from the fins, the station hovers lower and smaller under its hanging plate, and Future House is smaller and inward under the cabin roof.
  - The model turns and bobs on `windTime`, so it is still under reduced motion and frozen in captures.
  - It sets `userData.keepGeometry` (cpu-detail must not simplify it again) and has no collider.
  - It is pushed into `photos`, so a click opens that piece's photo viewer.
- **Hourly swap.** `updateFeatured` loads the next hour's piece only while the visitor is beyond `ROOM_RANGE` of that collection. It swaps geometry on the same mesh and material, so no shader rebuilds.
- **Mycelium ring.**
  - `LivingWaters.presentMyceliumRing()` loads `mycelium.glb` at ×1.6 (about 5.8 m), 1 m above the orb, in the grove's silver.
  - It is named `Mycelium ring`, so frame-budget counts it under the grove.
  - `turnRing()` runs from `Town.update`.
- **Dev hook.** `window.__featured()` lists each building's piece, its world position and which way its poster faces.

### Pipeline

```bash
bun scripts/build-jewelry-models.ts ~/Downloads/drive-folder --preview          # all models + orthographic previews
bun scripts/build-jewelry-models.ts ~/Downloads/drive-folder --only splash --preview
```

- **Steps:**
  1. Weld vertices at 1 µm.
  2. Drop collapsed and duplicate faces.
  3. Delete shells under 0.5 mm.
  4. Flip inside-out shells.
  5. Apply the manifest rotation (degrees, after STL Z-up becomes Y-up).
  6. Scale the longest side to `size` metres.
  7. Run `meshoptimizer` simplify with Prune.
  8. Compute normals with a 60° crease.
  9. Reorder for vertex fetch and write a plain GLB (positions, normals, uint16 indices).
- **Results.**
  - Featured models: 10k triangles (Ice 20k, La Navette 12k), 0.2–0.4 MB each, with deviation 0.5–17% of the wire radius.
  - Deep Sea Pearl (9.7 M triangles) and the Eye of Winter base (10.3 M) each take 25–37 s.
- **Previews** are written to `output/testing/jewelry-models/*.png`: front, side and top. The front view is what a visitor sees above a poster.
- **Gotcha:** `MeshoptSimplifier.compactMesh` renumbers the index buffer **in place** and returns the old→new remap, not new indices.

### Captures

```bash
bun scripts/screenshot-realism.ts output/testing/jewelry-featured/after desktop featured day
LIVISTONE_PARAMS=featured=off bun scripts/screenshot-realism.ts output/testing/jewelry-featured/before desktop featured day
```

- The `featured` view set covers each building's hovering model at hour 0, plus `mycelium-ring` and `mycelium-ring-far`.
- `featured-station-navette` needs `LIVISTONE_PARAMS=featured=la-navette`.
- Side-by-side sheets are in `output/testing/jewelry-featured/` (git-ignored).
- **Known:** at the station, Inline lines up visually with the Embryo ring's silver tube. It appears to be in front of the tube rather than inside it, but check from the side.

## Next steps

1. **Verify Parts 1–2 fully.**
   - Run `bun run build` and `bun run test:browser`.
   - Add a Playwright spec: load `?featured=splash`, check that the mesh exists and that clicking it opens the photo viewer.
   - Take touch and software captures. Run `bun scripts/frame-budget.ts`.
2. **Gate concepts.** Use `output/testing/jewelry-models/eye-of-winter-*.png` and `eyelense-*.png` with the town overview style to make one concept per gate, record them under `concepts/15-moon-gates/`, and get the owner's approval.
3. **Eye of Winter Gate**, files `winter-gate.ts` and `winter-gate-layout.ts`, around (−108, −30):
   - **Path.** Branch off route 3 at (−78, −32) in `landscape.ts`. Split into two level paths through the two openings that rejoin beyond the gate.
   - **Geometry.** The base stands up so its two finger loops are the openings, at about 0.3 m/mm (12 × 10 m). The honeycomb half-shell sits above the join with a blue stone; follow the gem pattern in `gateway-materials.ts`.
   - **Frost.** A frozen pond, icicles, and a frost tint baked into the ground through `ground-cover.ts`.
   - **Colliders.** Built by hand from the skeleton, never from the print mesh.
4. **Eyelense Gate**, files `eyelense-gate.ts` and `eyelense-gate-layout.ts`, around (106, −36):
   - **Path.** Branch off route 5 at (80, −34).
   - **Geometry.** Crescents upright at about 0.14 m/mm (~10 m) in brass, with the screw studs as columns.
   - **Lens.** A disc in the upper eye whose tint follows day and night (`daylight.ts`). It is opaque on the low tier.
   - **Colliders.** Feet and lower rim only.
5. **Shared gate wiring:**
   - In `content.ts`: the `LandmarkId` union, `LANDMARKS` inserted in route order, and `DISCOVERIES` (Eye of Winter lore labelled as Livia Lore fiction; Eyelense uses the artist's broken-lens text).
   - `nearby.ts`, plus `groundReserved` and `canopyReserved` clearances in `landscape.ts`.
   - Terrain flattening next to `terrain.ts:35`.
   - Path-network and grass-field tests, Rapier walk-through tests, `contact-shadows.ts`, and a frame-budget producer.
6. **Docs once the gates exist:**
   - README stops (12 entries) and new screenshots via `bun scripts/build-share-images.ts --readme`.
   - The `docs/3d-game-plan.md` status paragraph.
   - CLAUDE.md repository map and invariants.
   - The catalogue's "In Livistone" column.
7. **Separate issue, out of scope:** `bila.stl` (the Nanot) carries print supports in its bottom ~11 mm. About 27% of the Ministry of Science strand length may be supports.
