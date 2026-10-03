import * as THREE from 'three';
import { WALKING_NETWORK } from './landscape';
import { KERB_WIDTH } from './path-kerbs';
import { GARDENS, WATER_EYES } from './living-waters-layout';
import type { Point } from './living-waters-layout';

/** A water eye's stone lip runs this far outside the garden paving's edge: past the path kerb, with a strip of silver between. */
export const EYE_PATH_MARGIN = KERB_WIDTH + .3;
/** Marching-squares step (m); straight cell edges and corners come back exact, so it only shapes the curves beside paths. */
const STEP = .2;
/** Smooth-max width where a path meets a cell edge: slivers at shallow crossings blunt instead of ending in needle tips. */
const BLEND = .6;
/** Pieces smaller than this (m²), or thinner than twice MIN_REACH, stay silver. */
const MIN_AREA = 1.2, MIN_REACH = .3;

export interface WaterEye {
  /** Index into WATER_EYES of the cell this piece was cut from; a path across a cell leaves two pieces with one index. */
  cell: number;
  /** Closed outline, counter-clockwise in (x, z) like WATER_EYES, garden-local. */
  outline: Point[];
  /** Where the water is deepest-looking and plants stand: the centroid of an uncut cell, the most interior point of a cut one. */
  center: Point;
  /** Clear distance from `center` to the outline. */
  reach: number;
  /** False for cells no path comes near: their outline is the WATER_EYES cell itself. */
  cut: boolean;
}

const area = (outline: readonly Point[]): number => outline.reduce((sum, [x, z], i) => { const [nx, nz] = outline[(i + 1) % outline.length]; return sum + x * nz - nx * z; }, 0) / 2;
/** Distance from a point to the nearest edge of a closed outline. */
export function clearance(x: number, z: number, outline: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % outline.length], dx = bx - ax, dz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
/** Star-shaped from `c`: every edge keeps it on its inner (left) side, so a fan from it covers the outline exactly once. */
export function fansFrom(outline: readonly Point[], [cx, cz]: Point): boolean {
  return outline.every(([ax, az], i) => { const [bx, bz] = outline[(i + 1) % outline.length]; return (bx - ax) * (cz - az) - (bz - az) * (cx - ax) > 1e-6; });
}

let built: WaterEye[] | null = null;
/**
 * The lake's water eyes with the garden paths kept dry. WATER_EYES were cut from the silver network before the paved paths
 * crossed it, so their stone lips ran over the paving. Every cell a path comes near is outlined again as the cell less the
 * ground within EYE_PATH_MARGIN of the merged paving (WALKING_NETWORK, the same field the paving and kerbs follow): marching
 * squares on a smooth max of the two distances, with crossings refined on the field, the cell's own corners put back exactly
 * and straight runs reduced to their ends. A path across a cell splits it. Garden-local and computed once.
 */
export function waterEyes(): WaterEye[] {
  if (built) return built;
  built = [];
  const reach = EYE_PATH_MARGIN + BLEND + 1;
  const pathTerm = (x: number, z: number): number => EYE_PATH_MARGIN - WALKING_NETWORK.edge(x + GARDENS.x, z + GARDENS.z, reach);
  WATER_EYES.forEach((cell, index) => {
    // WATER_EYES are counter-clockwise in (x, z): outward normals point to each edge's right.
    const normals = cell.map(([ax, az], i) => { const [bx, bz] = cell[(i + 1) % cell.length], length = Math.hypot(bx - ax, bz - az); return [(bz - az) / length, -(bx - ax) / length] as Point; });
    const cellTerm = (x: number, z: number, out?: { edge: number }): number => {
      let best = -Infinity;
      for (let k = 0; k < cell.length; k++) { const d = (x - cell[k][0]) * normals[k][0] + (z - cell[k][1]) * normals[k][1]; if (d > best) { best = d; if (out) out.edge = k; } }
      return best;
    };
    const field = (x: number, z: number): number => { const a = cellTerm(x, z), b = pathTerm(x, z), h = Math.max(BLEND - Math.abs(a - b), 0) / BLEND; return Math.max(a, b) + h * h * BLEND * .25; };
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const [x, z] of cell) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const i0 = Math.floor(minX / STEP) - 2, j0 = Math.floor(minZ / STEP) - 2, nx = Math.ceil(maxX / STEP) + 3 - i0, nz = Math.ceil(maxZ / STEP) + 3 - j0;
    const values = new Float32Array(nx * nz);
    // A one-metre survey of the path field: within .71 m of a survey point the field cannot rise by more than that, so fine
    // points whose survey value lies a metre below the blend skip the field (most of every cell's interior).
    const ci0 = Math.floor(minX) - 1, cj0 = Math.floor(minZ) - 1, cnx = Math.ceil(maxX) + 2 - ci0, cnz = Math.ceil(maxZ) + 2 - cj0, survey = new Float32Array(cnx * cnz);
    for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) survey[j * cnx + i] = pathTerm(ci0 + i, cj0 + j);
    let near = false;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = (i0 + i) * STEP, z = (j0 + j) * STEP, a = cellTerm(x, z);
      // Ground well outside the cell never becomes water, so the path field is only needed in and around it.
      if (a > STEP * 2 || survey[(Math.round(z) - cj0) * cnx + Math.round(x) - ci0] < -BLEND - STEP - 1) { values[j * nx + i] = a; continue; }
      const b = pathTerm(x, z); if (b > -BLEND - STEP) near = true;
      const h = Math.max(BLEND - Math.abs(a - b), 0) / BLEND; values[j * nx + i] = Math.max(a, b) + h * h * BLEND * .25;
    }
    if (!near) {
      const center = cell.reduce(([x, z], p) => [x + p[0] / cell.length, z + p[1] / cell.length] as Point, [0, 0] as Point);
      const clear = Math.min(...cell.map((p, i) => { const q = cell[(i + 1) % cell.length], dx = q[0] - p[0], dz = q[1] - p[1]; return Math.abs(dx * (p[1] - center[1]) - (p[0] - center[0]) * dz) / Math.hypot(dx, dz); }));
      built!.push({ cell: index, outline: cell, center, reach: clear, cut: false }); return;
    }
    // Marching squares, as path-network.ts marches the paving: each square's ring of inside corners and crossings, in
    // counter-clockwise order, links the crossing where the outline enters to the one where it leaves.
    const crossings = new Map<number, Point>(), links = new Map<number, number>();
    const crossing = (ia: number, ja: number, ib: number, jb: number): number => {
      const a = ja * nx + ia, b = jb * nx + ib, key = Math.min(a, b) * 2 + (ja === jb ? 0 : 1);
      if (crossings.has(key)) return key;
      const ax = (i0 + ia) * STEP, az = (j0 + ja) * STEP, dx = (ib - ia) * STEP, dz = (jb - ja) * STEP;
      let lo = 0, hi = 1, flo = values[a], fhi = values[b], t = flo / (flo - fhi);
      for (let k = 0; k < 4; k++) {
        const f = field(ax + dx * t, az + dz * t); if (Math.abs(f) < 1e-6) break;
        if ((f < 0) === (flo < 0)) { lo = t; flo = f; } else { hi = t; fhi = f; }
        t = lo + (hi - lo) * flo / (flo - fhi);
      }
      crossings.set(key, [ax + dx * t, az + dz * t]); return key;
    };
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const c: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], v = c.map(([ci, cj]) => values[cj * nx + ci]), inside = v.map(f => f < 0);
      if (inside.every(s => s === inside[0])) continue;
      const link = (ring: { key: number; edge: boolean }[]): void => { for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length]; if (a.edge && b.edge) links.set(a.key, b.key); } };
      if (inside[0] === inside[2] && inside[1] === inside[3] && v[0] + v[1] + v[2] + v[3] >= 0) {
        for (const k of inside[0] ? [0, 2] : [1, 3]) link([{ key: -1, edge: false }, { key: crossing(...c[k], ...c[(k + 1) % 4]), edge: true }, { key: crossing(...c[(k + 3) % 4], ...c[k]), edge: true }]);
      } else {
        const ring: { key: number; edge: boolean }[] = [];
        for (let k = 0; k < 4; k++) { if (inside[k]) ring.push({ key: -1, edge: false }); if (inside[k] !== inside[(k + 1) % 4]) ring.push({ key: crossing(...c[k], ...c[(k + 1) % 4]), edge: true }); }
        link(ring);
      }
    }
    const seen = new Set<number>(), out = { edge: 0 };
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const loop: Point[] = [];
      for (let key: number | undefined = start; key !== undefined && !seen.has(key); key = links.get(key)) { seen.add(key); loop.push(crossings.get(key)!); }
      if (loop.length < 3) continue;
      // Label each point with the cell edge it lies on (only where the path term is out of the blend), put back the cell
      // corners the squares cut and keep only the ends of straight runs.
      const labels = loop.map(([x, z]) => { const a = cellTerm(x, z, out); return pathTerm(x, z) < a - BLEND - 1e-3 ? out.edge : -1; });
      const exact: Point[] = [], exactLabels: number[] = [];
      loop.forEach((p, k) => {
        exact.push(p); exactLabels.push(labels[k]);
        const from = labels[k], to = labels[(k + 1) % loop.length]; if (from < 0 || to < 0 || from === to) return;
        for (let e = from; e !== to; e = (e + 1) % cell.length) {
          const corner = cell[(e + 1) % cell.length]; if (pathTerm(corner[0], corner[1]) >= -BLEND) break;
          exact.push([corner[0], corner[1]]); exactLabels.push(-2);
        }
      });
      const outline = exact.filter((_, k) => { const label = exactLabels[k]; return label < 0 || exactLabels[(k + exact.length - 1) % exact.length] !== label || exactLabels[(k + 1) % exact.length] !== label; });
      if (area(outline) < MIN_AREA) continue;
      // The most interior grid point of this piece stands in for the centroid: a cut piece need not contain its centroid.
      let center: Point = outline[0], clear = -Infinity;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const f = values[j * nx + i], x = (i0 + i) * STEP, z = (j0 + j) * STEP; if (f >= 0 || -f <= clear) continue;
        const d = clearance(x, z, outline); if (d > clear && pointIn(x, z, outline)) { clear = d; center = [x, z]; }
      }
      if (clear < MIN_REACH) continue;
      built!.push({ cell: index, outline, center, reach: clear, cut: true });
    }
  });
  return built;
}
/** One piece per cell, its largest: lily pads and lake plants keep one site per cell, as before the paths cut some cells. */
export function largestEyes(): WaterEye[] {
  const best = new Map<number, WaterEye>();
  for (const eye of waterEyes()) { const held = best.get(eye.cell); if (!held || area(eye.outline) > area(held.outline)) best.set(eye.cell, eye); }
  return [...best.values()];
}
function pointIn(x: number, z: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside;
}

/**
 * A round stone lip along a closed outline at height `y`: one ring of `sides` vertices per outline point, mitred at every corner
 * (capped at 2.4× so needle tips cannot spike), so sharp cell corners stay sharp and curved runs follow the outline exactly.
 */
export function eyeLip(outline: readonly Point[], y: number, radius: number, sides: number): THREE.BufferGeometry {
  const n = outline.length, positions: number[] = [], normals: number[] = [], index: number[] = [];
  for (let k = 0; k < n; k++) {
    const [px, pz] = outline[(k + n - 1) % n], [x, z] = outline[k], [qx, qz] = outline[(k + 1) % n];
    const ax = x - px, az = z - pz, al = Math.hypot(ax, az) || 1, bx = qx - x, bz = qz - z, bl = Math.hypot(bx, bz) || 1;
    // The bisector of the two edges' right-hand normals points out of the water; the miter keeps the lip's width along both edges.
    const ox = az / al + bz / bl, oz = -ax / al - bx / bl, ol = Math.hypot(ox, oz) || 1, miter = Math.min(2.4, 1 / Math.max(.2, (ox / ol) * (az / al) + (oz / ol) * (-ax / al)));
    for (let s = 0; s < sides; s++) {
      const angle = s / sides * Math.PI * 2, across = Math.cos(angle), up = Math.sin(angle);
      positions.push(x + ox / ol * across * radius * miter, y + up * radius, z + oz / ol * across * radius * miter);
      normals.push(ox / ol * across, up, oz / ol * across);
      const a = k * sides + s, b = k * sides + (s + 1) % sides, c = (k + 1) % n * sides + s, d = (k + 1) % n * sides + (s + 1) % sides;
      index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(index);
  return geometry;
}
