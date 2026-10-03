import * as THREE from 'three';
import type { PathContour } from './path-network';

/** Across the kerb (from its centre, outward) and up (from the paving surface), m. */
const PROFILE = [[-.14, -.18], [.14, -.18], [.14, .085], [.115, .11], [-.115, .11], [-.14, .085]];
/** Kerbs stop this far along a road short of a free end (a bridge, threshold or door), as they always have. */
export const KERB_END_OPENING = 1.7;
/** Width of the kerb beyond the paving edge, and the hairline it keeps from the paving so the two never overlap. */
export const KERB_WIDTH = .28, KERB_SET = .003;

export interface KerbOptions {
  /** Paving surface height for a group; each profile vertex is measured from it. */
  surface: (x: number, z: number, group: number) => number;
  /** Signed distance from the paving edge, positive outside: it turns every kerb outward. */
  edge: (x: number, z: number) => number;
  /** Thresholds where paving runs on into a plaza, platform or floor without a kerb. */
  open: (x: number, z: number) => boolean;
  /** Free road ends; kerbs leave KERB_END_OPENING along the road open before each. */
  ends?: readonly { x: number; z: number; half: number }[];
  reduced: boolean;
  groups?: number;
}

/**
 * Low bevelled stone blocks along the merged paving's outlines (path-network.ts): they follow junction fillets and round road
 * ends like any other edge and leave only thresholds and free ends open. Blocks shorten on tight curves so their joints stay
 * closed. One non-indexed geometry per group; it is also the kerbs' collider.
 */
export function pathKerbs(contours: readonly PathContour[], options: KerbOptions): THREE.BufferGeometry[] {
  const groups = options.groups ?? 1, length = options.reduced ? 1.65 : 1.15, spacing = .2;
  const out = Array.from({ length: groups }, () => ({ positions: [] as number[], colors: [] as number[], uv: [] as number[] }));
  const ends = (options.ends ?? []).map(e => ({ ...e, reach: Math.hypot(KERB_END_OPENING, e.half) }));
  contours.forEach((contour, road) => {
    // Resample the outline evenly; marching squares leaves its points up to a cell diagonal apart.
    const n = contour.x.length, arc = [0];
    for (let k = 0; k < n; k++) arc.push(arc[k] + Math.hypot(contour.x[(k + 1) % n] - contour.x[k], contour.z[(k + 1) % n] - contour.z[k]));
    const total = arc[n]; if (total < 1) return;
    const count = Math.max(8, Math.round(total / spacing)), xs: number[] = [], zs: number[] = [], gs: number[] = [];
    for (let m = 0, k = 0; m < count; m++) {
      const s = m / count * total; while (arc[k + 1] < s) k++;
      const t = (s - arc[k]) / Math.max(1e-9, arc[k + 1] - arc[k]), b = (k + 1) % n;
      xs.push(contour.x[k] + (contour.x[b] - contour.x[k]) * t); zs.push(contour.z[k] + (contour.z[b] - contour.z[k]) * t); gs.push(contour.group[t < .5 ? k : b]);
    }
    const tangent = (m: number): [number, number] => {
      const a = (m - 1 + count) % count, b = (m + 1) % count, dx = xs[b] - xs[a], dz = zs[b] - zs[a], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l];
    };
    // Which perpendicular points off the paving: a majority vote over the outline, robust to a pinched point or two.
    let vote = 0;
    for (let m = 0; m < count; m += Math.max(1, Math.floor(count / 24))) { const [tx, tz] = tangent(m); vote += Math.sign(options.edge(xs[m] - tz * .15, zs[m] + tx * .15) - options.edge(xs[m] + tz * .15, zs[m] - tx * .15)); }
    const side = vote >= 0 ? 1 : -1, normal = (m: number): [number, number] => { const [tx, tz] = tangent(m); return [-tz * side, tx * side]; };
    // Cut blocks at the nominal length, or sooner where the outline turns, so tight fillets and caps get short stones.
    const cuts = [0];
    for (let m = 1, start = 0; m <= count; m++) {
      const [ax, az] = tangent(start), [bx, bz] = tangent(m % count), turn = Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz)));
      if (((m - start) * spacing >= length || turn > .3) && count - m >= 2 || m === count) { cuts.push(m); start = m; }
    }
    for (let block = 0; block < cuts.length - 1; block++) {
      const [m0, m1] = [cuts[block], cuts[block + 1]], mid = Math.round((m0 + m1) / 2) % count, group = gs[mid];
      const points = [[m0, 1], [m1, -1]].map(([m, inward]) => {
        // Joints open 18 mm each side, measured along the outline so every face stays on it.
        const k = m % count, next = (m + inward + count) % count, f = .018 / spacing, [nx, nz] = normal(k);
        const x = xs[k] + (xs[next] - xs[k]) * f, z = zs[k] + (zs[next] - zs[k]) * f;
        return PROFILE.map(([across, up]) => { const out = KERB_SET + (across + .14) / .28 * (KERB_WIDTH - KERB_SET), px = x + nx * out, pz = z + nz * out; return new THREE.Vector3(px, options.surface(px, pz, group) + up, pz); });
      });
      if (points.some(end => end.some(p => options.open(p.x, p.z)))) continue;
      // In the narrow crotch where two routes part, stones from either side would reach across onto the other paving: they stop
      // where their outer face comes within 10 cm of it, leaving the tip of the lawn bare.
      if (points.some(end => end.slice(1, 4).some(p => options.edge(p.x, p.z) < .1))) continue;
      if ([m0, m1].some(m => ends.some(e => Math.hypot(xs[m % count] - e.x, zs[m % count] - e.z) < e.reach))) continue;
      const axis = points[1][0].clone().sub(points[0][0]); axis.y = 0; const blockLength = axis.length(); if (blockLength < .05) continue; axis.normalize();
      const across = points[0][1].clone().sub(points[0][0]); across.y = 0; across.normalize();
      // Faces wind outward whichever way round the outline runs.
      const flip = axis.x * across.z - axis.z * across.x < 0, shade = .87 + ((block * 37 + road * 13) % 17) / 100, target = out[group];
      const emit = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
        for (const p of flip ? [c, b, a] : [a, b, c]) { target.positions.push(p.x, p.y, p.z); const delta = p.clone().sub(points[0][0]); target.uv.push(.04 + delta.dot(axis) / blockLength * .17, .045 + delta.dot(across) / .28 * .10 + (p.y - points[0][0].y) * .06); target.colors.push(shade, shade * .975, shade * .92); }
      };
      for (let j = 0; j < PROFILE.length; j++) { const k = (j + 1) % PROFILE.length; emit(points[0][j], points[1][j], points[0][k]); emit(points[1][j], points[1][k], points[0][k]); }
      for (let j = 1; j < PROFILE.length - 1; j++) { emit(points[0][0], points[0][j], points[0][j + 1]); emit(points[1][0], points[1][j + 1], points[1][j]); }
    }
  });
  return out.map(({ positions, colors, uv }) => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals(); return geometry;
  });
}
