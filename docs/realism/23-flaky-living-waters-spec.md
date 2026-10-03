# 23 — Flaky Living Waters desktop spec

**Needs:** nothing. **Branch:** `realism/23-flaky-spec`. A small test fix.

## Symptom

`tests/living-waters.spec.ts:7` (desktop) sometimes fails because `#interact` still says "EDiscover" after 5 s, instead of "Vittoria Amazonica at the lake". It passes on rerun. Seen once on the merged 01 branch while other Chrome instances loaded the machine.

## Steps

- Find what the prompt waits for, such as the nearby-story update or the interaction raycast after a teleport. Wait on that state through `__livistone.snapshot().interaction` instead of a fixed text timeout, or give it a longer explicit timeout with a reason.
- Do not weaken the assertion itself.

## Acceptance

Ten consecutive desktop runs pass while another headless Chrome capture runs in parallel.
