# 21 — Sun/ambient contrast and aerial perspective

**Needs:** 01, 02 and 20 Phase B. **Tiers:** all. **Branch:** `realism/21-contrast`.
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Why

After round 1, sun shadows render, but they read pale. The hemisphere light plus sky environment light is roughly as strong as the sun, so shaded areas barely darken. Distant hills also keep their full colour until the linear fog's far plane, so the landscape lacks depth.

## Steps

1. **Rebalance sun against fill per phase.** The tables are `FILL` in `src/main.ts`, plus the sun intensity there. Make sunlit/shadow contrast clearly visible on the open meadow and paths without crushing the shade. Raise exposure only if the scene darkens overall.
2. **Height-aware aerial perspective.** 02 designed this (`concepts/14-realism/02-light-sky.md`) but did not build it. It is a global fog-chunk patch that:
   - fades distant geometry toward the sky colour at that height, using `HORIZON_HAZE`
   - has a slight blue shift with distance
   - on the CPU tier, keeps plain linear fog
3. **Variants:** dev-only switch `?contrast=a|b` (a = moderate, b = strong).

## Key views

`arrival-meadow`, `station-arrival`, `north-meadow`, `garden-overview`, `gateway-front`, `woodland-edge`, desktop and touch, day and night.

## Tests and acceptance

- Specs: `tests/night.spec.ts`, `tests/graphics-profile.spec.ts`.
- Shadows clearly read as shadows.
- Far hills recede.
- Night emissions are unchanged.
- The owner picks a variant.

## On WebGPU (round 2)

- Build the aerial perspective as `scene.fogNode`, in linear light before tone mapping. Use height-aware exponential fog whose colour is the sky radiance along the view direction, sampled from the baked sky cubemap at a low mip, so silhouettes fade into the sky behind them rather than into one haze colour.
- Fog far also drives forest culling (`world.ts` near the forest update). If the fog distances change, keep culled trees inside full fog.
- Add tone-mapping variants `?tone=aces|agx|neutral`. ACES is today's look. The owner chooses.
- The cpu tier keeps plain linear fog.
