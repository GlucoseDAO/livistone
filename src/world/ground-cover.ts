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
  const freshness = broad;
  return { soil: Math.min(.48, .015 + wear * (.08 + patches * .12) + bank * .3), shade: .88 + broad * .16 + patches * .07, freshness };
}
