# 17 — Wind and foliage edges

**Needs:** 00. **Tiers:** gpu and mobile; off on cpu and under `prefers-reduced-motion`. **Branch:** `realism/17-wind`.
See [README](README.md) for the shared workflow.

## Current state

- Nothing sways; the only time-driven shaders are the water.
- Trees are EZ-Tree GLBs with alpha-tested leaf cards at a 0.45 cutoff, double-sided, without alpha-to-coverage (`forest.ts`).
- MSAA is on only for fine pointers (`main.ts:79`).

## Steps

1. Share a `uWind` time uniform, updated once per frame.
2. Add height-scaled vertex sway through `onBeforeCompile` with a `customProgramCacheKey` to:
   - `forest.ts` foliage, with large slow motion plus leaf flutter
   - `planting.ts` grass, shrubs and flowers
   - the reeds in `living-waters.ts`
3. Use a per-instance phase from the instance matrix, so neighbouring plants do not move in lockstep.
4. Turn on `alphaToCoverage` for foliage when MSAA is on, for smoother leaf edges.
5. Give grass blades a base-to-tip colour gradient.
6. The harness `?capture=1` freezes wind time.

## Tests

- `tests/forest.test.ts`, `tests/cpu-detail.test.ts` (cpu has no wind patch).
- Specs: `tests/graphics-profile.spec.ts`.

## Views

`ground` and `exteriors`, desktop and touch. Frozen captures, plus a short screen recording for review.

## Acceptance

- Gentle, believable motion.
- No change on cpu.
- Reduced motion is respected.

## On WebGPU (round 2)

- Sway through `positionNode` on the foliage, shrub, grass and reed node materials. Take the per-instance phase from the instance matrix, and time from the game's wind uniform, never TSL's global `time`.
- `alphaToCoverage` needs MSAA, which `antialias` enables on fine pointers.
- Temporal AA (`TRAANode`) would smooth leaf edges further; consider it only if 25 leaves headroom.

## Outcome (round 2, `realism/17-wind`, 3 October 2026)

- **One clock, one gust field.** `wind.ts` keeps `windTime` (game time; frozen by `?capture=1`, still under reduced motion) and the gust noise the near grass field already used; its `windSway` output is unchanged, so the grass field moves exactly as before.
- **Trees** (`treeSway`): the whole crown leans and rocks with the gust at its trunk (about 2% of the tree's height per unit of lean, so a 12 m tree moves a few centimetres to about 0.3 m at the top), limbs bob on phases taken from the model-space position, and leaf cards flutter about 2 cm at roughly 1.5 Hz. Every term grows with height in the tree; bark and foliage share all but the flutter, so leaves stay on their twigs. The distant detail (thinned cards, twigless branches beyond 36 m) keeps only the crown's lean, where bob and flutter would span about a pixel. The GLB materials become node copies (as three's own conversion makes them) with the sway as `positionNode`; each detail was already its own instanced mesh and shader build, so the cheaper distant material adds none.
- **Shrubs, flowers, meadow tufts and lake reeds** (`plantSway`): the grass field's sway at the plant's root, growing with the square of the height above it; shrubs are stiffer and their leaves shiver about 1 cm. The tufts keep their sinking inside the grass field.
- **Per-instance phase from the instance matrix.** Each instanced kind carries a `windRoot` attribute (the instance matrix's translation and scale), refilled alongside the matrices whenever cells change; the phase is a hash of the root, so neighbours never move in step and nothing jumps when instances are repacked. Every view mesh has its own geometry for it (the mobile forest's two foliage meshes now share vertices under two geometries).
- **Shadows keep the rest pose.** The sun's shadow map is cached and re-baked only when visibility or the shadow box changes, so swaying casters would freeze a random pose into it and jump at each re-bake. Casters draw their rest pose instead (`castShadowPositionNode`); the leaves move through rest-pose shadows by at most a few centimetres to about 0.3 m at tree tops, mostly square to the sun's azimuth.
- **Foliage edges.** Leaf cards use alpha-to-coverage where the frame is multisampled (fine pointers; `FOREST_DETAIL.coverage`). three ramps coverage over the pixel above the cutoff, which visibly thinned every crown, so the ramp is centred on the 0.45 cutoff (`alphaTestNode`); crowns keep the alpha test's density with smoother edges. The shadow pass keeps the plain alpha test.
- **Grass gradient:** already present. The near grass field shades its blades dark at the base and lighter and drier toward the tips, and the tufts carry a base-to-tip vertex gradient; the overall grass colour is unchanged (owner decision pending, [round-2-leftovers](round-2-leftovers.md) 2.6).
- **Not swayed:** the lake's sculptural Untold/Spotlight leaves (`lake-plants.ts`, silver-green metal art, not plants), lily pads, and the silver mycelium grove.
- **Tiers:** gpu and mobile sway; the cpu tier keeps its materials and geometry exactly as before (no `windRoot`, no node copies). No draw calls or triangles are added. Dev switches: `?wind=off` (the town before this sub-plan) and `?wind=<seconds>` (pinned clock for stills).
- **Headless frame rate** (informational; one shared integrated GPU, other agents' captures running, dev server, `?capture=1` fixed render scale, desktop gpu tier on WebGPU; median of five 1 s samples, the cleanest interleaved pair): woodland-edge 15 → 13–14 fps, arrival-meadow 20 → 18, north-meadow 21 → 19–20, `?wind=off` against the branch. Contended runs scattered by more than that, and the WebGL 2 fallback (3–7 fps) showed no measurable difference. Physical devices are unmeasured.
- **Review:** `review/17-wind` (ground, desktop and touch) and `review/17-wind-exteriors` (desktop), plus `review/17-wind/wind.mp4`, a recording without `?capture=1`. Frozen stills change only by the static pose and the smoother leaf edges (1–8.5% of pixels by more than 20 levels), below the 15% gate: the change is motion, which only the recording shows.

