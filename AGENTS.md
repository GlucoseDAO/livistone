# Agent instructions for Livistone

> **This file and `CLAUDE.md` are two copies of one document.** Edit either one; a
> `pre-commit` hook copies your change over the other and stages it. Never let them
> drift on purpose, and never edit both in the same commit with different content —
> the hook will refuse the commit. See [Keeping the agent docs in sync](#keeping-the-agent-docs-in-sync).

Livistone is a browser-playable 3D town: a first-person walk through an art-and-science
fantasy settlement whose three civic buildings are inhabitable interpretations of Livia
Zaharia's jewelry (the Nut of Power, the Mitoring, and the Nanot of Power). The Embryo
Ring also becomes a walkable railway station on the southern arrival bank. Read
[README.md](README.md) for what the project is and [docs/3d-game-plan.md](docs/3d-game-plan.md)
for where it is going.

## What this project is, in one paragraph

A TypeScript + Vite single-page app. Three.js renders the town with WebGPURenderer (WebGPU, or its
built-in WebGL 2 backend where no hardware WebGPU adapter exists); Rapier
(WebAssembly) provides a kinematic capsule character controller. There is no backend, no
API key, no database, and no account system — the entire game is static files plus
`localStorage`. Every building, tree placement, path, and piece of jewelry geometry in the
current build is generated in code at load time; binary assets are two tree GLBs, local derivatives of 70 real jewelry photographs, six Materialized Enhancements poster images, two CC0 rock maps, four CC0 ground-map derivatives, nine CC0 railway maps, two generated limestone paving derivatives, two generated river ripple maps, and three generated architectural surface sets (ashlar, terrazzo, brass).

## Commands

| Task | Command | Notes |
| --- | --- | --- |
| Install | `bun install --frozen-lockfile` | Bun is the package manager and dev server |
| Dev server | `bun run dev` | Binds `0.0.0.0:5173`; open `http://localhost:5173` locally or the computer's LAN IP on Wi-Fi. `strictPort` is on |
| Type check + build | `bun run build` | `tsc --noEmit` then `vite build` into `dist/` |
| Preview the build | `bun run preview` | Binds `0.0.0.0:4173`; open `http://localhost:4173` locally |
| Unit tests | `bun run test` | Vitest, `tests/**/*.test.ts` — **not** `bun test` |
| Browser tests | `bun run test:browser` | Playwright, `tests/**/*.spec.ts`, real Chrome. `LIVISTONE_BASE_URL=http://127.0.0.1:<port>` targets another worktree's dev server |
| Sync agent docs | `bun run docs:sync` | What the pre-commit hook runs |
| Install git hooks | `bun run hooks:install` | Sets `core.hooksPath` to `.githooks` |
| Regenerate tree GLBs | `bun scripts/generate-trees.mjs` | Needs the dev server running |
| Landmark screenshots | `node scripts/screenshot-landmarks.mjs [outDir]` | Needs the dev server; headless Chrome with GPU WebGL flags, plus the WebGPU flags on Linux |
| Realism captures | `bun scripts/screenshot-realism.ts <outDir> <desktop\|touch\|software> [quick\|exteriors\|ground\|water\|galleries\|all\|fixes\|skyline] [day\|golden\|night]` | Dev server only (`LIVISTONE_BENCHMARK_URL`, default port 5173); loads `?capture=1`, which freezes animation time, CPU render scale and physics stepping so runs are pixel-close. See `docs/realism/` |
| Realism review page | `bun scripts/build-realism-comparison.ts <dir> [--base before] [--title text]` | Writes `<dir>/index.html`: before/after sliders, variants, draw-call/triangle deltas. Serve the folder over HTTP to view it |
| Mitoring comparisons | `node scripts/screenshot-mitoring.mjs [outDir] [desktop\|touch\|software]` | Fixed daylight/cameras; real SwiftShader is separate from touch emulation |
| Surface maps | `python3 scripts/build-surface-textures.py [previewDir]` | Pillow + numpy, seeded and procedural; ashlar, terrazzo and brass albedo + nrh WebPs into `public/textures/surfaces/` |
| Enhancement assets | `python3 scripts/build-enhancement.py [photoDir]` | Pillow; WebP posters + compact crystal meshes. Regrow crystals with `scripts/generate-enhancement-crystals.py` inside a materialized-enhancements checkout |
| Share images | `bun scripts/build-share-images.ts [outDir] [--readme]` | Dev server only; renders the 1200×630 `og:image` card and the loading-screen backdrops into `public/images/share/`, or with `--readme` the README's gate, civic-centre and map screenshots into `docs/images/`. Rerun after visible changes on the arrival path |
| Frame budget | `bun scripts/frame-budget.ts [--json] [--far 150]` | No browser: main-pass draw calls and triangles per producer (Living Waters, glucose, Enhancement, terrain, planting; posters and forest under Bun) over the capture poses. Not device timings |

`bun run test` uses Vitest; `bun test` would invoke Bun's own runner and fail. Playwright
reuses an already-running dev server, so leave one up while iterating.

Node.js ≥ 22.12 must be on `PATH` for the `tsc`, `vitest`, and `playwright` CLIs even
though Bun runs Vite itself.

## Repository map

```
src/
  main.ts            Game class: renderer, cameras, fixed-timestep loop, mode switching,
                     raycast interaction, the window.__livistone test hook
  style.css          All UI styling (no CSS framework)
  render/
    renderer.ts      WebGPURenderer creation, backend choice, classic transparent order, frame stats
    output.ts        Output pass: Neutral tone mapping, paper/sign display mask, display-space range fog, AO/bloom composite, load-time precompile
    tone.ts          Khronos PBR Neutral with its mid-grey gain, CPU mirror and inverse (night halos)
    aerial.ts        Walking aerial perspective: height-aware haze toward the sky as scene.fogNode, complete at GraphicsProfile.fog
    post.ts          Screen-space stages: half-resolution depth/normal copy, GTAO + denoise, capped bloom
    lighting.ts      Batched shadowless lights that keep the sky's image-based light
    shell.ts         Transmissive shells seen from inside through a second layer of themselves
  game/
    content.ts       LANDMARKS, DISCOVERIES, SPAWN, progress parse/read/write
    exhibits.ts      Source-linked factual jewelry catalogue and photograph metadata
    physics.ts       Rapier world, collider specs, kinematic character controller
    input.ts         Keyboard, held-button drag-to-look mouse, and touch thumbstick input
    audio.ts         Owner-approved phone kalimba playlist, default on
    graphics.ts      Coarse-pointer / software-GL / laptop-iGPU probe that selects reduced town meshes
    daylight.ts      Persistent Auto / Day / Night selection, without GPS
    research.ts      GlucoseDAO chapters with original Drive poster images and source links
    research-art.ts  Drawn figures for non-research garden stories; research uses source images
    piece-stories.ts Artist and exhibition stories overlaid on the jewellery catalogue
    enhancement.ts   Materialized Enhancements poster captions and gene-category facts
    render-budget.ts GPU-free draw estimate per camera, the dev snapshot().budget tracker, ?budget=off
    render-scale.ts  Adaptive resolution: per-tier frame-rate targets with hysteresis
    jewelry-catalogue.json Generated source-hashed catalogue and image manifest
  world/
    world.ts         Town: terrain, river, paths, bridges, landmarks, interiors, tower,
                     gardens, hills; emits colliders, interactives, occluders
    jewelry.ts       Rebuilds the extracted jewelry strands as cast-silver ribbons; ENERGY_HALL sizes the amber cup
    walnut.ts        Procedural walnut shell relief and material
    strands/         mitoring.json, nanot.json: preserved wire centerlines from the STLs
    forest.ts        Batched GLB tree instancing, mobile foliage cut, and distance LOD
    forest-layout.ts Seeded tree sites and their clearances, DOM-independent for tests
    contact-shadows.ts One multiply-blended decal batch grounding trees, rocks, feet, posts and benches
    landscape.ts     Shared path curves, WALKING_NETWORK, planting and grass clearance
    path-network.ts  Roads as one smooth-union distance field: filleted junctions, marching-squares paving, outlines
    walking-surface.ts The network's paving and kerbs per group (town, garden), kerb thresholds and paving height
    path-kerbs.ts    Bevelled kerb blocks along the merged outlines; the geometry is also their collider
    cpu-detail.ts    CPU-only visual simplification, vertex lighting and static batching
    station.ts       Embryo station ring, glazed foyer, signs, train, and matching colliders
    train.ts         Maglev shell with true glazed apertures, lounge cabin, cabin announcements and matching colliders
    station-amber.ts Closed resin body, procedural textures, refraction, and inner core geometry
    station-ring.ts  Deep curved silver shank, organic side-wall piercings, and clasp anchors
    station-layout.ts Shared station, tunnel, railway planting and walking clearance
    railway.ts       Textured rail geometry, Dark Nut portals, lined bores and matching colliders
    planting.ts      Spatially batched leafy shrubs, blossoms, blade grass, distance cull
    grass-field.ts   Near-player grass: one instanced draw of world-anchored blade patches over a baked 2 m lookup
    wind.ts          Shared wind clock (game time, still under reduced motion); grass, tree, shrub, flower and reed sway
    bridge.ts        Solid arch bridge, deck, rails, and matching colliders
    gateway.ts       King's Chapel entrance arch, faceted tourmaline, raised lettering and colliders
    gateway-materials.ts Procedural silver, limestone and colour-zoned gem materials
    gateway-layout.ts Shared gateway footprint and arrival-path planting clearance
    sky.ts           Startup-baked physical day (atmosphere, ray-marched cumulus) or night cubemap and reflection environment
    atmosphere.ts    Single-scattering atmosphere, CPU copy for calibration and its TSL bake
    cloud-noise.ts   Seeded tileable 3D Perlin–Worley cloud noise for the day bake
    mountains.ts     Continuous ground and ridges with triplanar rock maps and reduced mobile detail
    far-ranges.ts    Distant ranges beyond the 520 m tiles and the town ridges' erosion; zero inside the near box
    far-landscape.ts The ranges' ring mesh in six sectors, their material and FAR_LAYER
    planar-exhibition.ts Permanent photo posters in brass rails, aspect-matched captions, stand colliders, texture residency
    poster-layout.ts Curated hall and station panel placements
    glucose-pavilion.ts Source-derived insulin ribbons, glucose sculpture and research panels
    glucose-layout.ts Shared molecular court and planting clearance
    living-waters.ts Integrated lake, pavilion, silver mushroom grove and garden platform
    living-waters-layout.ts Shared lake cells, paths and full canopy clearance
    lake-eyes.ts     Water eyes kept clear of the garden paving (cells re-outlined round the paths) and their mitred stone lips
    mycelium.ts     Curled silver mushroom folds, branching stems, light crown and the grove's detail batches
    static-batch.ts Merges static parts that share a material after their colliders are taken
    terrain.ts      One continuous town terrain and physics mesh
    town-layout.ts  Walking bounds and rigid collider transforms
    water-material.ts River shader per device tier and the dev-only ?look=a|b variants
    water-surface.ts Clipped river sheet with baked flow, depth and rock attributes
    surfaces.ts      Mapped ashlar, terrazzo and brass for plain architecture, per tier; dev-only ?surfaces=off
    probes.ts        Reflection probes per building-piece and hall interior, baked per sky phase; dev-only ?probes=off
    river-rocks.ts   Blended boulder variants (instanced morphs), seated and in-stream placement, one collider trimesh
    pebbles.ts       Seeded shore pebbles: one unshadowed mesh refilled from the cells near the camera, none on cpu
    shore-nodes.ts   TSL shore: channel distance on the GPU, gravel, wet band, silt bed, caustics; rock moss and wet foot
    waterways.ts     Shared river/tributary boundaries, bridge sites and tower footprint
    time-tower.ts    Silver hourglass, round plaza, guarded spiral gallery and summit terrace
    elevated-layout.ts Shared tower, camel neck and Future House clearances
    walkway.ts       Shared rendered/physical ribbons and guard rails
    place-sign.ts    Livia-style building/place signs: pierced gold lattice frame, dark lettered faces, colliders
    future-house.ts  Liquid copper camel, curved printed hull, leather ties and neon name
    lake-plants.ts   Untold elliptical strip leaves and Spotlight folded bracts
    transit-art.ts   Original bold transit campaign for cabin advertisements
    enhancement*.ts  Voronoi hill (enhancement.ts), shared layout, poster row with category crystals (enhancement-gallery.ts)
  ui/gallery.ts      Floating exhibit controls, piece browser, flat photo zoom/pan viewer
  ui/ui.ts           DOM overlay: HUD, map panel, lore panel, journal, pause menu
tests/               *.test.ts → Vitest, *.spec.ts → Playwright
scripts/             Tree asset generation, agent-doc sync
public/models/trees/ oak.glb, ash.glb + attribution and MIT licence
data/models/         Livia's original STL jewelry models (git-ignored, ~50–110 MB); reference only
concepts/            Approved concept image, design brief, generation record, prompts,
                     02-jewelry-models/notes.md = what the STLs contain and how buildings use them
docs/3d-game-plan.md Technology decision, scope, milestones, acceptance criteria
.githooks/           Version-controlled git hooks
```

## How the pieces fit together

- **`Town` builds the world and hands out everything else.** Its async `Town.create` factory runs all the
  `create*` methods and fills three public arrays: `colliders` (fed to `Physics`),
  `interactives` (raycast targets for the E key), `occluders` (invisible boxes used to hide
  interiors until you are inside). If you add geometry that the player can walk into, you must push a matching
  `ColliderSpec` — the renderer and the physics world share no geometry automatically.
- **Path connectivity is a regression gate.** `tests/path-network.test.ts` checks that roads connect to the station through bridges and civic aprons, terminate on another route or a paved destination, and reach all map entrances. Keep the raised west-lake connector aligned with the foot of `FUTURE_NECK` and give garden paths matching mesh collision. Town routes and garden paths form one `WALKING_NETWORK` (`path-network.ts`): a smooth union of their distance fields with `PATH_FILLET` corners, marched (`walking-surface.ts`, 0.5 m cells) into one paving layer per group with world-space UVs, so junctions are one surface with no overlapping strips, shoulders or skirts. `path-kerbs.ts` lays raised bevelled kerbs along the merged outlines, round fillets and joined road ends, with matching mesh collision; they stop only at `kerbOpening` thresholds, 1.7 m before free road ends and where a narrow crotch would put them on other paving. The `merged junctions` tests in `tests/path-network.test.ts` check the single layer, the fillets and the kerbs. The wider gateway apron and its kerbs share `gatewayApproachWidth`; do not place narrow-path kerbs inside the apron. Paving loads attributed generated limestone derivatives with a procedural fallback; planting visibility uses the batches returned by `createPlanting`, without per-frame scene traversal. Reduced paving omits bump sampling.
- **Paths and planting share one layout.** `landscape.ts` owns the path curves and
  `plantingAllowed(x, z, radius)`. Every plant placement must reserve its full canopy or
  tuft radius, including flowers; keep civic doorway approaches and the bridge clear.
  Shrubs and grass are spatially instanced, with reduced mobile density. Bridge rail
  colliders follow the deck height; update their physics tests when changing the span.
- **The near grass field shares the planting clearance.** `grass-field.ts` bakes, on the terrain's 2 m vertices, the rendered
  height and a signed clearance equal to `grassAllowed` at every point (`groundReserved`, the merged path field, water);
  blades start 0.25 m beyond it, on the terrain mesh's own triangles. `plantingAllowed` is `grassAllowed` plus `canopyReserved`:
  the lake garden's grove and margin, `enhancementClearing` and `futureClearing` keep trees, shrubs and flowers away but grow
  grass. New ground something stands on belongs in `groundReserved` (with a footprint the 2 m lookup resolves, about 0.75 m
  across at least) or the path and water clearances, never in `plantingAllowed` alone; canopy-only clearings go in
  `canopyReserved`. Rocks and the grove's stems (`LivingWaters.stems`) reach the bake as discs. `tests/grass-field.test.ts`
  checks the agreement. The field is
  one draw (gpu 52k blades to 22 m, mobile 19k to 12 m, none on cpu), lives in the details group so map mode hides it, shades
  the ground between its blades, takes the terrain's baked crown and wall occlusion (`groundShadeField`) as its own aoNode,
  and sinks `planting.ts` tufts inside its radius. Animate plants only through `wind.ts`
  (`windTime`: the game's elapsed time, frozen by `?capture=1`, still under reduced motion), never TSL's `time`. Trees
  (`treeSway`; the distant detail only leans), shrubs, flowers, tufts and lake reeds (`plantSway`) read a per-instance `windRoot` (the instance matrix's
  translation and scale) that is refilled with the matrices, so every view mesh needs a geometry of its own; shadow casters
  keep the rest pose (`castShadowPositionNode`) in the cached sun shadow map. Leaf cards use alpha-to-coverage where the frame
  is multisampled (`FOREST_DETAIL.coverage`). The cpu tier gets neither. Dev switches: `?grass=off`, `?wind=off` (plants still,
  plain alpha test), `?wind=<seconds>` (pinned wind clock), and `?eye=<metres>` for low captures.
- **The bridge gateway follows the approved King's Chapel ring concept.** Keep its paired
  inward-facing silver tips, fan-spoked bezel, long green tourmaline and raised LIVISTONE
  letters above the stone. `gateway-layout.ts` reserves the side abutments and paved approach;
  trees also reserve their full canopy near the arch. `createGateway` is DOM-independent
  and derives colliders from its meshes. Keep the gem's quality settings separate from hall
  glazing and station amber; low detail uses an opaque reflective fallback. The serif glyph
  outlines are bundled, with their licence under `public/fonts/`. The source-photo poster
  stands left of the southern bridge approach, outside the walking span; keep its photo,
  factual caption, interaction and planting clearance aligned. Spawn is at `(-2, 75.2)`
  with yaw `0`, looking from the town-facing train exit toward the city gate.
- **The station keeps its transport role.** Its seven-poster collection stays in the concourse. `CIVIC_LANDMARKS`
  selects only the three ministries/City Hall for circular gardens and civic construction. Guard exhibition
  lookups when iterating all `LANDMARKS`. `station-layout.ts` owns the station and railway
  clearing; paths and full plant footprints must respect it. The open ring threshold and
  platform and glazed foyer have matching colliders, and the authored train has boarding bays at local x = -14 and 10. `STATION_LOCAL` preserves that geometry; the southern station applies a half-turn and x = -16 translation to its structure, gallery, interactions and every collider, putting the bays at world x = -2 and -26. `STATION` describes the placed footprint. Keep ramps, screen gaps, body apertures and the cabin floor aligned. Train windows are holes
  in the curved shell with separate transparent panes and colliders; never cover them with solid
  body geometry. Keep the aisle clear and subdivide curved window panels before projection.
  `train.ts` creates the single parked train at the southern station. Cabin announcements (`createTrainCabinGraphics`) face the boarding bays on the opposite wall above the seats, with matching bulkhead and overhead boards: “Step into the future,” science one way with double-triangle arrowheads, art/geometry the opposite way. They add no colliders, never cover window holes, stay clickable via `researchPanels`, and open the science/GlucoseDAO or art/pieces page directly on click. Keep ads flush with walls and bulkheads. Station signs and collection stands have separate, correctly oriented reverse faces. Keep the amber material settings distinct when switching
  visual quality. The amber is a closed, lobed volume with a recessed resin core on desktop;
  do not flatten it into a canopy sheet. The silver entrance is a deep cylindrical shank
  with a narrow rolled lip and irregular holes through its curved sides. Do not replace
  it with a flat washer, evenly spaced face holes, or wire hoops. Clasp roots share its
  surface coordinates through `stationRingAnchor`.
  Keep the central foyer doorway and eastern side entrance open, with glass colliders only
  where panes are rendered. `createStationStructure` remains DOM-independent for Rapier tests.
  Sub-plan 28: the shank's base levels onto the platform as a pierced silver threshold (`stationRingGeometry(mobile, footed)`),
  never through the slab; ashlar coping, footings and a threshold stone dress the slab; benches are teak slats on cast-silver
  ring frames; the curtain wall east of the ring has framed bays, a kick plate and one top rail; the amber's columns are silver
  with a girdle bezel. Lamps, bins and the map panel come from `STATION_FITTINGS`, which contact shadows also read; the clock,
  departures board and map faces share one canvas atlas. Dev-only `?station=classic` restores the earlier station.
- **Railways pass through real mountain openings.** `station-layout.ts` shares the track extent,
  tunnel mouth/exit positions, bore clearance, and narrow extended walking corridor.
  `railway.ts` keeps geometry/collider creation DOM-independent and loads attributed local
  gravel and metal maps separately. Preserve both concrete maglev guideways, guidance beams,
  motor strips, maintenance ledges, and both far exits. RAILWAY.centerZ centers the shared bore;
  RAILWAY.tracks gives the two line centers. Keep mountain clipping and planting aligned. `mountains.ts` clips
  actual hillside triangles from the clearance volume; do not hide the railway with a black
  entrance plane. Dark Nut shells and bronze ornaments are new architecture inspired by the
  supplied photo, distinct from City Hall. Mobile omits railway normal maps and reduces
  shell/rib detail. Preserve railway clearance and full-passage physics tests.
- **Glucose Commons uses scientific source coordinates.** `glucose-pavilion.ts` lifts the A/B backbone of human insulin PDB 1TRZ above an open, walkable court. Preserve the uniformly scaled fold, three disulfides and separate GLC glucose identity. `data/molecules/` keeps attributed originals; `bun scripts/extract-molecules.mjs` rebuilds hashed compact data. `glucose-layout.ts` shares poster/planting clearance; architecture creation stays DOM-independent for Rapier tests. Research facts, chapter slides and source links belong in `game/research.ts`, separate from jewelry lore. The supplied Drive folder is the current glucose image/text source; direct extracts from Livia’s Romanian AI Days 2026 poster live under `public/images/research/` with provenance. Preserve source plots and offer full-size viewing; do not treat its unpublished benchmark claims as verified results. Each of the six posters opens a multi-slide dialog (←/→ or on-screen buttons). Only verified public tools and research workflows count as achievements. Keep the pavilion out of `CIVIC_LANDMARKS`, preserve old save IDs (`glucose-livia`, `glucose-format`, `glucose-service`, `glucose-game`, `glucose-models`, `glucose-molecule`), and keep source dialogs keyboard/touch accessible. Do not invent clinical outcomes.
- Space and the touch Jump button request one grounded jump in the fixed physics loop. Jumping clears gallery rails; falling has no damage. The river is wadeable: its bed is 2 m down, so `FALL_FLOOR` in `town-layout.ts` (the out-of-world reset) must stay below every walkable surface; `tests/river-wading.test.ts` crosses the channel. Keep the main navigation sound toggle labeled and visible on touch screens.
- **Physics is a kinematic capsule, not a rigid body.** `Physics.step(x, z, dt)` applies
  horizontal intent plus its own gravity accumulation, then Rapier's character controller
  resolves the movement. Autostep, snap-to-ground, and slope limits are configured once in
  the constructor; change them there rather than compensating in `main.ts`.
- **The loop is fixed-timestep.** `main.ts` accumulates real time and steps physics at
  1/60 s. Rendering is per animation frame. Anything time-dependent takes `dt` explicitly.
- **Modes drive the UI.** `Mode` is `'welcome' | 'walking' | 'map' | 'lore' | 'journal' |
  'paused' | 'gallery'`. `welcome` is the loading state; ready opens first person at SPAWN facing the city gate, without an entry gate. The static loading introduction precedes module loading; Town.create yields between construction stages and progress follows completed stages. Mode changes are the single place where input capture, the active camera, and
  DOM visibility all change together. Do not bypass them with ad-hoc DOM toggling.
  Keep the labeled First person / Map switch (M), journal, and menu usable across
  panels. Dialogs leave navigation accessible and make the scene inert; native control
  keys must not be consumed as movement. Map markers sit below map panels and navigation.
  All journal stories are readable from the start; reading records progress without
  requiring a landmark visit. Preserve existing save IDs.
  On touch and narrow screens, the nearby-story card starts folded and has an accessible
  toggle; desktop can fold it too. Keep the nearby title visible when folded and the story
  link reachable when expanded. The desktop controls strip also folds, while touch movement
  and Jump remain available. The top sound control is a compact labeled speaker button.
  The loading progress bar spans the viewport; larger introduction text and portrait must
  remain fully reachable by scrolling on short screens.
- **Mouse rotation requires a held left mouse button; Left/Right arrows also turn.** Never request pointer lock or turn on
  entering/resuming. A drag starts on the canvas, uses client-coordinate deltas on document
  pointer events, and checks `buttons & 1`. A/D strafe, W/S or Up/Down move forward/backward, and Left/Right turn
  through `Input.turn(dt)` in the fixed physics loop; none reset a held drag. Mouse capture loss is handled through document events, while release,
  cancellation, blur, and mode changes clear the appropriate inputs. Keep touch pointer IDs
  independent so looking and the thumbstick can work together.
- **The ministries' silver is data, not hand-drawn geometry.** `jewelry.ts` maps the strands in
  `src/world/strands/*.json` into hall space, clips doorway crossings and short fragments,
  and keeps silver out of inhabited walking space. Mitoring clips its basket; Nanot projects
  its facade outside the glazing and seats low strands at its base. Change
  the look through the architectural transforms and clipping rules, not by editing the JSON.
- **Nanot silver belongs outside its glazing.** Its source folds are projected after curve
  sampling, keeping every ribbon outside the glass. Continuous supporting ribs and rings
  reach the base; their returned geometry is also a world-space collider. Do not restore
  radial spokes through the inhabited glass hall. Preserve the extracted source JSON. The entrance arch is cast in the
  lattice's own silver, which `nanotCage` returns with the frame, not in the town masonry.
- **Jewelry collections have permanent homes.** `data/catalogue/selection.json` contains reviewed source facts; `scripts/build-catalogue.mjs` generates `game/jewelry-catalogue.json` and local WebP derivatives using offline Sharp tooling. City Hall/Energy/Science/station keep 8/8/9/7 physical works. Timeface has six and Future House has three; the catalogue has 41. The additional attributed archive manifest is `game/archive-catalogue.json`. Keep one physical assignment per work. `piece-stories.ts` overlays artist texts from https://livia.glucosedao.org/pieces and official Romanian Jewelry Week collection pages; do not invent a studio story when the public tab has none. Rotary Magnetic keeps the 2026 amber caption and does not mix the older tourmaline note. `planar-exhibition.ts` uses uncropped thumbnails, aspect-matched caption canvases and simple stand colliders; full images load only for inspection. Full thumbnails and captions (960 px wide on gpu, 640 on mobile and cpu; anisotropy 8/4/1) exist only for the two collections last approached within `POSTER_RANGE` (`PosterResidency`); every poster keeps a 96 px photo and 128 px caption for distance. Swap `material.map` on the existing materials with the same sampler setup, never new materials, so nothing rebuilds after load (`tests/poster-text.spec.ts` checks it through the dev-only `window.__posters()`); dev-only `?posters=all` keeps every collection resident. `poster-layout.ts` keeps the central axes and entrances clear. Do not restore rotating cylinders, pedestal tables or lore lecterns. Source facts and artist descriptions stay separate from Livistone fiction. Native in-hall controls remain hidden until keyboard focus; 1–4 give facts, collection, photo and place story. Failed photographs leave facts available.
- **All rail facilities belong to southern Embryo Station.** Keep one parked train and its platform at the placed station, with both main guideways at z = 79/85. There is no northern platform, duplicate train or garden rail loop. Preserve snapshot diagnostics (`zone: 'town'`, `journey: null`) and the save version. Garden access is by continuous walking paths.
- **Terrain is continuous, not a flat town inside a mountain ring.** `terrain.ts` owns the shared river banks, lake depression, woodland foothills and asymmetrical elongated ridges. `mountains.ts` renders the whole ground with meadow/rock blending and actual tunnel apertures. Ground cover uses local meadow/soil WebP maps (512 px reduced, 1024 px rich), with path wear and bank soil baked by `ground-cover.ts` into existing vertices. Preserve soil attributes when clipping tunnels. No extra terrain draw call or per-frame CPU work is needed; reduced detail skips the mountain normal map. Regenerate derivatives with `python3 scripts/build-ground-textures.py`; provenance is under `public/textures/ground/`. The two-metre near grid agrees with the terrain collider. Grade railway approaches and far exits; reserve full tree canopies and taper planting naturally up slopes. Distant ranges (sub-plan 26, gpu and mobile) stand only past the ±520 m tiles (`far-ranges.ts`, exactly zero inside the near box); `far-landscape.ts` stitches their rings to the tiles' exact edge. A second camera draws them and the sky first, from a small scene of their own (`OutputPipeline.render(camera, distant)`), with their own valley-mist and aerial fog (`DISTANT_DISPLAY`); the town's fog, far plane and draws are untouched, and the map sees the ranges on `FAR_LAYER`. Ridges over 10 m carry eroded gullies except at paths, entrances, rails and the Dark Nut portals (`tests/far-ranges.test.ts`). Dev-only `?ridges=classic` restores the rounds 1–2 landscape without ranges or distant pass.
- **Living Waters belongs to the town.** `living-waters-layout.ts` defines the lake at `(0, -110)`, asymmetrical water cells, 2.2 m nerve network and paths into the civic gardens. Use the shared `terrain.ts` ground and town Rapier world; never restore remote scene switching or a second terrain. Keep both pavilion entries, shallow-water escape and the dry Mycelium loop traversable in both quality tiers. Place mushrooms, reeds, lily pads and rain with seeded scatter and path clearance, not a modular lattice. The mushroom crowns use the actual Mycelium photographs: curled open silver folds around opal hearts, with branching stems, never fabric umbrellas. Also instance a lower shrub-scale ring population. Reserve every crown’s full radius from paths. Tall crowns and shrubs share six instanced batches (full and light crown, stem, opal): `MyceliumGrove` gives each mushroom full detail within 36 m per unit of crown scale and the light crown (every fold, about 2k triangles, flat-normal ribbon straps) beyond, hides it only beyond the walking full-fog distance outside the map, and repacks only when a level changes; do not give spatial cells their own meshes, which multiplies draws. `?grove=full|light` pins one level for review. The water eyes are `waterEyes()` (`lake-eyes.ts`), not the raw `WATER_EYES` cells: every cell a garden path comes near is outlined again as the cell less the ground within `EYE_PATH_MARGIN` (kerb plus a 0.3 m silver strip) of the merged paving, so stone lips never cross a path; a path across a cell splits it, and lily pads and lake plants use each cell's largest piece. Water eyes and their stone lips draw as merged meshes via `mergeStatic` after each part gave its collider; the garden's paving and kerbs are its share of the merged walking surface, each with its collider. Keep the names that `cpu-detail.ts` skips (`walking network`, `kerb`) and leave the water channel and pool unmerged. `gardenGround` (panels, the lake's silver rim, the opal basin and the rill with its banks) is all that keeps grass off the grove floor. The rill (`RILL`) runs west from the opal basin square across the Mycelium paths and passes under them through a culvert: each open run is a pipe that ends in a stone headwall just outside the kerb, so nothing lies on the paving; pipes, water and headwalls draw as one mesh each (the frame-budget test counts Living Waters' draws). Vittoria and Dewdrop garden stands present both jewels with local photographs from Livia’s archive, photograph and caption on both faces (one shared material each). The pavilion borrows Dewdrop’s silhouette, whose original stone is topaz, not aquamarine. Rain/drainage respects reduced motion; audio remains opt-in. Physical-device performance remains release work.
- **Photo clicking must not break looking.** A short scene press with no drag can raycast
  a planar photograph or caption. Activate on the native click after pointerup, so a
  synthesized touch click cannot hit a newly focused dialog button. Track its pointer independently from the joystick; cancelled gestures,
  long holds, and look drags must not open photos. Gallery arrows operate on photos,
  while walking arrows still turn. Keep visible buttons for zoom, fit, next/previous, and close.
  `clickTarget` in `main.ts` is the one test for what a click acts on (href, discovery or catalogue piece, not behind an occluder);
  mouse hover reuses it once per frame to show a hand cursor. Anything new that opens on click belongs in `researchPanels` or an exhibition so it gets the cue.
- **River gardens share one channel field.** `waterways.ts` owns the main river, both tributaries, garden bridge placements, and the silver hourglass tower site. `waterDistance` drives terrain, clipped water, and full-footprint planting clearance. `createGardenBridge` transforms both render meshes and every collider together. Keep the tower’s ground-level north–south passage open and its approach free of trees. Placeholder dome homes are removed; `HOME_SITES` is empty.
- **Water and its banks share their outline.** `terrainHeight` and the water/shore meshes use
  the same river centre and width variation. Match terrain colliders to the rendered bank;
  the river shader uses the baked sky environment and needs no extra reflection camera.
  `water-surface.ts` bakes `flow`, `along`/`across`, `depth` and `rock` from that same channel field and
  `riverRockSites`, and joins tributaries into the river without a seam. GPU and mobile water is
  transparent (no depth write, drawn first among transparent objects) and tagged `heroEnv`; CPU bakes
  depth colour into opaque vertex colours. Regenerate the ripple maps with `python3 scripts/build-water-textures.py`.
- **River rocks are one instanced draw.** `river-rocks.ts` blends four seeded shape variants per rock through relative
  instanced morph targets (gpu/mobile/cpu: 320/180/80 triangles); `rockMatrix` and `rockWeights` place both the render and
  `rockColliders`, one trimesh sampled from the same blended shape. `riverRockSites` (`stone.ts`) stays the single list for
  rocks, colliders and the water's `rock` foam; a few stream rocks lean with the bank and `seatedHeight` buries every
  underside in the ground, so none floats or overhangs the channel. Props on the ground use `terrainSurfaceHeight` /
  `terrainSurfaceNormal` (the triangulated two-metre grid), not the analytic `terrainHeight`; `layoutAllows` is planting
  clearance without the water band. Shore pebbles are one unshadowed mesh in `details` (map mode hides it, cpu has none),
  refilled like the forest from the 8 m cells within two cells of the camera, only when the camera crosses a cell. They lie
  in small drifts along the waterline, bedded below the ground (`PEBBLE_BED`), and never reach the grass (`tests/pebbles.test.ts`).
- **Shores are shaded on the GPU from the same channel field.** `channelDistance` in `shore-nodes.ts` mirrors `waterDistance`;
  keep the two in step (`tests/shore.test.ts` evaluates the node graph against it across the town). The ground's colour stage calls `shoreGround`: gravel from the sub-plan 03 shore scan (gpu, mobile),
  a ragged wet band up to 0.4 m above the water (glossy above it), dark silt under the river and, on gpu, caustics driven by
  `shoreTime`, which `Town.update` sets from game time so `?capture=1` freezes them. `rockShore` gives the node rock material
  moss from the `moss` attribute and the world normal, and a wet foot at the river; the cpu tier's Lambert copy keeps baked
  lichen instead. The lake material is `lakeWaterMaterial` in `water-material.ts`: the river's optics on an opaque sheet,
  `heroEnv`, no emission, so the outer lake stays subdued at night around the lit pavilion.
- **The Mitoring hall is not a sphere.** `createEnergyHall` builds an amber cup with a domed lid
  from `ENERGY_HALL` (`a`, `b` semi-axes, wall and dome heights, door angle); the basket strands
  below the rim are projected onto its outside, and the crown loops curl onto the lower roof.
  Structural cristae remain visible in map mode. `Landmark.stretch` in `content.ts` must match
  `a / 7.1` and `b / 7.1`, because tree clearing, garden rings, and the "inside a landmark" test in
  `main.ts` read it.
  `mitoring-materials.ts` owns its offline-baked cloud/roughness maps and distinct amber
  quality tag; generic glazing settings must not overwrite its absorption or night emission.
  Reduced amber uses single-pass partial transparency with refraction and clearcoat
  disabled. Silver cross-sections keep outward normals and UVs, and shoulder transforms
  ease smoothly onto the roof. Project every sampled silver span outside the amber with
  clearance for the full ribbon width; centreline-only checks let folds sink into the shell.
  Preserve both source strands and pedestrian clearance when refining the cast folds.
- **View switching preserves the player; map destinations deliberately relocate them.**
  Map / First person (M) and Start / Resume exploring preserve walking position and
  direction. Map labels and list entries use `Landmark.entrance` to arrive just outside
  a clear entrance, then enter walking mode. Embryo Station arrivals look toward the city
  gate (yaw 0); other halls still face inward. Keep these approaches aligned
  with geometry and colliders. All destinations use the already loaded town scene and physics world. Keep the large
  Start / Resume exploring button visible above the map list on desktop and touch screens.
- **Progress is local only.** `readProgress` / `writeProgress` use the
  `livistone-progress-v1` key and every access is wrapped so that blocked or damaged
  storage degrades to an empty-but-playable state. If the shape changes, bump the key and
  the `version` field together, and keep `parseProgress` rejecting unknown versions.

## Conventions to match

- **TypeScript is strict**, with `verbatimModuleSyntax` — import types with
  `import type { … }`. `bun run build` fails on any type error; treat it as the gate.
- **The code style is deliberately dense.** Geometry-building code packs related statements
  onto one line and keeps helpers local to their module. Match the surrounding file rather
  than reformatting it.
- **Comments explain why, not what.** Existing comments flag non-obvious intent (a wall ring
  leaving an opening, a mobile foliage reduction, a fallback that keeps exploration
  available). Do not narrate the obvious.
- **No new runtime dependencies without a reason.** Runtime deps are Three.js, Rapier and the CPU-only lazy meshoptimizer simplifier; EZ-Tree is a dev-time asset generator. Prefer generating geometry over adding a
  library.
- **Time of day is selectable.** `daylight.ts` resolves persistent Auto / Day / Night; Auto follows the local clock without requesting GPS. Cache each `createSky` result on first use and switch fog, reflections, emissions and light sources without rebuilding town meshes or moving the player. `night-lighting.ts` keeps depth-tested additive halos and a fixed pool of six/ten nearby point lights. Lake lighting concentrates on the central briolette; keep the outer lake subdued. Quality changes must preserve night emissions.
- **Contact shadows ground objects in one draw.** `contact-shadows.ts` builds a single multiply-blended `MeshBasicNodeMaterial` batch (shared 64 px `DataTexture`, no depth write, polygon offset, `renderOrder` -1) of soft footprints: crown-wide and trunk patches per tree, bank rocks, lamp posts, poster and stand feet, place signs, plinths and station benches, taken from the layouts that place them. The multiply scales linear light before the output pass; its `KEEP_DISPLAY` MRT leaves the ground's paper mask and range-fog factor untouched, so on the map and the cpu tier far decals fog with the ground, and walking on gpu and mobile `ContactShadowMaterial` fades the shade toward white by the aerial haze, so far patches do not darken it. Terrain patches reuse the rendered terrain's 2 m grid and diagonal, so they are coplanar with the ground; floor sites are flat quads at their floor height. Tree patches follow `forestCells` and stay out of the index until `Forest.onCells` reports their cell's trunks, never per frame. Keep tree patches inside their planting clearance and every patch off paths and water: rock patches reach past the silhouette by `rockHalo`, beyond their planting clearance but never over the water's outline, and every vertex carries its `waterDistance` (`water`), which the material fades out toward the waterline (`CONTACT_WATER_FADE`). The batch hides in map mode, where bare trunks would leave unexplained blots. `userData.keepGeometry` keeps `cpu-detail.ts` from simplifying it. `ground-cover.ts` bakes a `groundShade` terrain attribute (crowns, trunks, building walls; 1 = open sky) that the ground material reads as its `aoNode`, dimming only indirect light on Lambert and standard alike. Dev-only `?contact=off` leaves out both for review.
- **Sky, sun and haze share one source.** The day sky is a single-scattering atmosphere with ray-marched cumulus and the night graded stars, a Milky Way and the moon (sub-plan 26), baked once per phase; one gain (`SKY_GAIN`, from the CPU copy in `atmosphere.ts`) and a low haze band land its horizon exactly on `HORIZON_RADIANCE`, so change sky constants only with `tests/sky.test.ts`. Golden hour reuses it by changing only the sun direction. Dev-only `?sky=classic` restores the painted sky. `sky.ts` exports `SUN_DIR` / `MOON_DIR` (the light sits at its target + direction × `SUN_DISTANCE`, kept in `Game.sunDirection`), `SKY_EXPOSURE`, the displayed `HORIZON_HAZE` the output pass fogs toward and the pre-tone-mapped `HORIZON_RADIANCE` of the flat map background; do not hard-code fog colours. Sub-plan 21 (owner's choice: contrast a, Neutral): `LIGHT` in `main.ts` sets a stronger sun against a weaker sky fill (day sun 3.35, environment .6 × `PHYSICAL_DAY_FILL`, hemisphere .36; the moon likewise at the same overall level; `CPU_LIGHT` for the cpu tier), so shade is about a third darker than sunlit ground; emissions are untouched. Walking on gpu and mobile, `render/aerial.ts` is `scene.fogNode`: height-aware exponential haze in linear light toward the sky radiance along each view ray (the 64 px `haze` cube that `createSky` bakes without sun, moon or stars; it settles on the horizon colour up to about 2° and reaches the open sky by about 17°, because the distant ranges' valley mist stands behind low silhouettes), slightly blue with distance, complete at `GraphicsProfile.fog` (130 / 110 m). That one number is also the walk camera's far plane (the distant pass starts at 90% of it) and where trees (per tree, `forest.ts`) and grove crowns (`groveDetail`) are culled: nothing disappears before it is entirely haze. Its parameters are render-group uniforms, so walk/map/day/night switches never rebuild shaders; set the node once before compiling. The map, the cpu tier (42–130 m) and the distant ranges (`DISTANT_DISPLAY`, sub-plan 26) keep a range fog that the output pass mixes toward `HORIZON_HAZE` after tone mapping. Display materials fog themselves toward the displayed sky; additive halos take the air's transmittance instead of fog; ambient occlusion keeps only the clear share. In r186 a material without its own `envMap` gets `scene.environmentIntensity` instead of its `envMapIntensity`, so tag materials whose reflection strength matters with `userData.heroEnv = true`; `main.ts` points them at the current sky after load and on day/night switches (CPU keeps its Lambert re-pointing).
- **Reflection probes (sub-plan 07).** `probes.ts` bakes one cube per building-piece exterior (its envelope above 0.6 m
  hidden) and per hall interior plus the concourse, after loading and lazily on the first switch to the other phase: gpu
  256/128 px (exterior/interior), mobile 128/64, none on cpu. Faces render through the output pipeline's own target layout
  and MRT, so every compiled shader is reused (they go through `renderer.render`, never the output pass, so GTAO and bloom
  stay out); the town fogs itself with the walking aerial haze as seen from each probe (`setFog(true)`, even under the loading
  map), the copy turns display pixels back into radiance through the Neutral inverse (`untoneMapped`), and exterior faces draw
  the distant ranges' scene first, as the walking view's distant pass does. Photographs,
  captions, near details and night halos stay out (they would upload or build during loading). A site's materials share one `pmremTexture` node as `envNode` (a phase switch swaps its texture,
  no rebuild), keep an `envMap` so their own `envMapIntensity` applies (non-heroEnv ones get the scene fill per phase), and
  add the probe to `customProgramCacheKey`: three reduces node-valued properties to `{}`, so alike materials would share one
  build and its probe. Materials shared with other buildings are copied per probe before `NightLighting` collects emissive
  materials; `pointReflections` skips probe materials; `Town.probeScopes()` lists each site's parts. Dev-only `?probes=off`.
- **Graphics has three device profiles.** `graphics.ts` selects GPU, mobile/typical integrated graphics, or CPU software rendering (a software WebGPU adapter renders through the WebGL 2 backend). Profiles cover raster and sky resolution, foliage range, the walking full-fog distance (`fog`), lighting, architecture and screen-space post (`post`, gpu only). CPU uses `cpu-detail.ts` to reduce visual geometry with locked boundaries and batch static opaque architecture, preserving collision geometry and parent visibility. CPU disables shadows and rain, retaining night emission and a bounded light pool. Test profile overrides do not prove actual device performance.
- **Rendering is WebGPURenderer with TSL.** `three` resolves to `three/webgpu` (Vite and Vitest alias, `tsconfig.json` paths; Playwright reads `tsconfig.playwright.json`). Shaders exist once, in TSL: never add GLSL or `onBeforeCompile`. The scene renders at top level into `OutputPipeline`'s half-float target, whose 8-bit `display` attachment carries a paper/sign mask (`displayMaterial()`), each surface's fog factor and, in blue, how far ambient occlusion reaches it (0 for display and transparent materials; `userData.occlusion` lowers it, as the near grass does); the output pass applies Khronos PBR Neutral (`render/tone.ts`; its gain 1.403 shows 18% grey as the classic ACES fit did; ACES and AgX were compared and dropped in sub-plan 21), sRGB and the range fog, as classic did after encoding. `render/post.ts` (sub-plan 18) adds GTAO and a capped bloom before tone mapping: one pass copies a half-resolution depth and depth-rebuilt normals out of the multisampled scene depth, GTAO and its denoise run at half resolution on the walk camera only (the map and Gentle detail skip them), and bloom takes exposed radiance above 1.2 for every camera. Both skip display pixels; the occlusion fades with the range-fog factor and, walking, with the aerial haze. Bloom thresholds the plain exposure, not Neutral's gain. The gpu tier runs them (`GraphicsProfile.post`), mobile and cpu do not; dev-only `?post=off|ao|gi` (gi = the noisy SSGI experiment). Additive sprites keep the mask with `KEEP_DISPLAY`; night halos add their displayed colour to what lies behind them. Uniforms that reach every material from outside it (fog range, shadow fade) belong in `renderGroup`: r186 refreshes only shared groups for materials without node properties. On WebGPU each InstancedMesh costs its own TSL build, so prefer few instanced meshes; forest and planting refill one mesh per species, part and detail. Everything that can appear must exist at load: `OutputPipeline.compile` builds the town (double-sided transmissive materials one side at a time) while `warmUp` keeps every instance drawable. Transmissive surfaces draw before transparent ones, as in classic. Shadowless lights go through `TownLighting`, which keeps image-based light and pins the light class names minification would change.
- **Plain architecture wears generated maps.** `surfaces.ts` puts the ashlar on the town white (bridges, hall rims) and gateway abutments, terrazzo on the hall floor insets, and brass on the town gold, poster stands and place-sign frames (tarnish only). Each albedo averages the flat colour it replaces and the material colour is that colour over the set's mean (`SURFACE_SETS`, kept equal to `sources.json` by `tests/surfaces.test.ts`), so the palette holds. Masonry uses an object-space triplanar with v up on every side face (three's `triplanarTexture` would stand courses on end); any new mesh with the masonry material needs `bakeMasonry()`, which adds the cpu UVs and the `surfaceClearance` that drives the weathering. gpu reads albedo, normal and roughness, mobile albedo and roughness, cpu only the stone albedo through the Lambert copy. Brass is `userData.objectSpace`: `mergeStatic` bakes each merged part's own position, normal and rotation (`surfacePosition`, `surfaceNormal`, `surfaceRotation`), so the brushing follows every poster foot as it did unmerged; the triplanar picks them per vertex layout. Share these materials rather than making variants; dev-only `?surfaces=off` restores the flat colours.
- **Frame budget (sub-plan 25).** `render-scale.ts` adapts resolution once a second: gpu holds 50 fps between scales 1 and 1.5, mobile 28 fps between .75 and 1, falling after 2 s short and recovering .05 every 4 s with 15% headroom; a scale that failed stays out of reach until headroom triples. The cpu tier keeps its .05-per-second fall to .3. `?capture=1` freezes the scale. The walk camera's far plane is the walking full-fog distance (`GraphicsProfile.fog`, sub-plan 21), so lengthening the fog lengthens the view. `terrainTiles` splits the ground into 25 culled tiles to 520 m (33 to 1.4 km on cpu and `?ridges=classic`) that keep every vertex attribute (soil, `groundShade`), the one ground material with its `aoNode` and shore layer, and the name `cpu-detail.ts` skips. Hall interiors and the station and Future House collections hide their meshes beyond `ROOM_RANGE` (never their lights, which WebGPU builds into shaders) and show during `Town.warmUp`. Poster boards, brass rails and feet merge per collection (two draws) without touching display materials. Distant trees draw branches without twigs through one view-only mesh; shadows and the map keep every branch. Flowers are one geometry coloured per instance by a `petal` mask, except on cpu. `?budget=off` restores the 150 m far plane, interiors and twigs for review; `snapshot().budget` (dev only) lists the last frame's draws by top-level town group.
- **Mobile is a first-class target, not a later port.** `Town` takes a `mobile` flag
  (coarse pointer, software GL, or a typical laptop iGPU — not a discrete card) and
  materials/foliage are already reduced for it. Walking hides far vegetation and thins
  mid-range foliage; the pause-menu visual-detail switch does not rebuild meshes. New
  heavy effects need a coarse-pointer path, and touch input must keep simultaneous
  move + look working.
- **Keep lore and invention separate.** Text in `DISCOVERIES` distinguishes Livia Lore
  source material from new Livistone fiction. Preserve that distinction, and do not turn
  the artifacts' fictional powers into health or efficacy claims.

- **Elevated galleries must remain walkable.** `elevated-layout.ts` owns the 2.5-turn Timeface route and Future House neck. Use the same sampled ribbon for rendering and mesh collision. The neck reaches cabin floor height before the hull threshold; do not reintroduce a floor lip. It runs straight in plan at one eased grade under 34° (the controller climbs 45°), `NECK_WIDTH` wide, and the map arrival faces straight up it; `tests/elevated.test.ts` walks a capsule holding forward from the lake path into the cabin. The middle leather strap springs from above the neck aperture, never through the doorway. The printed cabin has a curved lower hull beneath its flat floor. Keep the gallery under the high roof zone and run `tests/elevated.test.ts` after changing it. Match plant and terrain clearances to `futureClearing`. Copper appendages use closed, lumpy teardrop sections with rounded ends. `poster-layout.ts` carries optional elevated floor heights, and interaction targets must include that height. The dev teleport hook accepts an optional fourth height argument while preserving its existing three-argument behavior.
- **Presentation images remain original.** Glucose chapters combine the original Romanian AI Days poster with full slides from the supplied presentation folder. Keep provenance and page numbers in `public/images/research/ATTRIBUTION.md`; use `scripts/extend-archive.py` for derivatives. Treat the deck's team and research results as a dated source snapshot. Earlier-work archive images include photographs and original design renders; label them as studio archive images.
## Testing expectations

- Vitest covers pure logic that is cheap to assert: save parsing, and physics behaviour
  driven headlessly through Rapier (`tests/physics.test.ts` walks a capsule into a wall).
- Playwright drives the real game in Chrome through `window.__livistone`, which exposes
  `snapshot()` (mode, position, yaw, fps, draw calls, triangles, progress,
  `reducedGraphics`, `backend`: `webgpu` or `webgl2-fallback`, and `budget`, the last frame's draws by town group) and `teleport(x, z, yaw)`; the realism captures also call the additive dev-only `standingHeight(x, z)` (a capsule cast onto whatever lies under the view: ground, deck or floor) instead of a fixed y. **That hook is test infrastructure —
  keep it working and keep its shape stable**, including the mobile-viewport run with
  touch emulation.
- Browser tests launch headless Chrome with GPU flags and fall back to whatever Chrome
  provides (ANGLE D3D11 on Windows, native GL on Linux); `LIVISTONE_SOFTWARE_GL=1` forces SwiftShader, which can exceed the 120 s test
  budget on a loaded machine. Neither mode says anything about real GPU performance. On Linux the Playwright config and the
  capture harness add `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-low-power` (only
  the integrated GPU presents headless). `LIVISTONE_BACKEND=webgl` runs the specs on the WebGL 2 fallback;
  `LIVISTONE_PARAMS=backend=webgl` captures it. Run both after changing materials or the render path.
- After changing anything in `src/`, run `bun run build` and `bun run test`. Run
  `bun run test:browser` for changes to input, modes, interaction, world layout, or the UI.
- Realism work follows `docs/realism/README.md`: one sub-plan per `realism/NN-slug` branch, with before/after captures for desktop, touch and software. New scripts are TypeScript run with `bun scripts/<name>.ts`; `tsconfig.json` type-checks `scripts/**/*.ts`.
- `node scripts/screenshot-landmarks.mjs` is the quickest visual check after touching
  `world.ts` or `jewelry.ts`; it renders on the GPU when one is available. Look at the images.
- Screenshots land in `output/testing/`; failure traces in `test-results/`. Both are
  git-ignored — do not commit them, `dist/`, or `node_modules/`.

## Gotchas

- Rapier ships as `@dimforge/rapier3d-compat` with embedded WASM; its lazily-loaded chunk is
  ~1.1 MB and Vite warns about it. The main chunk (~1.7 MB, ~560 kB gzip with WebGPURenderer's node
  system) is over the limit too. Both warnings are known and accepted for the prototype.
- Port 5173 is fixed (`strictPort`) so the README, Playwright, and the tree generator all
  agree. If it is taken, reuse or stop that server instead of changing the port.
- The tree generator needs the dev server plus real Google Chrome; it writes into
  `public/models/trees/`. Regenerating changes committed binaries — say so in the commit.
- On the cpu tier the walking eye leads the capsule axis by 2 mm (`EYE_LEAD` in `main.ts`): SwiftShader smeared a terrain
  vertex lying on the camera plane (standing exactly over a grid vertex, as whole-metre teleports do) into a flat near
  triangle. Keep that lead if you move the camera.
- Interiors are hidden by occluder geometry, not by physics. Moving a landmark means moving
  its occluders and colliders too.
- Fonts load from Google Fonts with local fallbacks; the game must stay usable offline.
- The STL files in `data/models/` are jewelry with 1–2 million triangles each. They never load in
  the browser. Their extracted JSON strands survived the recovery, but the historical
  `scripts/derive-strands.mjs` did not; do not document a working regeneration command until
  that tool is restored and verified. Preserve the source JSON. Tooling here is Bun/Node.
- Browser tests forbid pointer-lock requests and compare identical drags across movement
  keys. Separately check Left/Right turning, A/D strafing, keyboard turning during a held
  drag, and unpressed mouse movement after release.

## Documentation duties

When behaviour changes, update the docs in the same commit:

- **README.md** — anything a player or a newcomer running the project would notice:
  controls, commands, what is playable, requirements.
- **docs/3d-game-plan.md** — scope, milestones, and technology decisions. Its opening status
  paragraph states what the prototype actually implements; keep it honest.
- **AGENTS.md / CLAUDE.md** — conventions, invariants, and commands (this file).
- **concepts/** is a record of what was generated and approved. Add to it; do not rewrite
  its history.

Do not claim a milestone is met that has not been verified. If something is untested — for
example physical-device performance or Safari/iOS — say so plainly.

## Keeping the agent docs in sync

`AGENTS.md` and `CLAUDE.md` must be byte-identical. [scripts/sync-agent-docs.sh](scripts/sync-agent-docs.sh)
enforces it and [.githooks/pre-commit](.githooks/pre-commit) runs it before every commit:

- Only one of the two changed → it is copied over the other, and both are staged.
- Only one exists → it is copied to create the other.
- Both changed with different content → **the commit is rejected.** Make your edit in one
  file, run `bun run docs:sync`, and commit again.

Install the hooks once per clone with `bun run hooks:install` (`bun install` also runs it
via the `prepare` script). It sets `core.hooksPath` to the version-controlled `.githooks`
directory, so the hook travels with the repository.

## Commit and collaboration

- Commit or push only when asked. `main` is the default branch.
- Keep unrelated formatting churn out of diffs; this codebase is small and readable.
- Concept images, the design brief, and the interview decisions recorded in
  `docs/3d-game-plan.md` are the approved direction — check them before redesigning the
  town's look, its civic identities, or its landmark roles.

## Enhancement hill and route numbering

- `enhancement-layout.ts` owns the faceted hill surface and sampling; `enhancement.ts` uses that exact mesh for display and collision. Preserve direct slope access; do not add a compulsory ramp. The indexed STL source is kept unchanged; never fill holes or smooth its Voronoi cells to make navigation easier. Climbing assistance applies only while moving toward an actual tagged hill face. Original provenance is in `docs/enhancement-reference.md`.
- The summit sign links to enhancement.bio and has a journal story with the same source. Keep research/bioart descriptions distinct from clinical claims. Future supplied stone STLs can replace the small procedural foot lights without changing access.
- `LANDMARKS` order is the visitor route from southern Embryo Station toward the northern hill, never insertion recency. The map tells visitors every stop comes from an existing work or project.
- The monument font must contain every glyph in both LIVISTONE and FUTURE HOUSE, including a real space. Future House letters sit above the leather straps and face the lake approach.
- Timeface poster corners and feet remain entirely inside the inner guard rail, toward the core, clear of the walking lane.
- Radio defaults on at the owner’s request; browser autoplay restrictions defer playback to the first gesture. Use one HTMLAudioElement for the six owner-approved phone kalimba clips, pause when muted/hidden, and load one local Git LFS asset at a time. Never include rejected clip 7. Keep the informal phone-recording credit visible in the menu.

- The hill is satin violet, one tone per coplanar facet, after the project's rendered and printed crystals; do not return to terracotta, which read as rust. A single row (`GALLERY`, z = -160) alternates six photo posters with six gene-category stands; keep its gaps walkable and it clear of paths, the climb line and overhangs (`tests/enhancement.test.ts`). Posters, labels and emblems carry `href` to enhancement.bio. The join sign (`ENHANCEMENT_SIGN`) stands beside the start of the marked climb, never on it. Stand crystals are real pipeline outputs from `data/enhancement/crystals/` (every triangle kept, flat side down, 10× STL mm) and load as their own chunk; never substitute procedural shapes. Photo originals stay outside the repo; keep `public/images/enhancement/ATTRIBUTION.md` and `sources.json` current, label memes as AI-assisted and do not name visitors.
- Enhancement retains the source Voronoi shell outside one approved internal shaft. Keep the cave spiral connected and the base panel small. The summit human uses the CC0 MakeHuman body surface in `enhancement-human.json`; preserve continuous anatomy and chest-scale copper geometry. Five smaller roadside mycelium trees taper toward the hill without obstructing its entrances. Grass covers the clearing: `enhancementGround` (the convex hull of the shell's plan with its cave, the cave walk, the display row strip, the sign posts and the climb's ground lamps) is what stays bare.

- Photo exhibition boards and jewel stands share cream paper (`#f4f0e5`) across backing, margins, and captions. Use `displayMaterial()` (unlit, outside tone mapping, ambient occlusion and bloom) so the paper stays consistent at night (`tests/post.spec.ts`). `build-catalogue.mjs` bakes white studio sweeps to that paper (`scripts/paper-background.mjs`; grey, dark and scenic backgrounds are kept) and `paperPhotoMaterial()` keys colours within three levels of it to exact `#f4f0e5`, since lossy WebP cannot store it; never multiply a photograph by the paper colour again. The paper sits in a thin bevelled brass rail on a lit board (`POSTER_BOARD`), neither carrying the display mask; captions bake a subtle picture-light pool whose top row stays exact paper.
- Building and place story signs (Embryo Station story, Mycelium grove, Enhancement join sign) use `place-sign.ts` so they are never mistaken for piece posters: a larger 3.5 × 2.5 m board, dark face in Livia's site style (warm near-black, letter-spaced serif capitals, amber-to-green rule) inside a pierced cast-gold lattice frame, lettered on both faces and clickable. Geometry and colliders are DOM-independent; `paintPlaceSign` draws the face. New place signs use the same component.

- Town and garden roads share the 2.6 m path width, 0.13 m surface elevation and world-aligned paving; their junctions are filleted unions of one field, not round joints. Keep the Glucose rear connection direct (38,-49 to 38,-52), with no redundant north spur.

- The introduction poster uses `introduction-layout.ts` for full planting clearance, matching scaled colliders and clickable faces. Its creator story is available in the journal.

- Poster body text uses `poster-text.ts` to fit the largest readable type into the space above footers; preserve all source text. The loading portrait is the unchanged local homepage artwork, with provenance under `public/images/about/`.

- `game/nearby.ts` maps architecture to source-backed one-sentence stories. The ring gateway takes precedence at the arrival approach; close displays take precedence over buildings. Both the nearby card and desktop E control are real buttons, and keyboard E falls back to the nearby story without requiring precise aim. Keep lore explicitly labelled.

Open grass areas have broad rolling contours, reaching roughly 1–2.5 metres where space allows, with a subdued spring-green palette. `meadow-relief.ts` bakes a clearance distance field once and tapers the contours around paths, buildings and other authored clearances, including a 2.5-metre interpolation margin. The existing terrain mesh and Rapier surface share these heights; plants follow the same field. Contours add no triangles or draw calls.

## City Hall facade

`world/city-hall.ts` owns the DOM-independent Nut of Power facade and ornamental colliders. Preserve the doorway, source photo attribution and separate `cityHallCrystal` quality tag. The crystal turns smoky toward its outline and with distance, and its outline mirrors less of the baked sky (`crystalLook`, front faces only, so the view from inside stays clear): as plain glass it vanished against the sky and the hall looked cut in half. `cpu-detail.ts` keeps those nodes on its Lambert copy. `world/walnut.ts` loads offline maps; reduced detail omits normals. Regenerate maps with `python3 scripts/build-city-hall-textures.py`. `scripts/screenshot-city-hall.mjs [outDir] [desktop|touch|software]` accepts `LIVISTONE_BENCHMARK_URL` for an isolated preview; touch emulation is not a physical-device benchmark.
