/** Eyelense E: local +z faces west toward Science; the passage runs east–west. Metres. */
export const EYELENSE = {
  x: 106, z: -36, yaw: -Math.PI / 2, floor: .13,
  sourceScale: 1.65, sourceOffsetX: -.7,
  beadRadiusX: 4, beadRadiusY: 4, beadCentreY: 2.8, beadDepth: 2.4,
  doorHalf: 2.1, doorSpring: 2.3, doorTop: 4.4, tunnelHalfDepth: 1.8,
  lensBottom: 7.4, lensTop: 9.5,
  forecourtHalfX: 8.5, forecourtHalfZ: 11,
  arrival: { x: 97, y: 1.05, z: -36, yaw: -Math.PI / 2 },
  seats: [{ x: -6, z: 5.5 }, { x: 5.3, z: 5.5 }],
} as const;

export function eyelenseLocal(x: number, z: number): { x: number; z: number } { return { x: z - EYELENSE.z, z: EYELENSE.x - x }; }
/** Stone platform and the source crescent's complete footprint, including its wider left foot. */
export function eyelenseGround(x: number, z: number, radius = 0): boolean {
  const p = eyelenseLocal(x, z);
  return (Math.abs(p.x) < EYELENSE.forecourtHalfX + radius && Math.abs(p.z) < EYELENSE.forecourtHalfZ + radius)
    || (p.x > -10 - radius && p.x < 8 + radius && Math.abs(p.z) < 2.5 + radius);
}
/** Meadow around the whole assembly and seats; canopies stay outside, grass grows beyond the limestone. */
export function eyelenseClearing(x: number, z: number, radius = 0): boolean {
  const p = eyelenseLocal(x, z); return p.x > -13 - radius && p.x < 11 + radius && Math.abs(p.z) < 14 + radius;
}
/** Flatten the forecourt and ease into the surrounding foothill, without affecting the Science route. */
export function eyelenseGrade(x: number, z: number): number {
  const p = eyelenseLocal(x, z), d = Math.max(Math.abs(p.x) - 12, Math.abs(p.z) - 13, 0), t = Math.min(1, d / 10);
  return 1 - t * t * (3 - 2 * t);
}
