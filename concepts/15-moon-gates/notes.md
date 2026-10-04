# Moon gates — concept for approval (4 October 2026)

The owner chose two new locations: the **Eye of Winter double moon gate** on the west meadow beyond the Ministry of Energy (the request first recorded in [06-town-extension](../06-town-extension/notes.md)), and the **Eyelense moon gate** on the east strip beyond the Ministry of Science, walked through under its colour-changing lens. Plan and status: [docs/jewelry-models-plan.md](../../docs/jewelry-models-plan.md).

No image generator was available, so these concepts are in-engine renders of Livia's own geometry rather than paintings: each gate is her decimated STL assembly (`scripts/build-jewelry-models.ts`, entries `eye-of-winter-gate` and `eyelense-gate` in `data/catalogue/models.json`) stood on its site through the dev-only `?concept=gates` switch (`src/world/gate-concepts.ts`), which also clears the trees within 24 m. No paths, colliders or planting clearances exist yet.

- [Eye of Winter Gate](images/01-eye-of-winter-gate.png): the looped base and the honeycomb half-shell exactly as assembled in the print files (`+EOW-base.stl` + `+EOW-complex half.stl`, 10.9 M → 30k triangles), stood up so the two finger rings are two walk-through openings; the honeycomb basket sits over their join with a blue stone; polished silver; a frozen pond under both openings. About 12 m wide, at (−108, −30), facing the route 3 approach from the east.
- [Eyelense Gate](images/02-eyelense-gate.png): both crescent faces as threaded together in the pendant (`+eyelens1-1/-2.stl`, 112k → 20k triangles), stood on their two tips as an arch about 10 m across; brass for the PLA and brass of the piece; the lens hangs in the eye as a tinted disc (to darken by day and clear at night). At (106, −36), facing the route 5 approach from the west.

**Rejected (4 October 2026):** the owner found these renders unsatisfactory — they are scaled-up jewelry meshes on a bare meadow, not architecture, and the Eyelense was the wrong colour (the piece is black PLA, not brass). A brief for a concept model is in [docs/moon-gates-concept-brief.md](../../docs/moon-gates-concept-brief.md). These images stay as history.

Captures: `LIVISTONE_PARAMS=concept=gates bun scripts/screenshot-realism.ts <dir> desktop gates day`. Awaiting the owner's approval before paths, clearances, frost, colliders and the map entries are built.
