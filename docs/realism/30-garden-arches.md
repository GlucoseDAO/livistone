# Garden arches, performance and Winter night lighting

Owner follow-up to 29, on the same review branch and port 5181. Existing originals remain untouched. This is review work, not deployed or merged.

## Changes

- Fifteen posters hang inside rounded, twin-rail garden arches. Climbing stems, curved leaves and two layers of cupped petals give the planting depth. Geometry batches per arch/material, retaining local culling. Post and planter colliders keep the terrace walkable.
- Ten missing concept images were generated with the built-in image tool from the original civic prompts and recorded building briefs. The five existing images and their derivatives remain unchanged. Source images, prompts and provenance are under `concepts/16-concept-garden/`; all fifteen uncropped WebP derivatives total about 6.7 MiB. Images remain labelled as generated architectural studies.
- Eye of Winter has no exterior lamps. Silver, quartz and topaz use faint blue-white night emission and one restrained internal halo. Saved reflections must be regenerated so the former lamps are absent there too.
- Older Intel HD/UHD 4xx–6xx and gen-9 adapters select the existing lightweight geometry/material path. Real hardware keeps static gem reflections and halo sprites, with adaptive resolution capped at 500k pixels. Software rendering retains its original smaller budget. The Performance menu remembers Automatic, Lightweight, Balanced or Rich and reloads the scene when changed.

## Performance evidence

The laptop reports an i7-7700HQ, Intel HD 630 and NVIDIA GTX 1050. Automated Chrome actually selects Intel gen-9. No operating-system GPU settings were changed. `scripts/benchmark-gardens.ts` samples ordinary rendering at 1600 × 900, after settling, for ten seconds at each viewpoint.

| View | Previous automatic tier | Tuned automatic tier |
| --- | ---: | ---: |
| Station | 5 fps | 29.5 fps |
| Rotunda | 7 fps | 30 fps |
| Lake | 6 fps | 30 fps |

The revised mode rendered at about 0.59 scale during these samples; the former mobile mode bottomed out at 0.75. Simpler materials, geometry and fewer effects also contribute. WebGL fallback alone measured 6–7 fps and did not solve the issue. Cold startup was approximately 35 seconds before and after. These are same-machine headless Chrome measurements, not measurements of Codex's embedded browser, Safari or another device.

Raw records: `output/testing/garden-performance-{before,webgl,light,after}.json`. Development overrides remain `?graphics=cpu|mobile|gpu` and `?backend=webgl`; no alternative visual style was introduced.

## Review and checks

First-look captures under `output/testing/realism/30-garden-arches/first-look/` show the filled arches and the Winter structure without exterior lamps. They use the hardware lightweight tier. The earlier flat rotunda remains in the 29 captures for comparison. No further aesthetic iteration is planned without owner feedback.

Focused geometry, graphics classification, adaptive scaling, night-light and Winter unit checks: 23 passed. Production build and type-check passed. Final broader checks and reflection-cache validation are recorded below when complete.

Final source validation: production build/type-check pass. The full unit run passed 275 of 278 assertions; three geometry checks exceeded their time limits. Their three suites passed all 36 assertions on isolated rerun (60-second default allowance). After removing obsolete Winter lamp shadow sites, the contact-shadow, Winter and gate-fitting suites passed another 19 checks. The only build warnings are the established large chunks.

Saved reflections: all eight day/night, 128/256-pixel sets for WebGPU and WebGL regenerated at revision `dc187b993881c8cb` (104 HDR atlases), including the removed lamp-shadow sites. A subsequent production build passed with that complete cache.

Browser validation: the folding navigation, stable map, connected rotunda and persistent performance-choice scenario passes on WebGPU and WebGL, as does walking through the Winter iris (four scenarios total). Final rich desktop captures show filled arches and soft Winter structural glow with no exterior lamps; both capture runs report no page errors. The owner preview was reloaded on port 5181 and its playable interface verified.

Final touch-emulated and real software quick captures each completed eight views without page errors. Inspected both reduced-tier outputs: the lightweight tier visibly trades sky and material detail for speed, and remains an explicit menu choice. These are emulated checks, not physical phone measurements. All final captures are in `output/testing/realism/30-garden-arches/after/`.
