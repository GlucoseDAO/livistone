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

- **Contrast** (`main.ts`, `?contrast=a|b`, a is the default until the owner picks). Horizontal sunlit ground keeps its old brightness; shade loses about a third (a) or half (b):
  - day: sun 2.4 → 3.35 / 3.95, environment 0.9 → 0.6 / 0.42, hemisphere 0.55 → 0.36 / 0.24 (sunlit to shaded about 1.8:1 → 2.8:1 / 4:1);
  - night: moon 0.32 → 0.42 / 0.5, environment 0.3 → 0.24 / 0.18, hemisphere 0.22 → 0.17 / 0.13, at the same overall level; emissions untouched;
  - cpu (no environment, no shadows): sun 2.75 / 3.1 against hemisphere 0.92 / 0.65.
- **Aerial perspective** (`render/aerial.ts`) is `scene.fogNode` on gpu and mobile, chosen over a depth-based output pass because each surface, glass and water included, fogs at its own distance in linear light before blending and before the MSAA resolve. Per fragment: exponential haze whose density falls off with height (scale height 24 m, 30% floor), integrated along the ray, blue extinguished 15% faster than green and red 12% slower; plus a horizon fade (a smoothstep from 0.48 × full, raised to the power 2.2 as a linear-light weight so it thins out as evenly as the old fog did after encoding) that makes it exactly 1 at `GraphicsProfile.fog` (gpu 150 m, mobile 120 m). The fog colour is a 64 px bake of the same sky with the horizon repeated below it, sampled at mip 3 along the view ray. Display materials fog themselves toward the tone-mapped sky; halos take the transmittance.
- **One full-fog number.** `GraphicsProfile.fog` is the walk camera's far plane (replacing sub-plan 25's fog-far), ends per-tree culling in `forest.ts` (a tree is drawn while any of its bounding sphere is nearer; cells that straddle it are filtered tree by tree every 2 m of travel, alongside 25's twigless distant branches) and hides grove crowns (`groveDetail`) only beyond it. Sub-plan 16's contact-shadow decals fade toward white by the same fog, so far patches do not darken the haze; their per-cell visibility (`onCells`) is unchanged. `?budget=off` still restores the 150 m far plane. The cpu tier keeps its 42–130 m linear fog and 80 m forest.
- **Tone mapping** (`render/tone.ts`, `?tone=aces|agx|neutral`): ACES (classic fit, default), three's AgX and Khronos PBR Neutral, each with an exposure gain matching 18% grey to ACES (AgX 0.969, Neutral 1.403). `HORIZON_HAZE` and the halo inverse follow the active curve; paper skips every curve.
- **Cost.** Drawing trees until full fog multiplies far trees: two sanity views on desktop went from 3.6M to 5.2M and 2.6M to 4.2M triangles with unchanged draw calls. Sub-plan 25's distant-tree LOD or impostors are what make this affordable; a shorter full-fog distance is the fallback.
