# Materialized Enhancements

- Project: https://enhancement.bio/ (read 23 September 2026). A character-building game, gene evidence knowledgebase and printable bioart project. The base invitation links directly to its home/character page.
- User-supplied source: `voronoi_shell_20260820_083431_daria_s3943.stl`.
- SHA-256: `02f013e1753df8f911da805aa811766869b21d0b94b046fb2f8ef4e1c0d18be5`.
- Original: 3,642 triangles. Indexed derivative: 1,359 vertices, same 3,642 triangles and holes. STL Z becomes world Y, with uniform scale 0.8 and translation only. Vertex coordinates are rounded to four decimals.
- `src/world/models/enhancement-shell.json` retains source identity and indices. No hole filling, remeshing or slope smoothing remains. The earlier matte terracotta read as rust and was replaced (23 September 2026) by satin violet vertex colours, one tone per set of coplanar triangles, after the project's rendered and printed crystals. Warm amber markers remain for wayfinding.
- Direct ascent was checked on the southeast face. Other sides retain their original openings and overhangs; these are not solid invisible slopes. Movement assists climbing only against the tagged STL collider. Ordinary town surfaces retain their existing rules.
- Small procedural lights mark the ascent pending any additional user-supplied stone STLs. No other stone model is claimed as supplied.
- The broader hill/ramp adaptation was discarded after the user's correction.

The outer west road now connects to the lake loop, and the outer east road connects to the garden approach below the tributary tip. The right-hand unused station spur was removed; the left spur reaches the station and the Glucose spur reconnects to the main route.


### Internal route and anatomical monument
The source STL data remains unchanged. Rendering and collision clip one approved internal shaft near the summit; all source surfaces outside that shaft remain intact. The concealed spiral connects the cave entrance to the summit. The small information/join panel is at the base.

The continuous human surface uses the CC0 MakeHuman hm08 base mesh (body group only), with arms posed outward and uniformly scaled to monument size. No MakeHuman application code is included. Source: https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj . License: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md . Copyright at CC0 release: Data Collection AB, Joel Palmius, Jonas Hauquier (2020). The compact derivative stores its original SHA-256 in `src/world/models/enhancement-human.json`.

Five smaller mycelium trees form a sparse transition beside the hill approach. Their crowns taper toward the hill and remain outside the marked ascent and cave access.


### Poster row and generated crystals
The participation sign stands beside the start of the marked climb (`ENHANCEMENT_SIGN`), turned toward the map arrival, at least 2.2 m from the marker line. Six photo posters alternate with six gene-category stands along z = -160, between the approach and the hill's south face (`GALLERY` in `enhancement-layout.ts`). Tests keep the row clear of paths, the cave approach, the marked climb and every overhang, and walk its length and one gap.

- Photos, the “Scinquisitor” report screenshot and the project memes were supplied on 23 September 2026 from `~/Pictures/materialized`; see `public/images/enhancement/ATTRIBUTION.md` and `sources.json` for original hashes.
- Category names, colours, icon meanings and descriptions follow `CATEGORY_COLORS`, `CATEGORY_ICONS` and `CATEGORY_DESCRIPTIONS` in materialized-enhancements `state.py`. The emblems are simplified drawings of the same icons (shield, heartbeat, sync, globe, eye, brush), not copies of the icon font.
- Crystals: `scripts/generate-enhancement-crystals.py`, run in a materialized-enhancements checkout (commit `3271faf`, DoltHub hash `uupl5q35e6av1rcqv96717396ftq90ac`), calls the site's own `generate_sculpture` with the character name “Livistone” and every game-enabled gene whose primary category matches. Results are deterministic; seeds, gene counts, face counts and SHA-256 are in `data/enhancement/crystals/meta.json`.
- `scripts/build-enhancement.py` indexes each binary STL by exact vertex identity and quantizes to 0.1 mm without removing triangles. The game lays each crystal flat side down (STL Z becomes world Y) at ten times its STL millimetres, as a separately loaded chunk.
- Gene examples on the stands are entries of that knowledgebase snapshot; counts will drift as the knowledgebase grows.
