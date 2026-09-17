# Livistone

A welcoming art-and-science fantasy town inspired by Livia Lore and Livia Zaharia's jewelry: smooth white sculptural architecture, fresh green trees, branching rivers and streams, and sheltered places for everyday life. Three artifacts from the lore become the town's civic buildings, and the Embryo Ring becomes a railway station. You can explore all four in a browser.

![Livistone: Mitoring Ministry of Energy at left, Nut of Power City Hall at center, and Nanot Ministry of Science at right, surrounded by green trees and white organic homes beside a river.](concepts/01-garden-town/images/01-town-overview.png)

| Artifact | Civic role | Architectural identity |
| --- | --- | --- |
| The Nut of Power | **City Hall** | A furrowed walnut half joined to smoky crystal, a dark seam, broad brass clasps and hexagonal fasteners |
| The Mitoring | **Ministry of Energy** | A long, low amber hall with visible folded inner membranes and the ring's silver loops curled over its roof; the shank becomes an entrance gateway |
| The Nanot of Power | **Ministry of Science** | The pendant's own lattice: struts radiating from the hub into angular folded strands, with dark inclusions and the bail on top |
| The Embryo Ring | **Railway station** | A pierced silver entrance ring, clasping prongs, and a thick sculpted amber cover over a glazed foyer, concourse, platform, and streamlined ultra-fast train |

The project has two halves: a **concept package** that fixed the visual direction, and a **playable prototype** that turns it into a browsable 3D town. Both live in this repository.

## Contents

- [Quick start](#quick-start) · [Controls](#controls) · [Build and verify](#build-and-verify)
- [Project structure](#project-structure) · [How the game is built](#how-the-game-is-built) · [Content model](#content-model) · [Asset pipeline](#asset-pipeline)
- [Testing](#testing) · [Agent and contributor docs](#agent-and-contributor-docs)
- [What is playable today](#what-is-playable-today) · [Roadmap](#roadmap)
- [Concept package](#concept-package) · [Credits and licensing](#credits-and-licensing)

## Quick start

**Bun** installs dependencies and runs the Vite development server. Bun 1.4.2 is pinned through `packageManager`; 1.3.14 or newer works, and `bun.lock` records dependency versions. The game runs entirely in the browser on TypeScript, Three.js/WebGL 2, and Rapier WebAssembly physics — no backend, API key, or database.

Install Bun on Linux/macOS if you do not have it ([official instructions](https://bun.com/docs/installation)):

```bash
curl -fsSL https://bun.com/install | bash
```

Open a new terminal, then:

```bash
bun --version
cd livistone
bun install --frozen-lockfile
bun run dev
```

If Bun is not found after installation, add it to your current shell:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Open **http://localhost:5173**. Keep the terminal running; Ctrl+C stops the server. Port 5173 is fixed so the browser tests and the documented URL agree; if it is already occupied, reuse the running Livistone server or stop that process first.

Use a current browser with WebGL 2 and hardware acceleration enabled. The first load initializes the physics engine; the **Enter Livistone** button becomes available when it is ready. Fonts load from Google Fonts, with local fallbacks if they are unavailable.

For a phone on the same Wi-Fi, use the **Network** URL that Vite prints, such as `http://192.168.x.x:5173`, and allow port 5173 through your local firewall if needed. The development server is for local use, not production hosting.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Forward / backward | W/S or ↑/↓; Shift to walk faster | Left thumbstick |
| Strafe left / right | A/D | Left thumbstick |
| Turn left / right | ←/→ | Drag the scene |
| Look | Hold the left mouse button and drag; release it to stop turning | Drag the scene with your other finger |
| Discover | Face a nearby display, then E | Tap the discovery prompt |
| Cylinder information / other pieces | 1 / 2 inside a hall, or cylinder labels | Tap the cylinder labels |
| Rotate / pause cylinder | [ / ] and P, or the curved labels | Tap the curved labels |
| Open a photograph | 3, click a curved photo, or Open photograph | Tap a photo or Open photograph |
| Inspect a photograph | Scroll or +/− to zoom; drag to pan; ←/→ photos; 0 fit; Esc close | Pinch or +/− to zoom; drag to pan; photo arrows; Fit image; Close |
| Aerial map | M or City map | Map icon in the top bar |
| Orbit / zoom map | Drag / scroll | Drag / pinch |
| Journal | Journal button | Book icon |
| Pause | Escape or menu | Menu icon |

Mouse rotation happens only while the left button is held on a drag begun in the scene. Left/Right arrows turn at a fixed rate; A/D strafe and W/S or Up/Down move forward/backward. Keyboard turning and mouse dragging work together without resetting one another. Entering, resuming, and moving an unpressed mouse do not turn the camera; the game never requests pointer lock. The map returns you to the same walking position. The menu offers visual detail, optional ambient sound, and a return-to-entrance action. Discoveries are saved locally in this browser; clearing site data resets them.

## Build and verify

```bash
bun run build
bun run preview
```

`bun run build` type-checks with `tsc --noEmit` before bundling, so a type error fails the build. The production build is written to `dist/` and previewed at **http://localhost:4173**. Deploy the contents of `dist/` to any static web host; the preview server is for local verification only.

Development tooling also needs **Node.js 22.12 or newer** on your `PATH` for the TypeScript, Vitest, and Playwright command-line tools (Node 23.11.0 was used here). Bun runs the actual Vite server and bundler.

Rapier currently uses its compatibility package with embedded WASM. Vite reports that lazy-loaded physics chunk as large — about 1.1 MB compressed — which is a known download cost for this prototype.

## Project structure

```
src/
  main.ts            Game loop, cameras, mode switching, interaction raycasting
  style.css          All UI styling
  game/
    content.ts       Landmarks, discoveries, spawn point, saved progress
    physics.ts       Rapier world and kinematic character controller
    input.ts         Keyboard, held-button drag-to-look mouse, and touch thumbstick input
    audio.ts         Procedural ambient sound
  world/
    world.ts         The whole town: terrain, river, paths, bridge, buildings, gardens
    jewelry.ts       Cast-silver ribbons built from the extracted jewelry strands
    walnut.ts        Procedural walnut relief, furrows, and material
    strands/         mitoring.json, nanot.json — wire centerlines derived from the STL models
    forest.ts        Batched tree instancing from GLB models
    landscape.ts     Shared path curves and planting-clearance rules
    station.ts       Embryo railway station, pierced entrance, glazed foyer, train and colliders
    station-amber.ts Closed amber body, procedural resin textures, and material
    station-ring.ts  Curved silver band with organic openwork and narrow rolled edges
    station-layout.ts Shared station footprint, tunnel and railway clearance
    railway.ts       Textured tracks, Dark Nut portals, lined mountain tunnels and colliders
    planting.ts      Instanced leafy shrubs, flowers, and grass blades
    bridge.ts        Masonry arch, paved deck, railings, and matching colliders
    gateway.ts       King's Chapel bridge gateway, cut green stone, silver lettering and colliders
    gateway-materials.ts Procedural silver, limestone and tourmaline materials
    gateway-layout.ts Shared gateway and arrival-path clearance
    stone.ts         Procedural limestone paving and textured river stones
    sky.ts           Baked daylight/cloud cubemap and reflection environment
    mountains.ts     Ridged terrain with triplanar rock textures and green foothills
    exhibition.ts    Rotating curved photo cylinders and adjacent light columns
    river.ts         Environment-lit water with downstream ripples
  ui/ui.ts           HUD, aerial map panel, lore panel, journal, pause menu
tests/               Vitest unit tests (*.test.ts) and Playwright browser tests (*.spec.ts)
scripts/             Tree asset generation, landmark screenshots, agent-doc sync
public/models/trees/ Generated oak and ash GLB models with attribution
data/models/         Livia's original jewelry STL files (git-ignored: 50–110 MB each), reference only
concepts/            Approved concept image, design brief, prompts, generation record, jewelry model notes
docs/                Implementation plan
.githooks/           Version-controlled git hooks
```

## How the game is built

**Rendering.** Three.js with `WebGLRenderer` on WebGL 2, a daylight skybox with layered clouds, matching sky reflections, and a directional sun with shadows. The sky is baked into a cubemap once at startup, with a smaller cubemap on mobile; it needs no remote sky assets. WebGPU is a later evaluation, not a current dependency.

**The town is generated in code.** `Town` in [src/world/world.ts](src/world/world.ts) builds the vertex-coloured terrain, a shader-animated river, garden paths, three masonry bridges, the three landmarks with their ground-floor interiors, a silver hourglass tower, dense planting, and surrounding hills. Building shells are parametric surfaces: furrowed walnut and smoky crystal joined by broad brass clasps for City Hall, an elongated amber hall with folded membranes for Mitoring, and a glazed hall inside Nanot's exterior supporting frame and angular lattice. Nanot's silver stays outside the glass; continuous ribs and connecting rings carry the facade down to its foundation. The supplied models survive as about 40 KB of extracted centerlines under `src/world/strands/`. [src/world/jewelry.ts](src/world/jewelry.ts) adapts those curves into bevelled silver ribbons, clears the doors and walking space, and merges each building's silver into one draw call. The Mitoring hall is 28 × 13.2 m and 8.4 m high; its folds remain visible in the aerial map. Mobile uses fewer curve samples.

**Gardens and arrival.** A raised white masonry arch carries the river bridge, with sculpted side ribs, a jointed limestone deck, and brass railings. The deck rises 2.35 m above its approaches. Narrower 2.6 m paths take gently winding routes to the civic doorways, and smaller paved aprons leave more room for grass. Paving uses a shared procedural colour and bump texture at a consistent scale. The same path curves reserve space for the full footprint of shrubs, flowers, grass, and nearby trees, keeping the approaches open. Shrubs use individual folded leaves, branching stems, and small blossoms; grass uses curved blade geometry over a textured meadow surface. Plants are instanced in spatial batches, with fewer shrubs and blades on mobile and fine grass hidden in map mode. Small, separated cream, pink, and lavender flower patches punctuate the grass rather than forming continuous borders. Irregular grey, lightly mossed river rocks reuse the mountain rock maps and have matching collision shapes; larger stones break the water surface along the banks. The plant meshes remain procedural assets. Surrounding mountain ridges use slope-dependent vegetation colouring and scanned CC0 rock textures, with lower mesh detail on mobile.

**Embryo Station.** Two northern garden paths lead around the civic district to a new railway station, adapted from the approved [Embryo concept](concepts/06-town-extension/images/01-embryo-station.png). Walk through a deep silver ring band and glazed foyer beneath a thick, lobed amber body held by rounded silver clasps and branching columns. The ring has narrow polished rims and irregular leaf- and triangle-shaped openings through its curved sides, matching the jewelry photograph. The resin has a glossy refractive surface, fine internal markings, and a recessed core; the entrance has warm light strips and a shallow upper gallery. Trees frame the approach so the ring is visible from the gardens. Benches, station signs, a tactile platform edge, and a parked streamlined ultra-fast train establish the arrival space. Platform screens and matching collision geometry separate the walking route from the railway. Find **Embryo Station** on the aerial map; discover its story at the panel beside the entrance. The train is a static architectural display; boarding, departures, and travel are not implemented. Mobile uses simpler amber and silver geometry, with opaque golden resin instead of refraction.

**Jewelry exhibitions.** The central sculptures and information lecterns have been replaced by rotating cylinders carrying curved, authentic studio photographs. The information cylinder carries an opaque curved text texture with the piece title, materials, dimensions, description, and clickable labels: **About this piece**, **Explore other pieces**, **About this place**, rotation, pause/resume, and a keyboard-accessible photo opener. Six pieces from Livia’s catalogue are available locally: Nut of Power, Mitoring, Nanot, Amberbow, Ammonite, and Beanut. Choosing one replaces the entire cylinder’s photographs and title in that hall; other halls keep their selection. The information cylinder rotates slowly alongside the photo cylinder, with shared pause/resume controls. Both cylinders have 35% larger diameters; photo proportions and display heights are preserved. The text texture’s aspect ratio matches its unwrapped arc width and height, so lettering is not stretched. The old pedestal tables are removed from every hall; their stories remain available through **About this place** on the information cylinder. The chooser links to the full website catalogue. Selections last for the current visit and do not change saved lore discoveries.

Click or tap a curved photo to unfold it into a flat viewer with zoom, pan, next/previous, fit, and close controls. Its proportions come from the source image dimensions; neither the curved panels nor the flat viewer crop or stretch the photograph. Rotation pauses while a dialog is open; reduced-motion preferences start cylinders paused. Twelve photographs ship locally, with attribution in `public/images/jewelry/`. Catalogue facts stay separate from fiction, and information for a newly selected piece uses its own title and facts.

**River gardens and time tower.** A winding main river meets two narrower tributaries along the western and eastern woodland edges. Three walkable masonry bridges connect the civic gardens and woodland paths, with matching deck and rail collisions. Water, terrain banks, and planting use shared channel boundaries. The white dome placeholder houses have been removed. Denser instanced oak and ash groves frame the town, with reduced density on mobile, and river stones now use cool grey mineral tones. A 27 m open silver hourglass tower stands northeast of City Hall, adapted from the supplied jewelry photograph with a narrow waist, looped strands, and flared crown. Its ground-level passage is open; it is a sculpture, with no clock or climbable interior.

**Water rendering.** The surface uses the daylight reflection environment, moving ripple normals, muted green water, shallow-edge colour variation, irregular bank widths, and narrow gravel shores. This is a lightweight visual water shader, not fluid simulation or a live planar reflection pass.

**Physics is separate from what you see.** `Town` emits a list of `ColliderSpec` values — boxes and trimeshes — that [src/game/physics.ts](src/game/physics.ts) loads into a Rapier world. The player is a kinematic capsule driven by Rapier's character controller, with autostep for stairs, snap-to-ground, and slope limits. New walkable or blocking geometry needs a matching collider; nothing is derived from the render meshes automatically.

**The loop is fixed-timestep.** [src/main.ts](src/main.ts) accumulates real time and steps physics at 1/60 s, so movement behaves the same on a 60 Hz and a 144 Hz display, while rendering happens per animation frame.

**Modes drive everything on screen.** `welcome`, `walking`, `map`, `lore`, `journal`, `gallery`, and `paused` each decide the active camera, whether input is captured, and which panels are visible. Aerial map mode swaps to an orbit camera over a simplified view of the town and restores your exact walking position when you return.

**Interiors** are hidden by invisible occluder geometry until you step inside, which keeps the town readable from outside and limits what is drawn.

**Mobile is a target from the start.** The build detects coarse pointers and reduces glass transmission, foliage density, and effect cost accordingly, and touch movement and look work simultaneously.

**Mountain railway.** Textured crushed-stone ballast, timber sleepers, fastening plates, and weathered rails continue east and west through the mountains. The dark Nut of Power photograph inspires thick charcoal tunnel shells with organic bronze clasps. Each tunnel has an open lined bore, support ribs, warm guide strips, maintenance ledges, and an exit beyond the ridge. The narrow rail corridor extends beyond the garden walking boundary. See [the railway design record](concepts/08-mountain-railway/notes.md) and [CC0 texture credits](public/textures/railway/ATTRIBUTION.md). The train remains static.

**Bridge gateway.** The King's Chapel Double Ring forms a walk-through entrance over the near end of the bridge, following [the approved concept](concepts/07-bridge-monument/images/08-kings-chapel-name-on-top.png). Paired open silver curves and fan-spoked ends hold a long green-to-yellow tourmaline prism, with raised **LIVISTONE** serif letters above it. Silver uses metallic sky reflections and a fine roughness texture; the closed gemstone has modeled step-cut facets, colour zoning, refraction and thickness on rich detail. Gentle detail keeps its cut and colour with an opaque reflective material. Porous limestone bases have separate colour and bump maps. The monument and its approach have matching collision geometry and planting clearance. Players start farther back on the paved approach to see the gateway. The local font outlines and licence are bundled under `src/world/fonts/` and `public/fonts/`.

## Content model

Landmarks and lore live in [src/game/content.ts](src/game/content.ts) as plain data: four `LANDMARKS` and seven `DISCOVERIES`, each tagged with the landmark it belongs to and, for two of them, a shortcut to pause or resume their hall’s photo cylinder. Discovery text keeps Livia Lore source material distinct from new Livistone fiction; the artifacts' powers are game fiction, not claims about the real jewelry.

Progress is stored in `localStorage` under `livistone-progress-v1`. Every read and write is defensive: damaged, blocked, or unknown-version storage degrades to an empty save rather than breaking exploration.

## Asset pipeline

Runtime assets include two tree models, twelve jewelry photographs, two mountain texture maps, and nine railway texture maps. The tree models in `public/models/trees/` are generated from [EZ-Tree](https://github.com/dgreenheck/ez-tree) presets with deterministic seeds and exported as GLB with embedded textures. To regenerate them, start the dev server and run:

```bash
bun scripts/generate-trees.mjs
```

This needs real Google Chrome and rewrites the committed GLBs. See [public/models/trees/ATTRIBUTION.md](public/models/trees/ATTRIBUTION.md) for the exact settings.

Livia's two original STL files are in `data/models/` and remain offline. The small extracted JSON centerlines are the runtime source assets. The earlier extraction script was missing from the recovered working tree; the current checkout does not provide a regeneration command. Preserve the JSON and original STLs. The recovery and architectural changes are recorded in [the design update](concepts/02-jewelry-models/recovery-and-refinement.md).

## Testing

```bash
bun run test          # Vitest unit tests
bun run test:browser  # Playwright browser tests in Google Chrome
```

Use `bun run test`, not `bun test` — these are Vitest tests. Unit tests cover save parsing, planting clearance, Nanot’s glass clearance, and headless Rapier walking behaviour, including the bridge deck and railings, the station ring entrance in both directions, the open side doorway and solid glass bays, walking along its platform, and its track barrier. Browser tests drive the real game, including a mobile viewport with touch emulation: entering the town, held-mouse looking while moving, arrow-key turning versus A/D strafing, stable entry orientation, pointer-capture loss, opening the menu, crossing into City Hall, opening the map and returning to the same position, persisting discoveries, and loading photographs and catalogue tables in all three halls, switching cylinder pieces independently, and opening and zooming photographs on desktop and touch layouts. Station browser checks cover entry, story discovery and persistence, the station map card, and touch layout.

For a visual review of the buildings, `node scripts/screenshot-landmarks.mjs` saves twenty-one views of the landmarks, jewelry galleries, light columns, bridge, gardens, and aerial map to `output/testing/landmarks/` (the dev server must be running). It launches headless Chrome with hardware WebGL flags; the reported frame rate is a local diagnostic, not a physical-device benchmark.

If Chrome is missing, install it or run `bunx playwright install chrome`. The tests start a development server automatically if one is not already running. Headless Chrome renders on the GPU when the machine has one; set `LIVISTONE_SOFTWARE_GL=1` to force SwiftShader instead, which is reproducible anywhere but slow enough on a busy machine that the 120 s test budget can run out. Neither mode measures real-device performance. Screenshots go to `output/testing/`; failure reports and traces to `test-results/`.

## Agent and contributor docs

[AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) are the working instructions for coding agents and new contributors: commands, repository map, architecture invariants, code conventions, testing expectations, and known gotchas.

The two files are **one document under two names** and are kept byte-identical. Edit either; a pre-commit hook copies the change over the other and stages it, and refuses the commit if both were edited with different content. Install the hook once per clone:

```bash
bun run hooks:install   # also run automatically by `bun install`
bun run docs:sync       # sync the two files by hand at any time
```

The hook lives in the version-controlled [.githooks/](.githooks/) directory, enabled through `core.hooksPath`.

## What is playable today

- Walk across an arched stone river bridge into leafy gardens, under a cloudy daylight sky, with clear paved approaches to the jewelry-inspired civic buildings.
- Arrive beneath the King's Chapel ring gateway and its raised LIVISTONE lettering.
- Enter the ground-floor interiors of **Nut of Power City Hall**, **Mitoring Ministry of Energy**, and **Nanot Ministry of Science**.
- View original jewelry photographs and catalogue information in each civic hall.
- Follow the northern garden paths to Embryo Station, walk through its silver ring, and explore the concourse and train platform.
- Discover seven lore entries, revisit them in the journal, and pause or resume the photo displays.
- Switch between first-person exploration and an orbitable 3D aerial map with landmark selection.
- Play with desktop controls or simultaneous touch movement and look.

## Roadmap

This is the first procedural prototype; the honest limits are:

- Buildings and vegetation are generated in code. Livia's STL models of the Mitoring and the Nanot are in `data/models/` (not committed because of their size); only their extracted wire centerlines (about 40 KB of JSON) ship, rebuilt as ribbons around procedural halls. The historical extraction settings are recorded in the model notes; the extraction script itself was not present in the recovered tree.
- Placeholder dome homes are removed; authored housing remains future work. Each civic building has one accessible floor.
- There are no NPCs, quests, or multiplayer, and no final production assets.
- Performance on physical phones, and Safari/iOS compatibility, still need device testing.

Next come multi-room interiors, authored GLB assets replacing procedural stand-ins, more of the town, and measured performance targets on real devices. [docs/3d-game-plan.md](docs/3d-game-plan.md) holds the technology decision, full scope, milestones, and acceptance criteria.

## Concept package

- [Design brief](concepts/01-garden-town/brief.md)
- [Generation record and source references](concepts/01-garden-town/generation.json)
- [Town overview prompt](concepts/01-garden-town/prompts/01-town-overview.txt)
- [City Hall close-up prompt](concepts/01-garden-town/prompts/02-city-hall.txt)
- [Ministry of Energy close-up prompt](concepts/01-garden-town/prompts/03-ministry-of-energy.txt)
- [Ministry of Science close-up prompt](concepts/01-garden-town/prompts/04-ministry-of-science.txt)
- [Town extension concepts](concepts/06-town-extension/notes.md): the approved Embryo Station and the Eye of Winter double-moon-gate direction
- [Jewelry model notes](concepts/02-jewelry-models/notes.md): what the STL files contain and how the buildings reinterpret them

The town overview above is the approved generated image. The three close-up prompts are prepared but their images have not been generated yet. The image is an artistic concept, not a settled masterplan or engineering design: it fixes the shared appearance and the individual landmark identities, while dimensions, topology, and building performance are design development work.

## Credits and licensing

Livistone is built on the Livia Lore artifacts and Livia Zaharia's jewelry; the concept and civic roles were agreed with the project owner and are recorded in [concepts/01-garden-town/brief.md](concepts/01-garden-town/brief.md) and [docs/3d-game-plan.md](docs/3d-game-plan.md).

The oak and ash tree models are generated from Daniel Greenheck's EZ-Tree 1.1.0 (MIT), with the licence reproduced in [public/models/trees/LICENSE.txt](public/models/trees/LICENSE.txt). Runtime libraries are Three.js and Rapier; this repository is private and has no licence of its own yet.

Jewelry photographs and catalogue facts come from [Livia Zaharia’s Pieces catalogue](https://livia.glucosedao.org/pieces/), bundled from the website’s original studio archive. See [photo attribution](public/images/jewelry/ATTRIBUTION.md). Mountain rock maps are [Rock Face 03](https://polyhaven.com/a/rock_face_03) by Dario Barresi and Rico Cilliers, provided by Poly Haven under CC0; see [texture attribution](public/textures/mountains/ATTRIBUTION.md).
