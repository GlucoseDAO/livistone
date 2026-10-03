/** Light-space framing for the sun's orthographic shadow camera (docs/realism/01-shadows.md). DOM- and three-free so it unit-tests cheaply. */
export interface Vec3 { x: number; y: number; z: number }
export interface ShadowFrame { left: number; right: number; top: number; bottom: number; target: Vec3; texel: number }

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** The shadow camera's right and up axes. three.js aims it with lookAt from the light toward its target and world up +Y; this mirrors Matrix4.lookAt, including its nudge for a vertical light. */
export function lightAxes(direction: Vec3): { right: Vec3; up: Vec3 } {
  let length = Math.hypot(direction.x, direction.y, direction.z) || 1, z = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  if (z.x === 0 && z.z === 0) { z.z += .0001; length = Math.hypot(z.x, z.y, z.z); z = { x: z.x / length, y: z.y / length, z: z.z / length }; }
  const across = Math.hypot(z.x, z.z), right = { x: z.z / across, y: 0, z: -z.x / across };
  return { right, up: { x: z.y * right.z - z.z * right.y, y: z.z * right.x - z.x * right.z, z: z.x * right.y - z.y * right.x } };
}

/**
 * A square box of ±half metres around `center`, looking along `direction` (target → light). The target slides by under one texel so its
 * light-space position is a whole number of shadow texels: every re-bake then samples the world on the same grid and static shadows do not shimmer.
 */
export function shadowFrame(center: { x: number; y?: number; z: number }, half: number, mapSize: number, direction: Vec3): ShadowFrame {
  const texel = 2 * half / mapSize, { right, up } = lightAxes(direction), c = { x: center.x, y: center.y ?? 0, z: center.z };
  const r = dot(c, right), u = dot(c, up), dr = Math.round(r / texel) * texel - r, du = Math.round(u / texel) * texel - u;
  return { left: -half, right: half, top: half, bottom: -half, texel, target: { x: c.x + dr * right.x + du * up.x, y: c.y + dr * right.y + du * up.y, z: c.z + dr * right.z + du * up.z } };
}
