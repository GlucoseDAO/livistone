# Embryo Station refinement — 18 September 2026

The user supplied a runtime screenshot and the approved station concept, observing that the implementation read as a brown-orange roof instead of an amber jewelry body with the ring as its entrance. This revision uses the existing approved concept; no replacement concept was generated.

The amber is rebuilt as a closed loft with a tall, irregular crown behind the entrance and a tapered platform wing. Procedural resin colour and relief maps, a refractive outer surface, and a recessed amber core give the cover volume. Mobile keeps the same shape at reduced resolution with opaque golden resin. The silver shank becomes a broad, bevelled casting with pierced oval openings and polished lips. Substantial rounded prongs form the upright loop, diagonal loop, and wound lower clasp.

The ring frames a glazed foyer with an open ground-level doorway, shallow upper galleries, warm light strips, and glazing beside the concourse. The geometry and corresponding glass, floor, ring, and support colliders are built without DOM dependencies; canvas station signs remain in the presentation wrapper. A home formerly directly in front of the ring moves to the western residential edge, and trees leave an open view from the northern gardens. Existing approach paths, story interaction, and platform corridor remain usable.

The station remains procedural browser geometry rather than a photographic render. The concept's passengers, lower garden terraces, and operating trains are not implemented. No Embryo STL was supplied. Train travel and the Eye of Winter double moon gate remain separate future work.

## Verification

`bun run build`, all 18 Vitest checks, and all 10 Playwright browser tests passed. The station physics checks exercise both directions through the main ring, the open eastern entrance, blocking glass panels, the full platform corridor, and the railway barrier for desktop and mobile geometry. Browser checks cover station entry, discovery and save persistence, map return, and the touch layout alongside the existing civic and input checks. Twenty-one landmark views were generated; station front, side, entrance, platform, town overview, and touch screenshots were inspected. A final colour-channel correction was checked in fresh desktop and mobile renders after the landmark pass. Screenshots are stored under ignored `output/testing/station-refinement/`. The existing Rapier bundle-size warning remains; physical-phone and Safari/iOS performance are not verified.


## Ring-band correction from the original photograph

The user rejected the first revised ring as still having the wrong wheel-like form and supplied a [larger jewelry photograph](references/embryo-ring-shank-detail.png). The photograph shows a thin front rim and a deep cylindrical band, with irregular openwork passing through the curved sides and lower part of the shank. Its openings are not regularly spaced holes through a broad flat annular face.

`station-ring.ts` now constructs a bevelled silver strip with staggered leaf and rounded-triangle openings, tessellates it, and bends it into the deep ring band. The front and rear edges have narrow polished lips; the band inclines gently towards the amber setting. The main clasps attach using the actual band surface coordinates. Its lower curve preserves the walking threshold, and the rendered geometry supplies the matching collider. Mobile uses the same form at reduced detail. Two geometry regression tests cast rays through the band at several depths, checking that both open and solid parts of the curved wall exist while the central passage stays clear.

Verification for this correction is recorded after the final browser and visual checks below. The wider town is being edited concurrently; this record concerns the station band.
