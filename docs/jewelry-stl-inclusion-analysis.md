# Jewelry STL inclusion analysis — 3 October 2026

Question: most of Livia's STLs were made for 3D printing, so which of the latest shapes can go into Livistone as they are, and which cannot? This page answers it from measurements of the actual meshes. The files and what they are called are in the [STL catalogue](jewelry-stl-catalogue.md); this page is about what is *inside* them.

## Short answer

- **Not as exported, but mostly because of size, not damage.** The 155 latest bodies of published, unlisted and new works hold **70 million triangles**, in 211 million loose vertices (an STL stores every triangle on its own). Livistone's walking view draws roughly 1.5 million triangles per view in the repository's own frame-budget model, most of it forest (the lake garden 75 k, the mycelium grove 65 k per view). One Mitoring file alone is 985 k.
- **Decimation is easy and clean.** Run through the same `meshoptimizer` simplifier the town already ships, **at 30 k triangles 90 % of the 120 bodies that are larger than that stay within 6 % of their own wire radius (median 2.7 %), and at 10 k 90 % of 131 stay within 14 %.** Deep Sea Pearl goes from 9.66 M to 10 k triangles with a worst-case surface shift of 0.07 mm on a 0.8 mm wire. Wire cages, the hardest case, survive visually even at 10 k triangles.
- **The real problems are print leftovers, not tessellation.** Measured across the set: print supports baked into one piece (and, probably, already into the town), loose debris, pinholes, a few inside-out or duplicated-face meshes, and assemblies that are several interpenetrating shells. 84 of 155 bodies are clean, 53 need a scripted cleanup, 18 need real attention. Section 3 lists them.
- **Supports in the Nanot.** `bila.stl` has a forest of print-support towers in its bottom quarter (168 detached shells, 61 % of them in the lowest 15 % of height). The Ministry of Science strands were extracted from this file, and 27 % of their length (686 of 2,583 units) lies below z = 11, the support zone. The "continuous ribs that reach the base" in the hall may be supports. Worth looking at before adding more STL-derived work.

## 1. What was measured

For each latest body (155 files, excluding private commissions, third-party models and form studies):

1. The triangle soup was **welded** (vertices within 1 µm merged) into an indexed mesh.
2. **Topology:** open edges, edges shared by more than two faces, windings that disagree between neighbours, and whether the volume is positive (an inside-out mesh has negative volume).
3. **Shells:** connected components, their size and where they sit.
4. **Quality:** zero-area triangles, sliver triangles (longest edge² > 20 × twice the area), median edge length.
5. **Feature size:** `2V/A` from volume and surface area, which is the tube radius for wire and the sheet thickness for plates.
6. **Reduction:** `meshoptimizer` simplification with pruning to 100 k, 30 k, 10 k, and on 15 samples 3 k and 1 k triangles, recording the surface deviation it reports.
7. **Looking:** the Mitoring, Deep Sea Pearl, Eye of Winter base and King's Chapel ring were rendered at full size, 30 k and 10 k triangles, and the Nanot, Art Nouveau earring, Sticks and Stones and Brain ring with their loose shells coloured.

Not measured: self-intersections between touching tubes, hidden cavities, how the pieces shade in Livistone's renderer, GPU timings (the repository's own `frame-budget.ts` gives main-pass triangle counts only, not device times), and whether a given STL was exported in its print orientation (support detection is conclusive only where supports are visible).

## 2. Size: why intact is not an option

| | Mitoring (`+3mito.stl`) |
| --- | --- |
| Triangles | 984,780 |
| Loose vertices as stored in STL | 2.95 M (about 71 MB for position + normal in a non-indexed geometry) |
| After welding | 492 k vertices |
| At 30 k triangles | 14.8 k vertices, about 0.5 MB with 16-bit indices |
| At 10 k triangles | 4.8 k vertices, about 0.17 MB |

The median edge in these meshes is **0.12 mm**, and 36 of 155 bodies are finer than 0.1 mm, on wires about 1.2–1.6 mm thick (median feature radius 0.74 mm). That is print resolution (tens of micrometres), several times finer than anything a screen shows, and it is why simplification costs so little. Deep Sea Pearl and the Eye of Winter base are the extreme: 13 µm edges and 10 M triangles each.

### Reduction ladder

Surface deviation reported by the simplifier, as a percentage of the piece's own wire radius or sheet thickness:

| Target | Bodies tested | Median | 90th percentile | Worst | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| 100 k triangles | 99 | 1.0 % | 2.3 % | 6.2 % | indistinguishable |
| 30 k triangles | 120 | 2.7 % | 5.9 % | 31.6 % | near LOD; Sticks and Stones is the weak one |
| 10 k triangles | 131 | 6.1 % | 13.9 % | breaks on Sticks and Stones | mid LOD |
| 3 k triangles (15 samples) | 15 | 1–62 % | | | far LOD, silhouette only |
| 1 k triangles (15 samples) | 15 | 2–131 % | | | too coarse: wires dissolve |

The sizes are relative to feature size, so the same absolute error looks different at game scale: the existing Mitoring hall maps 1 mm to about 0.8 m, so 0.1 mm of deviation is about 8 cm. The renders show Mitoring, Deep Sea Pearl, Eye of Winter and the King's Chapel ring keeping every loop and crossing at 30 k and 10 k triangles.

**Suggested ladder for a hero piece:** 30 k near, 10 k mid, 3 k far (hidden beyond the fog, as the forest does). Three simultaneously visible 30 k pieces cost about what the whole lake garden draws per view (75 k).

## 3. What is wrong inside the meshes

Counts are bodies out of 155.

| Problem | Bodies | Why it matters in Livistone | Fix |
| --- | ---: | --- | --- |
| **Print supports** | 1 confirmed (Nanot) | Support towers become part of the building | Cut everything below the build plate's support zone; re-derive strands |
| **Loose micro-debris** (islands < 1 mm, often < 0.1 mm, 24–300 triangles) | 12 | Invisible, but they bloat colliders and break "is this one piece" checks | Delete components under 0.5 mm |
| **Pinholes** (1–100 open edges) | 24 | Seen only through transmissive or mirrored material | Weld, or ignore for opaque metal |
| **Open edges, hundreds to thousands** | 4 (`cab7`, `perla12`, `shimeji17`, `cerceii+`) | Visible cracks; all four are 2017–2018 meshes | Use a newer save, or close and re-save in Rhino |
| **Non-manifold edges, > 50** | 7 | Duplicated or internal faces: z-fighting and wrong volumes, harmless to a plain triangle draw | Delete coincident faces |
| **Inside-out** (negative volume) | 3 (`ceartari_DRP`, `perla12`, `cerceii+`) | Back-face culling hides the surface | Flip winding; `DRP` is the mirrored right earring, and a mirror reverses winding |
| **Assemblies of several shells** | 14 | Parts that interpenetrate (Sticks and Stones: 35 shells, Brain: 25) cannot be treated as one solid | Split by component, treat each part separately |
| **Slivers** (> 15 % of triangles) | 30 | Odd shading unless normals are recomputed; no effect on silhouette | Recompute smooth normals after welding |
| **Zero-area or collapsed triangles** | 61 files, 51,679 triangles | None, but they stop simplification from reaching its target in places | Drop on weld |

Other print-isms that are not topology faults but should not reach the town:

- **Stone seats and placeholders.** The Eye of Winter base carries two spherical cups, Sticks and Stones has two ball bodies, the Art Nouveau earring (`cerceii+`) holds loose faceted gem soup, Sound of Stars has small separate bells. In the game a stone is a material (amber, tourmaline), not geometry.
- **Tolerance gaps and threads.** Multi-part sets (Rotary, La Navette, Eye of Winter, Thunderstone) are modelled with printing clearances and screw threads. Fine as inspiration; as geometry they are 0.1–0.3 mm gaps that z-fight when scaled up.
- **No normals, no UVs, no materials.** STL carries none. After welding, normals have to be recomputed (angle threshold around 40° keeps tube ends round and edges of plates crisp); texturing has to be triplanar or procedural, as the masonry already is. Everything these pieces are cast in (silver, bronze, amber) is a shared material the town already has.
- **Axes and origin.** Pieces are not centred; "up" is the exporter's Z, which is not always the ring axis or the pendant's hanging direction. Re-orient each file on import.

### Scale and collision

At the size of the existing halls (1 mm ≈ 0.45–0.8 m) a 0.7 mm wire is 0.3–0.6 m thick, which is fine as a visible rib. The player capsule is 0.29 m in radius, so a cage with 1–2 mm gaps (0.5–1.5 m) is a lattice you can slip through, and one with smaller gaps is a wall. Colliders should therefore not come from the printed mesh: build them from the skeleton (floors, a few ribs, boxes), as `jewelry.ts` does for the Nanot frame, and keep the visible mesh visual only.

## 4. Verdict per work

Each row is a work; "bodies" are its latest parts, "triangles now" their total. **Tier A**: single watertight shell, correct winding, decimate and shade. **Tier B**: a scripted cleanup first (pinholes, debris, slivers, a few stray edges). **Tier C**: something needs real work or a different save. "Error 30 k / 10 k" is the worst deviation among the work's bodies as a percentage of its feature size. Private commissions, third-party models and form studies were not analysed.

### Tier C — needs real work (12 works)

| Work | Bodies | Triangles now | What to do before use | Error 30 k / 10 k |
| --- | ---: | ---: | --- | ---: |
| Nanot of Power (Nanot Pendant) | 1 | 2.25 M | close pinholes; cut away the print supports (bottom ~11 mm); remove duplicate/internal faces (3394 non-manifold edges); split into parts (up to 169 separate shells) | 10 % / 31 % |
| Funghi Ring Series | 4 | 2.07 M | remove duplicate/internal faces (20820 non-manifold edges); split into parts (up to 35 separate shells); weld stray edges | 7 % / 16 % |
| King's Chapel Double Ring | 1 | 1.14 M | remove duplicate/internal faces (5270 non-manifold edges) | 7 % / 18 % |
| Sticks and Stones Pendant | 4 | 1.11 M | close pinholes; remove duplicate/internal faces (9715 non-manifold edges); split into parts (up to 35 separate shells) | 32 % / breaks |
| Art Nouveau Earrings | 1 | 960 k | close cracks (557 open edges) or use an earlier/cleaner save; flip inside-out normals; split into parts (up to 4 separate shells); weld stray edges | 1 % / 2 % |
| Piguen Nonaltra Pendant | 3 | 732 k | close pinholes; remove duplicate/internal faces (981 non-manifold edges) | 9 % / 19 % |
| Merlusca Ring | 1 | 625 k | close cracks (13396 open edges) or use an earlier/cleaner save; flip inside-out normals; split into parts (up to 3 separate shells) | 3 % / 9 % |
| Flute (concept, insulin-vial token) | 3 | 533 k | remove duplicate/internal faces (58 non-manifold edges); weld stray edges | 2 % / 13 % |
| Mushroom Ring | 1 | 445 k | close cracks (1449 open edges) or use an earlier/cleaner save; delete micro-debris; weld stray edges | 3 % / 8 % |
| Ceartari Earrings | 2 | 305 k | close pinholes; flip inside-out normals | 2 % / 5 % |
| Cabochon Ring | 1 | 71 k | close cracks (2039 open edges) or use an earlier/cleaner save | 0 % / 1 % |
| "pathfinder" cage (probable Sunfinder) | 1 | 18 k | remove duplicate/internal faces (716 non-manifold edges) | 0 % / 1 % |

### Tier B — scripted cleanup (28 works)

| Work | Bodies | Triangles now | What to do before use | Error 30 k / 10 k |
| --- | ---: | ---: | --- | ---: |
| Hexa Ring family (Hexa → exhexa → not so hexa) | 8 | 3.44 M | delete micro-debris | 5 % / 12 % |
| IESF trophy (mountain + crystal, ~60 cm) | 17 | 3.44 M | whole-trophy files are already split into parts; decimate the 3.3 M base, delete debris | < 1 % |
| Emerald Stillness (STL spelling `stilness`) | 4 | 3.00 M | close pinholes | 6 % / 14 % |
| Cloud Agate | 7 | 2.92 M | close pinholes | 1 % / 4 % |
| Lines ring (justline / pill) | 3 | 1.74 M | delete micro-debris | 4 % / 9 % |
| "sperecels" spiral dome | 3 | 1.36 M | close pinholes | 2 % / 5 % |
| Sound of Stars Earrings | 2 | 1.32 M | split into parts (up to 10 separate shells) | 6 % / 16 % |
| Blooming Pins | 6 | 872 k | close pinholes; delete micro-debris; weld stray edges | 4 % / 10 % |
| Nocciola Ring | 2 | 777 k | delete micro-debris | 5 % / 11 % |
| Rotary Ring (Rotary Magnetic ancestor) | 2 | 713 k | recompute normals (sliver triangles) | 5 % / 11 % |
| Tilia Earrings (+ piramid, m) | 3 | 552 k | close pinholes; delete micro-debris; split into parts (up to 2 separate shells); weld stray edges | 9 % / 21 % |
| Frog Ring (frog remake) | 1 | 543 k | recompute normals (sliver triangles) | 8 % / 20 % |
| Dewdrop Ring | 2 | 422 k | close pinholes; weld stray edges | 1 % / 2 % |
| Amberear Ring | 1 | 397 k | close pinholes | 5 % / 11 % |
| The Eye Pendant | 1 | 377 k | close pinholes | 2 % / 6 % |
| Daggers earrings (cercel2) | 1 | 339 k | close pinholes; weld stray edges | 3 % / 7 % |
| "2securea" (Jan 2025) | 1 | 335 k | delete micro-debris | 4 % / 9 % |
| Cloudstone Pendant | 1 | 278 k | delete micro-debris | 3 % / 7 % |
| Moldavite (VLATIV) ring | 1 | 241 k | close pinholes | 3 % / 7 % |
| Brain Ring | 1 | 189 k | split into parts (up to 25 separate shells); weld stray edges | 3 % / 10 % |
| Wrap Ring | 1 | 169 k | weld stray edges | 1 % / 3 % |
| Supernova Ring | 3 | 123 k | close pinholes | 1 % / 3 % |
| Eyelense Pendant | 2 | 112 k | close pinholes | 0 % / 1 % |
| Vittoria Amazonica Pendant | 2 | 108 k | delete micro-debris | 3 % / 7 % |
| Interchangeable Flower Pendant | 4 | 94 k | weld stray edges | 1 % / 5 % |
| Solid Tourmaline Ring | 1 | 19 k | close pinholes; weld stray edges | < 1 % |
| Little Trumpet / second cabochon series | 1 | 16 k | close pinholes | 0 % / 1 % |
| Florine Ring | 1 | 4 k | recompute normals (sliver triangles) | < 1 % |

### Tier A — decimate and go (39 works)

Single watertight shells with consistent winding; the only work is decimation and normals. Triangles now in brackets.

Eye of Winter Double Ring and Pendant (11.36 M); Deep Sea Pearl (Karmazina) Ring (9.66 M); Hardata / cylinder (1.98 M); White Dwarf Pendant (1.27 M); Mitoring (Mitochondria Ring) (985 k); Thunderstone (869 k); Bubble Ring (685 k); Pretzel Earrings (657 k); Mountain of Gold Double Ring (595 k); Ice Pendant (589 k); Colour Window Spring Edition Ring (526 k); Wavy Circle Pendant (501 k); Beanut (Fasolaluna) Pendant (444 k); Splash Pendant (397 k); War and Peace Ring (377 k); Soft Art Nouveau Railing Ring (365 k); Mycelium Ring (364 k); Greentooth Ring (349 k); La Navette Pendant (315 k); Wormy Ring / Red Wormy Little Apple (307 k); Fistic Ring ("bullet") (305 k); Nut sphere (`nucasfera`) (301 k); Half Fistic Earrings (282 k); Peas in Pod Ring (258 k); Trophy 2021 (lattice bloom) (248 k); Switch ring (probable Slider Ring) (244 k); Pearl Earrings (242 k); Yellow Submarine Pendant (231 k); Hessonite Ring (222 k); Peony Ring (221 k); Art Nouveau Ring (amethyst) (220 k); Roots Ring (212 k); Inline Ring (200 k); Nucalong Pendant (from `sparanghel`) (165 k); The Link Pin (MNAR "Inspira-scara") (153 k); "bila capat" bulb (30 k); Moldavian Vault Ring (19 k); Cheesecake Pendant (14 k); First Ring (probable: `inel_propriu_test4livia`) (1 k).

## 5. A pipeline that follows from this

1. **Weld and clean.** Merge vertices at 1 µm, drop zero-area triangles, split into components, delete debris under 0.5 mm, flip any inside-out shell, delete coincident faces. All scriptable; this analysis did it in a few seconds per file even for 10 M triangles.
2. **Keep only what is the piece.** Cut supports and stone seats; split multi-part sets into their parts (they are separate files already for the sets in the catalogue).
3. **Normals and orientation.** Recompute smooth normals (about 40°), centre on the bounding box, set up along the ring or hanging axis, scale 1 mm to the building's scale.
4. **LODs.** Simplify with pruning to 30 k, 10 k and 3 k triangles (the town already depends on `meshoptimizer`; use it offline here). Compress as GLB with meshopt: about 0.2–0.5 MB per LOD before compression.
5. **Load like the Enhancement crystals:** one lazy chunk per piece, built during the loading stages, not at first view; one material per piece.
6. **Colliders by hand** from the skeleton, never from the print mesh.
7. **Or skip the mesh:** for a pure wire cage the strand route (centrelines, ribbons rebuilt in code, as the two ministries) still gives the smallest download and the town's own look, but it needs the extractor rewritten, and it must start from a cleaned mesh without supports.

## 6. Recommendation

- **Easiest wins** (Tier A, strong shape, nothing to repair): Deep Sea Pearl, Eye of Winter (base, halves, screw), Thunderstone, White Dwarf, Wavy Circle, Hardata, La Navette, Mountain of Gold, Mycelium, Ice. Tier B but trivial: the spiral dome (a dozen pinholes), the Hexa pair, Moldavite and Cloud Agate (pinholes and slivers only).
- **Fix first:** the **Nanot supports**, because the building already exists. Cut the strand set at the support zone and compare the hall.
- **Avoid for now:** the King's Chapel ring (5,270 non-manifold edges), Sticks and Stones (9,715) and Funghi ring 3 (20,820) unless rebuilt; and the 2017–2018 meshes with open edges (Merlusca `perla12`, Cabochon `cab7`, Mushroom `shimeji17`, the Art Nouveau earring), where the older saves tested are just as open. The one closed alternative, Merlusca's earliest save `perla1+`, is an earlier design.
- **Decide the budget first.** A 30 k hero piece is about 40 % of what the lake garden draws per view. Two or three such pieces and their LODs fit; a dozen do not.

## 7. Numbers for the best candidates

Measured with `meshoptimizer` simplification (pruning on) from the welded meshes. "Error" is the largest surface deviation the simplifier reports, in centimetres at an assumed **1 mm = 0.5 m** (the existing halls use 0.45–0.8 m per mm), and in brackets as a percentage of the part's own wire radius or sheet thickness ("Feature"). MB is positions + normals (float32) + 16-bit indices, uncompressed; meshopt compression shrinks it further. Parts that are already smaller than a target are marked unchanged. Only one generation of the Hexa family and one of each identical left/right or numbered pair is listed.

| Work · part | Triangles now | Size (mm) | Feature (mm) | 30 k: MB · error | 10 k: MB · error | 3 k: MB · error |
| --- | ---: | --- | ---: | --- | --- | --- |
| Deep Sea Pearl · final high-resolution ri | 9,660,890 | 40.3 × 32.8 × 24.7 | 0.80 | 0.54 MB · 1.7 cm (4%) | 0.18 MB · 3.7 cm (9%) | 0.05 MB · 9.0 cm (22%) |
| Eye of Winter · base | 10,264,076 | 40.1 × 32.3 × 24.2 | 0.84 | 0.54 MB · 1.8 cm (4%) | 0.18 MB · 4.3 cm (10%) | 0.05 MB · 10.8 cm (26%) |
| Eye of Winter · complex half | 681,158 | 28.4 × 17.7 × 25.2 | 0.58 | 0.54 MB · 1.5 cm (5%) | 0.18 MB · 3.5 cm (12%) | 0.05 MB · 10.5 cm (36%) |
| Eye of Winter · simple half | 409,016 | 29.6 × 19.5 × 20.7 | 0.61 | 0.54 MB · 1.2 cm (4%) | 0.18 MB · 2.8 cm (9%) | 0.05 MB · 7.8 cm (25%) |
| Eye of Winter · assembly screw | 2,106 | 4.0 × 4.0 × 21.0 | 1.17 | (unchanged, 0.04 MB) | (unchanged) | (unchanged) |
| Thunderstone · base | 393,552 | 11.8 × 26.8 × 28.5 | 0.82 | 0.54 MB · 1.1 cm (3%) | 0.18 MB · 2.4 cm (6%) | 0.05 MB · 6.2 cm (15%) |
| Thunderstone · upper part, reduced | 456,214 | 20.3 × 43.5 × 19.2 | 0.72 | 0.54 MB · 0.9 cm (3%) | 0.18 MB · 2.0 cm (5%) | 0.05 MB · 5.4 cm (15%) |
| Thunderstone · nut | 19,544 | 5.7 × 5.7 × 4.5 | 1.10 | (unchanged, 0.35 MB) | 0.18 MB · 0.1 cm (0%) | 0.05 MB · 0.4 cm (1%) |
| White Dwarf · pendant | 1,274,204 | 34.9 × 34.8 × 34.1 | 0.81 | 0.53 MB · 2.9 cm (7%) | 0.17 MB · 7.1 cm (18%) | 0.05 MB · 19.3 cm (48%) |
| Wavy Circle · wavy circle | 501,412 | 32.8 × 32.8 × 15.7 | 0.84 | 0.54 MB · 1.4 cm (3%) | 0.18 MB · 3.4 cm (8%) | 0.05 MB · 8.9 cm (21%) |
| Hardata · Hardata | 1,983,234 | 93.2 × 93.4 × 162.9 | 8.02 | 0.54 MB · 6.9 cm (2%) | 0.18 MB · 17.8 cm (4%) | 0.05 MB · 56.2 cm (14%) |
| La Navette · frame cadru | 121,980 | 12.0 × 33.6 × 44.7 | 1.11 | 0.54 MB · 0.6 cm (1%) | 0.18 MB · 1.6 cm (3%) | 0.05 MB · 4.7 cm (8%) |
| La Navette · stone piatra | 21,328 | 12.6 × 27.6 × 6.8 | 0.72 | (unchanged, 0.38 MB) | 0.18 MB · 0.2 cm (1%) | 0.05 MB · 1.1 cm (3%) |
| La Navette · small wing, left aripioa | 85,766 | 17.6 × 17.3 × 10.1 | 0.71 | 0.54 MB · 0.3 cm (1%) | 0.18 MB · 0.8 cm (2%) | 0.05 MB · 2.1 cm (6%) |
| La Navette · small wing, right aripio | 85,788 | 17.6 × 17.3 × 10.1 | 0.71 | 0.54 MB · 0.3 cm (1%) | 0.18 MB · 0.8 cm (2%) | 0.05 MB · 2.1 cm (6%) |
| Mountain of Gold · double ring | 595,256 | 50.5 × 24.6 × 30.1 | 0.65 | 0.54 MB · 1.7 cm (5%) | 0.18 MB · 4.1 cm (13%) | 0.05 MB · 11.5 cm (35%) |
| Mycelium · ring | 363,938 | 19.9 × 21.1 × 28.1 | 0.53 | 0.54 MB · 1.5 cm (6%) | 0.18 MB · 3.7 cm (14%) | 0.05 MB · 10.5 cm (39%) |
| Ice · pendant | 588,790 | 33.9 × 35.4 × 30.0 | 0.44 | 0.53 MB · 2.9 cm (13%) | 0.17 MB · 6.1 cm (28%) | 0.05 MB · 13.8 cm (62%) |
| Spiral dome · dome, newest | 484,754 | 30.3 × 28.4 × 16.5 | 0.79 | 0.54 MB · 0.7 cm (2%) | 0.18 MB · 2.0 cm (5%) | 0.05 MB · 5.9 cm (15%) |
| Not-so-hexa · not so hexa base | 764,468 | 24.3 × 29.4 × 35.8 | 0.76 | 0.54 MB · 1.9 cm (5%) | 0.18 MB · 4.6 cm (12%) | 0.05 MB · 12.1 cm (32%) |
| Not-so-hexa · not so hexa top | 41,686 | 13.9 × 27.5 × 8.6 | 0.70 | 0.54 MB · 0.1 cm (0%) | 0.18 MB · 0.3 cm (1%) | 0.05 MB · 1.0 cm (3%) |
| Moldavite · ring | 240,885 | 20.3 × 41.3 × 35.8 | 0.79 | 0.53 MB · 1.1 cm (3%) | 0.18 MB · 2.9 cm (7%) | 0.05 MB · 9.6 cm (24%) |
| Cloud Agate · complex cloud agate, no. | 1,416,187 | 122.0 × 28.5 × 45.0 | 4.43 | 0.48 MB · 2.6 cm (1%) | 0.14 MB · 9.4 cm (4%) | breaks |
| Cloud Agate · complex base 1 | 6,170 | 17.5 × 15.9 × 21.3 | 4.19 | (unchanged, 0.11 MB) | (unchanged) | 0.05 MB · 0.1 cm (0%) |
| Cloud Agate · complex slice | 3,894 | 64.0 × 7.6 × 6.6 | 2.15 | (unchanged, 0.07 MB) | (unchanged) | 0.05 MB · 0.0 cm (0%) |
| Cloud Agate · basic cloud agate, no. 1 | 44,430 | 122.0 × 17.0 × 42.0 | 7.08 | 0.54 MB · 0.2 cm (0%) | 0.18 MB · 0.7 cm (0%) | 0.05 MB · 2.3 cm (1%) |

Reading the table:

- **30 k triangles is safe everywhere except Ice** (13 % of its 0.44 mm wire, the thinnest in the list); give Ice 60 k or accept slightly rounded loops. Every other part is within 7 %.
- **Every candidate costs 0.54 MB at 30 k, 0.18 MB at 10 k and 0.05 MB at 3 k** before compression, because the vertex count scales with triangles; the multi-million-triangle sources are 100–500 MB each, so the reduction is roughly 40× (a 20 MB source) to 900× (the 483 MB Deep Sea Pearl) on disk and in memory.
- **3 k is a distance LOD, not a model:** 3–48 % of wire radius for most, 62 % for Ice, and Cloud Agate's complex pods collapse (the pruned result is not a pod any more). Use the plain `basic` Cloud Agate (44 k triangles, 1 % at 30 k and 2.3 cm at 3 k) for a far LOD of that piece.
- **Sets cost the sum of their parts:** Eye of Winter at 30 k each is 62 k triangles for base + one half + screw, or about 21 k at 10 k each; La Navette's four parts are 30 k + 21 k + 2 × 30 k at full detail (111 k) or about 40 k at 10 k; the not-so-hexa pair is 30 k + 30 k at the near LOD, or 10 k + 10 k at the mid LOD.
- **Scale:** at 0.5 m per mm the Deep Sea Pearl is a 20 × 16 × 12 m object with a 0.4 m wire radius, Hardata is 47 × 47 × 81 m (its 8 mm feature is a 4 m thick wall), and Cloud Agate would be 61 m long, so it needs a smaller scale (0.15 m per mm gives about 18 m). Pick the scale per piece, not globally.
