# 18 — GPU-only post-processing (experiment)

**Needs:** 01 and 02. **Tiers:** gpu only. **Branch:** `realism/18-post`.
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
