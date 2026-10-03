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

## Built (3 October 2026, `realism/21-contrast`)

- **Contrast** (`main.ts`, `?contrast=a|b` until the owner picked a; see the decision below). Horizontal sunlit ground keeps its old brightness; shade loses about a third (a) or half (b):
  - day: sun 2.4 → 3.35 / 3.95, environment 0.9 → 0.6 / 0.42, hemisphere 0.55 → 0.36 / 0.24 (sunlit to shaded about 1.8:1 → 2.8:1 / 4:1);
  - night: moon 0.32 → 0.42 / 0.5, environment 0.3 → 0.24 / 0.18, hemisphere 0.22 → 0.17 / 0.13, at the same overall level; emissions untouched;
  - cpu (no environment, no shadows): sun 2.75 / 3.1 against hemisphere 0.92 / 0.65.
- **Aerial perspective** (`render/aerial.ts`) is `scene.fogNode` on gpu and mobile, chosen over a depth-based output pass because each surface, glass and water included, fogs at its own distance in linear light before blending and before the MSAA resolve. Per fragment: exponential haze whose density falls off with height (scale height 24 m, 30% floor), integrated along the ray, blue extinguished 15% faster than green and red 12% slower; plus a horizon fade (a smoothstep from 0.48 × full, raised to the power 2.2 as a linear-light weight so it thins out as evenly as the old fog did after encoding) that makes it exactly 1 at `GraphicsProfile.fog` (gpu 130 m, mobile 110 m). The fog colour is a 64 px bake of the same sky with the horizon repeated below it, sampled at mip 3 along the view ray. Display materials fog themselves toward the tone-mapped sky; halos take the transmittance.
- **One full-fog number.** `GraphicsProfile.fog` is the walk camera's far plane (replacing sub-plan 25's fog-far), ends per-tree culling in `forest.ts` (a tree is drawn while any of its bounding sphere is nearer; cells that straddle it are filtered tree by tree every 2 m of travel, alongside 25's twigless distant branches) and hides grove crowns (`groveDetail`) only beyond it. Sub-plan 16's contact-shadow decals fade toward white by the same fog, so far patches do not darken the haze; their per-cell visibility (`onCells`) is unchanged. `?budget=off` still restores the 150 m far plane. The cpu tier keeps its 42–130 m linear fog and 80 m forest.
- **Tone mapping** (`render/tone.ts`, `?tone=aces|agx|neutral` until the owner picked Neutral): ACES (classic fit, then the default), three's AgX and Khronos PBR Neutral, each with an exposure gain matching 18% grey to ACES (AgX 0.969, Neutral 1.403). `HORIZON_HAZE` and the halo inverse follow the active curve; paper skips every curve.
- **Full-fog distance: 130 m (gpu), 110 m (mobile).** Measured on `realism/21-on-round-2` with `snapshot()` (headless Chrome, WebGPU on the shared low-power adapter while other agents captured; two interleaved runs per setting, median of seven one-second samples per view). 150 / 120 m cost about a fifth of the gpu frame rate against 130 / 110 m, past the 15% limit, so 130 / 110 m it is. Mobile stayed under 1.5M triangles at either setting; its 30 fps is the reduced tier's frame cap.

  | View | round 2 (f308232) | 21 at 130 / 110 m | 21 at 150 / 120 m |
  | --- | --- | --- | --- |
  | desktop north-meadow | 198 calls, 1.64M tris | 198, 2.34M, 20.5 fps | 199, 2.94M, 16 fps |
  | desktop woodland-edge | 47, 1.98M | 47, 2.79M, 13.5 fps | 48, 3.22M, 11.5 fps |
  | desktop garden-overview | 195, 1.67M | 195, 2.35M, 19 fps | 216, 2.98M, 14.5 fps |
  | touch north-meadow | 193, 0.72M | 106, 0.76M | 190, 0.91M |
  | touch woodland-edge | 48, 0.78M | 48, 1.23M | 48, 1.35M |
  | touch garden-overview | 191, 0.75M | 186, 0.98M | 188, 1.08M |

  The added triangles are trees drawn until full fog (forest 0.3–1.1M → 0.9–1.9M on desktop), plus grove crowns (about 25k → 65k per gpu view in `scripts/frame-budget.ts`). Cheaper distant trees (impostors) would let the haze reach farther. On mobile the fade now completes at 110 m instead of the old fog's 130 m: clearer to about 70 m, hazier from about 80 m. Headless numbers are not device benchmarks.

## Owner decision and rebase onto main (3 October 2026)

**Contrast a with Khronos PBR Neutral** is the only look. Contrast b, the AgX and ACES curves and both dev switches (`?contrast=`, `?tone=`) are deleted; `render/tone.ts` keeps Neutral alone, with its CPU mirror for `HORIZON_HAZE` and its inverse for the night halos. No switch keeps main's previous look, because that would have kept ACES and the old tree culling as dead paths; `before` captures come from a server on `main`. The branch was squashed to one commit and rebased onto `main` (sub-plans 12, 13, 14, 16, 18, 24, 25 and 26 merged since).

How 21 sits on today's renderer:

- **Lights.** `LIGHT` (contrast a) replaces `FILL`; 26's `PHYSICAL_DAY_FILL` still multiplies the day environment, so the physical sky's shade keeps the ratio 21 measured on the painted one. The distant pass copies sun, hemisphere and environment as before.
- **Tone mapping.** Neutral with a gain of 1.403 inside the curve, so 18% grey shows as under ACES (#7c7c7c). Bloom (18) still thresholds the plain exposure at 1.2, so it gathers the same radiance as before; under Neutral that threshold sits at about 95% of white instead of ACES's 80% (linear). `HORIZON_HAZE` is now #e2eff4 by day (ACES #d6dadc) and #082a47 at night (#0d1e35); `tests/sky.test.ts` checks both. Sky constants (`SKY_GAIN`, `HORIZON_RADIANCE`) are unchanged.
- **Fog.** The aerial perspective fogs the town while walking; the distant ranges keep 26's valley mist and per-metre haze in the output pass (`DISTANT_DISPLAY` reads the range factor without the aerial switch-off). The haze cube is baked from the physical sky (or `?sky=classic`) without sun disc, moon or stars, and settles on the horizon colour up to about 2°, reaching the open sky by about 17°: low far silhouettes stand in front of 26's mist, not open sky, and fading them toward the bright sky along the ray left blue ghost trees and hillsides in front of the ranges (first-look captures). Ambient occlusion (18) keeps only the clear share of a surface in the aerial haze, as it already did for range fog.
- **One full-fog distance.** The walk camera's far plane is `GraphicsProfile.fog` (130 / 110 m) and the distant pass's near plane follows it at 90%. Forest and grove culling use it on gpu and mobile; the near grass field (13) was never tied to the fog. The cpu tier's tree range is now 58 m to the nearest tree, about where main's cells hid (72% of 80 m from their centres); 21's original branch had let cpu trees reach 80 m.

Results, `review/21-final/` (`before` = `main` at 9489bd3 on a read-only server; `after` = this branch on `main` at ba1a352, whose lake-eye fix also shows in the lake views). Share of pixels changed by more than 20 levels, median per set: desktop day 30.8% (key views 28.8%), desktop night 4.1% (key views 1.3%), touch day 27.4%, software day 15.4%. Paper stays exactly `#f4f0e5` and night emissions are unchanged (`tests/post.spec.ts`, `tests/night.spec.ts` on WebGPU and the WebGL 2 fallback).

| Set | Draw calls (mean, before → after) | Triangles (median) |
| --- | --- | --- |
| desktop day (33 views) | 164 → 166 | 2.03M → 2.70M |
| desktop night (8) | 221 → 224 | 1.93M → 2.45M |
| touch day (8) | 162 → 155 | 0.81M → 0.98M |
| software day (8) | 129 → 132 | 0.43M → 0.45M |

The added triangles are trees drawn until full fog instead of to 72% of the old range (desktop forest about 0.3–1.1M more per view). Headless numbers, not device benchmarks.

Watch:

- **Enhancement hill from `vittoria-lake`.** The fade is by distance, not view depth as main's range fog was, so off-axis surfaces between about 100 and 130 m are fogged more than on main. The hill, 125–170 m away at the edge of the view, becomes a flat pale shape in front of the distant ranges instead of a pale violet hill. Any surface fully fogged in front of the ranges reads this way (main shows the same on hillsides near its far plane).
- **Ghost trees.** Trees now draw until they are entirely haze, so far trees show as pale silhouettes in front of the mist where main had already hidden them, most visibly on mobile (110 m).
- **Bright amber at night.** Neutral rolls the brightest highlights toward white: inside the Mitoring at night (`energy-front`) the amber's hot spots turn peach-white, about twice as many clipped pixels as under ACES. Emissions are unchanged; this is the curve.
