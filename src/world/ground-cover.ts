import { PATH_CURVES, PATH_WIDTH } from './landscape';
import { terrainNoise } from './terrain';
import { waterDistance } from './waterways';

const CELL = 8;
type Segment = { ax: number; az: number; dx: number; dz: number; length2: number };
const bins = new Map<string, Segment[]>();
// Index the authored routes once; do not scan every path for every terrain vertex.
for (const curve of PATH_CURVES) {
  const points = curve.getPoints(100);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const segment = { ax: a.x, az: a.z, dx, dz, length2: dx * dx + dz * dz };
    for (let x = Math.floor((Math.min(a.x, b.x) - 4) / CELL); x <= Math.floor((Math.max(a.x, b.x) + 4) / CELL); x++)
      for (let z = Math.floor((Math.min(a.z, b.z) - 4) / CELL); z <= Math.floor((Math.max(a.z, b.z) + 4) / CELL); z++) {
        const key = `${x},${z}`, bucket = bins.get(key); if (bucket) bucket.push(segment); else bins.set(key, [segment]);
      }
  }
}
export function groundPathDistance(x: number, z: number): number {
  let nearest = 8;
  for (const p of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const t = Math.max(0, Math.min(1, ((x - p.ax) * p.dx + (z - p.az) * p.dz) / (p.length2 || 1)));
    nearest = Math.min(nearest, Math.hypot(x - p.ax - p.dx * t, z - p.az - p.dz * t));
  }
  return nearest;
}
export function groundCover(x: number, z: number): { soil: number; shade: number; freshness: number } {
  const broad = terrainNoise(x * .035 + 19, z * .035 - 7), patches = terrainNoise(x * .18, z * .18 + 41);
  const edge = groundPathDistance(x, z), bank = Math.max(0, 1 - Math.abs(waterDistance(x, z)) / 3.5);
  const wear = Math.max(0, 1 - Math.max(0, edge - PATH_WIDTH / 2) / (1 + patches * 1.6));
  const freshness = Math.min(1, broad * .75 + bank * .25);
  return { soil: Math.min(.55, .025 + wear * (.16 + patches * .17) + bank * .27 + Math.max(0, .4 - broad) * .3), shade: .82 + broad * .22 + patches * .09, freshness };
}

/** Radial falloff shared by the contact-shadow decals and the baked ground shade: full inside 45% of the radius, where an object
 *  usually covers it, then a smooth fade that reaches exactly 0 at the rim. The visible ring just outside a footprint stays strong. */
export function contactFalloff(rho: number): number { const t = Math.min(1, Math.max(0, (rho - .45) / .55)); return 1 - t * t * (3 - 2 * t); }

/** A trunk or crown darkens a disc of ground; strength is the darkening at its centre. */
export interface ShadeDisc { x: number; z: number; radius: number; strength: number }
/** A building footprint: full strength beneath it, fading to nothing `reach` metres outside its walls. Yaw follows Object3D.rotation.y. */
export interface ShadeFootprint { x: number; z: number; rx: number; rz: number; yaw?: number; box?: boolean; reach: number; strength: number }
/** The darkest baked ground shade; stacked crowns never read as black holes. */
export const GROUND_SHADE_MIN = .42;

/** Baked ambient ground occlusion, 1 under open sky. It is stored per terrain vertex (`groundShade`), and the ground material
 *  reads it as ambient occlusion; binning the discs keeps the bake to a handful of distance tests per vertex. */
export function groundShadeField(discs: readonly ShadeDisc[], footprints: readonly ShadeFootprint[] = []): (x: number, z: number) => number {
  const grid = new Map<string, ShadeDisc[]>();
  for (const disc of discs) for (let x = Math.floor((disc.x - disc.radius) / CELL); x <= Math.floor((disc.x + disc.radius) / CELL); x++)
    for (let z = Math.floor((disc.z - disc.radius) / CELL); z <= Math.floor((disc.z + disc.radius) / CELL); z++) {
      const key = `${x},${z}`, bucket = grid.get(key); if (bucket) bucket.push(disc); else grid.set(key, [disc]);
    }
  return (x, z) => {
    let shade = 1;
    for (const disc of grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) shade *= 1 - disc.strength * contactFalloff(Math.hypot(x - disc.x, z - disc.z) / disc.radius);
    for (const f of footprints) {
      const c = Math.cos(f.yaw ?? 0), s = Math.sin(f.yaw ?? 0), dx = x - f.x, dz = z - f.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      // Outside distance to the wall line; the ellipse uses its normalised radius, close enough for a soft falloff.
      const outside = f.box ? Math.hypot(Math.max(0, Math.abs(lx) - f.rx), Math.max(0, Math.abs(lz) - f.rz)) : Math.max(0, Math.hypot(lx / f.rx, lz / f.rz) - 1) * Math.min(f.rx, f.rz);
      if (outside < f.reach) { const t = 1 - outside / f.reach; shade *= 1 - f.strength * t * t; }
    }
    return Math.max(GROUND_SHADE_MIN, shade);
  };
}
