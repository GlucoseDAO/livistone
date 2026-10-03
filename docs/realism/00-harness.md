# 00 — Before/after harness

**Needs:** nothing. **Tiers:** all. **Branch:** `realism/00-harness`.
See [README](README.md) for the shared workflow. This sub-plan creates the tools every later sub-plan uses.

## Goal

1. One command captures fixed, reproducible screenshots and metrics for one device profile.
2. A second command builds a local review page comparing `before/` with `after/` (or `after-a/` and `after-b/`).

## Reuse

- `scripts/screenshot-city-hall.mjs` already provides most of the capture setup:
  - desktop, touch and software Chrome profiles, including `--use-angle=swiftshader` for real software rendering
  - a hidden HUD (`#app > :not(canvas)`)
  - `reducedMotion`
  - `LIVISTONE_BENCHMARK_URL`
  - the forced time-of-day key `livistone-time-of-day`
- `scripts/screenshot-landmarks.mjs` has the view table: `[name, x, z, yaw, pitch]`.
- `scripts/build-mitoring-comparison.mjs` and `output/testing/mitoring-pilot/index.html` show the existing pattern for a staged comparison page.

## Steps

0. Add `"scripts/**/*.ts"` to `include` in `tsconfig.json`, and fix any type errors this exposes in `scripts/tree-assets.ts`. New scripts are `.ts`, run with `bun`. The existing `.mjs` scripts stay as they are; do not churn them.
1. **New `scripts/screenshot-realism.ts <outDir> <desktop|touch|software> [viewSet] [day|golden|night]`.**
   - View sets:
     - `quick`: about 8 views, for the software profile
     - `exteriors`
     - `galleries`
     - `ground`: low eye height over the north meadow; standing view over the arrival meadow; a path edge close-up; a woodland edge
     - `water`: bridge-bank, east-tributary, a shore close-up at about 1 m above the water, west-tributary, Vittoria Lake, mycelium-grove
     - `all`
   - For each view: teleport through `window.__livistone.teleport`, set the pitch the way `screenshot-landmarks.mjs` does, wait for two frames, then save the screenshot.
     October 2026 (`fix/round-2-known-issues`): the teleport height is no longer a fixed y = 1.05. The harness asks the dev hook's `standingHeight(x, z)`, which casts the player capsule down from 2.2 m above the terrain, so every view stands on its ground, bridge deck or floor; `captures.json` records `teleport: 'standing'` (or `'fixed y 1.05'` against a server without the hook). The fixed height had sunk the capsule into raised meadow, so `north-meadow` is now a standing view, not a low one; low-eye ground captures use `LIVISTONE_PARAMS=eye=<metres>`, as 13's low-eye review did. See [round-2-leftovers.md](round-2-leftovers.md), section 2, item 7, for the views whose earlier baselines are not comparable.
   - Record `__livistone.snapshot()` per view: draw calls, triangles, fps, graphics tier and `reducedGraphics`. Write `captures.json` with the view list, git commit (`git rev-parse --short HEAD`), profile, time and Chrome version.
   - Collect page errors into the JSON. Treat any error as a failed capture.
2. **Reproducibility flag.** Add a dev/test-only URL flag, for example `?capture=1`, read only when `import.meta.env.DEV`. It:
   - freezes render scale (needed once 06 adds adaptive resolution)
   - freezes animation time at a constant `elapsed`, so water, rain and wind are identical between runs
   Expose its state in `snapshot()` only as an added field. Do not change existing fields.
3. **New `scripts/build-realism-comparison.ts <dir>`.**
   - Detect the `before/` folder and every `after*/` folder, each with profile subfolders.
   - Write `<dir>/index.html` with:
     - per-view before/after sliders
     - a variant picker
     - a profile switch
     - a metrics table showing draw calls and triangles with deltas, and fps marked "headless, informational"
   - It is a local file, not shipped with the game.
4. Add both commands to the CLAUDE.md command table and to `docs/technical-guide.md`.

## Acceptance

- Running before and after on unchanged `main` gives pixel-close images and identical draw-call and triangle counts.
- `bun run build` and `bun run test` pass.
- The software profile with `quick` finishes within the existing 120 s Playwright budget, or the script documents its own longer timeout.
