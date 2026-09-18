/** Shared footprint keeps the protein, gallery circulation and surrounding planting apart. */
export const GLUCOSE_PAVILION = { x: 38, z: -40, radius: 9.6, floorY: .16, canopyY: 4.8 };
export const GLUCOSE_POSTERS = [55, 90, 125, 235, 270, 305].map((degrees) => {
  const angle = degrees * Math.PI / 180;
  return { x: GLUCOSE_PAVILION.x + Math.sin(angle) * 7.7, z: GLUCOSE_PAVILION.z + Math.cos(angle) * 7.7, yaw: angle + Math.PI };
});
export function glucoseClearing(x: number, z: number, radius: number): boolean {
  return Math.hypot(x - GLUCOSE_PAVILION.x, z - GLUCOSE_PAVILION.z) < GLUCOSE_PAVILION.radius + 1.4 + radius;
}
