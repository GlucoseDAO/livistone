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
