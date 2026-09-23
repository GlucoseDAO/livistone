// East of the arrival path, facing visitors approaching the bridge from the station.
export const INTRODUCTION_SITE = { x: 5.9, z: 46.5, yaw: -.25 };
export const INTRODUCTION_SCALE = 1.35;
export function introductionClearing(x: number, z: number, radius: number): boolean {
  return Math.abs(x - INTRODUCTION_SITE.x) < 3.5 + radius && Math.abs(z - INTRODUCTION_SITE.z) < 3.5 + radius;
}
