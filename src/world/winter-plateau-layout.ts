/** The Eye's snowfield above the Jepii Mici chimney. No terrain imports: rendering and physics sample the same field. */
export const WINTER_PLATEAU = { x: -71.5, z: -282.5, a: 31, b: 11.5, corner: 6, level: 43.5 } as const;
export const WINTER_SITE = { x: -78, z: -283, base: WINTER_PLATEAU.level } as const;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smooth = (n: number, a: number, b: number): number => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Positive metres inside a broad shelf, with rounded corners rather than sharp rectangular cliffs. */
export function winterPlateauInside(x: number, z: number): number {
  const p = WINTER_PLATEAU, qx = Math.abs(x - p.x) - (p.a - p.corner), qz = Math.abs(z - p.z) - (p.b - p.corner);
  return p.corner - Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - Math.min(Math.max(qx, qz), 0);
}
export function winterPlateauMask(x: number, z: number): number { return smooth(winterPlateauInside(x, z), -3, 3.5); }
/** The room sits above the source shank's foot; a broad snow ramp reaches it without distorting the silver. */
export function winterPlateauHeight(x: number, z: number): number {
  const dx = x - WINTER_SITE.x, dz = z - WINTER_SITE.z;
  const ramp = clamp((30 - dx) / 19), rear = clamp((dx + 7) / 4), edge = clamp((12 - Math.abs(dz)) / 4);
  const ends = clamp((dx + 22) / 6) * clamp((34 - dx) / 6), t = edge * ends;
  const grade = 4.92 * ramp * rear * smooth(t, 0, 1);
  // Small concentric drifts spread from the eye; they fade out of its footprint and away from the walking approach.
  const r = Math.hypot(dx, dz), drifts = .28 * Math.pow(Math.sin(r * .42), 2) * smooth(Math.abs(dz), 4, 8) * smooth(r, 9, 16);
  return WINTER_SITE.base + grade + drifts;
}
export const WINTER_APPROACH = [
  { x: -50.5, z: -275.4 }, { x: -54, z: -277.4 }, { x: -59, z: -280.8 }, { x: WINTER_SITE.x + 10.7, z: WINTER_SITE.z },
] as const;
/** The snow boot-print route branches at the chimney's head and climbs to the iris forecourt. */
export function winterApproachFrame(x: number, z: number): { d: number; along: number; across: number; dx: number; dz: number } {
  let d = Infinity, along = 0, across = 0, dx = 0, dz = 0, length = 0;
  for (let k = 1; k < WINTER_APPROACH.length; k++) {
    const a = WINTER_APPROACH[k - 1], b = WINTER_APPROACH[k], vx = b.x - a.x, vz = b.z - a.z, l = Math.hypot(vx, vz);
    const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / (l * l)), cx = a.x + vx * t, cz = a.z + vz * t, distance = Math.hypot(x - cx, z - cz);
    if (distance < d) { d = distance; along = length + l * t; dx = vx / l; dz = vz / l; across = (x - cx) * -dz + (z - cz) * dx; }
    length += l;
  }
  return { d, along, across, dx, dz };
}
/** Additional rope-fence sites around the snow shelf; shared rim filtering removes the former meadow fence at the join. */
export function winterPlateauRim(inset = 1.3): { x: number; z: number; out: { x: number; z: number } }[] {
  const p = WINTER_PLATEAU, points: { x: number; z: number; out: { x: number; z: number } }[] = [];
  for (let side = 0; side < 4; side++) for (let k = 0; k < 32; k++) {
    const angle = (side + k / 32) * Math.PI / 2, nx = Math.cos(angle), nz = Math.sin(angle);
    // Intersect a radial ray with the rounded shelf's signed boundary.
    let lo = 0, hi = 40;
    for (let j = 0; j < 18; j++) { const r = (lo + hi) / 2; if (winterPlateauInside(p.x + nx * r, p.z + nz * r) > inset) lo = r; else hi = r; }
    const x = p.x + nx * lo, z = p.z + nz * lo, gx = winterPlateauInside(x + .1, z) - winterPlateauInside(x - .1, z), gz = winterPlateauInside(x, z + .1) - winterPlateauInside(x, z - .1), l = Math.hypot(gx, gz);
    if (!points.length || Math.hypot(x - points[points.length - 1].x, z - points[points.length - 1].z) > 2) points.push({ x, z, out: { x: -gx / l, z: -gz / l } });
  }
  return points;
}
