import { WINTER_SITE, winterPlateauHeight, winterPlateauMask } from './winter-plateau-layout';
/** Approved two-stone Eye of Winter. Metres; the source silver is only scaled and rigidly rotated. */
export const WINTER = {
  x: WINTER_SITE.x, z: WINTER_SITE.z, scale: 1.5, sourceHeadY: 9.4,
  silverBase: WINTER_SITE.base + .13, centreY: WINTER_SITE.base + 9.12, quartzX: WINTER_SITE.x + 2.1, radius: 5.55, depth: 4.6,
  floor: WINTER_SITE.base + 5.05, doorRadius: 2.1, doorY: WINTER_SITE.base + 5.05 + 2.1 * Math.sqrt(3) / 2,
  arrivalX: WINTER_SITE.x + 10.7, plazaX: WINTER_SITE.x + 7, plazaRadius: 4,
} as const;

export const WINTER_ARRIVAL = { x: WINTER.x + 21.5, z: WINTER.z, y: winterPlateauHeight(WINTER.x + 21.5, WINTER.z) + .95, yaw: Math.PI / 2 };
export const WINTER_POSTER = { x: WINTER.x + 11, z: WINTER.z + 6, y: winterPlateauHeight(WINTER.x + 11, WINTER.z + 6), yaw: 2.09 };

/** The complete silver assembly, stones and forecourt, including canopy clearance around the trailing rings. */
export function winterClearing(x: number, z: number, radius = 0): boolean {
  return x > WINTER.x - 16 - radius && x < WINTER.x + 14 + radius && Math.abs(z - WINTER.z) < 8 + radius;
}
export function winterGround(x: number, z: number, radius = 0): boolean {
  return Math.hypot(x - WINTER_POSTER.x, z - WINTER_POSTER.z) < 1.4 + radius
    || (Math.abs(x - WINTER.quartzX) < 3.4 + radius && Math.abs(z - WINTER.z) < 3.7 + radius)
    || (x > WINTER.x - 16 - radius && x < WINTER.x + 3 + radius && Math.abs(z - WINTER.z) < 6.5 + radius)
    || Math.hypot(x - WINTER.plazaX, z - WINTER.z) < WINTER.plazaRadius + radius;
}
/** A gentle rising approach seats the eye above the original rings' lowest point without reshaping the source metal. */
export function winterGrade(x: number, z: number): { height: number; weight: number } {
  return { height: winterPlateauHeight(x, z), weight: winterPlateauMask(x, z) };
}
