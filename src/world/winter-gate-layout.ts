/** Approved two-stone Eye of Winter. Metres; the source silver is only scaled and rigidly rotated. */
export const WINTER = {
  x: -108, z: -30, scale: 1.5, sourceHeadY: 9.4,
  silverBase: .13, centreY: 9.12, quartzX: -105.9, radius: 5.55, depth: 4.6,
  floor: 5.05, doorRadius: 2.1, doorY: 5.05 + 2.1 * Math.sqrt(3) / 2,
  arrivalX: -97.3, plazaX: -101, plazaRadius: 4,
} as const;

/** The complete silver assembly, stones and forecourt, including canopy clearance around the trailing rings. */
export function winterClearing(x: number, z: number, radius = 0): boolean {
  return x > -124 - radius && x < -94 + radius && Math.abs(z - WINTER.z) < 8 + radius;
}
export function winterGround(x: number, z: number, radius = 0): boolean {
  return (Math.abs(x - WINTER.quartzX) < 3.4 + radius && Math.abs(z - WINTER.z) < 3.7 + radius)
    || (x > -124 - radius && x < -105 + radius && Math.abs(z - WINTER.z) < 6.5 + radius)
    || Math.hypot(x - WINTER.plazaX, z - WINTER.z) < WINTER.plazaRadius + radius;
}
/** A gentle rising approach seats the eye above the original rings' lowest point without reshaping the source metal. */
export function winterGrade(x: number, z: number): { height: number; weight: number } {
  const ramp = Math.max(0, Math.min(1, (-x - 78) / 19));
  const rear = Math.max(0, Math.min(1, (x + 115) / 4));
  const edge = Math.max(0, Math.min(1, (12 - Math.abs(z - WINTER.z)) / 4));
  const end = Math.max(0, Math.min(1, (x + 130) / 6)) * Math.max(0, Math.min(1, (-x - 74) / 6));
  const t = edge * end;
  return { height: (WINTER.floor - .13) * ramp * rear, weight: t * t * (3 - 2 * t) };
}
