# Moon gates — concept for approval (4 October 2026)

The owner chose two new locations: the **Eye of Winter double moon gate** on the west meadow beyond the Ministry of Energy (the request first recorded in [06-town-extension](../06-town-extension/notes.md)), and the **Eyelense moon gate** on the east strip beyond the Ministry of Science, walked through under its colour-changing lens. Plan and status: [docs/jewelry-models-plan.md](../../docs/jewelry-models-plan.md).

No image generator was available, so these concepts are in-engine renders of Livia's own geometry rather than paintings: each gate is her decimated STL assembly (`scripts/build-jewelry-models.ts`, entries `eye-of-winter-gate` and `eyelense-gate` in `data/catalogue/models.json`) stood on its site through the dev-only `?concept=gates` switch (`src/world/gate-concepts.ts`), which also clears the trees within 24 m. No paths, colliders or planting clearances exist yet.

- [Eye of Winter Gate](images/01-eye-of-winter-gate.png): the looped base and the honeycomb half-shell exactly as assembled in the print files (`+EOW-base.stl` + `+EOW-complex half.stl`, 10.9 M → 30k triangles), stood up so the two finger rings are two walk-through openings; the honeycomb basket sits over their join with a blue stone; polished silver; a frozen pond under both openings. About 12 m wide, at (−108, −30), facing the route 3 approach from the east.
- [Eyelense Gate](images/02-eyelense-gate.png): both crescent faces as threaded together in the pendant (`+eyelens1-1/-2.stl`, 112k → 20k triangles), stood on their two tips as an arch about 10 m across; brass for the PLA and brass of the piece; the lens hangs in the eye as a tinted disc (to darken by day and clear at night). At (106, −36), facing the route 5 approach from the west.

**Rejected (4 October 2026):** the owner found these renders unsatisfactory — they are scaled-up jewelry meshes on a bare meadow, not architecture, and the Eyelense was the wrong colour (the piece is black PLA, not brass). A brief for a concept model is in [docs/moon-gates-concept-brief.md](../../docs/moon-gates-concept-brief.md). These images stay as history.

Captures: `LIVISTONE_PARAMS=concept=gates bun scripts/screenshot-realism.ts <dir> desktop gates day`. Awaiting the owner's approval before paths, clearances, frost, colliders and the map entries are built.

## Generated variations — 4 October 2026

**Status: unapproved explorations.** At the owner's request, six daylight hero concepts were generated with the built-in `image_gen` tool, using the actual jewelry photographs and town/style references. These are architectural proposals, not in-engine captures. The earlier rejected images remain unchanged.

[Open the comparison gallery](explorations-2026-10-04/index.html). [Generation manifest, reference images and reviews](explorations-2026-10-04/manifest.json).

- **Winter A — twin court:** [image](images/03-winter-a-twin-court.png) · [exact prompt](prompts/03-winter-a-twin-court.txt). Closest to the brief: paired silver portals, central caged topaz, low white wall wings and a winter forecourt.
- **Winter B — splayed ribbons:** [image](images/04-winter-b-splayed-ribbons.png) · [exact prompt](prompts/04-winter-b-splayed-ribbons.txt). Lighter crossed silver ribbons, outward trumpet terminals and a small winter garden within the summer meadow.
- **Winter C — winter courtyard:** [image](images/05-winter-c-winter-courtyard.png) · [exact prompt](prompts/05-winter-c-winter-courtyard.txt). White masonry crescents with silver inner bands, a flatter topaz crown, seating and a side ice pool.
- **Eyelense A — black crescent:** [image](images/06-eyelense-a-black-crescent.png) · [exact prompt](prompts/06-eyelense-a-black-crescent.txt). Closest to the pendant: black crescent, threaded brass loops, high tinted lens and a suspended glass ring with red bead.
- **Eyelense B — folded canopy:** [image](images/07-eyelense-b-folded-canopy.png) · [exact prompt](prompts/07-eyelense-b-folded-canopy.txt). A deeper black curl with the tinted lens acting as a partial overhead canopy; a more sheltered threshold.
- **Eyelense C — leaning wave:** [image](images/08-eyelense-c-leaning-wave.png) · [exact prompt](prompts/08-eyelense-c-leaning-wave.txt). A flowing black arch with both feet in black, an overhead lens and a longer bench integrated with the heavier base.

This first pass explores silhouettes, architectural mass and garden integration. It does not record an owner selection. Winter B is the initial recommendation for the crossed-ring silhouette; Winter C is the alternative for masonry/garden integration. Eyelense C is the initial recommendation for a complete black arch and integrated seating. A full three-quarter, aerial and optional dusk package can follow selection. Review observations, including the denser background in the A studies and the slender brass right support in Eyelense A/B, are preserved in the gallery and manifest.

## Owner-requested orientation and doorway revisions — 4 October 2026

The owner requested a horizontal, larger Eye of Winter that visitors can walk through, and enlargement of Eyelense's red element so it becomes a door. This round interprets Winter as one horizontal blue eye with an open central passage, superseding the original two adjacent circular passages for these studies. Eyelense retains its black crescent and overhead tinted lens while the enlarged red bead becomes the walking entrance. These are exploration requests, not approval of a final image or implementation.

- **Winter D — horizontal eye:** [image](images/09-winter-d-horizontal-eye.png) · [exact prompt](prompts/09-winter-d-horizontal-eye.txt). A large horizontal blue eye wrapped in silver honeycomb; the central opening becomes the walking route.
- **Winter E — crystal passage:** [image](images/10-winter-e-crystal-passage.png) · [exact prompt](prompts/10-winter-e-crystal-passage.txt). A deeper horizontal topaz surround and short crystal-lined passage, integrated with white masonry wings.
- **Eyelense D — red ring doorway:** [image](images/11-eyelense-d-red-ring-door.png) · [exact prompt](prompts/11-eyelense-d-red-ring-door.txt). The enlarged red bead becomes a faceted red ring doorway inside the black crescent, with its clear outer glass rim.
- **Eyelense E — passage through the bead:** [image](images/12-eyelense-e-red-bead-passage.png) · [exact prompt](prompts/12-eyelense-e-red-bead-passage.txt). A thicker rounded red jewel with an arched passage through it, preserving more of the original bead’s volume.

Generated with built-in `image_gen`, editing Winter B/C and Eyelense C as references. All four PNGs are 1536×1024. Added at the top of the [existing comparison gallery](explorations-2026-10-04/index.html#revisions); original studies preserved. Initial recommendations for this round: Winter D for the broad eye silhouette and Eyelense E for retaining the bead's volume around an arched doorway. No game code changed and no approval recorded.

## Approved Winter building — 4 October 2026

The owner explicitly approved [Winter G, shutter open](images/17-winter-g-model-two-stones-open.png): “I really like it, save this picture in concepts and please start 3D modeling to make the building.” The [matching closed view](images/16-winter-g-model-two-stones-closed.png) explains the entrance mechanism. Prompts: [closed](prompts/16-winter-g-model-two-stones-closed.txt), [open](prompts/17-winter-g-model-two-stones-open.txt).

**Authoritative geometry:** the existing Eye of Winter ring assembly, `public/models/jewelry/eye-of-winter-gate.glb`, derived from Livia's `+EOW-base.stl` and `+EOW-complex half.stl`. Keep the source shape close: uniform scale and rigid orientation, not a redesigned almond facade or two invented standalone arches. The two stones are absent from the print mesh and must be added: a large smooth clear convex front stone, and a distinctly smaller blue faceted hexagonal stone behind it, visible through the first. Front/back/side photographs were inspected from the sibling `livia/assets/RJW2026/` checkout, including the `cm2.jpg` rear view and `cm5.jpg` side view.

A lower-front camera-style six-blade hexagonal shutter admits visitors to an enclosed room with generous headroom. The eye remains whole when shut; it has no permanent through-hole. Winter D/E and F are rejected interpretations (permanent holes and/or one undifferentiated blue stone). Eyelense's enlarged red-door direction was accepted; no individual D/E image was selected.

Implementation is now authorized. Initial building work belongs in `winter-gate.ts` and shared `winter-gate-layout.ts`, with source model, added stones, ground-level doorway, an interior floor, path/planting clearance and matching collision geometry. Generated concepts are design references; the actual model supplies the silver geometry.

### First 3D building study

- Runtime: `src/world/winter-gate.ts`; shared placement and graded approach: `winter-gate-layout.ts`.
- [Interactive 3D preview](explorations-2026-10-04/model.html), with orbit, front, three-quarter, interior, and open/close controls.
- [Exported GLB](models/eye-of-winter-building.glb), generated by `bun scripts/build-winter-building.ts`. `models/sources.json` records the original silver asset and hash. No original STL is copied or committed.
- Original silver vertex/index order and proportions are retained; only uniform 1.5× scale, rigid rotation and translation are applied. The clear front envelope is moved forward of the original silver strut to provide standing space without cutting the jewelry. The smaller blue hexagon remains behind it.
- The source rings reach lower than the eye's floor. A graded approach raises the entry to that floor. Floor, outer envelope and source silver have matching mesh collision; the iris blocks passage until its leaves have fully retracted.
- This is a first model, not a final reproduction of the approved render. Stone materials and architectural dressing need an art pass; the snow, pond, icicles and concept lighting remain to build.

Validation for the first study: production build passed; 254 unit tests passed; `tests/winter-gate.spec.ts` passed in Chrome/WebGL, confirming map arrival and walking through the operable iris. Desktop town exterior and interior were rendered and inspected. [First in-town front capture](models/previews/first-building-front.png) shows the actual prototype, not a generated concept.
