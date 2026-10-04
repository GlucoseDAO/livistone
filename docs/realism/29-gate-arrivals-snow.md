# Gate arrivals, source photographs and snow — 4 October 2026

Owner request: pull teleport views back so the buildings can be seen, light the two new eye buildings at night, place source photographs beside them, and replace sandy, sharply ridged snow and the narrow central footprint strip.

Implementation is in the attached `gate-arrivals-lighting` worktree, on `realism/29-gate-arrivals`, served at port 5181. The previously requested teleport toolbar and artist links are included in this preview.

- Arrivals for Energy, Science, City Hall and Materialized Enhancements stand farther back on existing paving. Eyelense arrives on the Science branch. Winter arrives on its graded snow approach; its physical threshold is unchanged.
- Both eyes have shielded lamps feeding the existing fixed light pool, modest night emission, and source-photo boards with two faces. Photos open the gallery; captions and E open their architectural stories. The original jewellery collections remain in Energy and Future House.
- Snow is cool white, with dirt limited to melting margins. An 8 × 16 m seeded map spreads fourteen wandering hiking lines across the snow. Broad drifts replace small ridges; steep rock faces retain their rock shading. Rendering and collision continue to share the terrain height field.
- New feet and lamp positions share their planting clearance and contact shadows. The source silver and crescent geometry are preserved.

Review captures: `output/testing/gate-arrivals/`. Desktop daylight covers snow, both photo boards, gates and all changed arrivals; night covers both gates and other newer buildings. Touch and genuine software captures check reduced detail. These are desktop captures and touch emulation, not physical-device performance measurements.

Comparison switches in development: `?gate-fittings=off` hides the new lamps and boards; `?snow=classic` restores the earlier snow shading, footprint maps and drift shapes. Arrivals are intentional navigation changes, not a visual variant.

Status: owner approved the screenshot review on 4 October 2026 (“things look proper”) and requested commit and push.

Validation: `bun run build`; 272 Vitest tests in 54 files; eight WebGL browser tests (desktop/touch arrivals, teleport dropdown, both gate passages and source-photo interactions); three WebGPU browser tests (both gate passages and photo interactions). Desktop WebGL, touch WebGPU and real SwiftShader captures completed without page errors. The quick review page is built by `bun scripts/build-visit-review.ts`; the standard comparison page remains available for the baseline views.
