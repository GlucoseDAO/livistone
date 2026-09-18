# Vittoria Lake and Mycelium Rain Garden — approved direction, 18 September 2026

The user approved a future landscape district reached by train from Embryo Station. Vittoria Amazonica becomes a shallow lake made from many irregular water eyes, with the pendant's branching silver nerves enlarged into small walkable bridges. The spatial reference is the layered water and raised edges of Japanese rice paddies, without importing generic Japanese architecture or decoration. At the center, Vittoria's aquamarine becomes an inhabitable pavilion whose faceted droplet silhouette refers to the separate Dewdrop ring.

The neighboring Mycelium Rain Garden turns the ring's folded silver crown into a family of umbrella-shaped plants. Their canopies catch rain and lead it through visible ribs and rills into planted basins. This builds on the source story: the Mycelium setting was designed to drain water away from porous opal, with fungi informing the solution.

The complete self-contained specification—including the overall jewelry/building/gallery hierarchy, source-image paths and website fallbacks, factual stone distinction, train journey, zone placement, scale targets, circulation, water and planting rules, mobile reductions, testing, and acceptance criteria—is in [the implementation plan](../../docs/3d-game-plan.md#collection-hierarchy-and-interior-photo-galleries) and its [rail-excursion section](../../docs/3d-game-plan.md#approved-rail-excursion-vittoria-lake-and-mycelium-rain-garden). This record preserves the approval without duplicating the implementation brief.

Status: approved concept only. The current train is parked; the remote stop, train journey, Vittoria Lake, central pavilion, and Mycelium Rain Garden are not implemented.


## Procedural implementation — 18 September 2026

The approved route now has a procedural prototype. `Journey` moves the occupied maglev through visible departure and arrival, with the eastern tunnel concealing lazy loading. Living Waters occupies a separate zone at x = 540 m, beyond the mountain exit; the return train remains at its platform. Both platforms reuse the same train model and aligned boarding ramps. Map/menu/journal suspend the ride and preserve passenger position. Reload returns to town with the same saved stories.

Vittoria becomes an approximately 88 m organic disc with 28 irregular shallow water eyes and a connected 2.2 m silver network. Shared polygon data produces water, walking surfaces and colliders. Low water and smooth banks permit recovery. A 12 m wide, 10.1 m tall blue faceted pavilion has north and east openings, a dry floor and an open silver embrace. Its label distinguishes Vittoria’s aquamarine from Dewdrop’s treated Swiss blue topaz.

The neighboring Mycelium garden uses instanced folded crowns, merged silver ribs, reduced mobile density, falling rain, moving drops along selected ribs and a silver rill into the lake. Graded water colours, shared ripple shading, lily leaves, bank reeds and a textured meadow retain shallow-water depth cues without reflection cameras. A dry loop reserves full canopy clearance. This is atmospheric water animation rather than hydrological simulation. The source opal-drainage story is preserved in a readable, source-linked panel.

Headless physics checks exercise boarding, disembarking, the pavilion approaches, rain-garden loop and shallow-water recovery in both geometry tiers. Browser checks exercise both journeys and map pause on desktop/touch emulation. Physical phone, Safari/iOS, sustained frame-time and memory measurements remain open release gates. Authored art refinement can improve resemblance beyond the current procedural interpretation.
