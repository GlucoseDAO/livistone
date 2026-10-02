# 20 — WebGPURenderer spike, with automatic WebGL2 fallback (experiment)

**Needs:** 00. Best done after 03 and 04 settle, because their shaders are the main porting work. **Tiers:** all. **Branch:** `realism/20-webgpu-spike`.
See [README](README.md) for the shared workflow.

## What r186 offers (checked in `node_modules/three/src/renderers/webgpu/WebGPURenderer.js`)

- `WebGPURenderer` (from `three/webgpu`) uses WebGPU when `navigator.gpu` provides an adapter. Otherwise it falls back automatically to its own `WebGLBackend`, which runs on WebGL 2.
- `forceWebGL: true` forces the fallback backend, so the fallback can be tested on a WebGPU-capable machine.
- Shaders are written once in TSL (three's node shading language) and compiled to WGSL or GLSL for whichever backend is active.

## Why it is not a drop-in switch here

- **Shader patches.** The node-material system does not run `onBeforeCompile`. Six modules rely on it or on `ShaderMaterial`: `mountains.ts` (terrain blend), `sky.ts` (sky bake), `river.ts`, `living-waters.ts` (lake), `stone.ts` (rock tint) and `cpu-detail.ts`. Sub-plans 03, 04, 13 and 17 add more. Every one must be ported to TSL node materials.
- **The fallback is not the classic renderer.** It is a different WebGL 2 implementation, with its own overhead and feature gaps (for example, compute shaders are WebGPU-only). The cpu tier on SwiftShader and old phones would run through it, which must be measured.
- **Other APIs move too.** Transmission, shadows, PMREM and post-processing use the node/`PostProcessing` APIs rather than `EffectComposer`.

## Spike scope (measure before deciding)

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

Until the owner decides, keep 03 and 04 shader logic in small, self-contained GLSL functions, so a later TSL port is mechanical.
