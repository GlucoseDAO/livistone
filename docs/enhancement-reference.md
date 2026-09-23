# Materialized Enhancements

- Project: https://enhancement.bio/ (read 23 September 2026). A character-building game, gene evidence knowledgebase and printable bioart project. The base invitation links directly to its home/character page.
- User-supplied source: `voronoi_shell_20260820_083431_daria_s3943.stl`.
- SHA-256: `02f013e1753df8f911da805aa811766869b21d0b94b046fb2f8ef4e1c0d18be5`.
- Original: 3,642 triangles. Indexed derivative: 1,359 vertices, same 3,642 triangles and holes. STL Z becomes world Y, with uniform scale 0.8 and translation only. Vertex coordinates are rounded to four decimals.
- `src/world/models/enhancement-shell.json` retains source identity and indices. No hole filling, remeshing or slope smoothing remains. Matte terracotta and warm amber lights follow the user's Martian-soil direction.
- Direct ascent was checked on the southeast face. Other sides retain their original openings and overhangs; these are not solid invisible slopes. Movement assists climbing only against the tagged STL collider. Ordinary town surfaces retain their existing rules.
- Small procedural lights mark the ascent pending any additional user-supplied stone STLs. No other stone model is claimed as supplied.
- The broader hill/ramp adaptation was discarded after the user's correction.

The outer west road now connects to the lake loop, and the outer east road connects to the garden approach below the tributary tip. The right-hand unused station spur was removed; the left spur reaches the station and the Glucose spur reconnects to the main route.


### Internal route and anatomical monument
The source STL data remains unchanged. Rendering and collision clip one approved internal shaft near the summit; all source surfaces outside that shaft remain intact. The concealed spiral connects the cave entrance to the summit. The small information/join panel is at the base.

The continuous human surface uses the CC0 MakeHuman hm08 base mesh (body group only), with arms posed outward and uniformly scaled to monument size. No MakeHuman application code is included. Source: https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj . License: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md . Copyright at CC0 release: Data Collection AB, Joel Palmius, Jonas Hauquier (2020). The compact derivative stores its original SHA-256 in `src/world/models/enhancement-human.json`.

Five smaller mycelium trees form a sparse transition beside the hill approach. Their crowns taper toward the hill and remain outside the marked ascent and cave access.
