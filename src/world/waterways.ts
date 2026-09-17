/** Shared channel boundaries for terrain, water, rocks and planting. */
export function riverCenter(x: number): number { return 26 + Math.sin(x * .036) * 4 + Math.sin(x * .075) * 3 * Math.min(1, Math.abs(x) / 35); }
export function riverWidthVariation(x: number): number { return .38 * Math.sin(x * .19) + .18 * Math.sin(x * .53); }
export function tributaryCenter(z: number, side: number): number { return side * (57 + 6 * Math.sin((z + 12) * .065)); }
export function waterDistance(x: number, z: number): number {
  let distance = Math.abs(z - riverCenter(x)) - 7.3 - riverWidthVariation(x);
  // Tributaries rise below the railway and merge into the main river at its banks.
  if (z > -58 && z < 32) for (const side of [-1, 1]) {
    const cap = Math.min(1, (z + 58) / 8), width = (3.5 + .45 * Math.sin(z * .21)) * cap;
    distance = Math.min(distance, Math.abs(x - tributaryCenter(z, side)) - width);
  }
  return distance;
}
export const GARDEN_BRIDGES = [{ x: -57, z: -12, yaw: Math.PI / 2, scale: .65 }, { x: 57, z: -12, yaw: Math.PI / 2, scale: .65 }];
export const TIME_TOWER = { x: 17, z: -39, radius: 4.8 };
