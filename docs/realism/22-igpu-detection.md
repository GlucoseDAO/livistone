# 22 — Tier detection for newer integrated GPUs

**Needs:** nothing. **Tiers:** probe only. **Branch:** `realism/22-igpu`. A small bug fix.

## Bug

`INTEGRATED` in `src/game/graphics.ts` matches `Intel(R) UHD/HD/Iris`, `Intel Iris`, `Intel HD` and `AMD Radeon Graphics`. It does not match newer names such as `Intel(R) Graphics (RPL-S)` (Raptor Lake), `Intel(R) Arc(TM) Graphics` when integrated (Meteor/Lunar Lake), or ANGLE strings like `ANGLE (Intel, Intel(R) Graphics (RPL-S) ...)`. Those laptops therefore get the full gpu tier. Round 1 found this on the development laptop.

## Steps

- Extend the regex to cover these names, while keeping discrete `Intel Arc A…` and `NVIDIA` / `AMD RX` on gpu.
- Add the names to `tests/graphics.test.ts`.
- Document the strings in a comment, with the source of each.

## Acceptance

- `bun run test` passes.
- The development laptop's iGPU string maps to `mobile`; NVIDIA stays `gpu`.
