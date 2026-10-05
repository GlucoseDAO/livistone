/** Open-air concept gallery beyond the east-facing exit of Eyelense. */
export const ROTUNDA = { x: 137, z: -36, radius: 17, panels: 14.5, floor: .13 };
export function rotundaGround(x: number, z: number, radius = 0): boolean {
  return Math.hypot(x - ROTUNDA.x, z - ROTUNDA.z) < ROTUNDA.radius + radius || (x > 115 - radius && x < ROTUNDA.x && Math.abs(z - ROTUNDA.z) < 1.3 + radius);
}
export function rotundaClearing(x: number, z: number, radius = 0): boolean { return Math.hypot(x - ROTUNDA.x, z - ROTUNDA.z) < ROTUNDA.radius + 3 + radius; }
export function rotundaGrade(x: number, z: number): number {
  const d = Math.hypot(x - ROTUNDA.x, z - ROTUNDA.z), t = Math.max(0, Math.min(1, (d - ROTUNDA.radius - 2) / 10)); return 1 - t * t * (3 - 2 * t);
}
