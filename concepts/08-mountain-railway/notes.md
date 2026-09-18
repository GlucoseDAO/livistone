# Dark Nut mountain railway — 18 September 2026

The user requested proper railway textures, tracks continuing through the mountains, and a tunnel entrance based on the attached dark Nut of Power. The unedited photograph is preserved in [references/dark-nut-of-power.png](references/dark-nut-of-power.png). It is a visual reference, not an instruction document. This is a new architectural adaptation; City Hall retains its existing civic identity.

The east–west railway stays aligned with Embryo Station at z = -79. It extends to x = ±476 m. Dark, thick, irregular shells frame the near tunnel mouths around x = ±112 m; organic bronze branches and nuggets sit above the train clearance. Each passage has a real elliptical vault, vertical lower walls, support ribs, recessed guide strips, and maintenance ledges. The tracks emerge through outer portals at x = ±428 m. Mountain triangles are clipped out of the clearance volume, rather than obscured with a black facade; local foothills connect the near portals to the ridge.

Ballast uses CC0 scanned gravel; timber sleepers and weathered rail sides use separate local color, roughness, and OpenGL normal maps. The steel running surfaces remain polished. Sleepers and fastenings are instanced. Attribution and original download checksums are in [the texture record](../../public/textures/railway/ATTRIBUTION.md). The reference photograph is not loaded in the game.

`station-layout.ts` shares the railway, portal, planting, and walking-boundary dimensions. `railway.ts` builds geometry and matching passage colliders independently of DOM texture loading. The existing station platform screens still separate the platform from the railway. The narrow rail corridor and maintenance ledges can be traversed beyond the town boundary; the rest of the mountain backdrop remains scenery. The train remains parked: boarding and travel are not implemented.

Mobile uses fewer shell/vault samples and support ribs, and skips railway normal maps. Local texture failures leave usable base materials. Headless tests check mountain and portal clearance for a train-sized envelope, ballast face orientation, planted-footprint exclusion, full east/west passage traversal, solid ledges/walls, and corridor boundaries. Browser checks cover texture loading, passage entry, map return, touch rendering, and missing-map fallback. Physical-phone and Safari/iOS performance remain unverified.

## Verification

`bun run build` passed and `bun run test` passed all 33 checks in the shared working tree. The full browser run passed 11 of 13 tests; live Vite reload interrupted the input test, and concurrent test runs removed the desktop railway test's trace files. Both affected tests passed when rerun with separate output directories; all three railway browser cases passed together. No runtime defect remained from those interruptions. Twenty-eight landmark screenshots were generated, and east/west portals, track surfaces, passage interiors, and touch passage rendering were inspected. Screenshots remain ignored under `output/testing/railway/` and `output/testing/railway-landmarks/`.


## 18 September: maglev and boarding revision

In response to the supplied in-game screenshot and Dark Nut photo, the single conventional track is replaced by two parallel concrete maglev guideways. The parked train loses wheel geometry and gains open boarding apertures, a cabin floor and seats. Two platform gates and gentle ramps connect the concourse to the cabin. The Dark Nut portals are broader, darker shells with heavier irregular bronze ornaments; both lined bores, mountain cutouts, maintenance ledges and planting clearances expand together. Train departures remain out of scope.

### Passenger cabin refinement

The user’s interior screenshot exposed the opaque shell behind the old window decals and the block-shaped seats. The replacement cabin uses actual rounded apertures with transparent curved glazing on both sides, sculpted teal upholstery with pale headrests, metal armrests and bases, a carpeted aisle, continuous warm ceiling light strips, and separate driving-cab bulkheads. Curved panels are subdivided before projection so large triangles do not cut across the windows. Boarding and glass containment have physics checks; window sightlines are checked from inside and outside.
