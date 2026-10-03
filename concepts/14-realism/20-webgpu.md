# 20 — WebGPU renderer — 3 October 2026

Sub-plan [20](../../docs/realism/20-webgpu-spike.md), Phase B, branch `realism/20-webgpu`. The owner approved the
migration after the Phase A spike. The game now renders with three r186's `WebGPURenderer`: WebGPU where Chrome offers a
hardware adapter, its built-in WebGL 2 backend everywhere else, including software adapters. Classic `WebGLRenderer` and
every GLSL patch are gone; shaders exist once, in TSL. The gate was parity with classic, not visible change.

## What changed in the code

- **One renderer** (`src/render/renderer.ts`). `three` resolves to `three/webgpu` in Vite and Vitest; addons share that core.
  `snapshot().backend` reports `webgpu` or `webgl2-fallback`; dev-only `?backend=webgl` forces the fallback.
- **TSL ports.** Ground blend, river water (its own lighting model), shadow fade (a wrapped PCF filter), sky bake, rock tint,
  lake ripples, rain and drips.
- **Output pass** (`src/render/output.ts`). The scene renders at top level into a half-float target with an 8-bit `display`
  attachment: red masks paper, photographs, captions and signs (`displayMaterial()`), green carries each surface's fog
  factor. One full-screen pass applies classic's ACES fit, encodes sRGB, then mixes the fog toward the displayed horizon,
  as classic fogged after encoding. Paper stays `#f4f0e5` by day and night.
- **Load time.** WebGPU builds one shader per instanced mesh, so forest and planting refill one mesh per species, part and
  detail from the cells in view (450 instanced meshes became 30). Shadowless lamps share one loop through r186's
  DynamicLighting (`src/render/lighting.ts`): the WGSL built at load fell from 47.5 MB to about 1.9 MB (134 modules). Everything is precompiled at load in
  parallel, with the scene rendered at top level so the precompiled shaders are the ones the frame uses.
- **Looks restored.** Seen from inside, classic showed the Mitoring amber and the Nut of Power crystal through a second
  layer of themselves (its transmission pass drew double-sided back faces first); `src/render/shell.ts` adds that layer
  back. Transmissive surfaces draw before transparent ones, as in classic, and night halos add their displayed colour to
  what lies behind them. The reduced amber's opacity is .92, because linear-light blending let the sky through more than
  classic's .76 did.
- **r186 pitfalls found.** Uniforms reaching plain materials from outside (fog range, shadow fade) refresh only in a shared
  group (`renderGroup`); compileAsync built two-pass transmissive glass after restoring `DoubleSide`, so it is precompiled
  one side at a time; DynamicLighting dropped the sky's image-based light and relies on light class names that
  minification changes.
- **Reduced glass.** Transparent surfaces now blend in linear light before tone mapping. The reduced amber (.76 to .92) and
  the reduced crystal (.30 to .14) were retuned to look as classic did.
- **cpu tier.** Standing exactly over a terrain grid vertex (whole-metre teleports) put it on the camera plane, and
  SwiftShader smeared it into a flat near triangle, in classic as in WebGPU. The cpu-tier eye now leads the capsule by 2 mm.

## Review

Before/after page: `review/20-webgpu-b/` (sliders, Difference mode, per-frame calls and triangles, backend per capture).
Parity numbers: `review/20-webgpu-b/parity.json`.

## Results

Parity against classic `main` (pixels changed by more than 20 levels, median per set): desktop day 1.9%, night 1.0%,
touch 0.4%, WebGL 2 fallback desktop 2.0% and touch 0.5%, no view over 10%. Software (cpu tier, SwiftShader) 9.3%:
city-hall-front, city-hall-gallery and east-tributary reach 10–12%, from the cpu tier's render scale of about 0.37 (thin
edges) and reduced glass. Paper and sign pixels are exact by day and night; the fogged horizon is within 0.4 levels on
average. Draw calls per frame halve on the gpu tier (611 to 296 over 33 views by day) because WebGPU needs no transmission
pre-pass. Time to ready (median of three, headless): desktop 0.80× classic on WebGPU and 1.00× on the fallback; touch 0.99×
and 1.11×; software 1.32×. Both Playwright suites pass (47 specs each). The full table is in
`docs/3d-game-plan.md` (WebGPU renderer, 3 October 2026).

The capture harness now waits for a teleported capsule to settle. The first classic round had caught bridge-bank,
shore-closeup and several software views mid-drop; those were recaptured on classic `main`, and each `captures.json`
records it under `recaptured`.

Residuals: on the mobile tier the WebGL 2 fallback ran at about three quarters of classic's headless frame rate; reduced
(transparent) glass still blends in linear light, so a tuned opacity matches classic for typical backdrops, not all.

Headless figures come from the development laptop's integrated GPU through Chrome's headless flags. They are informational,
not device benchmarks; physical phones, Safari and Firefox remain unmeasured.
