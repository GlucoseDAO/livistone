# 20 — WebGPURenderer migration, with automatic WebGL2 fallback

**Needs:** 00, 03 and 04 (merged). **Tiers:** all. **Branch:** `realism/20-webgpu` (worktree `~/sources/livistone-realism/20-webgpu`, dev port 5185).
See [README](README.md) for the shared workflow and [NEXT.md](NEXT.md) for the round-2 rules.

Phase A (the spike) is done and measured; the owner approved the migration on 3 October 2026. **Phase B, at the end of this file, is the work.**

## Phase A result (3 October 2026, `0889b07` on `76104be`, pre-round-1 shaders)

Desktop day, `quick` views, dev laptop (Intel RPL-S iGPU, Linux, Chrome 154 headless; fps is informational, not a device benchmark):

| View | classic calls / triangles / fps | WebGPU | WebGPU's WebGL 2 fallback |
| --- | --- | --- | --- |
| arrival-meadow | 592 / 6.90M / 4 | 299 / 3.47M / 21 | 299 / 3.47M / 7 |
| city-hall-front | 823 / 6.40M / 6 | 416 / 3.21M / 18 | 416 / 3.21M / 15 |
| energy-front | 824 / 6.54M / 8 | 416 / 3.27M / 16 | 416 / 3.27M / 12 |
| bridge-bank | 592 / 3.62M / 6 | 303 / 1.83M / 19 | 303 / 1.83M / 11 |
| east-tributary | 1040 / 6.87M / 5 | 524 / 3.44M / 22 | 524 / 3.44M / 9 |
| meadow-ground | 537 / 6.51M / 6 | 271 / 3.26M / 22 | 271 / 3.26M / 7 |
| city-hall-gallery | 696 / 6.33M / 10 | 351 / 3.17M / 15 | 351 / 3.17M / 6 |
| vittoria-lake | 538 / 5.80M / 10 | 272 / 2.91M / 11 | 272 / 2.91M / 14 |

Calls and triangles halve on both WebGPURenderer backends: classic `WebGLRenderer` re-renders every opaque object into a transmission target whenever glass, amber or a gem (`transmission > 0`, six materials) is visible, while WebGPURenderer copies the frame instead.

## What r186 offers (checked in `node_modules/three/src/renderers/webgpu/WebGPURenderer.js`)

- `WebGPURenderer` (from `three/webgpu`) uses WebGPU when `navigator.gpu` provides an adapter. Otherwise it falls back automatically to its own `WebGLBackend`, which runs on WebGL 2.
- `forceWebGL: true` forces the fallback backend, so the fallback can be tested on a WebGPU-capable machine.
- Shaders are written once in TSL (three's node shading language) and compiled to WGSL or GLSL for whichever backend is active.

## Why it is not a drop-in switch here

- **Shader patches.** The node-material system does not run `onBeforeCompile`. Six modules rely on it or on `ShaderMaterial`: `mountains.ts` (terrain blend), `sky.ts` (sky bake), `river.ts`, `living-waters.ts` (lake), `stone.ts` (rock tint) and `cpu-detail.ts`. Sub-plans 03, 04, 13 and 17 add more. Every one must be ported to TSL node materials.
- **The fallback is not the classic renderer.** It is a different WebGL 2 implementation, with its own overhead and feature gaps (for example, compute shaders are WebGPU-only). The cpu tier on SwiftShader and old phones would run through it, which must be measured.
- **Other APIs move too.** Transmission, shadows, PMREM and post-processing use the node/`PostProcessing` APIs rather than `EffectComposer`.

## Phase A spike scope (done; kept for the record)

1. Add a dev-only `?renderer=webgpu|webgpu-gl|classic` switch in `main.ts`, defaulting to `classic`. Port just enough to load the town:
   - the sky as a TSL material
   - the terrain blend as a TSL node material
   - water as a TSL node material
   Everything else uses the auto-converted standard materials.
2. Capture all three renderers with the harness. Add a `LIVISTONE_RENDERER` environment variable that appends `?renderer=`. Run the desktop, touch and software profiles.
3. Compare:
   - visual parity, especially that the fallback matches classic
   - draw calls and triangles
   - headless frame time
   - load and compile time
   - SwiftShader behaviour
4. Write the result to `docs/3d-game-plan.md`. The owner then decides whether to migrate.

## What the decision unlocks

- GPU compute for the grass field (13), particles and wind on WebGPU devices.
- One TSL shader source for both backends.

## Phase B — migration (approved 3 October 2026)

**Decision.** WebGPURenderer becomes the only renderer: WebGPU where `navigator.gpu` gives an adapter, its built-in WebGL 2 backend everywhere else. Shaders exist once, in TSL. Classic `WebGLRenderer` and every GLSL patch are deleted at the end of Phase B, so later sub-plans never write a shader twice. Revisit only if the WebGL 2 fallback measures clearly worse than classic on the touch or software profiles; then record the numbers and ask the owner before deleting classic.

Facts checked in r186 source (3 October 2026):

- Rendering to the canvas always goes through a half-float target (4× MSAA with `antialias`), then one full-screen output pass tone-maps and converts to sRGB (`Renderer.js` `needsFrameBufferTarget`, `_renderOutput`). Nothing reads `material.toneMapped`.
- Fog is mixed into the linear colour in each material (`NodeMaterial.setupFog`), before that pass. Flat background colours are tone-mapped too (`Background.js`).
- `DirectRenderPipeline` tone-maps inside materials but does not support transmission and still ignores `toneMapped`; do not use it.
- `RenderPipeline` (`PostProcessing` is its deprecated alias), `pass`, `mrt`, `material.mrtNode`, `outputColorTransform`, `scene.fogNode`, `triplanarTexture`, `ao` (`three/addons/tsl/display/GTAONode.js`) and `bloom` exist.
- Per-frame draws are `info.render.drawCalls`; `info.render.calls` counts `render()` calls since startup.
- `LightShadow.autoUpdate` defaults to true and the renderer-level `shadowMap.autoUpdate = false` is ignored, so shadows re-render every frame unless each light is told (Phase A's `TownRenderer` does this).
- The node `PMREMGenerator.fromCubemap` throws before `await renderer.init()`.
- The env-map intensity rule matches classic (`MaterialProperties.js`), so the `heroEnv` tagging carries over.

What happens to today's colours, computed with three's own conversions:

| Colour | Classic | WebGPU without fixes |
| --- | --- | --- |
| Paper `#f4f0e5` | exact | `#dedcd9` day, `#d2d0cc` night |
| Place-sign board `#120f0c` | exact | `#030201` |
| Night haze `#0d1e35` | exact | `#000719` (the "dark hills at night") |
| Day haze `#d6dadc` | exact | `#d2d4d4` |

### B1. Make WebGPU the build

- `three` resolves to `three/webgpu` in Vite and Vitest unconditionally, so addons share one core. Drop the `LIVISTONE_RENDERER` switch; keep `src/render/` for renderer creation, stats and device loss.
- `await renderer.init()` before the sky bake and PMREM.
- Dev-only `?backend=webgl` forces the WebGL 2 backend. `snapshot().backend` (`webgpu` or `webgl2-fallback`) is an added field; `calls` and `triangles` report the last frame (`drawCalls`).
- Tier probe: the WebGPU adapter (Phase A `probeAdapter`), reading the WebGL renderer string for Intel and AMD through the `INTEGRATED` pattern from 22; a fallback adapter is the cpu tier.
- Static shadows through each light's `shadow.autoUpdate` / `needsUpdate`. Replace the WebGL-only shadow-map dispose on quality change (`main.ts:370`).

### B2. Port every GLSL patch to TSL

| Patch | Where | Tiers | Notes |
| --- | --- | --- | --- |
| Ground blend | `ground-material.ts:189`, applied in `mountains.ts:78`, Lambert copy in `cpu-detail.ts:23` | gpu, mobile, cpu | Largest port. Keep the `GROUND_GPU/MOBILE/CPU` variants as three node builders and both `?ground=a|b` looks. Explicit gradients via `.grad()`, `dFdx`/`dFdy`. Phase A's copy is obsolete (old blend, renamed textures). |
| River water | `water-material.ts:114` | gpu, mobile | Rebuilds colour from separate diffuse and specular light, so it needs a custom lighting model or output stage. Keep Beer–Lambert absorption, the alpha formula, Fresnel, foam, `renderOrder = -1`, `heroEnv` and both `?look=a|b`. `water-surface.ts` is geometry only. |
| Shadow fade | `shadow-fade.ts:14`, `main.ts:120,365` | gpu, mobile | No shared chunks in WebGPU: wrap the sun's shadow filter, or use a per-material received-shadow hook. |
| Sky bake | `sky.ts:30` | all | Phase A's TSL sky plus `darkGround`, `SUN_DIR`/`MOON_DIR`. |
| Rock tint, lake ripple, rain and drips | `stone.ts:71`, `living-waters.ts:34,98` | gpu, mobile | Phase A versions; the lake must keep `heroEnv`. Rain and drips need instanced sprites (WebGPU points are 1 px). |

Animate only with the game's own time uniforms (`userData.time`), never TSL's global `time`, so `?capture=1` freezes everything. `tests/water-material.test.ts` asserts GLSL text and must be rewritten to assert the node setup.

### B3. Output, fog and display colours

- **Output pipeline.** A `RenderPipeline` with `pass(scene, camera)` and `mrt({ output, display: float(0) })`. The 19 former `toneMapped:false` materials (paper, photos, captions, signs, train posters: `planar-exhibition.ts`, `gateway-poster.ts`, `living-waters.ts`, `enhancement-gallery.ts`, `place-sign.ts`, `train.ts`) set `mrtNode = mrt({ display: float(1) })`. The output node mixes the tone-mapped colour with the untouched colour by `display`, then converts to sRGB (`outputColorTransform = false`). Ambient occlusion and bloom (18) plug in here later and skip `display` pixels.
- **Fog.** Export the pre-tone-mapped `HORIZON_RADIANCE` per phase from `sky.ts` and use it for `scene.fog` and the flat map background, so full fog meets the tone-mapped sky exactly. Partial fog now blends in linear light, which is physically closer; record the mid-distance difference. Display materials keep classic fog: fog off on the material, mixed manually toward the display-space `HORIZON_HAZE` with the same near/far.
- **Halos** (`night-lighting.ts`) stay additive but are now tone-mapped; pre-compensate their tint so they match classic.
- Keep `tests/sky.test.ts` for `HORIZON_HAZE` and add the radiance values.

### B4. Fix found while planning

The quality toggle (`main.ts:376–381`) gives every untagged physical material transmission .45 and opacity .65, including the river water and the Future House glazing. Restrict it to the tagged materials.

### B5. Tests and harness

- `playwright.config.ts` adds, on Linux, `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-power-preference=force-low-power` (the Intel adapter presents headless; NVIDIA does not). `LIVISTONE_BACKEND=webgl` runs the same specs on the fallback. Shader-error console checks also match WGSL and WebGPU validation messages.
- Run the whole Playwright suite on both backends and assert `snapshot().backend`. Vitest runs with the alias.
- The capture harness uses the WebGPU flags by default; `LIVISTONE_PARAMS=backend=webgl` captures the fallback. The comparison page reads per-frame calls.

### B6. Parity gate

`before` = classic on `main` at the rebase point: desktop `all` day and night, touch `all` day, software `quick` day. Variants `after-webgpu` and `after-fallback`, same sets.

- Paper and sign pixels match classic within 2 levels, day and night (city-hall-gallery, catalogue-poster, station-arrival's welcome sign).
- The fully fogged horizon and far hills match within 3 levels; the night horizon is no longer dark; the map background matches.
- Median view: at most 3% of pixels change by more than 20 levels. Any view over 10% is explained (transmission blur, shadow filtering) and tuned when it is a regression, such as lighter glass.
- Night emissions, halos and shadows are present with the same contrast. No page or shader errors.
- A performance table per profile — calls, triangles, headless fps, time to ready, main chunk size — for classic, WebGPU and fallback, recorded in `docs/3d-game-plan.md`.

### B7. Remove classic and document

After the gate: delete the GLSL patches and the classic render module; update CLAUDE.md (TSL convention, test flags, the `backend` field), README (WebGPU with a WebGL 2 fallback), `docs/3d-game-plan.md` (technology decision and measurements) and `concepts/14-realism/` (record).

### Acceptance

- WebGPU and the fallback both pass the gate, and the production build uses WebGPURenderer.
- The software profile completes; its fps and load time are recorded against classic.
- The side-by-side review page `review/20-webgpu-b/` exists for the owner.
