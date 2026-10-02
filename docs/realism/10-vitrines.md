# 10 — Glass vitrines with real pieces

**Needs:** 09. **Tiers:** all, graded. **Branch:** `realism/10-vitrines`.
See [README](README.md) for the shared workflow.

## Context and rules

- The owner approved glass vitrines on 3 October 2026, alongside the flat posters.
- CLAUDE.md currently says "Do not restore rotating cylinders, pedestal tables or lore lecterns." Amend it to say that glass vitrines holding real 3D pieces are approved, and are distinct from the retired tables and lecterns. Then run `bun run docs:sync`.
- Keep the central walking axes and entrances clear (`src/world/poster-layout.ts`). Each work keeps one physical home.

## Steps

1. **New `src/world/vitrine.ts`.** DOM-independent geometry and colliders, like the other `create*` modules.
   - **Plinth:** cream, in the gallery paper family.
   - **Label:** brass, reading "shown ×N actual size".
   - **Light:** an emissive top strip, plus a baked soft light pool on the plinth top.
   - **Glass:**
     - gpu: `MeshPhysicalMaterial` with transmission, reusing the transmission pass the hall glass already pays for
     - mobile: transparent reflective glass, no transmission
     - cpu: frame plus faint Lambert panes
   - **Collider:** one box per vitrine.
2. **Studio lighting for the piece.** One shared PMREM of `RoomEnvironment` (three addon, procedural, no asset) as the piece materials' `envMap`. Polished silver then looks like a product photograph without dynamic lights.
   - Silver: metalness 1, roughness about 0.12–0.2.
   - Stone or amber: physical material on gpu, standard on mobile.
3. **Placement.** First Mitoring in the Energy hall, then Nanot in Science. The Embryo vitrine comes later, once its silver export arrives; it pairs the CAD silver with a procedural real-stone amber. City Hall gets no vitrine model, because the Nut of Power has no CAD model; its photo posters stay. Each real piece sits beside its own architectural version. Add a vitrine site to `poster-layout.ts` in a side bay, clear of the doors, the central route and the poster stands.
4. **Lazy loading.** Request the tier's GLB only once the player is within about 30 m of the hall. Never request it at startup.
5. **Interaction.**
   - Register an interactive, like the posters do. E opens the existing lore for that piece's discovery id.
   - Click opens the 3D inspection viewer from 11. Until 11 exists, click opens the photo viewer.
   - Add the vitrine to `clickTarget` so it gets the hand cursor.

## Tests

- New `tests/vitrine.test.ts`: collider matches the geometry; clearance from doors, the central route and poster stands.
- `tests/exhibits.test.ts`: counts unchanged.
- `tests/exploration.spec.ts`:
  - no piece GLB is requested before approaching the hall
  - E in front of the vitrine shows the facts
- Specs: `tests/entrances.spec.ts`.

## Views

`galleries` plus vitrine close-ups, all profiles, day and night.

## Acceptance

- The pieces read as real cast silver and amber under studio light.
- The halls stay walkable.
- Mobile draw calls stay within budget.
