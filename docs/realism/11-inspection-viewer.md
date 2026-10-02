# 11 — 3D inspection viewer

**Needs:** 10. **Tiers:** all; cpu uses the mobile GLB at low resolution. **Branch:** `realism/11-inspect`.
See [README](README.md) for the shared workflow.

## Steps

1. **Viewer.** Add `gallery.showModel(id)` in `src/ui/gallery.ts`.
   - Reuse the existing `gallery` mode, so no new `Mode` value is needed.
   - Mode changes stay the single place where input capture, the camera and DOM visibility change.
2. **Rendering.** While open, `main.ts` renders a small studio `THREE.Scene` with the same `WebGLRenderer`, and skips the town render.
   - Never create a second WebGL context.
   - The scene holds the `RoomEnvironment` PMREM, the piece GLB and a neutral backdrop.
3. **Controls.**
   - `OrbitControls`: drag or one-finger rotate, wheel or pinch zoom.
   - Buttons: Fit, Reset and Close.
   - ←/→ switch to the piece's photographs, which stay available alongside.
   - Esc closes and restores walking position and yaw.

## Tests

- `tests/exploration.spec.ts`, new case: click the vitrine, then rotate, zoom and close. Yaw and position must be unchanged and there must be no page errors.
- Same flow on touch, with no horizontal overflow.
- Specs: `tests/navigation.spec.ts`.

## Acceptance

- The piece can be inspected from every side on desktop and touch.
- The town resumes exactly where it was.
