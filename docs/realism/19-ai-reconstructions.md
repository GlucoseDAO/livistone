# 19 — AI reconstructions from photographs (gated)

**Needs:** 09. **Tiers:** offline. **Status:** not scheduled until Livia approves a first piece.
See [README](README.md) for the shared workflow.

## Rules (owner decision, 3 October 2026)

- Only for pieces without Grasshopper or CAD files.
- Every reconstruction needs Livia's sign-off for that piece before it ships.
- It is labelled "Interpretation from photographs" in the lore and the viewer, and must never be presented as her CAD geometry.

## Steps

1. Run image-to-3D offline, outside the repository, from the multi-angle photos in `~/sources/livia/assets/pieces/<piece>/`.
2. Process the result through `scripts/build-piece-models.ts` into tiered GLBs.
3. Add it to `src/game/piece-models.json` with `source: 'reconstruction'` and `approved: false`, and include the photo hashes.
4. Show Livia the contact sheet. Only after her yes does `approved` become `true` and the piece go into a vitrine.

## Tests

- `tests/piece-models.test.ts` (from 09) fails if a reconstruction with `approved: false` is wired into any vitrine.
