# Recovery and architectural refinement — 17 September 2026

This update follows the original [model notes](notes.md); their measurements and earlier
design record remain unchanged. The user requested reliable held-left-button rotation,
closer resemblance to the Nut pendant, and a more recognizable mitochondrial building.

## Recovery

The working tree had `world.ts` importing `ENERGY_HALL`, `mitoringCage`, and `nanotCage`,
but `jewelry.ts` still exported an older `jewelryCage`. Likewise, `main.ts` called mouse-lock
methods absent from `Input`. Those mismatches prevented the TypeScript build from passing.
The two extracted strand JSON files survived and were used to rebuild the architectural
silver. No STL is fetched by the game and no new runtime dependency was added.

The historical `scripts/derive-strands.mjs` was absent. The settings in the original notes
describe how the existing data was obtained; they are not a runnable regeneration workflow
in this checkout. Preserve both JSON files and the original STLs.

## Controls

The final interaction follows the user's explicit preference: start a drag on the scene,
hold the left mouse button to turn, and release to stop. There is no pointer lock and no
automatic mouse capture on entry or resume. Pointer capture for routing an ongoing drag
is separate from pointer lock: document pointer events preserve the drag if capture is lost.
Mouse `buttons` repairs missed releases; WASD and arrows never change the look-pointer state.
Touch retains separate pointers for looking and the movement stick.

## Buildings

- **City Hall:** the source photographs `../livia/assets/RJW2025/IMG_3493.jpg` and
  `IMG_3496.jpg` show a walnut hemisphere, smoky crystal, a dark joining seam, broad brass
  clasps, and hexagonal fasteners. Procedural shell relief and a furrow texture replace the
  smooth timber appearance; broad clasps replace the thin enclosing bands. The central
  entrance and physics footprint remain in place.
- **Mitoring:** a 28 × 13.2 m amber hall, with 4.2 m walls and a 4.2 m roof, replaces the
  taller cup proportions. The extracted bezel basket is stretched around that footprint;
  its upright setting loops curl inward and sit above the roof. Seven alternating folded
  membranes hang inside, with silver edges and head clearance. These structural folds
  remain visible in the aerial map. The ring shank becomes a smaller entrance gateway.
- **Nanot:** the supplied radial struts and angular folded curves form a silver lattice
  around a lightly glazed public hall. Dark inclusions and the pendant bail preserve its
  identity. The door and walking area are cut from sampled curves before ribbon generation.

Both silver structures are merged into one mesh each and use fewer curve samples on mobile.
They are inhabitable interpretations, not enlarged printable solids. Artifact abilities remain
Livia Lore fiction rather than health claims.

## Verification

- `bun run build` and all seven Vitest tests pass; the known Rapier bundle warning remains.
- All four Playwright tests pass in Chrome, including startup orientation, held-mouse
  rotation with every WASD/arrow key, keyboard changes during dragging, capture loss,
  unpressed mouse movement, map restoration, mobile simultaneous touches, and both ministry
  entrances and discoveries.
- Geometry tests check finite vertices/normals, clear walking space, matching Energy hall
  footprint values, a maximum of 80,000 silver triangles per building, and fewer mobile triangles.
- Ten landmark and aerial screenshots were reviewed under `output/testing/review/` (ignored).
  Physical-phone performance and Safari/iOS have not been tested.
