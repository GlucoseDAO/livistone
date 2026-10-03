# 02 — Light and sky coherence — 3 October 2026

Branch `realism/02-light-sky`, built on the 00 harness at `76104be`. Spec: [docs/realism/02-light-sky-coherence.md](../../docs/realism/02-light-sky-coherence.md). It waits for the owner to choose look a or b.

## What changed

- **One sun and one moon.** `sky.ts` exports normalised `SUN_DIR` (-35, 70, 35) and `MOON_DIR` (25, 38, -70). The sky shader paints its discs from them, and `main.ts` stores the active one in `Game.sunDirection`. The directional light sits at `target + sunDirection × SUN_DISTANCE` (180 m from the target (0, 0, -60)).
  - By day the light moves about 10° from its old (-55, 150, 40) position, to match the painted sun.
  - At night the light used to come from overhead, at 65° elevation. It now comes from the low moon at 27°, in the north. Moonlight therefore backlights views that face north and lights the station from the front.
- **One horizon haze.** Three.js mixes fog and flat backgrounds in after tone mapping. So `HORIZON_HAZE` is the shader's horizon radiance, passed through a CPU copy of three's ACES curve (`acesFilmic`) at `SKY_EXPOSURE` (0.96 by day, 0.72 at night).
  - The result: day `#d6dadc`, night `#0d1e35`. These replace the hard-coded `#c3d8df` and `#1a2433`.
  - Captured horizon pixels read (212–214, 217–218, 218–220), against the computed (214, 218, 220).
  - Fully fogged ground now meets the sky with no blue band. Tall, fully fogged hills still show as pale silhouettes against the bluer sky higher up. That is the expected aerial-perspective look for fog of a single colour.
- **Reflection strength (look b only).**
  - The environment carries more of the ambient light, and the hemisphere light carries less:
    - day: `scene.environmentIntensity` 0.5 → 0.9, hemisphere 1.2 → 0.55
    - night: 0.2 → 0.3, hemisphere 0.28 → 0.22
  - The CPU tier has no PMREM environment, so it keeps the old hemisphere values.
  - Materials tagged `userData.heroEnv = true` get `envMap = sky.environment`. This happens once after the town loads and again on every day/night switch, so their own `envMapIntensity` finally applies. CPU keeps its Lambert re-pointing.
  - `createSky(..., darkGround)` shades the lower hemisphere of the baked sky toward (0.08, 0.095, 0.06). Terrain hides that part of the sky, so it is never seen directly. Polished metal then shows a dark-below, bright-above horizon line. Without it, the metal is a flat pale tint: the first pass, with the authored 1.5–1.7 values on the old ground, read as white porcelain.
- **Tagged hero materials:**
  - Mitoring cast silver and cloudy amber
  - Jewelry and Nanot silver, and the Nanot frame
  - gateway silver and tourmaline
  - City Hall brass clasps, silver pins and smoky crystal
  - Embryo Station silver (ring, prongs, foyer, rails) and amber
  - time-tower silver
  - Mycelium silver and opal
  - Dewdrop briolette
  - river water and lake water
- **Retuned intensities** (the old values never took effect):

  | Material | Before | After |
  | --- | --- | --- |
  | Mitoring silver | 1.7 | 1.05 |
  | Gateway silver | 1.65 | 1.0 |
  | City Hall brass | 1.6 | 1.2 |
  | City Hall silver | 1.5 | 1.0 |
  | Station silver | 1.6 | 1.05 |
  | Time-tower silver | 1.4 | 1.0 |
  | LIVISTONE lettering | — | 0.45 (a clone, so the name stays legible against the sky it mirrors) |

  The ambers (1.25 and 1.2), crystal (1.5), gem (1.45), river (1.25) and lake (0.65) keep their authored values.
- **Not tagged on purpose:**
  - forest foliage (0.35): tagging it would darken every tree
  - station glazing (1.6)
  - generic silvers that carry no authored value

## Variants

The switch is dev-only: `?light=a|b` (renamed from `?look` when merging, because the river uses `?look`). The harness passes it via `LIVISTONE_PARAMS=light=a`. Production builds always use b.

- **a**: steps 1–2 only, meaning the shared sun and moon directions plus the matched haze.
- **b**: a, plus reflection strength (step 3) and the darker reflection ground.

## Review

`http://127.0.0.1:5199/02-light-sky/index.html`, built from `review/02-light-sky/`. `before` links to the shared `baseline-76104be` captures.

## Metrics (desktop/day vs baseline; % of pixels whose difference exceeds 8 levels)

- **Look a:** median 2.3%.
  - city-hall-front 7%, energy-front 3%, science-front 8%, gateway-front 2%, station-arrival 2%
- **Look b:** median 15.9%.
  - city-hall-front 16%, energy-front 27%, science-front 15%, gateway-front 11%, station-arrival 7%
  - embryo-station-front 26%, mycelium-grove 18%, shore-closeup 52%
- **Mean luminance:** b is 1–4% brighter on land views, 9–14% brighter on river views, and within ±3% at night.
- **Draw calls and triangles:** unchanged, because no geometry was added.
- **Caveat:** `after-b/software` was captured before the CPU fill fix, so it is about 8% too dark there. Recapture it.
