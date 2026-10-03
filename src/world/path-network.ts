import * as THREE from 'three';

/**
 * Size of the fillet where two routes meet (m). The routes' distance fields join with a smooth minimum, which rounds every
 * inside corner of a junction with a radius of about .85 × this and fills edge gaps narrower than half of it.
 */
export const PATH_FILLET = 2;
const CELL = 4, STRIDE = 8;

export interface Road {
  curve: THREE.Curve<THREE.Vector3>;
  /** Paved width at a point of the curve. */
  width: number | ((p: THREE.Vector3) => number);
  /** Ground kept clear of plants beyond the paving edge (clearance()). */
  margin?: number;
  /** Output mesh that the road's paving and kerbs join (surface()). */
  group?: number;
}
/** A closed outline of the merged paving, its points running one way round; each point carries the group of the paving inside it. */
export interface PathContour { x: number[]; z: number[]; group: number[] }

const smin = (a: number, b: number, k: number): number => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };

/**
 * A walking network as one merged surface: each road is a polyline with a half-width, and the network's signed distance field
 * is the smooth union of the roads' own fields. Paving, kerbs and every clearance read the same field, so junctions are one
 * continuous surface with filleted corners and nothing planted on them. Pure and DOM-independent.
 */
export class PathNetwork {
  /** Road ends that stop on open ground rather than inside another road's paving: kerbs leave these open. */
  readonly freeEnds: { x: number; z: number; half: number }[] = [];
  private readonly segments: Float64Array;
  private readonly bins: number[][];
  private readonly minX: number; private readonly minZ: number; private readonly nx: number; private readonly nz: number;
  private readonly maxHalf: number; private readonly maxMargin: number;
  private readonly bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  private readonly best: Float64Array; private readonly touched: number[] = [];

  constructor(readonly roads: readonly Road[], readonly fillet = PATH_FILLET) {
    const data: number[] = [];
    roads.forEach((road, r) => {
      const points = road.curve.getSpacedPoints(Math.max(2, Math.ceil(road.curve.getLength() / .2)));
      const half = points.map(p => (typeof road.width === 'number' ? road.width : road.width(p)) / 2);
      // Keep a fine sample only where a longer chord would stray more than 4 mm from the curve or its width: tight bends stay
      // round, straight runs stay cheap.
      for (let a = 0; a < points.length - 1;) {
        let b = a + 1;
        for (let next = a + 2; next < points.length && points[next].distanceTo(points[a]) < 3; next++) {
          const ax = points[a].x, az = points[a].z, dx = points[next].x - ax, dz = points[next].z - az, length = Math.hypot(dx, dz);
          let fits = true;
          for (let k = a + 1; k < next && fits; k++) {
            const t = ((points[k].x - ax) * dx + (points[k].z - az) * dz) / (length * length);
            fits = Math.abs((points[k].x - ax) * dz - (points[k].z - az) * dx) / length < .004 && Math.abs(half[a] + (half[next] - half[a]) * t - half[k]) < .004;
          }
          if (!fits) break; b = next;
        }
        data.push(points[a].x, points[a].z, points[b].x, points[b].z, half[a], half[b], road.margin ?? 0, r); a = b;
      }
    });
    this.segments = Float64Array.from(data); this.best = new Float64Array(roads.length).fill(Infinity);
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxHalf = 0, maxMargin = 0;
    for (let o = 0; o < data.length; o += STRIDE) {
      minX = Math.min(minX, data[o], data[o + 2]); maxX = Math.max(maxX, data[o], data[o + 2]); minZ = Math.min(minZ, data[o + 1], data[o + 3]); maxZ = Math.max(maxZ, data[o + 1], data[o + 3]);
      maxHalf = Math.max(maxHalf, data[o + 4], data[o + 5]); maxMargin = Math.max(maxMargin, data[o + 6]);
    }
    this.minX = minX - CELL; this.minZ = minZ - CELL; this.nx = Math.ceil((maxX - this.minX) / CELL) + 2; this.nz = Math.ceil((maxZ - this.minZ) / CELL) + 2;
    this.maxHalf = maxHalf; this.maxMargin = maxMargin; this.bounds = { minX, minZ, maxX, maxZ };
    this.bins = Array.from({ length: this.nx * this.nz }, () => []);
    for (let o = 0, s = 0; o < data.length; o += STRIDE, s++) {
      for (let j = Math.floor((Math.min(data[o + 1], data[o + 3]) - this.minZ) / CELL); j <= Math.floor((Math.max(data[o + 1], data[o + 3]) - this.minZ) / CELL); j++)
        for (let i = Math.floor((Math.min(data[o], data[o + 2]) - this.minX) / CELL); i <= Math.floor((Math.max(data[o], data[o + 2]) - this.minX) / CELL); i++) this.bins[j * this.nx + i].push(s);
    }
    // An end lying inside another road's paving is a junction; the rest stop at bridges, thresholds and doors.
    roads.forEach((road, r) => {
      for (const t of [0, 1]) {
        const p = road.curve.getPoint(t), others = this.scan(p.x, p.z, this.maxHalf + 1, false, r);
        let inside = Infinity; for (const o of others) { inside = Math.min(inside, this.best[o]); this.best[o] = Infinity; }
        if (!(inside < -.25)) this.freeEnds.push({ x: p.x, z: p.z, half: (typeof road.width === 'number' ? road.width : road.width(p)) / 2 });
      }
    });
  }

  /** Fills `best` with each nearby road's own field and returns the roads it touched; every segment within `span` is seen. */
  private scan(x: number, z: number, span: number, margin: boolean, exclude = -1): number[] {
    const touched = this.touched, best = this.best, segments = this.segments; touched.length = 0;
    const i0 = Math.max(0, Math.floor((x - span - this.minX) / CELL)), i1 = Math.min(this.nx - 1, Math.floor((x + span - this.minX) / CELL));
    const j0 = Math.max(0, Math.floor((z - span - this.minZ) / CELL)), j1 = Math.min(this.nz - 1, Math.floor((z + span - this.minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const s of this.bins[j * this.nx + i]) {
      const o = s * STRIDE, road = segments[o + 7]; if (road === exclude) continue;
      const ax = segments[o], az = segments[o + 1], dx = segments[o + 2] - ax, dz = segments[o + 3] - az, length2 = dx * dx + dz * dz;
      const t = length2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / length2)) : 0;
      const value = Math.hypot(x - ax - dx * t, z - az - dz * t) - segments[o + 4] - (segments[o + 5] - segments[o + 4]) * t - (margin ? segments[o + 6] : 0);
      if (best[road] === Infinity) touched.push(road);
      if (value < best[road]) best[road] = value;
    }
    return touched;
  }
  /** Smooth union of the scanned roads, in road order so every caller gets the same value; also resets `best`. */
  private fold(touched: number[], nearest?: { road: number }): number {
    touched.sort((a, b) => a - b);
    let value = Infinity, low = Infinity;
    for (const road of touched) {
      const own = this.best[road]; this.best[road] = Infinity;
      if (nearest && own < low) { low = own; nearest.road = road; }
      value = smin(value, own, this.fillet);
    }
    return value;
  }
  private field(x: number, z: number, reach: number, margin: boolean, nearest?: { road: number }): number {
    if (nearest) nearest.road = -1;
    // Roads farther than reach + fillet cannot lower a value below reach, so the cap never depends on how far we looked.
    return Math.min(reach, this.fold(this.scan(x, z, reach + this.fillet + this.maxHalf + (margin ? this.maxMargin : 0), margin), nearest));
  }
  /** Signed distance from the merged paving's edge (negative on the paving), capped at `reach`. */
  edge(x: number, z: number, reach = 4): number { return this.field(x, z, reach, false); }
  /** The same, less each road's planting margin: plants of radius r fit where this is at least r. Capped at `reach`. */
  clearance(x: number, z: number, reach: number): number { return this.field(x, z, reach, true); }
  /** The road whose own paving is nearest (its group owns the paving and kerbs there), or -1 beyond `reach`. */
  nearest(x: number, z: number, reach = 4): number { const out = { road: -1 }; this.field(x, z, reach, false, out); return out.road; }

  /**
   * Marching squares over a world-aligned grid of `step` metres: one indexed paving mesh per group with world UVs (x / 4, z / 4)
   * and `height` per vertex, plus the closed outlines that the kerbs follow. Neighbouring groups share their boundary vertices.
   */
  surface(step: number, height: (x: number, z: number, group: number) => number, groups = 1): { paving: THREE.BufferGeometry[]; contours: PathContour[] } {
    const pad = this.fillet + this.maxHalf + step, { minX, minZ, maxX, maxZ } = this.bounds, i0 = Math.floor((minX - pad) / step), j0 = Math.floor((minZ - pad) / step);
    const nx = Math.ceil((maxX + pad) / step) - i0 + 1, nz = Math.ceil((maxZ + pad) / step) - j0 + 1;
    const values = new Float32Array(nx * nz), owners = new Int8Array(nx * nz), nearest = { road: -1 };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const n = j * nx + i; values[n] = this.field((i0 + i) * step, (j0 + j) * step, step * 2, false, nearest);
      owners[n] = nearest.road < 0 ? 0 : this.roads[nearest.road].group ?? 0;
    }
    const positions: number[] = [], vertexGroup: number[] = [], ids = new Map<number, number>(), triangles: number[][] = Array.from({ length: groups }, () => []);
    const vertex = (key: number, x: number, z: number, group: number): number => {
      let id = ids.get(key); if (id !== undefined) return id;
      id = positions.length / 3; ids.set(key, id); positions.push(x, height(x, z, group), z); vertexGroup.push(group); return id;
    };
    const corner = (i: number, j: number): number => { const n = j * nx + i; return vertex(n * 3, (i0 + i) * step, (j0 + j) * step, owners[n]); };
    // A crossing on the edge from corner a to corner b (one inside, one outside); its group is the inside corner's.
    const crossing = (ia: number, ja: number, ib: number, jb: number): number => {
      const a = ja * nx + ia, b = jb * nx + ib, key = Math.min(a, b) * 3 + (ja === jb ? 1 : 2);
      if (ids.has(key)) return ids.get(key)!;
      // Linear interpolation leaves curved edges up to h² / 8R inside or out; three false-position steps on the field itself
      // put the crossing on the true outline.
      const ax = (i0 + ia) * step, az = (j0 + ja) * step, dx = (ib - ia) * step, dz = (jb - ja) * step;
      let lo = 0, hi = 1, flo = values[a], fhi = values[b], t = flo / (flo - fhi);
      for (let k = 0; k < 3; k++) {
        const f = this.field(ax + dx * t, az + dz * t, step * 2, false);
        if (Math.abs(f) < 1e-5) break;
        if ((f < 0) === (flo < 0)) { lo = t; flo = f; } else { hi = t; fhi = f; }
        t = lo + (hi - lo) * flo / (flo - fhi);
      }
      return vertex(key, ax + dx * t, az + dz * t, owners[values[a] < 0 ? a : b]);
    };
    // Each outline piece runs from the crossing where a cell's ring leaves the paving to the one where it comes back in.
    let c: number[][] = [];
    const links = new Map<number, number>(), quad = (k: number): [number, number] => c[k] as [number, number];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const n = j * nx + i; if (values[n] >= 0 && values[n + 1] >= 0 && values[n + nx] >= 0 && values[n + nx + 1] >= 0) continue;
      c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const v = c.map(([ci, cj]) => values[cj * nx + ci]), inside = v.map(value => value < 0);
      let deepest = 0; for (let k = 1; k < 4; k++) if (v[k] < v[deepest]) deepest = k;
      const out = triangles[owners[c[deepest][1] * nx + c[deepest][0]]], rings: { id: number; edge: boolean }[][] = [];
      // Diagonal corners alone inside stay apart unless the cell's centre is inside too.
      if (inside[0] === inside[2] && inside[1] === inside[3] && inside[0] !== inside[1] && v[0] + v[1] + v[2] + v[3] >= 0) {
        for (const k of inside[0] ? [0, 2] : [1, 3]) rings.push([{ id: corner(...quad(k)), edge: false }, { id: crossing(...quad(k), ...quad((k + 1) % 4)), edge: true }, { id: crossing(...quad((k + 3) % 4), ...quad(k)), edge: true }]);
      } else {
        const ring: { id: number; edge: boolean }[] = [];
        for (let k = 0; k < 4; k++) {
          if (inside[k]) ring.push({ id: corner(...quad(k)), edge: false });
          if (inside[k] !== inside[(k + 1) % 4]) ring.push({ id: crossing(...quad(k), ...quad((k + 1) % 4)), edge: true });
        }
        rings.push(ring);
      }
      for (const ring of rings) {
        // The ring runs clockwise seen from above; reversing each fan triangle faces the paving up.
        for (let k = 1; k < ring.length - 1; k++) out.push(ring[0].id, ring[k + 1].id, ring[k].id);
        for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; if (a.edge && b.edge) links.set(a.id, b.id); }
      }
    }
    const paving = triangles.map(list => {
      const remap = new Map<number, number>(), position: number[] = [], uv: number[] = [], index: number[] = [];
      for (const id of list) {
        let local = remap.get(id);
        if (local === undefined) { local = position.length / 3; remap.set(id, local); position.push(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]); uv.push(positions[id * 3] / 4, positions[id * 3 + 2] / 4); }
        index.push(local);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.setIndex(index); geometry.computeVertexNormals(); return geometry;
    });
    const contours: PathContour[] = [], seen = new Set<number>();
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const contour: PathContour = { x: [], z: [], group: [] };
      for (let id: number | undefined = start; id !== undefined && !seen.has(id); id = links.get(id)) { seen.add(id); contour.x.push(positions[id * 3]); contour.z.push(positions[id * 3 + 2]); contour.group.push(vertexGroup[id]); }
      if (contour.x.length > 2) contours.push(contour);
    }
    return { paving, contours };
  }
}
