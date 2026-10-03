// Sub-plan 27 round 2: limestone crags on the mountain. The terrain's two-metre grid can only draw walls leaned back to about 60°
// (steeper ones alias into fins), so sheer rock comes from blocks: a row of them lines both walls of the gorge from its mouth up
// the snow gully, closing the floor in at the narrow passage as in the owner's photograph; boulders lie on its floor; and in the
// rock zones (mountain-layout.ts: the crest's crags above the plateau, the mouth's buttresses, the gorge's walls) and, more
// thinly, on other steep ground, blocks are found from the terrain itself: bedded steps, ledges hung on near-vertical walls,
// rounded conglomerate masses, and talus below the faces. Each block is a stack of slabs between bedding planes (limestone.ts
// shades them like the ground's rock), turned to face down the fall line or into the gorge, tilted by the beds' regional dip and
// lowered until its base lies under every ground mesh that can stand there: never floating, and walking-safe, since one trimesh
// of every block on the walking terrain is its collider on every tier. All of them draw as one mesh in one material; DOM-free
// apart from the material's texture maps.
import * as THREE from 'three';
import { Fn, attribute, cameraViewMatrix, cross, dFdx, dFdy, dot, length, max, normalLocal, normalize, positionLocal, property, select, vec3, vec4 } from 'three/tsl';
import type { ColliderSpec } from '../game/physics';
import type { GraphicsTier } from '../game/graphics';
import type { ContactSite } from './contact-shadows';
import type { GroundDisc } from './grass-field';
import { TERRAIN_GRID, terrainHeight } from './terrain';
import { terrainAxes } from './mountains';
import { GORGE_STREAM, PASSAGE_CABLE, STAGE, TRAIL_HALF, WATERFALL, besideTrail, brookDistance, cragFloorClear, cragKeepsOff, gorgeHalf, passageClosing, rockZone, trailDistance } from './mountain-layout';
import { limestoneBricks, limestoneColour, limestoneNormal, triplanarWeights } from './limestone';
import type { Bricks, Limestone } from './limestone';
export { CRAGS, cragsLook } from './limestone';

export type CragKind = 'bedded' | 'massive' | 'talus';
/** One block: where it stands, how it turns, its size and kind. Its shape follows from `seed`. */
export interface CragSite {
  /** The base outline's centre, at the height that seats the block (`y`). */
  x: number; y: number; z: number;
  /** Object3D-style yaw: local +z faces down the fall line, or into the gorge. */
  yaw: number;
  /** The beds' dip (or a talus block's tumble) after the yaw, as a quaternion. */
  tilt: readonly [number, number, number, number];
  /** Across the fall line (local x), into the slope (local z) and height, metres. */
  width: number; depth: number; height: number;
  kind: CragKind; seed: number;
  /** Ground slope under the block (degrees) and its horizontal reach from (x, z). */
  slope: number; reach: number;
  /** On a near-vertical wall only the block's back is seated: its front juts out of the wall as a ledge with a visible underside. */
  hung: boolean;
  /** How far every point of its outline keeps from the trail's centreline, metres. */
  trail: number;
  /** Stands on the walking terrain (TERRAIN_GRID), so it gets a collider on every tier. */
  collider: boolean;
  /** 0–1: the mobile tier draws the lower half of blocks without a collider, the cpu tier none of them. */
  rank: number;
}
/** The region searched for crags, with rock zones (0–1 density), the ground blocks keep off and the share of rounded masses. */
export interface CragRegion {
  minX: number; maxX: number; minZ: number; maxZ: number;
  weight?: (x: number, z: number) => number;
  /** False where a block may not stand on the ground (checked at every point of its outline from 1.5 m under the ground to 2.5 m over it). */
  clear?: (x: number, z: number, site: CragSite) => boolean;
  /** False where no part of a block may stand at any height (a waterfall's fall). */
  open?: (x: number, z: number) => boolean;
  /** Chance (0–1) that a face block is a rounded conglomerate mass rather than bedded limestone. */
  massive?: (x: number, z: number) => number;
}
/** Points within this distance of a polyline (in plan). */
function nearLine(points: readonly { x: number; z: number }[], x: number, z: number, within: number): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < within) return true;
  }
  return false;
}
/**
 * The Jepii Mici's rock (mountain-layout.ts): every rock zone at full density and other steep ground of the north ridge at a third.
 * Blocks keep off the gorge's walkable floor (but for its boulders and the passage's closing rock), the snow, the plateau's meadow,
 * the gorge's stream and the plateau's brook, and leave the waterfall's fall open.
 */
export const CRAG_REGION: CragRegion = {
  minX: -110, maxX: 60, minZ: -330, maxZ: -200,
  weight: (x, z) => rockZone(x, z) ? 1 : .35,
  clear: (x, z, site) => {
    const dbg0 = (globalThis as { __cragClear?: (r: string, site: CragSite, x: number, z: number) => void }).__cragClear, dbg = dbg0 && ((r: string): void => dbg0(r, site, x, z));
    if (cragKeepsOff(x, z)) { dbg?.('keepsOff'); return false; }
    if (!cragFloorClear(x, z, site.kind === 'talus' && site.width < 2.2)) { dbg?.('floor'); return false; }
    if (nearLine(GORGE_STREAM, x, z, .9)) { dbg?.('stream'); return false; }
    if (brookDistance(x, z) <= 1.2) { dbg?.('brook'); return false; }
    return true;
  },
  open: (x, z) => !nearLine([WATERFALL.lip, WATERFALL.foot], x, z, 1.6),
  massive: () => .22,
};
/** How far a block's outline keeps from the trail's centreline away from the gorge: the tread and a metre beside it stay open. */
export const CRAG_TRAIL_CLEARANCE = TRAIL_HALF + 1;
/** Metres the full outline of every block's foot lies under the lowest ground mesh at its spot. */
export const CRAG_BURY: Record<CragKind, number> = { bedded: .4, massive: .4, talus: .25 };
/** Slope (degrees) from which ground counts as a crag face, and from which a step hangs as a ledge seated by its back. */
const FACE_SLOPE = 47, HUNG_SLOPE = 66;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const smooth = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp;

/** Seeded 3D value noise, 0–1, for the blocks' lumps. */
function lattice(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(seed, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, s = (t: number): number => t * t * (3 - 2 * t);
  const c = (i: number, j: number, k: number): number => lattice(ix + i, iy + j, iz + k, seed), u = s(fx), v = s(fy), w = s(fz);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

/**
 * The ground under the blocks, from cached heights at the town lattice's even coordinates: the collider's two-metre triangles
 * (terrainSurfaceHeight) and the rendered tiles' coarser cells past the near grid (mountains.ts: 4 m on gpu, 8 m on mobile).
 * A block is seated under the lowest of them, so it neither floats on one tier nor on the walking surface.
 */
export class CragGround {
  private readonly heights = new Map<number, number>();
  private readonly axes = [terrainAxes(false, false), terrainAxes(true, false)];
  vertex(x: number, z: number): number {
    const key = (x + 4096) * 8192 + z + 4096; let h = this.heights.get(key);
    if (h === undefined) { h = terrainHeight(x, z); this.heights.set(key, h); }
    return h;
  }
  /** One triangulated lattice with columns xs and rows zs, split along the (x0, z1)–(x1, z0) diagonal as mountainGeometry is. */
  private cell(x: number, z: number, xs: readonly number[], zs: readonly number[]): number {
    const find = (values: readonly number[], v: number): number => { let lo = 0, hi = values.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (values[mid] <= v) lo = mid; else hi = mid - 1; } return lo; };
    const i = find(xs, x), j = find(zs, z), x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1], u = (x - x0) / (x1 - x0), v = (z - z0) / (z1 - z0);
    const h01 = this.vertex(x0, z1), h10 = this.vertex(x1, z0);
    if (u + v <= 1) { const h00 = this.vertex(x0, z0); return h00 + (h10 - h00) * u + (h01 - h00) * v; }
    const h11 = this.vertex(x1, z1); return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  /** The walking terrain's two-metre ground (terrainSurfaceHeight). */
  near(x: number, z: number): number {
    const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, u = (x - x0) / 2, v = (z - z0) / 2, h01 = this.vertex(x0, z0 + 2), h10 = this.vertex(x0 + 2, z0);
    if (u + v <= 1) { const h00 = this.vertex(x0, z0); return h00 + (h10 - h00) * u + (h01 - h00) * v; }
    const h11 = this.vertex(x0 + 2, z0 + 2); return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  /** The rendered ground of one tier (mountainGeometry's cells). */
  rendered(x: number, z: number, mobile: boolean): number { const { xs, zs } = this.axes[mobile ? 1 : 0]; return this.cell(x, z, xs, zs); }
  /** The lowest ground mesh at (x, z): what every block's base must lie under. */
  floor(x: number, z: number): number { return Math.min(this.near(x, z), this.rendered(x, z, false), this.rendered(x, z, true)); }
  /** Upward unit normal of the ground averaged over about four metres, and its slope in degrees. */
  normal(x: number, z: number): { n: THREE.Vector3; slope: number } {
    const gx = (this.near(x + 2, z) - this.near(x - 2, z)) / 4, gz = (this.near(x, z + 2) - this.near(x, z - 2)) / 4, n = new THREE.Vector3(-gx, 1, -gz).normalize();
    return { n, slope: Math.acos(n.y) / DEG };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Shapes

/** One slab between two bedding planes: its outline corners (local x, z, ordered by angle), heights and rounded edge. */
interface Slab { corners: [number, number][]; cx: number; cz: number; y0: number; y1: number; bevel: number }
interface Shape { slabs: Slab[]; crisp: boolean; lump: number }
/** The block's outline, slabs and lumps follow from the site alone, so every tier and the collider share them. */
const shapes = new WeakMap<CragSite, Shape>();
export function cragShape(site: CragSite): Shape {
  let shape = shapes.get(site); if (shape) return shape;
  const rand = random(site.seed), { width: w, depth: d, height: h, kind } = site;
  const sides = kind === 'massive' ? 8 : kind === 'talus' ? 5 : 6, phase = rand();
  const base = Array.from({ length: sides }, (_, k) => {
    const a = (k + phase + (rand() - .5) * .5) / sides * TAU, r = .78 + rand() * .26;
    return [Math.cos(a) * w / 2 * r, Math.sin(a) * d / 2 * r] as [number, number];
  });
  const count = kind === 'massive' ? 1 : kind === 'talus' ? (rand() < .35 ? 2 : 1) : Math.max(2, Math.min(5, Math.round(h / (.8 + rand() * 1.1))));
  const parts = Array.from({ length: count }, () => .5 + rand() * 1.1), total = parts.reduce((a, b) => a + b, 0);
  // Higher beds of a step recede a little into the slope or, now and then, jut out over the one below.
  const run = 1 / Math.tan(Math.max(site.slope, 20) * DEG), recede = kind === 'bedded' ? rand() * .35 : 0, slabs: Slab[] = [];
  let y = 0;
  parts.forEach((part, i) => {
    const t = h * part / total, scale = (kind === 'bedded' ? 1 - .04 * i : 1) + (rand() - .5) * .14, overhang = kind === 'bedded' && i > 0 && rand() < .25 ? (.08 + rand() * .12) * d : 0;
    const dx = (rand() - .5) * .14 * w, dz = -recede * run * y + (rand() - .5) * .16 * d + overhang;
    const corners = base.map(([cx, cz]) => { const r = .88 + rand() * .2; return [cx * scale * r + dx, cz * scale * r + dz] as [number, number]; });
    const bevel = kind === 'massive' ? .32 * Math.min(w, d, h) : Math.min(.06 + rand() * .14, .22 * t, kind === 'talus' ? .2 * Math.min(w, d) : 1);
    slabs.push({ corners, cx: corners.reduce((s, c) => s + c[0], 0) / sides, cz: corners.reduce((s, c) => s + c[1], 0) / sides, y0: y, y1: y + t, bevel });
    y += t;
  });
  shape = { slabs, crisp: kind !== 'massive', lump: kind === 'massive' ? .2 : kind === 'talus' ? .05 : .07 };
  shapes.set(site, shape); return shape;
}
/** The block's frame: yaw, then tilt, at (x, y, z). */
export function frame(site: CragSite, y = site.y): THREE.Matrix4 {
  const q = new THREE.Quaternion(...site.tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw));
  return new THREE.Matrix4().compose(new THREE.Vector3(site.x, y, site.z), q, new THREE.Vector3(1, 1, 1));
}
/** Share of a hung block's depth, from its back, whose base is seated in the wall. */
const HUNG_SEATED = .55;
/**
 * Points along the lowest slab's full outline (corners and three between each) where its rounded foot reaches full width, in the
 * frame `matrix`: all of them, or for a block hung on a wall the back ones (into the wall) up to `HUNG_SEATED` of its depth.
 * Seating these under the ground buries the rounding below them, so even a rounded mass meets the ground as a wall, not a pebble.
 */
function basePoints(shape: Shape, matrix: THREE.Matrix4, hung = false): THREE.Vector3[] {
  const slab = shape.slabs[0], points: THREE.Vector3[] = [], zs = slab.corners.map(c => c[1]), back = Math.min(...zs), cut = back + (Math.max(...zs) - back) * HUNG_SEATED;
  slab.corners.forEach((a, k) => {
    const b = slab.corners[(k + 1) % slab.corners.length];
    for (let s = 0; s < 4; s++) {
      const u = s / 4, p = new THREE.Vector3(a[0] + (b[0] - a[0]) * u, slab.y0 + Math.min(slab.bevel, (slab.y1 - slab.y0) * .45), a[1] + (b[1] - a[1]) * u);
      if (!hung || p.z <= cut) points.push(p.applyMatrix4(matrix));
    }
  });
  return points;
}
/** A point of a slab's outline pulled `by` metres toward its centre, at height y. */
function inset(slab: Slab, x: number, z: number, by: number, y: number): THREE.Vector3 {
  const rx = x - slab.cx, rz = z - slab.cz, r = Math.hypot(rx, rz) || 1, k = Math.max(.05, 1 - by / r);
  return new THREE.Vector3(slab.cx + rx * k, y, slab.cz + rz * k);
}
/** Every slab's full outline at both of its faces, in world space: the block's extent. */
function outlinePoints(shape: Shape, matrix: THREE.Matrix4): THREE.Vector3[] {
  return shape.slabs.flatMap(slab => slab.corners.flatMap(([x, z]) => [new THREE.Vector3(x, slab.y0, z), new THREE.Vector3(x, slab.y1, z)]).map(p => p.applyMatrix4(matrix)));
}
/** The highest origin at which every seated base point lies `CRAG_BURY` under the lowest ground mesh. */
export function seatHeight(site: CragSite, ground: CragGround): number {
  let y = Infinity; for (const p of basePoints(cragShape(site), frame(site, 0), site.hung)) y = Math.min(y, ground.floor(p.x, p.z) - CRAG_BURY[site.kind] - p.y);
  return y;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sites

/** Something a block keeps clear of: a trunk or a boulder. */
export interface CragObstacle { x: number; z: number; radius: number }
/** Most blocks a region holds: face blocks (steps, ledges and masses) and talus, besides the gorge's lining and floor boulders. */
const CAPS = { face: 300, talus: 70 };
const GRID = 8;
/** Seats and keeps blocks that stand clear of the trail, the obstacles, the region's ground and the blocks already kept. */
class Placer {
  readonly sites: CragSite[] = [];
  private readonly grid = new Map<number, CragSite[]>();
  constructor(readonly ground: CragGround, readonly region: CragRegion, readonly obstacles: readonly CragObstacle[]) {}
  private key(i: number, j: number): number { return (i + 512) * 1024 + j + 512; }
  private nearby(x: number, z: number): CragSite[] {
    const i = Math.floor(x / GRID), j = Math.floor(z / GRID), out: CragSite[] = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...this.grid.get(this.key(i + a, j + b)) ?? []);
    return out;
  }
  /**
   * Seats `site` and keeps it if: no trunk or boulder stands within its reach; every point of its outline keeps `site.trail` from
   * the trail and stands where the region leaves open; every point near the ground's surface (a ledge high on a wall or a corner
   * buried deep in it claims none) on ground the region allows; and no block already kept is nearer, in three dimensions, than
   * `overlap` of their summed sizes (0: may touch).
   */
  place(site: CragSite, overlap: number): boolean {
    const shape = cragShape(site), outline = outlinePoints(shape, frame(site, 0));
    site.reach = Math.max(...outline.map(p => Math.hypot(p.x - site.x, p.z - site.z)));
    const why = (reason: string): boolean => { (globalThis as { __cragReject?: (s: CragSite, r: string) => void }).__cragReject?.(site, reason); return false; };
    if (this.obstacles.some(o => Math.hypot(o.x - site.x, o.z - site.z) < o.radius + site.reach)) return why('obstacle');
    if (outline.some(p => trailDistance(p.x, p.z) < site.trail)) return why('trail');
    if (outline.some(p => this.region.open && !this.region.open(p.x, p.z))) return why('open');
    site.y = seatHeight(site, this.ground);
    const clear = this.region.clear;
    if (clear && outline.some(p => { const above = p.y + site.y - this.ground.near(p.x, p.z); return above > -1.5 && above < 2.5 && !clear(p.x, p.z, site); })) return why('clear');
    // Apart in three dimensions: ledges hung one above another on a wall share their plan position.
    const size = (s: CragSite): number => Math.hypot(s.reach, s.height / 2), centre = site.y + site.height / 2;
    if (overlap > 0 && this.nearby(site.x, site.z).some(s => Math.hypot(s.x - site.x, s.y + s.height / 2 - centre, s.z - site.z) < (size(s) + size(site)) * overlap)) return false;
    const end = { x: TERRAIN_GRID.minX + (TERRAIN_GRID.columns - 1) * TERRAIN_GRID.step, z: TERRAIN_GRID.minZ + (TERRAIN_GRID.rows - 1) * TERRAIN_GRID.step };
    site.collider = outline.some(p => p.x > TERRAIN_GRID.minX && p.x < end.x && p.z > TERRAIN_GRID.minZ && p.z < end.z);
    this.sites.push(site);
    const cell = this.key(Math.floor(site.x / GRID), Math.floor(site.z / GRID)); (this.grid.get(cell) ?? this.grid.set(cell, []).get(cell)!).push(site);
    return true;
  }
}
/** The beds' regional dip: about 7° toward the south-south-west everywhere, give or take 3°. */
function bedDip(roll: number): THREE.Quaternion { return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-.94, 0, .34).normalize(), (7 + (roll - .5) * 6) * DEG); }
const site = (fields: Omit<CragSite, 'y' | 'reach' | 'collider'>): CragSite => ({ ...fields, y: 0, reach: 0, collider: false });

/**
 * The gorge's walls lined with sheer rock: from its mouth up the snow gully, a block every 2–4 m on each side, its face at the
 * floor's edge (nearer the trail at the narrow passage, but behind its cable), as high as the wall behind it or a little higher,
 * and deep enough to run back into it. Rounded conglomerate masses below the waterfall, bedded limestone above it and in the gully.
 * Then boulders on the floor, thickest under the waterfall, clear of the trail, its stream and its pool.
 */
function gorgeSites(placer: Placer, rand: () => number): void {
  const ground = placer.ground;
  for (const side of [1, -1]) {
    for (let s = STAGE.mouth - 3; s < STAGE.head - 1;) {
      const draws = Array.from({ length: 10 }, rand), width = 2.8 + draws[0] * 2.4;
      const half = gorgeHalf(s), closing = passageClosing(s), out = (d: number): { x: number; z: number } => besideTrail(s, -side * d);
      // besideTrail's offsets run to the right of the way up, gorgeCoords' sides to the left: hence -side.
      let face = lerp(half - .3 + draws[1] * .35, TRAIL_HALF + .95 + draws[1] * .8, closing);
      if (side === PASSAGE_CABLE.side && s >= PASSAGE_CABLE.from - 1 && s <= PASSAGE_CABLE.to + 1) face = Math.max(face, PASSAGE_CABLE.offset(s) + .06);
      const foot = out(face + .3), floorY = ground.near(foot.x, foot.z);
      const wall = Math.max(...[3, 5, 7, 9].map(d => { const p = out(half + d); return ground.near(p.x, p.z); })) - floorY;
      s += width * (.58 + draws[2] * .2);
      if (wall < 2.4) continue;
      const height = Math.min(11, Math.max(2.6, wall * (.72 + draws[3] * .38)));
      // Deep enough that the block's back top runs into the wall behind it.
      let depth = 3; while (depth < 7) { const back = out(face + depth); if (ground.near(back.x, back.z) - floorY > height - .4) break; depth += .5; }
      const centre = out(face + depth / 2), axis = out(0), yaw = Math.atan2(axis.x - centre.x, axis.z - centre.z);
      const below = s < STAGE.waterfall - 4, kind: CragKind = below && draws[4] < .62 ? 'massive' : 'bedded';
      const tilt = kind === 'massive' ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(draws[5] * TAU), 0, Math.sin(draws[5] * TAU)), draws[6] * 6 * DEG) : bedDip(draws[6]);
      const block = site({ x: centre.x, z: centre.z, yaw, tilt: [tilt.x, tilt.y, tilt.z, tilt.w], width, depth, height, kind, seed: Math.floor(draws[7] * 2 ** 31), slope: 60, hung: false, trail: TRAIL_HALF + .9, rank: draws[8] });
      // A block that does not fit (a boulder, the waterfall, the snow's edge) is tried a little narrower and further back.
      if (!placer.place(block, 0)) placer.place({ ...block, width: width * .7, depth: depth + .4, x: out(face + .5 + depth / 2).x, z: out(face + .5 + depth / 2).z }, 0);
    }
  }
  // Boulders on the floor along the walls, more of them and bigger under the waterfall: a fallen-rock cone, off its pool.
  for (let k = 0, placed = 0; k < 400 && placed < 34; k++) {
    const draws = Array.from({ length: 8 }, rand), s = STAGE.mouth + 5 + draws[0] * (STAGE.snout - STAGE.mouth - 7), near = 1 - smooth(Math.abs(s - STAGE.waterfall), 3, 12);
    const width = .7 + draws[1] * (.7 + .9 * near), half = gorgeHalf(s), d = Math.max(TRAIL_HALF + 1.2 + width * .6, half - .2 - draws[2] * 1.4 * (1 - near * .5)), side = draws[3] < .5 ? 1 : -1;
    const p = besideTrail(s, -side * d), foot = WATERFALL.foot;
    if (Math.hypot(p.x - foot.x, p.z - foot.z) < 2.6 + width || draws[4] > .35 + .6 * near) continue;
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(draws[5] * TAU), 0, Math.sin(draws[5] * TAU)), (6 + 20 * draws[6]) * DEG);
    if (placer.place(site({ x: p.x, z: p.z, yaw: draws[7] * TAU, tilt: [tilt.x, tilt.y, tilt.z, tilt.w], width, depth: width * (.6 + draws[2] * .4), height: width * (.45 + draws[6] * .3), kind: 'talus', seed: Math.floor(draws[0] * 2 ** 31), slope: 10, hung: false, trail: TRAIL_HALF + 1, rank: draws[5] }), .9)) placed++;
  }
}

/**
 * Seeded crag blocks inside `region`: the gorge's lining and floor boulders (unless `gorge` is false), then on ground steeper than
 * about 47° (more on steeper, south-facing faces, and in the rock zones) bedded steps, ledges hung on near-vertical walls or, now
 * and then, rounded masses; on gentler ground within ten metres below such a face, talus. Candidates on a jittered 3 m grid (more
 * in steep cells, which hold more face than their plan shows) are taken best first; face blocks may overlap into continuous crags,
 * talus stays apart. Trunks and boulders (`obstacles`) keep their radius.
 */
export function cragSites(options: { region?: CragRegion; obstacles?: readonly CragObstacle[]; seed?: number; ground?: CragGround; gorge?: boolean } = {}): CragSite[] {
  const region = options.region ?? CRAG_REGION, ground = options.ground ?? new CragGround(), rand = random(options.seed ?? 6151), placer = new Placer(ground, region, options.obstacles ?? []);
  if (options.gorge ?? true) gorgeSites(placer, rand);
  type Candidate = { x: number; z: number; priority: number; talus: number; n: THREE.Vector3; slope: number; draws: number[] };
  const candidates: Candidate[] = [], STEP = 3;
  for (let z = region.maxZ; z >= region.minZ; z -= STEP) for (let x = region.minX; x <= region.maxX; x += STEP) {
    // Every number is drawn up front, so a rejected candidate never shifts the next one. A steep cell holds more face than its
    // plan shows (a 30 m wall is a band a few metres wide in plan), so it gets up to six candidates, about one per 9 m² of face.
    const draws = Array.from({ length: 72 }, rand), cell = ground.normal(x, z).slope, count = Math.min(6, Math.max(1, Math.round(.9 / Math.cos(Math.min(cell, 85) * DEG))));
    for (let i = 0; i < count; i++) {
      const d = draws.slice(i * 12, i * 12 + 12), px = x + (d[0] - .5) * STEP, pz = z + (d[1] - .5) * STEP, weight = region.weight ? region.weight(px, pz) : 1;
      if (weight <= 0 || trailDistance(px, pz) < CRAG_TRAIL_CLEARANCE + .8) continue;
      const { n, slope } = ground.normal(px, pz);
      if (slope >= FACE_SLOPE) {
        // South-facing faces look at the town and the plateau; north faces behind the crest get few.
        const facing = .3 + .7 * smooth(n.z / Math.max(Math.hypot(n.x, n.z), 1e-3), -.6, .3), p = weight * smooth(slope, FACE_SLOPE, 62) * facing * .7;
        if (d[2] < p) candidates.push({ x: px, z: pz, priority: p * (.5 + d[3]), talus: 0, n, slope, draws: d });
        continue;
      }
      if (slope < 6 || i) continue;
      // Talus: within ten metres below a face, more and bigger near its foot.
      const up = new THREE.Vector2(-n.x, -n.z).normalize();
      let cliff = 0; for (const step of [2.5, 5, 7.5, 10]) if (ground.normal(px + up.x * step, pz + up.y * step).slope >= 55) { cliff = 1 - step / 12; break; }
      const p = weight * cliff * .45;
      if (d[2] < p) candidates.push({ x: px, z: pz, priority: p * (.3 + d[3]), talus: cliff, n, slope, draws: d });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority);
  const placed = { face: 0, talus: 0 };
  for (const c of candidates) {
    const talus = c.talus > 0, quota = talus ? 'talus' : 'face'; if (placed[quota] >= CAPS[quota]) continue;
    const [, , , , a, b, k, kindRoll, yawRoll, dipRoll, seedRoll, rankRoll] = c.draws;
    const massive = !talus && kindRoll < (region.massive ? region.massive(c.x, c.z) : .22), kind: CragKind = talus ? 'talus' : massive ? 'massive' : 'bedded', hung = kind === 'bedded' && c.slope > HUNG_SLOPE;
    let width: number, depth: number, height: number, tilt: THREE.Quaternion, yaw = Math.atan2(c.n.x, c.n.z) + (yawRoll - .5) * .5;
    if (kind === 'talus') {
      width = 1.3 + a * (1 + 1.4 * c.talus); depth = width * (.65 + b * .35); height = .7 + k * (.6 + .8 * c.talus); yaw = yawRoll * TAU;
      tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(dipRoll * TAU), 0, Math.sin(dipRoll * TAU)), (8 + 22 * k) * DEG);
    } else {
      // A step stands out of the slope: deep enough that its top runs back into the hillside behind it. On a near-vertical wall
      // a step could stand out only by its height × cot(slope), so it hangs instead: a deeper ledge seated by its back.
      height = massive ? 2.6 + a * 2.8 : 2.2 + a * 3.8 * smooth(c.slope, FACE_SLOPE, 70); width = massive ? 2.8 + b * 2.8 : 2.4 + b * 5.2;
      depth = Math.min(5, (height + .6) / Math.tan(c.slope * DEG) + .4 + k + (hung ? 1.4 + k * .6 : 0));
      // A rounded mass leans as it likes; a hung ledge also tips back into its wall, so its lowest corner is a seated one.
      tilt = massive ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-.94, 0, .34).normalize(), (dipRoll - .5) * 16 * DEG) : bedDip(dipRoll);
      if (hung) tilt.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), -(14 + 6 * dipRoll) * DEG));
    }
    const block = site({ x: c.x, z: c.z, yaw, tilt: [tilt.x, tilt.y, tilt.z, tilt.w], width, depth, height, kind, seed: Math.floor(seedRoll * 2 ** 31), slope: c.slope, hung, trail: CRAG_TRAIL_CLEARANCE + .4, rank: rankRoll });
    if (placer.place(block, talus ? .95 : .55)) placed[quota]++;
    if (placed.face >= CAPS.face && placed.talus >= CAPS.talus) break;
  }
  return placer.sites;
}
/** The blocks a tier draws: every block with a collider (no invisible walls), and on gpu every block; mobile half the rest. */
export function cragsDrawn(sites: readonly CragSite[], tier: GraphicsTier): CragSite[] {
  return sites.filter(s => s.collider || tier === 'gpu' || (tier === 'mobile' && s.rank < .5));
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry

/** Outline subdivisions per edge, rows per rounded edge and whether a bulging middle row is added. */
interface Detail { split: number; round: number; bulge: boolean }
const DETAIL: Record<GraphicsTier | 'collider', Detail> = { gpu: { split: 2, round: 1, bulge: true }, mobile: { split: 1, round: 1, bulge: false }, cpu: { split: 1, round: 1, bulge: false }, collider: { split: 1, round: 1, bulge: false } };

class Builder {
  readonly positions: number[] = []; readonly colors: number[] = []; readonly moss: number[] = []; readonly index: number[] = [];
  constructor(readonly shaded: boolean) {}
  add(p: THREE.Vector3, ao = 1, moss = 0, tint?: THREE.Color): number {
    this.positions.push(p.x, p.y, p.z);
    if (this.shaded) { this.colors.push(tint!.r * ao, tint!.g * ao, tint!.b * ao); this.moss.push(moss); }
    return this.positions.length / 3 - 1;
  }
}
/**
 * One block into `out`: every slab as walls of outline columns × profile rows (sharp at the corners of bedded and talus blocks,
 * smooth round a rounded mass), a top cap, and a bottom cap under every slab but the lowest, whose base lies underground. The
 * collider closes the lowest slab too. Shaded vertices carry an ambient term (joints between beds, overhang undersides, the
 * foot) times the block's tint, and a moss share on ledges.
 */
function emitBlock(out: Builder, site: CragSite, detail: Detail, ground: CragGround | null, closed: boolean): void {
  const shape = cragShape(site), matrix = frame(site), rand = random(site.seed ^ 0x5bd1e995);
  const value = .88 + rand() * .2, warm = rand() - .5, tint = new THREE.Color(value * (1 + warm * .06), value, value * (1 - warm * .08));
  const round = shape.crisp ? detail.round : detail.round + (detail.split > 1 ? 1 : 0);
  shape.slabs.forEach((slab, s) => {
    const t = slab.y1 - slab.y0, b = Math.min(slab.bevel, t * .45), rows: { h: number; in: number; lump: number; ao: number; moss: number }[] = [];
    for (let k = 0; k <= round; k++) { const a = k / round * Math.PI / 2; rows.push({ h: b * (1 - Math.cos(a)), in: b * (1 - Math.sin(a)), lump: k ? 1 : 0, ao: .62 + .38 * k / round, moss: 0 }); }
    if (detail.bulge && t > 2.2 * b) rows.push({ h: t / 2, in: -.04 * Math.min(t, 1.5), lump: 1, ao: 1, moss: 0 });
    for (let k = round; k >= 0; k--) { const a = k / round * Math.PI / 2; rows.push({ h: t - b * (1 - Math.cos(a)), in: b * (1 - Math.sin(a)), lump: 1, ao: .94 + .06 * k / round, moss: k ? .1 : .35 }); }
    const sides = slab.corners.length, columns = sides * detail.split;
    // Outline columns: corners and the points between them, each pushed out or in by the block's lumps.
    const ring = Array.from({ length: columns }, (_, c) => {
      const a = slab.corners[Math.floor(c / detail.split)], e = slab.corners[(Math.floor(c / detail.split) + 1) % sides], u = (c % detail.split) / detail.split;
      return [a[0] + (e[0] - a[0]) * u, a[1] + (e[1] - a[1]) * u] as [number, number];
    });
    const point = (c: number, row: (typeof rows)[number]): THREE.Vector3 => {
      const [x, z] = ring[c % columns], q = inset(slab, x, z, row.in, slab.y0 + row.h), rx = x - slab.cx, rz = z - slab.cz, r = Math.hypot(rx, rz) || 1;
      const bump = (noise(x * .9 + site.seed % 97, (slab.y0 + row.h) * .9, z * .9, site.seed) - .5) * 2 * shape.lump * row.lump;
      return q.set(q.x + rx / r * bump, q.y, q.z + rz / r * bump).applyMatrix4(matrix);
    };
    const vertex = (c: number, row: (typeof rows)[number], ao = row.ao, moss = row.moss): number => {
      const v = point(c, row);
      // Darker where the rock meets the ground.
      if (ground && out.shaded) { const above = v.y - ground.near(v.x, v.z); ao *= .7 + .3 * smooth(above, 0, .8); }
      return out.add(v, ao, moss, tint);
    };
    // Walls: one strip per edge on crisp blocks (their corners stay sharp), one closed ring on a rounded mass.
    const strips = shape.crisp ? Array.from({ length: sides }, (_, e) => Array.from({ length: detail.split + 1 }, (_, j) => e * detail.split + j)) : [Array.from({ length: columns }, (_, j) => j)];
    for (const strip of strips) {
      // A closed ring shares its first column, so a rounded mass has no seam.
      const ids = rows.map(row => strip.map(c => vertex(c, row))), span = shape.crisp ? strip.length - 1 : strip.length, next = (j: number): number => (j + 1) % strip.length;
      for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < span; j++) {
        const a = ids[r][j], bb = ids[r][next(j)], c = ids[r + 1][j], d = ids[r + 1][next(j)];
        out.index.push(a, c, bb, bb, c, d);
      }
    }
    // Caps, from their centre to the top and bottom rows.
    const top = rows[rows.length - 1], bottom = rows[0], dome = Math.min(.12, .03 * site.width);
    const cap = (row: (typeof rows)[number], y: number, up: boolean, ao: number, moss: number): void => {
      const centre = out.add(new THREE.Vector3(slab.cx, y, slab.cz).applyMatrix4(matrix), ao, moss, tint), ids = Array.from({ length: columns }, (_, c) => vertex(c, row, ao, moss));
      for (let c = 0; c < columns; c++) { const a = ids[c], e = ids[(c + 1) % columns]; if (up) out.index.push(centre, e, a); else out.index.push(centre, a, e); }
    };
    cap(top, slab.y1 + dome, true, 1, .5 + .5 * rand());
    if (s > 0 || closed || site.hung) cap(bottom, slab.y0 - dome * .5, false, .5, 0);
  });
}
/** The drawn blocks of a tier as one indexed geometry with normals, `color` (ambient × tint) and `moss`. */
export function cragGeometry(sites: readonly CragSite[], tier: GraphicsTier, ground = new CragGround()): THREE.BufferGeometry {
  const out = new Builder(true);
  for (const site of cragsDrawn(sites, tier)) emitBlock(out, site, DETAIL[tier], ground, false);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.colors, 3));
  geometry.setAttribute('moss', new THREE.Float32BufferAttribute(out.moss, 1));
  geometry.setIndex(out.index); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
/** One trimesh for every block on the walking terrain, closed and at the coarsest detail, the same on every tier. */
export function cragColliders(sites: readonly CragSite[]): ColliderSpec {
  const out = new Builder(false);
  for (const site of sites) if (site.collider) emitBlock(out, site, DETAIL.collider, null, true);
  return { type: 'mesh', vertices: new Float32Array(out.positions), indices: new Uint32Array(out.index) };
}

/** Contact patches where blocks on the walking terrain meet ground gentle enough to read as their foot (not on sheer faces). */
export function cragContactSites(sites: readonly CragSite[]): ContactSite[] {
  return sites.filter(s => s.collider && s.slope < 52 && s.z > -264).map(s => {
    // A step's visible foot is its downhill face; a talus block's is all round it.
    const front = s.kind === 'talus' ? 0 : s.depth * .35;
    return { x: s.x + Math.sin(s.yaw) * front, z: s.z + Math.cos(s.yaw) * front, yaw: s.yaw, rx: s.width / 2 + .55, rz: s.kind === 'talus' ? s.depth / 2 + .55 : 1.1, strength: s.kind === 'talus' ? .85 : .6 };
  });
}
/** Discs that keep the near grass out of blocks standing where it could grow (grass gives way to rock above about 35°). */
export function cragGrassDiscs(sites: readonly CragSite[]): GroundDisc[] {
  return sites.filter(s => s.slope < 40).map(s => ({ x: s.x, z: s.z, radius: s.reach * .85 }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Material and mesh

/**
 * The blocks' limestone (limestone.ts), world-space like the ground's so bedding and joints run on across them: gpu adds the
 * scan's normal map and the joint blocks' facets, mobile keeps the colour work, cpu shades a Lambert node material with one
 * scale of the scan and the bedding only (cpu-detail.ts leaves it alone). Vertex colours (ambient × tint) multiply the result.
 * Until `useMaps` the blocks are plain pale grey.
 */
export function cragMaterial(tier: GraphicsTier): THREE.MeshStandardNodeMaterial | THREE.MeshLambertNodeMaterial {
  const material = tier === 'cpu' ? new THREE.MeshLambertNodeMaterial({ vertexColors: true }) : new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: .92 });
  material.name = 'Limestone crags'; material.color.setRGB(.34, .335, .315, THREE.LinearSRGBColorSpace);
  return material;
}
/** The mountains' rock maps arrive: switch the crags to the shared limestone (no rebuild after load: this runs before compile). */
export function useCragMaps(material: THREE.MeshStandardNodeMaterial | THREE.MeshLambertNodeMaterial, tier: GraphicsTier, rock: THREE.Texture, rockNormal: THREE.Texture | null): void {
  // What the colour stage leaves for the normal stage.
  const tilt = property('vec3', 'cragTilt');
  const inputs = (): Limestone => {
    const p = positionLocal, dpx = dFdx(p), dpy = dFdy(p), n = normalize(normalLocal);
    return { p, dpx, dpy, weights: triplanarWeights(n), normal: n, pixel: max(length(dpx), length(dpy)) };
  };
  const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('crags') === 'debug';
  material.colorNode = Fn(() => {
    const at = inputs(), bricks = limestoneBricks(at.p, at.pixel, tier !== 'cpu');
    tilt.assign(bricks.tilt);
    return debug ? vec3(.8, .05, .02) : limestoneColour(tier, rock, at, bricks, attribute<'float'>('moss', 'float')).albedo;
  })();
  if (tier === 'gpu' && rockNormal && material instanceof THREE.MeshStandardNodeMaterial) material.normalNode = Fn(() => {
    const at = inputs(), bricks = { tilt } as unknown as Bricks;
    // The flat-shaded facet of the mesh keeps lumps visible where the smoothed normal would round them away.
    const face = normalize(cross(dFdx(positionLocal), dFdy(positionLocal))), facing = select(dot(face, at.normal).greaterThanEqual(0), face, face.negate());
    const base = normalize(at.normal.add(facing.mul(.35)));
    return normalize(cameraViewMatrix.mul(vec4(limestoneNormal(rockNormal, at, base, bricks, .5), 0)).xyz);
  })();
  material.needsUpdate = true;
}

export interface Crags { mesh: THREE.Mesh; collider: ColliderSpec; contacts: ContactSite[]; discs: GroundDisc[]; material: THREE.MeshStandardNodeMaterial | THREE.MeshLambertNodeMaterial }
/** The crag blocks of a tier as one mesh, with their collider (every tier), contact patches and grass discs. */
export function createCrags(tier: GraphicsTier, sites: readonly CragSite[], ground = new CragGround()): Crags {
  const material = cragMaterial(tier), mesh = new THREE.Mesh(cragGeometry(sites, tier, ground), material);
  mesh.name = 'Limestone crags'; mesh.castShadow = true; mesh.receiveShadow = true;
  // Seated to the centimetre and already at its tier's detail: cpu-detail.ts must not simplify it.
  mesh.userData.keepGeometry = true;
  return { mesh, collider: cragColliders(sites), contacts: cragContactSites(sites), discs: cragGrassDiscs(sites), material };
}
