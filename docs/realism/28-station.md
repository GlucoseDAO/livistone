# 28 — Embryo station detail

**Needs:** 16, 21, 24 (merged). **Tiers:** all (graded). **Branches:** `realism/28-station` (first pass, merged as `d145480`), `realism/28-station-2` (round 2). **Review:** `review/28-station/` (first pass), `review/28-station-2/` and `review/28-station-2-touch/` (round 2).
See [README](README.md) and the rules in [NEXT.md](NEXT.md).

## Owner request

Every visit starts at the station. Before the first pass, the ring's shank cut through the platform slab, the slab had a bare side band and a step up from the town path, the benches were plain boxes, the foyer's glazing was a near-invisible warm film (so its frames read as bare sticks) and the amber stood on white branching columns. The request that started the first pass was not written down; its commit records what it built. After reviewing it, the owner answered the round-2 questions on 3 October 2026 (evening):

1. **Amber canopy: "Deeper honey amber"**: a deeper honey colour, a darker underside and a stronger glowing core, so from below it reads as a set jewel. Silver prongs gripping its edge (the brief's recommendation) and a wider, flatter bezel were both rejected.
2. **Threshold:** keep the pierced silver floor plate (not a stone collar).
3. **Ring view from the path** (the gold frame grid and gallery behind it): leave as is.
4. **Departures and timetable copy, clock and board placement:** keep the first pass's choices.
5. **Night:** the lamp globes glowed but added no light. Light the platform with them through the existing light pool, never with lights of their own.

At the first-look review the coordinator approved the amber and added: keep the core as glowing folds rather than one bright heart, and push it about 1.2× only if nothing turns peach; dim the concourse glows by 25–30% so the lamp pools read; keep the 4 m fade of pooled lights; and try a cheap fix for a purplish fringe at grazing angles at night and olive or reddish-brown reflections by day.

## First pass (`d145480`)

- **Ring threshold.** The shank's base levels onto the platform as a pierced silver threshold (`stationRingGeometry(mobile, footed)`) instead of slicing through the slab; the band's inner face sits 2.5 cm above the paving through a 0.6 m fillet.
- **Dressed stone.** Ashlar coping round the slab, footings where the shank lands and a gently sloped threshold stone from the town path replace the bare side band and the step (one draw in the town's ashlar, every part with a collider).
- **Benches.** Teak slats on cast-silver ring frames that echo the shank.
- **Curtain wall.** East of the ring the foyer has framed bays of about 1.75 m, a brass kick plate and sill, a transom at door height and one top rail; the glass is a faint green-grey that mirrors more of the sky as the view grazes it.
- **Amber setting.** The columns under the amber are cast silver like the prongs, cupped against the soffit, with a bezel round the stone's girdle.
- **Fittings** (`STATION_FITTINGS`, read by contact shadows too): four lamp posts like the bridge's, three brass litter bins, a map and timetable panel, a hanging clock and a departures board. The clock, board and map faces share one canvas atlas and one draw.
- **Captures:** the `station` view set. **Switch:** dev-only `?station=classic` restores the earlier station.
- **Changed** (desktop day, before = `dce22d2`): `station-entrance` 32 %, `station-bench` 20 %, `station-glazing` 13 %, `embryo-station-front` 11 %, `station-platform` 7 %, `station-amber-below` 5.8 %, `station-arrival` 1.4 %; +2 to +4 calls and +24k to +41k triangles per view.

## Round 2

### Deeper honey amber (`station-amber.ts`)

- **Body.** The procedural map is a deeper honey: its mean on the sides goes from (247, 211, 25) to (247, 193, 16). Toward the soffit, red, green and blue fall by 34, 42 and 48 % (`HONEY.under`), so the underside's mean goes from (247, 216, 26) to (163, 114, 9) and from the platform the stone's own body frames its glow instead of one flat orange sheet. Transmission is tinted by a deeper golden attenuation (`#f5c060` over 12 m, was `#ffe063` over 14 m).
- **Outline.** In TSL, the colour deepens toward the outline, where a cabochon is thickest (`rim`). There the clear coat and surface reflection thin to 35 % (`coat`): with a full coat the outline mirrored only the sky, so the darkened body went olive by day and purple against the night sky. The Nut of Power crystal handles its outline the same way.
- **Core (desktop).** The resin core is a slimmer inner body (`stationAmberCore`: inset 0.3 vertically and 0.48 across, was 0.14), so a darker band of stone frames it from below. Its emission carries the relief's folds as fire: bright folds, dark cracks, mean about half. It is brightest face-on and full strength downward, where the darker underside must let it through; the sides, behind a clearer body, take 45 %. The glow levels are 2.9 by day and 3.6 at night, after the approved 1.2× push.
- **Opaque tiers.** Mobile, Gentle detail and a stone without a core (a phone set to rich detail) are opaque or have no core behind them, so the stone glows by itself with the same fire. That glow is strongest face-on, with a third of it kept at the outline so the edges stay warm. The cpu tier's Lambert copy keeps the colour and emission nodes (`cpu-detail.ts`, as for the Nut of Power crystal).
- **Quality switch.** The amber has its own, `setStationAmberQuality`; `main.ts`'s generic glazing switch no longer touches it. The stone's own day and night glow is per tier: rich 0.08 / 0.2 (the core carries the glow), low 0.5 / 0.9; the core's switches through `nightEmission`.
- **Closed volume.** The stone stays a closed, lobed volume with its recessed core. `?station=classic` keeps the earlier stone, core and inset.

Tone: the brightest folds stay short of Neutral's shoulder. Among the brightest warm amber pixels, the share desaturated toward peach did not rise with the 1.2× push (day front 26.6 → 25.9 %, day below 20.4 → 18.1 %, night below 11.6 → 6.9 %). Near-white pixels are unchanged (at most 0.04 %), and the stone does not bloom.

### Night lighting

- **Lamps.** Each of the four platform lamps is a night halo and a light source like the bridge's (`addGlow`, 36 over 10 m, halo 4.5 m), so the nearest join `NightLighting`'s fixed pool of six (mobile) or ten (gpu) lights. No light is created per lamp, and the pool's size never changes at runtime.
- **Concourse glows.** The three glows under the canopy (`world.ts`) drop from 70 to 50 and their halos from 0.3 to 0.22, so the lamp pools read as light sources while the platform stays legible.
- **Pool fade.** With seven candidates on the platform, mobile's six lights would swap within view as visitors walk. A pooled light now fades over its last 4 m (`POOL_FADE`) before it passes to a nearer source, and that source fades in, so a swap never pops. This applies to every pooled light in town: `station-arrival` at night changes by 0.0 %. `tests/night-lighting.test.ts` walks past a swap; without the fade one step moved all 36 at once.

### Captures and tests

New view `station-canopy` (in the `station` set): eye level on the platform under the canopy, looking west along the lamps. `tests/station-amber.test.ts` checks the darker underside and each tier's optics; `tests/night-lighting.test.ts` checks the pool, the fade and that every lamp has a halo and a light source.

## Budget (WebGPU, before = `main` at `0ea11ed`)

| View | Desktop calls / triangles, day | Changed, day | Calls, night | Changed, night |
| --- | --- | --- | --- | --- |
| station-amber-below | 123 / 2.48 M, ±0 | 58 % | 125 → 127 | 63 % |
| station-canopy | 165 / 2.37 M, ±0 | 28 % | 168 → 172 | 46 % |
| embryo-station-front | 177 / 2.66 M, ±0 | 23 % | 180 → 184 | 23 % |
| station-glazing | 134 / 2.53 M, ±0 | 13 % | 136 → 138 | 15 % |
| station-platform | 109 / 2.17 M, ±0 | 3 % | 111 → 112 | 26 % |
| station-bench | 90 / 2.25 M, ±0 | 0.1 % | 91 → 92 | 16 % |
| station-entrance | 138 / 2.18 M, ±0 | 4 % | 140 → 143 | 7 % |
| station-arrival | 223 / 2.63 M, ±0 | 0.2 % | 254, ±0 | 0.0 % |

By day nothing is added: the core keeps its tessellation and the nodes add no draws. At night the lamp halos add one draw and two triangles each where they are in view. Touch (mobile tier, `review/28-station-2-touch`): `station-amber-below` 58 / 56 % (day / night), `station-canopy` 25 / 42 %, `embryo-station-front` 23 / 23 %, `station-platform` 3 / 26 %, with the same night additions. `touch quick day` and `software quick day` hold no station view and change by at most 0.1 %; the software before is the shared `0ea11ed` capture from `review/21-haze`.

Hue checks on the first look against the final (share of the frame): the night purple fringe fell from 0.66 to 0.11 % from below and from 0.89 to 0.54 % along the canopy (touch 0.33 → 0.01 % and 0.86 → 0.13 %). By day, olive fell from 0.86 to 0.52 % from below and from 0.65 to 0.55 % along the canopy. The weaker reflection now mixes with the orange body in a soft lavender sheen at the edges of the sky streaks from below (0.24 → 0.91 %).

## Open

- The core reads as glowing folds through a darker body, not as one bright heart; that is the approved look. A stronger day glow turns the brightest folds peach under Neutral.
- On the opaque tiers the stone's own glow is a little mottled.
- Under the canopy, the concourse glows' pooled lights still leave a soft bright patch on the opaque (mobile) amber's underside at night.
- The cpu tier was checked on the hardware GPU (`?graphics=cpu`) and through `tests/graphics-profile.spec.ts`. The software capture holds no station view.
- Physical devices remain unmeasured; headless frame times are not device benchmarks.
