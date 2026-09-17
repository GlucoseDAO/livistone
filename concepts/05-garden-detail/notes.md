# Garden detail refinement — 17 September 2026

Reference: the approved [town overview](../01-garden-town/images/01-town-overview.png).

The requested details were textured paving, visible bridge arches, flowers, and river stones. After viewing the first pass, the user asked for fewer flowers, less space occupied by roads, longer routes, a visibly curved bridge, and rocks in the river.

Implemented direction:

- Procedural limestone paving with recessed joints and subtle surface grain. Four metres of world space per texture tile keeps the scale consistent across paths, civic aprons, and the bridge.
- Garden paths narrowed from 4.2 m to 2.6 m, with longer curves toward the ministries. Civic apron outer radii reduced from 12.3 m to 10.6 m before landmark stretching.
- Small, separated flower patches instead of continuous dense borders. Full plant footprints continue to respect path and entrance clearances. Mobile uses fewer plants and fewer stems per cluster.
- Bridge deck rise increased from 1.18 m to 2.35 m. The vault opening, arch mouldings, deck, rails, and colliders follow the revised profile. Physics checks cover crossing in both directions and stopping at the railings.
- Irregular river stones with varied sizes, moss-tinted vertex colours, and the existing CC0 rock maps. Large stones emerge near the banks; collision envelopes keep them solid.

This is a procedural detail pass, not a claim to match the concept's photographic quality. Buildings, overall terrain, and tree assets retain their existing treatment. Real-phone performance remains unverified.

Visual comparisons are generated under the ignored `output/testing/garden-before/` and `output/testing/garden-refined/` directories; they are not source assets.
