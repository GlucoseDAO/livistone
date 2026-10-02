# 08a–e — Material fidelity per building-piece

**Needs:** 07, recommended. **Tiers:** all, graded. **Branches:** `realism/08a-nanot`, `08b-embryo`, `08c-timeface`, `08d-future-house`, `08e-kings-chapel`. One building per branch and review.
See [README](README.md) for the shared workflow.

Every building is one of Livia's pieces at architectural scale. Each should read as the real material of that piece.

## Pattern to follow (approved pilots)

- **City Hall:**
  - `scripts/build-city-hall-textures.py` bakes the maps offline.
  - `src/world/walnut.ts` uses separate colour, AO/roughness and normal maps; reduced detail omits the normals.
  - `scripts/screenshot-city-hall.mjs` provides the fixed comparison cameras.
- **Mitoring:** `scripts/build-mitoring-textures.py` and `src/world/mitoring-materials.ts`, with rich and low setters behind a separate quality tag.
- **Map sizes:** 256, 512 and 1024 by tier. Normal maps on gpu only. Reference photos come from `~/sources/livia/assets/pieces/<piece>/`.
- **Records:** source photos and provenance go in the concept notes.

## Sub-steps

| Step | Building | Source piece folder | Focus |
| --- | --- | --- | --- |
| 08a | Science (`jewelry.ts` `nanotCage`) | `Nanot pendant` | Cast sterling with oxidised crevices, polished highs, dark inclusions |
| 08b | Station (`station-ring.ts`, `station-amber.ts`) | `Embryo ring` | Ring silver roughness and patina; amber clouding to match the photos |
| 08c | Time Tower (`time-tower.ts`) | Timeface archive | Silver strands, flat colour today |
| 08d | Future House (`future-house.ts`) | Camel Dalí archive | Native-copper drips, leather straps, printed hull; all flat colours today |
| 08e | Gateway (`gateway-materials.ts`) | `King's chapel double ring` | Silver micro-roughness and the tourmaline green-to-yellow zoning |

## For each step

1. Collect 2–4 reference photos and record them in `concepts/14-realism/notes.md`.
2. Write a bake script `scripts/build-<name>-textures.py`, with output under `public/textures/<name>/` and attribution.
3. Write a material module with rich and low setters behind a separate quality tag. CPU uses the Lambert conversion in `cpu-detail.ts`.
4. Add a view set to `scripts/screenshot-realism.ts` for front, side and interior.

## Tests

- The existing per-building tests: `tests/jewelry.test.ts`, `tests/station*.test.ts`, `tests/elevated.test.ts`, `tests/gateway.test.ts`.
- Specs: `tests/entrances.spec.ts`.

## Acceptance

- Side by side with the reference photo, the owner recognises the material.
- Triangle and draw-call counts do not increase.
