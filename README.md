# Livistone

A welcoming art-and-science fantasy town inspired by Livia Lore and Livia Zaharia's jewelry: smooth white sculptural architecture, fresh green trees, a modest river, and sheltered places for everyday life. Three artifacts from the lore become the town's civic buildings, and you can walk into all of them in a browser.

![Livistone: Mitoring Ministry of Energy at left, Nut of Power City Hall at center, and Nanot Ministry of Science at right, surrounded by green trees and white organic homes beside a river.](concepts/01-garden-town/images/01-town-overview.png)

| Artifact | Civic role | Architectural identity |
| --- | --- | --- |
| The Nut of Power | **City Hall** | A furrowed walnut half joined to smoky crystal, a dark seam, broad brass clasps and hexagonal fasteners |
| The Mitoring | **Ministry of Energy** | A long, low amber hall with visible folded inner membranes and the ring's silver loops curled over its roof; the shank becomes an entrance gateway |
| The Nanot of Power | **Ministry of Science** | The pendant's own lattice: struts radiating from the hub into angular folded strands, with dark inclusions and the bail on top |

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
| Discover | Face a nearby artifact or plaque, then E | Tap the discovery prompt |
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
    planting.ts      Instanced leafy shrubs, flowers, and grass blades
    bridge.ts        Masonry arch, paved deck, railings, and matching colliders
    sky.ts           Baked daylight/cloud cubemap and reflection environment
    mountains.ts     Ridged terrain with triplanar rock textures and green foothills
    exhibition.ts    Framed real jewelry photographs and information lecterns
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

**The town is generated in code.** `Town` in [src/world/world.ts](src/world/world.ts) builds the vertex-coloured terrain, a shader-animated river, garden paths, the white river bridge, the three landmarks with their ground-floor interiors, homes, planting, and surrounding hills. Building shells are parametric surfaces: furrowed walnut and smoky crystal joined by broad brass clasps for City Hall, an elongated amber hall with folded membranes for Mitoring, and a glazed hall inside Nanot's exterior supporting frame and angular lattice. Nanot's silver stays outside the glass; continuous ribs and connecting rings carry the facade down to its foundation. The supplied models survive as about 40 KB of extracted centerlines under `src/world/strands/`. [src/world/jewelry.ts](src/world/jewelry.ts) adapts those curves into bevelled silver ribbons, clears the doors and walking space, and merges each building's silver into one draw call. The Mitoring hall is 28 × 13.2 m and 8.4 m high; its folds remain visible in the aerial map. Mobile uses fewer curve samples.

**Gardens and arrival.** A solid white masonry arch carries the river bridge, with a jointed stone deck and brass railings. Continuous curved paving reaches every civic doorway. The same path curves reserve space for the full footprint of shrubs, flowers, grass, and nearby trees, keeping the approaches open. Shrubs use individual folded leaves, branching stems, and small blossoms; grass uses curved blade geometry over a textured meadow surface. Plants are instanced in spatial batches, with fewer shrubs and blades on mobile and fine grass hidden in map mode. The plant meshes remain procedural assets. Surrounding mountain ridges use slope-dependent vegetation colouring and scanned CC0 rock textures, with lower mesh detail on mobile.

**Jewelry exhibitions.** Every civic hall has two framed, authentic studio photographs of its original jewelry and a freestanding information lectern. Face a display or lectern and press E (or tap the discovery prompt) to open photographs and a readable table of artist, object, materials, dimensions, and year, with a link to Livia’s catalogue. The six optimized photos are bundled locally, with attribution in `public/images/jewelry/`; the factual catalogue and fictional lore have separate headings.

**Physics is separate from what you see.** `Town` emits a list of `ColliderSpec` values — boxes and trimeshes — that [src/game/physics.ts](src/game/physics.ts) loads into a Rapier world. The player is a kinematic capsule driven by Rapier's character controller, with autostep for stairs, snap-to-ground, and slope limits. New walkable or blocking geometry needs a matching collider; nothing is derived from the render meshes automatically.

**The loop is fixed-timestep.** [src/main.ts](src/main.ts) accumulates real time and steps physics at 1/60 s, so movement behaves the same on a 60 Hz and a 144 Hz display, while rendering happens per animation frame.

**Modes drive everything on screen.** `welcome`, `walking`, `map`, `lore`, `journal`, and `paused` each decide the active camera, whether input is captured, and which panels are visible. Aerial map mode swaps to an orbit camera over a simplified view of the town and restores your exact walking position when you return.

**Interiors** are hidden by invisible occluder geometry until you step inside, which keeps the town readable from outside and limits what is drawn.

**Mobile is a target from the start.** The build detects coarse pointers and reduces glass transmission, foliage density, and effect cost accordingly, and touch movement and look work simultaneously.

## Content model

Landmarks and lore live in [src/game/content.ts](src/game/content.ts) as plain data: three `LANDMARKS` and six `DISCOVERIES`, each tagged with the landmark it belongs to and, for two of them, an artifact interaction to trigger. Discovery text keeps Livia Lore source material distinct from new Livistone fiction; the artifacts' powers are game fiction, not claims about the real jewelry.

Progress is stored in `localStorage` under `livistone-progress-v1`. Every read and write is defensive: damaged, blocked, or unknown-version storage degrades to an empty save rather than breaking exploration.

## Asset pipeline

Runtime assets include two tree models, six jewelry photographs, and two mountain texture maps. The tree models in `public/models/trees/` are generated from [EZ-Tree](https://github.com/dgreenheck/ez-tree) presets with deterministic seeds and exported as GLB with embedded textures. To regenerate them, start the dev server and run:

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

Use `bun run test`, not `bun test` — these are Vitest tests. Unit tests cover save parsing, planting clearance, Nanot’s glass clearance, and headless Rapier walking behaviour, including the bridge deck and railings. Browser tests drive the real game, including a mobile viewport with touch emulation: entering the town, held-mouse looking while moving, arrow-key turning versus A/D strafing, stable entry orientation, pointer-capture loss, opening the menu, crossing into City Hall, opening the map and returning to the same position, persisting discoveries, and loading photographs and catalogue tables in all three halls.

For a visual review of the buildings, `node scripts/screenshot-landmarks.mjs` saves nineteen views of the landmarks, jewelry galleries, information lectern, bridge, gardens, and aerial map to `output/testing/landmarks/` (the dev server must be running). It launches headless Chrome with hardware WebGL flags; the reported frame rate is a local diagnostic, not a physical-device benchmark.

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
- Enter the ground-floor interiors of **Nut of Power City Hall**, **Mitoring Ministry of Energy**, and **Nanot Ministry of Science**.
- View original jewelry photographs and catalogue information in each civic hall.
- Discover six lore entries, revisit them in the journal, and activate two artifact effects.
- Switch between first-person exploration and an orbitable 3D aerial map with landmark selection.
- Play with desktop controls or simultaneous touch movement and look.

## Roadmap

This is the first procedural prototype; the honest limits are:

- Buildings and vegetation are generated in code. Livia's STL models of the Mitoring and the Nanot are in `data/models/` (not committed because of their size); only their extracted wire centerlines (about 40 KB of JSON) ship, rebuilt as ribbons around procedural halls. The historical extraction settings are recorded in the model notes; the extraction script itself was not present in the recovered tree.
- Homes are exterior scenery, and each civic building has one accessible floor.
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
- [Jewelry model notes](concepts/02-jewelry-models/notes.md): what the STL files contain and how the buildings reinterpret them

The town overview above is the approved generated image. The three close-up prompts are prepared but their images have not been generated yet. The image is an artistic concept, not a settled masterplan or engineering design: it fixes the shared appearance and the individual landmark identities, while dimensions, topology, and building performance are design development work.

## Credits and licensing

Livistone is built on the Livia Lore artifacts and Livia Zaharia's jewelry; the concept and civic roles were agreed with the project owner and are recorded in [concepts/01-garden-town/brief.md](concepts/01-garden-town/brief.md) and [docs/3d-game-plan.md](docs/3d-game-plan.md).

The oak and ash tree models are generated from Daniel Greenheck's EZ-Tree 1.1.0 (MIT), with the licence reproduced in [public/models/trees/LICENSE.txt](public/models/trees/LICENSE.txt). Runtime libraries are Three.js and Rapier; this repository is private and has no licence of its own yet.

Jewelry photographs and catalogue facts come from [Livia Zaharia’s Pieces catalogue](https://livia.glucosedao.org/pieces/), bundled from the website’s original studio archive. See [photo attribution](public/images/jewelry/ATTRIBUTION.md). Mountain rock maps are [Rock Face 03](https://polyhaven.com/a/rock_face_03) by Dario Barresi and Rico Cilliers, provided by Poly Haven under CC0; see [texture attribution](public/textures/mountains/ATTRIBUTION.md).
