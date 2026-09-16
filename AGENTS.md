# Agent instructions for Livistone

> **This file and `CLAUDE.md` are two copies of one document.** Edit either one; a
> `pre-commit` hook copies your change over the other and stages it. Never let them
> drift on purpose, and never edit both in the same commit with different content —
> the hook will refuse the commit. See [Keeping the agent docs in sync](#keeping-the-agent-docs-in-sync).

Livistone is a browser-playable 3D town: a first-person walk through an art-and-science
fantasy settlement whose three civic buildings are inhabitable interpretations of Livia
Zaharia's jewelry (the Nut of Power, the Mitoring, and the Nanot of Power). Read
[README.md](README.md) for what the project is and [docs/3d-game-plan.md](docs/3d-game-plan.md)
for where it is going.

## What this project is, in one paragraph

A TypeScript + Vite single-page app. Three.js renders the town on WebGL 2; Rapier
(WebAssembly) provides a kinematic capsule character controller. There is no backend, no
API key, no database, and no account system — the entire game is static files plus
`localStorage`. Every building, tree placement, path, and piece of jewelry geometry in the
current build is generated in code at load time; the only binary assets are two tree GLBs.

## Commands

| Task | Command | Notes |
| --- | --- | --- |
| Install | `bun install --frozen-lockfile` | Bun is the package manager and dev server |
| Dev server | `bun run dev` | http://localhost:5173, `strictPort` is on |
| Type check + build | `bun run build` | `tsc --noEmit` then `vite build` into `dist/` |
| Preview the build | `bun run preview` | http://localhost:4173 |
| Unit tests | `bun run test` | Vitest, `tests/**/*.test.ts` — **not** `bun test` |
| Browser tests | `bun run test:browser` | Playwright, `tests/**/*.spec.ts`, real Chrome |
| Sync agent docs | `bun run docs:sync` | What the pre-commit hook runs |
| Install git hooks | `bun run hooks:install` | Sets `core.hooksPath` to `.githooks` |
| Regenerate tree GLBs | `bun scripts/generate-trees.mjs` | Needs the dev server running |

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
  game/
    content.ts       LANDMARKS, DISCOVERIES, SPAWN, progress parse/read/write
    physics.ts       Rapier world, collider specs, kinematic character controller
    input.ts         Keyboard, drag-to-look, and touch thumbstick input
    audio.ts         Procedural filtered-noise ambience via WebAudio
  world/
    world.ts         Town: terrain, river, paths, bridge, landmarks, interiors, homes,
                     gardens, hills; emits colliders, interactives, occluders, animated
    jewelry.ts       Cast-silver ribbon geometry for the Mitoring/Nanot cages
    forest.ts        Batched GLB tree instancing with a mobile foliage reduction
  ui/ui.ts           DOM overlay: HUD, map panel, lore panel, journal, pause menu
tests/               *.test.ts → Vitest, *.spec.ts → Playwright
scripts/             Tree asset generation, agent-doc sync
public/models/trees/ oak.glb, ash.glb + attribution and MIT licence
concepts/            Approved concept image, design brief, generation record, prompts
docs/3d-game-plan.md Technology decision, scope, milestones, acceptance criteria
.githooks/           Version-controlled git hooks
```

## How the pieces fit together

- **`Town` builds the world and hands out everything else.** Its constructor runs all the
  `create*` methods and fills four public arrays: `colliders` (fed to `Physics`),
  `interactives` (raycast targets for the E key), `occluders` (invisible boxes used to hide
  interiors until you are inside), and `animated` (objects the artifact interactions spin
  or pulse). If you add geometry that the player can walk into, you must push a matching
  `ColliderSpec` — the renderer and the physics world share no geometry automatically.
- **Physics is a kinematic capsule, not a rigid body.** `Physics.step(x, z, dt)` applies
  horizontal intent plus its own gravity accumulation, then Rapier's character controller
  resolves the movement. Autostep, snap-to-ground, and slope limits are configured once in
  the constructor; change them there rather than compensating in `main.ts`.
- **The loop is fixed-timestep.** `main.ts` accumulates real time and steps physics at
  1/60 s. Rendering is per animation frame. Anything time-dependent takes `dt` explicitly.
- **Modes drive the UI.** `Mode` is `'welcome' | 'walking' | 'map' | 'lore' | 'journal' |
  'paused'`. Mode changes are the single place where input capture, the active camera, and
  DOM visibility all change together. Do not bypass them with ad-hoc DOM toggling.
- **Map mode must not move the player.** It swaps to `mapCamera` with `OrbitControls`;
  returning restores the exact walking position. A browser test asserts this.
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
- **No new runtime dependencies without a reason.** Runtime deps are Three.js and Rapier
  only; EZ-Tree is a dev-time asset generator. Prefer generating geometry over adding a
  library.
- **Mobile is a first-class target, not a later port.** `Town` takes a `mobile` flag and
  materials/foliage are already reduced for it. New heavy effects need a coarse-pointer
  path, and touch input must keep simultaneous move + look working.
- **Keep lore and invention separate.** Text in `DISCOVERIES` distinguishes Livia Lore
  source material from new Livistone fiction. Preserve that distinction, and do not turn
  the artifacts' fictional powers into health or efficacy claims.

## Testing expectations

- Vitest covers pure logic that is cheap to assert: save parsing, and physics behaviour
  driven headlessly through Rapier (`tests/physics.test.ts` walks a capsule into a wall).
- Playwright drives the real game in Chrome through `window.__livistone`, which exposes
  `snapshot()` (mode, position, yaw, fps, draw calls, triangles, progress) and
  `teleport(x, z, yaw)`. **That hook is test infrastructure — keep it working and keep its
  shape stable**, including the mobile-viewport run with touch emulation.
- Browser tests run with software WebGL for reproducibility, so their frame rates say
  nothing about real GPU performance. Do not treat them as a performance benchmark.
- After changing anything in `src/`, run `bun run build` and `bun run test`. Run
  `bun run test:browser` for changes to input, modes, interaction, world layout, or the UI.
- Screenshots land in `output/testing/`; failure traces in `test-results/`. Both are
  git-ignored — do not commit them, `dist/`, or `node_modules/`.

## Gotchas

- Rapier ships as `@dimforge/rapier3d-compat` with embedded WASM; its lazily-loaded chunk is
  ~1.1 MB and Vite warns about it. That warning is known and accepted for the prototype.
- Port 5173 is fixed (`strictPort`) so the README, Playwright, and the tree generator all
  agree. If it is taken, reuse or stop that server instead of changing the port.
- The tree generator needs the dev server plus real Google Chrome; it writes into
  `public/models/trees/`. Regenerating changes committed binaries — say so in the commit.
- Interiors are hidden by occluder geometry, not by physics. Moving a landmark means moving
  its occluders and colliders too.
- Fonts load from Google Fonts with local fallbacks; the game must stay usable offline.

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
