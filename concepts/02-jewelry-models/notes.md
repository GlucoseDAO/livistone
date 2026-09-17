# Jewelry model notes (17 September 2026)

Livia supplied two binary STL files of the pieces behind the two ministries. They live in
`data/models/` and are excluded from git because of their size. This note records what they
contain and how the procedural buildings in `src/world/jewelry.ts` reinterpret them. Nothing
from the files is loaded at runtime: they are printable jewelry solids at roughly millimetre
scale, far too dense for the browser, and a building needs floors, doors, and rooms that a
ring or pendant does not have.

## Measurements

| File | Piece | Triangles | Bounding box (model units) |
| --- | --- | --- | --- |
| `+3mito.stl` | Mitoring (mitochondria ring) | 984,780 | 31.5 × 24.3 wide, 34.5 tall |
| `bila.stl` | Nanot of Power (sphere pendant) | 2,246,016 | 39.5 × 41.1 wide, 46.3 tall |

Units are unlabelled; the proportions match the catalogue sizes (3.2 × 2.2 cm and 3.2 × 3.2 cm),
so the files are about ten times life size or in tenths of millimetres.

## What the shapes are

**Mitoring.** The lower half (0–17 units) is the ring shank: two parallel bands that merge into a
single loop. The head is an **oval bezel**: a wire basket whose side wall is a tangle of wavy
wire rows, a cross bar inside for the amber seat, and eight or so **tall hairpin loops** standing
up from the rim and curling inward over the stone. In the photographs those loops read as the
cristae folds around the amber.

**Nanot.** A sphere whose structure radiates from a **central hub**: straight struts run outward
like sea-urchin spines and each ends at the surface in an **angular, doubled-back strand**
(a hairpin bent into zigzags) that projects a little beyond the sphere. Thin fan-shaped sheets
sit between some struts, and a wire bail loop rises from the top. The cast piece adds dark
garnet-like inclusions between the strands.

## How the buildings use them

The first attempt (earlier on 17 September) hand-drew hairpin and strut shapes inspired by the
models. It was replaced the same day by a data-driven version: `scripts/derive-strands.mjs`
extracts the wire centerlines of each STL (surface sampling, inward shift by half the measured
wire diameter, voxelization, 3D thinning to one-cell curves, a spanning forest with stub pruning
and loop closing, then polyline tracing and simplification) into `src/world/strands/*.json`.
Parameters used: Mitoring `--cell 0.6 --maxdegree 14` (80 strands, 436 points, wire diameter
≈ 1.1 units); Nanot `--cell 0.9 --maxdegree 14` (378 strands, 1,867 points, wire diameter
≈ 0.74 units). `src/world/jewelry.ts` rebuilds every strand as a cast-silver ribbon.

| Source feature | Ministry of Energy (Mitoring) |
| --- | --- |
| Bezel head (STL Z ≥ 17.3) | Scaled ×0.8 with Z up: a 25 × 19 m basket, rim about 7.7 m up, hairpin tips at about 14 m |
| Wire basket wall | Strands below the rim are projected onto the outside of the amber cup, so the woven wall reads as an exterior skin; the seat bar across the middle stays as a beam above the hall |
| Hairpin loops | Kept in place; they rise past the rim and curl over the dome |
| Amber | A cabochon: an elliptical cup (11.3 × 8.5 m semi-axes, 7.2 m wall, 5.8 m dome) with faint emissive glow and the doorway cut from the south wall; inside, translucent amber shelves hang as cristae |
| Ring shank | Omitted from the strands; a 4.6 m silver ring stands across the entry path as the gateway |

| Source feature | Ministry of Science (Nanot) |
| --- | --- |
| Sphere (radius ≈ 20 units, centre Z ≈ 20.7) | Scaled to a 9 m radius around the hall centre 6 m up, rotated so the sparsest side meets the door |
| Struts and angular folded strands | Rebuilt as 0.32 m ribbons; points below ground, in the doorway, or below 3.6 m inside the hall are dropped and strands split there |
| Bail | Comes with the strands and crowns the building |
| Inclusions | Three dark orbs seated between the strands away from the door |

Everything above is Livistone design interpretation; the artifacts' lore powers are fiction and
are not presented as claims about health or efficacy.
