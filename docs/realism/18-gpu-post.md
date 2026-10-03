# 18 — Ambient occlusion and restrained bloom

**Needs:** 20 Phase B (its output pipeline and `display` mask). **Tiers:** gpu; mobile at reduced resolution only if 25's measurements allow. **Branch:** `realism/18-post`.
See [README](README.md) for the shared workflow.

## Idea

- `GTAOPass` at half resolution, then `OutputPass`, from the three addons with no new dependency.
- Optionally a very restrained night bloom for the halos and neon.

## Blocker to solve first

- Gallery paper and signs are `toneMapped:false` (an owner rule: they look the same at night).
- With a composer, tone mapping moves into `OutputPass` and applies to the whole frame, so the paper colour would shift.
- Possible solutions to evaluate:
  - a mask in the alpha or stencil that skips tone mapping for those pixels
  - drawing the unlit boards after the output pass, with depth from the main pass
- Ship only if paper colour and night consistency survive pixel-exactly.

## Measure

- Headless frame time and draw calls before and after.
- The owner reviews AO strength; aim for "subtle ambient occlusion where affordable" (`docs/3d-game-plan.md:330`).

## Acceptance

- Visible grounding in corners and under eaves.
- The paper looks unchanged.
- When the owner has not approved it, the branch is discarded.

## Round 2 update (WebGPU)

Promoted from experiment: flat ambient light is the most visible stylized cue left after round 1. The tone-mapping blocker above is solved by Stage A: paper and signs carry the `display` mask, and AO and bloom skip those pixels.

- **AO:** `ao()` from `three/addons/tsl/display/GTAONode.js` at half resolution on the scene pass's depth and normals, denoised, multiplied into the lit colour before tone mapping.
- **Variant `?post=gi`:** `ssgi()` (`SSGINode.js`) for one-bounce screen-space light, if the frame time allows.
- **Bloom:** `bloom()` with a threshold above 1, so only night halos, neon and sun glints bloom.
- **Dev switch:** `?post=off|ao|gi`.
- Record frame time (headless, informational) and draw calls before and after.
