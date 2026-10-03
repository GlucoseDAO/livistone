# 27 — Jepii Mici trail, alpine plateau and snow couloir

**Needs:** 26, 21 (merged). **Tiers:** all (graded). **Branch:** `realism/27-mountain-trail`. **Review:** `review/27-mountain-trail/`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Owner request and corrections (3 October 2026)

"I want to modify the mountains. Make a tourist route and put a 'Jepi Mici' pointer sign there together with danger sign like on the photo. Also, put nice flowers like photo on at least part of the mountain and a bit of the snow like on another mountain." Then, from reference photos: the trail should start on a forest-heavy hill with the board roped between two trunks; the rhododendrons are low shrubs with flower trusses, with moss campion between them; the flowers belong on an upper plateau visitors can walk on; the snow fills a shaded chimney between two peaks, not a long narrow streak.

The real trail is **Jepii Mici** (Bucegi, Romania): marked with a blue cross, closed in winter. The signs use that spelling.

## What and where

Layout lives in `src/world/mountain-layout.ts` (DOM-free); `src/world/mountain-trail.ts` builds what stands on it. Terrain shaping (`mountainShape`) applies with the eroded ridges only, so the forest's seeded draws stay put.

- **Trail.** Leaves the north lake-garden path at (-5, -159) through a gap in its kerb, runs through the woods to the trailhead at (-13, -190.5), climbs straight up a forested slope raised 3.4 m over ten metres behind the board (`hillRise`, about 30°), zigzags up the ridge's face on a bench graded into the slope (`trailBench`: level within 1.8 m of the centreline, blending out by 4.2 m) and enters the plateau at about (-17, -240). It is bare earth in the baked `groundSoil`.
- **Trailhead.** In thick woods (trees appended round it, ashes nearest the trail), a 1.6 × 0.9 m white board with a blue border and red hand-lettered warnings (ATENȚIE! · ATTENTION! / TRASEU ÎNCHIS! TRAIL CLOSED! / PERICOL DE MOARTE! DEATH HAZARD! / INTERZIS! · FORBIDDEN!) hangs with its lower edge 2.05 m up on four ropes tied round two big bark-mapped trunks, whose roots cross the trail. The JEPII MICI arrow (blue-cross mark, both faces) and a blaze are nailed to the left trunk; two boards with blue-cross squares to the right one: "TRASEU DEOSEBIT DE PERICULOS! / PERMIS NUMAI TURIȘTILOR ECHIPAȚI CORESPUNZĂTOR ȘI BINE ANTRENAȚI / PENTRU URGENȚE: 112" and "DIFFICULT OR DANGEROUS TRAIL! / CLOSED IN WINTER (NOVEMBER–APRIL)". Ferns and butterbur (cut out of the atlas by alpha test) crowd the edges. Blazes mark nine boulders up the climb. Board, trunks, pointer, fence and barrier have colliders; the mesh is clickable and E opens the trail's story.
- **Plateau.** A rolling alpine meadow round (-12, -249.5), 50 × 20 m, 30.5–35 m up, below a band of pale grey limestone crags with buttresses and ledges. A rope fence runs round its open edges (where no crag at least 7.5 m high closes it), with gaps for the trail; a log barrier with a TRASEU ÎNCHIS · TRAIL CLOSED board ends the walkable trail at (-11, -255.6) at the crags' foot. `trailCorridor` (the climb and the plateau) is where `main.ts` does not reset walkers past the town's bound. The grass field's bake reaches z = -262 to cover them.
- **Plants.** Rhododendron shrubs (gpu 80, mobile 44; 1–2.8 m across, 0.4–0.7 m tall): glossy dark-green leaf clumps with a red-brown cast and magenta trusses (#c8378f–#e05ab0) dense on top, a few lone ones on the sides; a world-space Worley pattern breaks trusses into blooms and clumps into leaves. Moss campion (gpu 110, mobile 55; 0.3–1.2 m, a few centimetres high, hugging the ground, grass through it) with TSL five-petalled lilac stars about 1.8 cm across and dark-red buds on bright moss, between the shrubs and on the climb's top verges. Two merged draws, none on cpu (where the ground paints their colour). Bright alpine turf (`groundPaint.x`) covers walkable ground between them; the crags and the climb's banks keep their rock.
- **Snow.** Two rocky peaks west of the plateau (about 75 and 85 m high) on a raised massif, with a couloir carved 13 m deep between them, opening toward the plateau. Old snow fills its upper part, about 15–17 m across at the top, tapering to a ragged, melting snout about 46 m up, with a wet runnel below. The default sun is high in the south-west, so the walls alone shade only about a third of the snow: the sun's terrain shade is ray-marched into `groundPaint.w` round the couloir and applied through the ground's `receivedShadowNode`, and **extra shade is baked into the inner upper couloir** (`couloirShade`). The snow is seen from the climb, the plateau and, through the haze, `ridge-north`.
- **Map.** Jepii Mici is destination 11, after Materialized Enhancements (not a civic landmark). Choosing it arrives on the trail 7 m below the board at (-11.25, -183.68), facing it. Its journal story keeps the facts (a steep Bucegi trail marked with a blue cross, closed in winter) apart from the Livistone fiction.

## Switch

Dev-only `?mountain=off` restores the mountains before this sub-plan: no trail, terrain shaping, paint, signs, plants, fence or corridor; the original forest, kerb and reeds. The map destination and story stay. Captures (`?capture=1`) no longer reset views placed past the walking bounds, and a view that cannot stand still (the plateau's steep slope under `?mountain=off`) is taken after 240 frames.

## Budget (day, WebGPU on `main` with sub-plan 21; before = `?mountain=off` on the same server)

| View | Desktop calls / triangles | Changed | Touch calls / triangles | Changed |
| --- | --- | --- | --- | --- |
| trail-from-path | 55 / 2.41 M → 59 / 2.44 M | 41 % | 39 / 1.18 M → 43 / 1.16 M | 41 % |
| trailhead-signs | 51 / 1.97 M → 55 / 2.17 M | 65 % | 36 / 924k → 40 / 897k | 68 % |
| mountain-flowers | 46 / 1.43 M → 50 / 1.32 M | 74 % | 30 / 491k → 34 / 442k | 73 % |
| snow-gully | 45 / 979k → 49 / 946k | 73 % | 30 / 294k → 34 / 338k | 72 % |
| plateau-view | 139 / 2.35 M → 144 / 2.43 M | 30 % | 92 / 1.22 M → 97 / 1.21 M | 22 % |
| ridge-north | 61 / 2.17 M → 67 / 2.17 M | 25 % | 48 / 1.19 M → 52 / 1.01 M | 19 % |

Four new draws: signs, trunks, fence, barrier and undergrowth (one mesh, 11k triangles on gpu), trail boulders (one, 9k), rhododendron shrubs (one, 103k gpu, 28k mobile) and moss campion (one, 3k). Terrain, turf, snow and shade add none. Fewer trees on the plateau, peaks and couloir offset most of the triangles.

## Captures

`bun scripts/screenshot-realism.ts <dir> desktop mountain day` (set `mountain`, outside `all`): `trail-from-path`, `trailhead-signs`, `mountain-flowers` (on the plateau), `snow-gully` (the couloir between its peaks from the plateau), `plateau-view` (back toward the town) and `ridge-north`. `tests/mountain-trail.test.ts` walks a Rapier capsule from the map arrival under the board, up the bench onto the plateau, never meeting the reset, and pushes it toward every edge of the plateau (held by fence and crags); `tests/entrances.spec.ts` includes the map destination.

## Open

- Up close the shrubs' leaf clumps and trusses are low-poly; the photo's leaves and funnel blooms are finer.
- From town (`ridge-north`) the couloir is about 110 m away, deep in the walking haze, so the snow reads only faintly.
- The crag band behind the plateau is still a broad, fairly smooth face at the two-metre grid's resolution.
- An oak at the trailhead hangs a little foliage across the board's left edge in `trailhead-signs`.
- Software captures were not taken.

## Round 2: the owner's order, rocks, snow and real flowers (3–4 October 2026)

**Owner request.** "First, the plateau with flowers is on top, you first start with forbidden area in a forest. Then you climb rocky and foresty regions, then you go through snow … when you get through snow you get to the plateau with flowers. It is proper flowers, not cactus like you did now." Then: "snow looks like white paint, not like snow." The owner supplied six photographs of their own hikes (a snow bridge over a stream, a snow gully between rock walls, a rhododendron slope below a rocky crest, a narrow rocky passage, a waterfall in a limestone cirque, and round 1's plateau in the game). They show people, so they stay outside git, in `~/sources/livistone-realism/references/jepii-mici-2/`; nothing from them is in the game.

**Layout** (`mountain-layout.ts`, all of it redrawn past the trailhead). The board, its woods and the map arrival are unchanged. Behind them the trail climbs benched switchbacks through the woods to about 19.5 m, enters a **gorge** between two rock buttresses through a narrow passage, and runs west along the north ridge's foot for about 55 m, its floor rising to 28.5 m, a stream on the crags' side and the waterfall's pool half way. At the gorge's west end it turns north up a **gully of old avalanche snow**: the trail is on the snow for more than 18 m, over a slab up to 1.7 m thick with a steep, ragged edge short of the walls, to about 46 m. It comes out on the **plateau**, a meadow shelf cut into the face below the crest's crags (41 m at its lip over the gorge, rising 5.5 m toward the crags), and ends at the barrier at the crags' foot. From the plateau's lip the view runs down over the gorge and the woods to the town. Steepest walkable stretch: 29° on the snow (35° on the old slope behind the board). The near terrain grid and collider now reach z = -296 (grass bake z = -284).

The gorge's walls stand at least 6–11 m above its floor, built as a rib where the slope falls away. They lean back to about 60°: steeper walls aliased into rows of thin fins on the 2 m grid, and the ridges' eroded gullies did the same along cut rims, so the erosion is calmed round the gorge (`mountainCalm`). Sheer rock is the crag blocks' job (round 2: crags, below). The HUD names the stage you are on: Forest Trail, Rocky Gorge, Snow Gully, Rhododendron Plateau (it said "Living Waters · Town Gardens" on the mountain before).

**Flowers** (`alpine-plants.ts`, new). Round 1's shrubs, piles of faceted clumps with hexagonal magenta rosettes on top, are deleted. Rhododendron myrtifolium now grows as the photograph shows it: low mats in drifts across the meadow, 10–22 cm of dark leafy mound under masses of 15–25 cm cards painted at load with dense trusses of five-lobed magenta funnel flowers (dark throats, pale rims, spots and stamens) and leafy sprigs, tilted every way so they hold their cover from eye height. A first attempt that painted small flowers procedurally on a smooth mound read as pink carpet and was replaced. Mats cover about 46% of the meadow. Yellow buttercups and avens and small white flowers stand on stems in the turf (round 1's yellow paint flecks on the ground are gone); moss campion keeps its cushions. Three draws, about 104k triangles on gpu, none on cpu.

**Snow** (ground shader). Grey-white, never paint-white, with soil streaks down the fall line, dirt patches, conifer needles, twigs and stones, and a banded steep edge. Where the trail crosses it, people have walked it before (the owner's suggestion): baked boot prints going up and down (`scripts/build-snow-footprints.py`, procedural and seeded: `public/textures/snow/footprints-{gpu,mobile}.webp`, a 1.2 × 9.6 m tile of height, normal and wear, 614 KB and 190 KB lossless) are laid on the trail's own frame, which the terrain bakes into a `trailFrame` vertex attribute near the trail on the snow; the prints darken and dirty the snow where deep and tilt its normal on gpu. A first try with Voronoi sun cups printed a pattern of cells and was dropped. It no longer climbs the gully's walls in white teeth. Boulders lie half sunk in it and dead branches on it (one mesh with the signs). The narrow passage has a steel cable on anchors, as the real trail has its chains; the rope fence now follows the plateau's lip wherever the ground falls away.

**Tests.** `tests/mountain-trail.test.ts` checks the order (woods, gorge, snow, plateau), rock on both sides of the gorge, the trail on more than 18 m of snow over a metre thick, the plateau above all the snow, the mats' cover and heights, and walks a capsule from the map arrival through the gorge and over the snow onto the plateau without a reset, then pushes it at every edge.

**Review.** `review/27-jepii-mici-2/` (work-in-progress captures and `flowers-progress.jpg`, the owner's photo beside round 1 and round 2).

## Round 2: crags (4 October 2026)

**Why.** "Where are the rocky ones??" The trail should climb through rocky and wooded terrain, but the steep faces were smooth sheets at the terrain's 2 m grid under a stretched, brown rock photo (the big smooth wall in `game-plateau-cacti.jpg`). The 2 m grid cannot draw sheer rock: the gorge's walls lean back to about 60° because steeper ones alias into fins. Branch `realism/27-crags`; review `review/27-crags/` (desktop, touch and software, before = `realism/27-jepii-mici-2` at edc50a8) and `review/27-crags-skyline/`.

**Blocks** (`src/world/crags.ts`, found from the terrain, so they follow the layout):
- *The gorge's lining.* A block every 2–4 m on both walls from the mouth up the snow gully, its face at the floor's edge, as high as the wall behind it or a little higher (up to 11 m), deep enough to run back into it: the gorge reads as sheer-walled. At the narrow passage the rock closes the floor in to 1.6–2.4 m from the trail on both sides, as in `rocky-gorge-path.jpg`, but stays behind the steel cable; the waterfall keeps a slot about 3 m wide. Rounded conglomerate masses below the waterfall, bedded limestone above it and in the gully.
- *Boulders on the floor*, thickest under the waterfall (a fallen-rock cone, off its pool and the stream), clear of the trail by `TRAIL_HALF` + 1 m.
- *The rock zones* (`rockZone` in `mountain-layout.ts`: the gorge's and gully's walls to 14 m past the floor's edge, the mouth's buttresses, the crest band above the plateau) and, at a third of the density, other steep ground of the north ridge: wherever the ground is steeper than about 47°, bedded steps (stacks of 2–5 slabs between bedding planes, standing out of the slope by their height × cot(slope)), ledges hung on near-vertical walls (seated by their back 55%, tipped back 8–13° so the lowest corner is a seated one, their undersides drawn), rounded masses, and talus within 10 m below the faces. Steep cells get up to six candidates, as a 30 m wall is only a few metres wide in plan.
- *Seated, never floating.* Every block's foot (its full outline where its rounding reaches full width) lies 0.4 m (talus 0.25 m) under the lowest ground mesh at its spot: the collider's 2 m triangles and the rendered tiles' 4 m (gpu) and 8 m (mobile) cells. Blocks keep off the gorge's walkable floor (`cragFloorClear`), the snow, the walkable meadow (inside the plateau's outline and gentle; its outline also takes in the crags' steep foot), the stream and the brook, and every point of a block keeps its trail clearance plus 0.15 m for the rendered lumps.
- *Contact patches* along the lining's feet, round talus and boulders, at the downhill face of steps on gentle ground (70 patches).

**Limestone** (`src/world/limestone.ts`, shared by the blocks and the ground's steep rock, world-space so their beds line up): the Poly Haven scan turned pale, faintly warm grey (the before was olive-brown), bedding planes at world height whose spacing varies from a metre to many and which dip and wander across the mountain, joints between them staggered from bed to bed, each block between them with its own value and facet tilt (normal on gpu), thin cracks that never thin below a pixel and fade before they alias, rounded grooves, dark water streaks down steep faces, lichen spots and crusts, moss on block ledges. The ground drops the top-down projection on steep triangles (its smoothed normals leaned toward the sky across the grid's folds and the scan streaked down the faces), and steep ground's baked colour takes the stone whole (meadow left in it had greened the rock). The cpu tier takes the pale scan alone: software rendering pays for every noise per pixel (the first software capture, with the full limestone, ran about a third slower).

**Budget** (headless, shared laptop; frame rates are not reported, they swung several-fold between runs):

| | gpu | mobile | cpu |
| --- | --- | --- | --- |
| Blocks drawn (of 352) | 352 | 344 | 333 |
| Triangles | 113k | 42k | 41k |
| Detail | edges split, bulging beds, normal map and facets | corners only, colour work | corners only, pale scan |
| Draws | 1 (+1 shadow pass when the cached map re-bakes) | 1 | 1 |

One trimesh collider on every tier: 333 blocks on the walking terrain, 42.6k triangles. Sites, geometry and collider are built at load from the collider grid's heights: about 75 + 65 + 15 ms in Vitest on the development laptop. Every view of the `mountain` set gains exactly one draw (desktop 113k triangles, touch 43k, software 42k); median pixels changed: desktop 44% (gorge-canyon 46%, waterfall 73%, plateau-crags 47%), touch 44%, software 34%. Skyline: `valley-east` and `summit-southwest` 0%, `ridge-north` 3%, `summit-northwest` 16% (the nearer ridge face turns to limestone with ledges); the distant ranges are unchanged.

**Tests.** `tests/crags.test.ts`: blocks line both walls along most of the gorge and close in at the passage; every block's lowest vertex lies under the ground on every tier and re-seating lands where it stands; no rendered vertex comes within its trail clearance (never within `TRAIL_HALF` + 0.9 m), onto the snow, the walkable meadow or the stream; only small boulders and the passage's rock stand inside the floor's edge; every block on the walking terrain collides and is drawn on every tier; gpu under 150k triangles, mobile under 50k, cpu not above mobile; the same sites every time. `tests/mountain-trail.test.ts` walks its capsule through the crags' collider. Playwright `graphics-profile`, `post` and `ground` pass on WebGPU and on the WebGL 2 fallback.

**Switch.** Dev-only `?crags=off`: round 1's rock and no blocks (with `?mountain=off`, nothing of sub-plan 27). `?crags=debug` paints the blocks red, to tell them from the ground's own rock.

**Open.**
- Up close the blocks still read a little built: stacked slabs with clean bevels, and rounded masses that can look like pillows on the crest band. The photographs' conglomerate is knobbier and its ledges carry grass and dwarf pines.
- The terrain's own 60° walls between and above the blocks remain smooth at the 2 m grid, now jointed limestone rather than a stretched photo; in the waterfall's slot the fins at the wall's foot still show.
- The rope fence along the plateau's lip follows `plateauRim(1.3)`, 1.3 m inside the outline, but over the gorge the outline lies on the cut wall: its posts stand on the cliff face 5–9 m above the gorge's floor and 7–11 m below the meadow (e.g. a post at (-28.4, -253.2) on ground at 30.0 m, meadow 41.2 m). The lining hides most of them; the fence belongs on the meadow's real lip, about `gorgeRim(s)` from the axis.
- The waterfall's water is not on this branch; its slot is bare rock until it is.
- The crags are one mesh, drawn whole wherever any of it is in view (113k triangles on gpu even from the town).
- Not verified: physical devices, Safari, Firefox.

## Round 2: mountain water (4 October 2026)

**Owner request.** A waterfall in the gorge after the owner's photograph of a tall white fall in a limestone cirque, a mountain stream that runs out from under the old snow (the snow-gully and snow-bridge photographs) and the plateau's brook to the waterfall's lip. The photographs stay outside git (see above).

**Module** (`src/world/mountain-water.ts`, branch `realism/27-mountain-water`). The builders take a world-space spec; `createGorgeWater` places them from the layout's exports on `terrainSurfaceHeight`. Nothing collides: the water is shallow and the terrain is its floor.
- **Waterfall** (`createWaterfall(spec, tier)`; spec: lip, foot (its height is the pool's level), width, optional ledge for two tiers, spread, pool radius, facing, ground). One lit sheet whose foam is a function of launch time (`tau`, integrated from the water's accelerating speed), so the streaks fall at the water's speed and stretch as it falls; glassy dark water for the first metre, then foam that thins at the edges into strands and opens gaps lower down, a curtain that bows out in the middle and thickens toward edge-on views, splash where it lands. Behind it a dark, patchy film lies on the rock face itself, wider than the water, with a thin film of water trickling down it: the wet streak of the photograph, which also frames the white water against the pale limestone. A plunge pool floods only a hollow (a priority flood on its polar grid), stands as a shallow sheet over flat ground and thins to a film where the ground falls away; froth churns outward from the impact in rings. Sheet, wet rock and pool are one draw; mist is a second (camera-facing cards that rise and swell, lit like level ground, none on cpu). The sheet keeps 0.35 m above the rendered rock under it, giving way over the last 1.5 m above its pool; a point that stepping out cannot clear near the pool stays put (it is under the rising floor), which fixed a first version that flung the sheet's foot 8 m across the gorge.
- **Streams** (`createStream(points, width, tier, options)`): a ribbon on the ground that bakes what the river's shader reads (`flow`, `along`, `across`, `depth`, `rock` as white water where the bed steepens), level across its middle and down to the ground at its edges, with a dark `wet` bank past them; the river's own shader serves it through `waterMaterial(tier, { stream: true, time })` (own ripple scale and waterline band, faster white water, ripples that tilt with the ribbon; the river's node graph is unchanged). Ends can fade in and out. Both streams merge into one draw and mirror 60% of the baked sky, which the gorge's walls mostly hide. cpu: opaque, nearly flat, baked colours.
- **Snow cave** (`createSnowCave(spec, tier)`): where `GORGE_STREAM[0]` leaves the snow, a tongue of snow 1.5 m thick ends in a ragged steep face with meltwater runnels and layers, its top leaning out as a 0.7 m lip over a 1.4 × 0.8 m mouth; behind it an arched tube with a dark wet floor and a back wall. The terrain's own snow there is a 7 m wedge with no face, so the face is this mesh. It shares the ground snow's tones (fall-line dirt streaks and patches from the foam texture). One draw; it casts its shade on the stream. The face thins away 1.1 m short of the trail, so it needs no collider.
- **Placement.** The brook starts where the crag's face lies back to the meadow (`PLATEAU_STREAM`'s first point stands 11 m up the crag), runs 0.45–0.8 m wide to the lip and falls 17.7 m (`WATERFALL`, 1.6 m wide at the lip, 3.5 m at the foot) onto a 1.7 m pool at the wall's foot, kept off the trail. The gorge's stream runs from a metre inside the cave, 0.6–1.2 m wide, down `GORGE_STREAM` and fades over its last 2 m among the boulders. The near grass keeps off the brook (`brookGround`, 0.8 m discs: the bake's 2 m lookup resolves no less, so a strip of bare turf about 1.5 m either side shows).
- **Time.** All of it runs on `windTime`: `?capture=1` freezes it, reduced motion stills it as the lake stands still, `?wind=<seconds>` pins it for stills.

**Budget** (day, WebGPU; before = `realism/27-jepii-mici-2` at edc50a8 on the same server). New draws: waterfall and pool, mist, streams, cave: four on gpu and mobile, three on cpu. Triangles: gpu 2.4k fall, 4.3k streams, 0.8k cave, 36 mist; mobile 1.0k, 1.8k, 0.8k, 18; cpu 0.4k, 0.6k, 0.4k.

| View | Desktop calls / triangles | Changed | Touch calls / triangles | Software calls / triangles |
| --- | --- | --- | --- | --- |
| waterfall | 52 / 1.032M → 55 / 1.038M | 14.4% | 37 / 386k → 40 / 389k | 25 / 136k → 27 / 137k |
| gorge-canyon | 52 / 1.626M → 56 / 1.634M | 12.6% | 37 / 712k → 41 / 715k | 25 / 268k → 28 / 269k |
| snow-snout | 50 / 949k → 52 / 954k | 3.3% | 37 / 368k → 39 / 370k | 27 / 187k → 29 / 188k |
| plateau-crags | 44 / 644k → 45 / 648k | 7.6% | 29 / 235k → 30 / 236k | 21 / 91k → 22 / 91k |
| waterfall (night) | 52 / 1.032M → 55 / 1.038M | 5.8% | | |

The change is local (a ribbon of water and a cave in wide gorge views), so no view reaches the 15% gate. Building it costs about 0.4 s of main thread on gpu (most of it the wet rock's and the sheet's searches against the terrain, at 18 µs a ground sample); interleaved time to ready on WebGPU, headless on a loaded machine, stayed within the noise of the layout branch (20.4–22.7 s against 19.8–23.7 s over four pairs).

**Captures.** The `mountain` set's `waterfall`, `gorge-canyon` and `snow-snout`, plus `plateau-crags` for the brook, day on desktop, touch and software, and `waterfall` at night. Motion: the same three views with `?wind=12` and `?wind=12.35` (`review/27-mountain-water/motion/`, Difference mode). `tests/mountain-water.test.ts` covers the builders (ribbons follow their points at their widths, finite values, flow, white water from the slope, the fall clear of the rock, launch time increasing down the fall, flooding only a hollow) and the placement.

**Review.** `review/27-mountain-water/` (before = edc50a8; `first-look` was taken on 714a1eb, before the wet rock).

**Open.**
- The fall is a brook's: 1.6–3.5 m wide and one tier, narrower than the photograph's; from the `waterfall` view, which sees it almost edge-on, it reads as a white ribbon. A front view from the gorge floor shows it best.
- The cliff behind it is the 2 m terrain's smooth face; crag blocks set there must keep clear of the sheet.
- The snow cave's face is cleaner and rounder than the photograph's dirty, scalloped lip.
- The pool is shallow because the gorge floor at the foot is flat; a basin carved there would give it depth.
- Physical-device performance is untested.
