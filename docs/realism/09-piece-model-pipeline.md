# 09 — Piece-model pipeline (Grasshopper/STL → tiered GLB)

**Needs:** 00. **Tiers:** offline tool; outputs are per tier. **Branch:** `realism/09-piece-models`.
See [README](README.md) for the shared workflow.

## Context

- Livia's pieces are designed in Grasshopper, and their exports can be very large.
- Today only `data/models/+3mito.stl` (Mitoring, 984,780 triangles) and `data/models/bila.stl` (Nanot, 2,246,016 triangles) exist. They are git-ignored and must never load in the browser.
- `meshoptimizer` 1.1.1 is already a runtime dependency; `cpu-detail.ts` uses its simplifier.
- No STL→GLB tool exists, and the historical `derive-strands.mjs` is missing. Leave `src/world/strands/*.json` untouched.

## Ask Livia for

- One export per material per piece: for example `<piece>.metal.stl`, `<piece>.stone.stl`, `<piece>.organic.stl`.
- Millimetre units, and the piece's real dimensions.

## Sources per building-piece (owner, 3 October 2026)

| Piece | Geometry | Status |
| --- | --- | --- |
| Mitoring | STL in the repo | Unblocked, pilot |
| Nanot | STL in the repo | Unblocked, pilot |
| Embryo | CAD of the silver only; the amber stone is real | Waiting for export. In the vitrine, pair the CAD silver with a procedural amber stone that reuses `station-amber.ts` and is matched to the photos |
| King's Chapel, Timeface | CAD | Waiting for export |
| Nut of Power | None: made from a real walnut | Photos only. A 3D version only through 19, with Livia's sign-off |

Build the pipeline and both pilots now; do not wait for the remaining exports.

## Steps

1. **New `scripts/build-piece-models.ts`**, run with `bun scripts/build-piece-models.ts [pieceId]`.
   - Parse binary and ASCII STL, and OBJ, streaming where possible because some files exceed 100 MB.
   - Weld vertices (`MeshoptSimplifier`/`generateVertexRemap`), centre, and orient so the piece's base is down.
   - Simplify with meshoptimizer to these triangle budgets: gpu ≤ 60k, mobile ≤ 15k, cpu ≤ 4k, summed over all parts. Preserve thin wires: tune the target error, and use `LockBorder` for open meshes.
   - Generate smooth normals with an angle threshold, and quantise positions and normals.
   - Write the GLB with `EXT_meshopt_compression`. A minimal writer in the script is preferred. `gltfpack` as a dev-dependency is acceptable as a dev-time tool, like EZ-Tree, if the writer grows too complex.
   - Output: `public/models/pieces/<id>-{gpu,mobile,cpu}.glb`.
2. **Manifest `src/game/piece-models.json`.** One entry per piece: `{ id, parts: [{ name, material }], sizeMm, displayScale, files, sourceSha256, source: 'cad' | 'reconstruction', approved }`. The catalogue `id` must match `COLLECTION` in `src/game/exhibits.ts`.
3. **Runtime loader helper `src/world/piece-model.ts`.** Uses `GLTFLoader` plus `three/examples/jsm/libs/meshopt_decoder.module.js`, which ships with three, so there is no new runtime dependency. Picks the file by tier. Not wired into the world yet; that happens in 10.
4. **Pilot:** Mitoring and Nanot from the existing STLs.
5. **Review artifact:** `bun scripts/build-piece-models.ts --sheet` renders each tier's GLB through Playwright on a dev-only page, writing a contact sheet to `output/testing/realism/09-piece-models/`.

## Tests

- New `tests/piece-models.test.ts`:
  - every manifest file exists
  - triangle budgets hold per tier
  - bounds are finite
  - `displayScale` is positive
  - every entry with `source: 'reconstruction'` has `approved: true`
- Run `bun run build` with the new script included in type-checking.

## Acceptance

- The owner approves the contact sheet: the wire silhouettes survive simplification at the mobile budget.
- File sizes are recorded: gpu under about 1.5 MB per piece, mobile under about 400 KB.
