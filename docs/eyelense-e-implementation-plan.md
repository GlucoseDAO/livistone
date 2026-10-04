# Eyelense E — implementation plan

Initial status when this plan was written, 4 October 2026: **not implemented as a playable building.** The repository contains the generated [E concept](../concepts/15-moon-gates/images/12-eyelense-e-red-bead-passage.png), original photograph derivatives, optimized crescent meshes, and an older dev-only `?concept=gates` preview. That preview has the rejected brass material and no paths or colliders. It does not implement the red bead passage. The owner accepted the enlarged red doorway direction; this plan takes E as the requested implementation reference, without recording a separate image approval.

Implementation is complete: the source crescent, rounded bead with traversable arch, bounded day/night lens, connected forecourt, seats, collisions, plant clearances, map and journal are integrated. See the [actual building and validation record](../concepts/15-moon-gates/notes.md). Generated E artwork is the reference; rendered building captures and the GLB are separate artefacts.

## Design to preserve

- Glossy black, sculpted crescent with raised swirling relief; brass only for the threaded rings, fittings and suspension.
- A large curved smoky grey-brown lens above the walking route. Its daylight tint fades toward clearer glass at night.
- A rounded, substantial red glass bead inside its clear glass surround. The bead contains the arched passage shown in E; preserve its volume around the opening rather than replacing it with a thin red ring.
- A level warm limestone forecourt, seating and meadow planting. Eyelense remains in the east meadow beyond Science, provisionally around `(106, −36)`, looking back toward the town. No winter effects here.

## 1. Inspect and establish the geometry

Compare E with both catalogue photographs and `public/models/jewelry/eyelense-gate.glb`, plus the separate `eyelense-1` and `eyelense-2` assets. Inspect bounding boxes, face orientations and which relief survives optimization. Use the source crescent geometry with rigid placement and uniform scale where possible; add missing architectural elements separately. Never copy the original STL files into Git.

Create DOM-independent `src/world/eyelense-gate-layout.ts` with placement, orientation, source scale, lens envelope, bead size, passage profile, approach and complete planting footprints. Start with a crescent roughly 10–12 m across and an opening at least 3.5 m high and 4 m wide; increase the overall size if the bead and surrounding glass cannot accommodate these clearances together. Verify that neither black tips nor suspension wires enter the passage.

## 2. Build a walkable red bead

Create `src/world/eyelense-gate.ts`. Build the bead as a closed rounded shell with an actual arched cutout through its front, back and thickness. Connect the cutout surfaces with a curved tunnel lining; do not fake the doorway with a dark plane or cover it with transparent solid geometry. The clear glass surround must also leave the passage open.

Seat the tunnel floor flush with the forecourt. Give the bead enough depth for a short sheltered passage and keep the overhead lens and brass suspension above its headroom. Use red glass with restrained internal glow, glossy black relief, brass fittings and a separate tinted lens material. Reduced graphics use reflective opaque glass fallbacks while retaining the doorway and recognizable silhouette.

## 3. Integrate the site and physics

Return meshes and matching `ColliderSpec`s together. Derive crescent, bead, tunnel, floor and seating colliders from the rendered geometry; use bounded pane colliders for the overhead lens. Test that the capsule can enter, cross and leave in both directions, and that it cannot pass through bead walls or seating.

Add the approach to the shared `WALKING_NETWORK`, join its paving and kerbs to the Science-side route, and open the kerbs at the threshold. Reserve the entire building, forecourt, seats and canopy through shared `groundReserved` and `canopyReserved` fields. Integrate with `Town.create`, static batching, reflection scopes, quality switching and frame-budget reporting. Replace the obsolete dev preview only once the playable structure exists.

## 4. Add navigation and the lens behaviour

Add an `eyelense-gate` landmark, map arrival facing the doorway, and accessible journal entry in east-side route order. Keep the original Eyelense jewellery assigned to Future House; the building is an interpretation, not a second physical catalogue exhibit. Use the artist's existing broken-lens story, and label invented architectural behaviour as Livistone fiction.

Update the lens tint from the existing daylight state, including auto, day and night. Keep its quality switch independent of Winter quartz and station amber. Any gradual transition uses the game's elapsed time and freezes under `?capture=1`; it needs no independent browser timer.

## 5. Verify and save the result

Run the production build, meaningful doorway/clearance and path-network tests, and a browser test covering map arrival and complete passage. Check desktop and reduced graphics for tint, reflections, transparency ordering and readable red volume. Capture front, three-quarter, passage interior, aerial context and night views from the actual building. Compare with E and the photographs, then save the captures, provenance and a GLB export under `concepts/15-moon-gates/`. Update the concept notes and jewellery-model status to distinguish generated artwork from the implemented building.

Completion means a recognizable black Eyelense E with a substantial red bead, a genuine traversable arch, connected level paths, aligned collisions, a day/night lens, and inspected in-world screenshots.
