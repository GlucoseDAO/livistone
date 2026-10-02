# 01 — Fix sun shadows and follow the player

**Needs:** 00. **Tiers:** gpu and mobile; cpu has shadows off and stays unchanged. **Branch:** `realism/01-shadows`.
See [README](README.md) for the shared workflow.

## Problem

`src/main.ts:98` sets:

```ts
this.sun.shadow.camera.top = shadow; this.sun.shadow.camera.bottom = shadow;
```

Commit 28f72f2 lost the minus sign (it used to be `bottom = -160`). The orthographic shadow camera now has zero height, so no sun shadows render.

The frustum is also fixed at ±160 m around (0, 0, −60) with a 2048 map. That is about 16 cm per texel, which is blurry even once fixed.

## Steps

1. **Fix the sign:** `bottom = -shadow`. Capture this alone as `after-a/`, so the owner sees the raw fix.
2. **New pure module `src/game/shadow-frame.ts`.**
   - `shadowFrame(center: {x, z}, half: number, mapSize: number)` returns `{ left, right, top, bottom, target }`.
   - Snap the centre to whole shadow texels along the light's right and up axes, which prevents shimmering.
3. **Use it in `main.ts`.**
   - **Walking:** half-size 50 m at 2048 (gpu) and 40 m at 1024 (mobile), centred on the player. The light position follows as target + sun direction × distance.
   - **Map mode:** keep the wide ±160 m frustum.
   - Keep `renderer.shadowMap.autoUpdate = false`. Set `needsUpdate = true` only:
     - when the player has moved more than ¼ of the half-size since the last bake, or
     - at the existing call sites (`main.ts:104,152,185,319,323`).
   - Call `updateProjectionMatrix()` on the shadow camera after changing its bounds.
   - Capture this as `after-b/`.
4. Retune `bias` and `normalBias` for the smaller texels, so there is no acne on terrain or walnut and no peter-panning at tree trunks.

## Tests

- New `tests/shadow-frame.test.ts`:
  - snapping is stable for sub-texel moves
  - the frustum contains the player
  - the bounds are symmetric
- Specs: `tests/graphics-profile.spec.ts`, `tests/night.spec.ts`, `tests/navigation.spec.ts`.

## Views

`ground`, `exteriors` (desktop and touch); `quick` (software, which should show no change). Day.

## Acceptance

- Trees, buildings, the bridge and the gateway cast visible shadows on gpu and mobile.
- No visible pop when the frustum re-centres while walking.
- Draw calls are unchanged except for the shadow pass when it bakes.
