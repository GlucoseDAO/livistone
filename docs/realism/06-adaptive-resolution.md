# 06 — Adaptive resolution for mobile and gpu (folded into 25)

**Needs:** 00. **Tiers:** gpu, mobile. cpu already has its own scaler. **Branch:** `realism/06-adaptive`.
See [README](README.md) for the shared workflow.

## Current state

- `main.ts:422` lowers the render scale on cpu only: by 0.05 per second while fps is below 18, down to 0.3.
- Reduced tiers are also frame-capped at about 33 fps (`main.ts:408`).
- Later sub-plans add GPU cost, so this is the safety net that pays for them.

## Steps

- Generalise the scaler into a small pure helper `src/game/render-scale.ts`, with hysteresis:
  - lower quickly when fps stays below target for 2 s
  - recover slowly (+0.05 every 4 s) when fps stays more than 15% above target
- Targets and floors:

  | Tier | Target | Floor | Ceiling |
  | --- | --- | --- | --- |
  | mobile | ≥ 28 fps | 0.75 | profile `pixelRatio` |
  | gpu | ≥ 50 fps | 1.0 | 1.5 |
  | cpu | unchanged | unchanged | unchanged |

- Respect the harness `?capture=1` freeze from 00.
- Never change shadow-map size at runtime here.

## Tests

- New `tests/render-scale.test.ts`: hysteresis, floors, no oscillation.
- Specs: `tests/graphics-profile.spec.ts`.

## Acceptance

- The scale settles without oscillating under synthetic fps traces.
- The documentation states that physical-device performance is unverified.

## Round 2

Folded into [25](25-frame-budget.md), which also measures the budget the scaler protects.
