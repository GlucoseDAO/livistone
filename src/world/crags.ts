// Sub-plan 27 round 2: limestone crags on the mountain. Blocks are found from the terrain itself, wherever the ground inside a
// region is steep (bedded steps and rounded masses) or lies at the foot of such ground (talus), so they follow whatever the
// layout shapes. Each block is a stack of slabs between bedding planes (limestone.ts shades them like the ground's rock), turned
// to face down the fall line, tilted by the beds' regional dip and lowered until its whole base lies under every ground mesh
// that can stand there: never floating, and walking-safe, since one trimesh of every block on the walking terrain is its
// collider on every tier. Blocks keep clear of the trail, the plateau's meadow, the snow, trees and the trail's boulders.
// All of them draw as one mesh in one material; DOM-free apart from the material's texture maps.
import * as THREE from 'three';
import { Fn, attribute, cameraViewMatrix, cross, dFdx, dFdy, dot, length, max, normalLocal, normalize, positionLocal, property, select, vec3, vec4 } from 'three/tsl';
import type { ColliderSpec } from '../game/physics';
import type { GraphicsTier } from '../game/graphics';
import type { ContactSite } from './contact-shadows';
import type { GroundDisc } from './grass-field';
import { TERRAIN_GRID, terrainHeight } from './terrain';
import { terrainAxes } from './mountains';
import { TRAIL_HALF, plateauHeight, plateauMask, plateauRadius, snowCover, trailDistance, turfCover } from './mountain-layout';
import { limestoneBricks, limestoneColour, limestoneNormal, triplanarWeights } from './limestone';
import type { Bricks, Limestone } from './limestone';
export { CRAGS, cragsLook } from './limestone';

export type CragKind = 'bedded' | 'massive' | 'talus';
/** One block: where it stands, how it turns, its size and kind. Its shape follows from `seed`. */
export interface CragSite {
  /** The base outline's centre, at the height that seats the block (`y`). */
  x: number; y: number; z: number;
  /** Object3D-style yaw: local +z faces down the fall line. */
  yaw: number;
  /** The beds' dip (or a talus block's tumble) after the yaw, as a quaternion. */
  tilt: readonly [number, number, number, number];
  /** Along the contour (local x), into the slope (local z) and height, metres. */
  width: number; depth: number; height: number;
  kind: CragKind; seed: number;
  /** Ground slope under the block (degrees) and its horizontal reach from (x, z). */
  slope: number; reach: number;
  /** On a near-vertical wall only the block's back is seated: its front juts out of the wall as a ledge with a visible underside. */
  hung: boolean;
  /** Stands on the walking terrain (TERRAIN_GRID), so it gets a collider on every tier. */
  collider: boolean;
  /** 0–1: the mobile tier draws the lower half of blocks without a collider, the cpu tier none of them. */
  rank: number;
}
/** The region searched for crags, with optional rock zones (0–1 density), extra clearance and the share of rounded masses. */
export interface CragRegion {
  minX: number; maxX: number; minZ: number; maxZ: number;
  weight?: (x: number, z: number) => number;
  /** False where no block may stand on the ground (checked at every point of its outline within 2.5 m of the ground). */
  clear?: (x: number, z: number) => boolean;
  /** Chance (0–1) that a face block is a rounded conglomerate mass rather than bedded limestone. */
  massive?: (x: number, z: number) => number;
}
/** Steep ground north of z = −200 between x = −110 and 60, up to the north ridge's crest. */
export const CRAG_REGION: CragRegion = { minX: -110, maxX: 60, minZ: -330, maxZ: -200 };
/** How far a block's outline keeps from the trail's centreline: the tread and a metre beside it stay open. */
export const CRAG_TRAIL_CLEARANCE = TRAIL_HALF + 1;
/** Metres every point of a block's base lies under the lowest ground mesh at its spot. */
export const CRAG_BURY: Record<CragKind, number> = { bedded: .4, massive: .4, talus: .25 };
/** Slope (degrees) from which ground counts as a crag face, and from which a step hangs as a ledge seated by its back. */
const FACE_SLOPE = 47, HUNG_SLOPE = 66;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const smooth = THREE.MathUtils.smoothstep;

/** Seeded 3D value noise, 0–1, for the blocks' lumps. */
function lattice(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(seed, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, s = (t: number): number => t * t * (3 - 2 * t), lerp = THREE.MathUtils.lerp;
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
/** The blocks' outline, slabs and lumps follow from the site alone, so every tier and the collider share them. */
function cragShape(site: CragSite): Shape {
  const rand = random(site.seed), { width: w, depth: d, height: h, kind } = site;
  const sides = kind === 'massive' ? 8 : kind === 'talus' ? 5 : 6, phase = rand();
  const base = Array.from({ length: sides }, (_, k) => {
    const a = (k + phase + (rand() - .5) * .5) / sides * TAU, r = .84 + rand() * .18;
    return [Math.cos(a) * w / 2 * r, Math.sin(a) * d / 2 * r] as [number, number];
  });
  const count = kind === 'massive' ? 1 : kind === 'talus' ? (rand() < .35 ? 2 : 1) : Math.max(2, Math.min(5, Math.round(h / (1 + rand() * .6))));
  const parts = Array.from({ length: count }, () => .7 + rand() * .6), total = parts.reduce((a, b) => a + b, 0);
  // Higher beds of a step recede a little into the slope or, now and then, jut out over the one below.
  const run = 1 / Math.tan(Math.max(site.slope, 20) * DEG), recede = kind === 'bedded' ? rand() * .35 : 0, slabs: Slab[] = [];
  let y = 0;
  parts.forEach((part, i) => {
    const t = h * part / total, scale = (kind === 'bedded' ? 1 - .05 * i : 1) + (rand() - .5) * .12, overhang = kind === 'bedded' && i > 0 && rand() < .22 ? .15 * d : 0;
    const dx = (rand() - .5) * .12 * w, dz = -recede * run * y + (rand() - .5) * .18 * d + overhang;
    const corners = base.map(([cx, cz]) => { const r = .94 + rand() * .12; return [cx * scale * r + dx, cz * scale * r + dz] as [number, number]; });
    const bevel = kind === 'massive' ? .32 * Math.min(w, d, h) : Math.min(.16, .22 * t, kind === 'talus' ? .2 * Math.min(w, d) : 1);
    slabs.push({ corners, cx: corners.reduce((s, c) => s + c[0], 0) / sides, cz: corners.reduce((s, c) => s + c[1], 0) / sides, y0: y, y1: y + t, bevel });
    y += t;
  });
  return { slabs, crisp: kind !== 'massive', lump: kind === 'massive' ? .2 : kind === 'talus' ? .05 : .06 };
}
/** The block's frame without its height: yaw, then tilt, at (x, 0, z). */
function frame(site: CragSite, y = site.y): THREE.Matrix4 {
  const q = new THREE.Quaternion(...site.tilt).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw));
  return new THREE.Matrix4().compose(new THREE.Vector3(site.x, y, site.z), q, new THREE.Vector3(1, 1, 1));
}
/**
 * Points along the lowest slab's base outline (corners and three between each), in the frame `matrix`: all of them, or for a
 * block hung on a wall the back ones (into the wall) up to `HUNG_SEATED` of its depth.
 */
function basePoints(shape: Shape, matrix: THREE.Matrix4, hung = false): THREE.Vector3[] {
  const slab = shape.slabs[0], points: THREE.Vector3[] = [], zs = slab.corners.map(c => c[1]), back = Math.min(...zs), cut = back + (Math.max(...zs) - back) * HUNG_SEATED;
  slab.corners.forEach((a, k) => {
    const b = slab.corners[(k + 1) % slab.corners.length];
    for (let s = 0; s < 4; s++) {
      const u = s / 4, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, p = inset(slab, x, z, slab.bevel, slab.y0);
      if (!hung || p.z <= cut) points.push(p.applyMatrix4(matrix));
    }
  });
  return points;
}
/** Share of a hung block's depth, from its back, whose base is seated in the wall. */
const HUNG_SEATED = .55;
/** A point of a slab's outline pulled `by` metres toward its centre, at height y. */
function inset(slab: Slab, x: number, z: number, by: number, y: number): THREE.Vector3 {
  const rx = x - slab.cx, rz = z - slab.cz, r = Math.hypot(rx, rz) || 1, k = Math.max(.05, 1 - by / r);
  return new THREE.Vector3(slab.cx + rx * k, y, slab.cz + rz * k);
}
/** Every slab's full outline at both of its faces, in world space: the block's extent in plan. */
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
/**
 * Ground claimed by the plateau's meadow and the fence round it, the walkable alpine turf (its mask also spans steep ground the
 * shader leaves rock) and the couloir's snow: no point of a block on the ground stands on it. Steep ground may carry blocks inside
 * the plateau's rim where it rises as a wall behind the meadow (no fence there), but where the rim drops away only beyond the
 * fence line (its posts stand at 0.86 of the plateau's radius).
 */
function defaultClear(ground: CragGround): (x: number, z: number) => boolean {
  return (x, z) => {
    if (snowCover(x, z) >= .35) return false;
    if (plateauMask(x, z) < .02 && turfCover(x, z) < .01) return true;
    if (ground.normal(x, z).slope < 50) return false;
    const rim = plateauRadius(x, z);
    return rim > .95 || (rim > .88 && ground.near(x, z) > plateauHeight(x, z) + 3);
  };
}
/** Most blocks a region holds: face blocks (steps, ledges and masses) and talus. */
const CAPS = { face: 380, talus: 90 };

/**
 * Seeded crag blocks inside `region`: on ground steeper than about 47° (more on steeper, south-facing faces) bedded steps, hung
 * ledges on near-vertical walls or, now and then, rounded masses; on gentler ground within ten metres below such a face, talus.
 * Candidates on a jittered 3 m grid (more in steep cells, which hold more face than their plan shows) are taken best first; face
 * blocks may overlap into continuous crags, talus stays apart. Every point of a block's outline keeps `CRAG_TRAIL_CLEARANCE` from
 * the trail and lies on clear ground; trunks and boulders (`obstacles`) keep their radius.
 */
export function cragSites(options: { region?: CragRegion; obstacles?: readonly CragObstacle[]; seed?: number; ground?: CragGround } = {}): CragSite[] {
  const region = options.region ?? CRAG_REGION, ground = options.ground ?? new CragGround(), rand = random(options.seed ?? 6151), clear = region.clear ?? defaultClear(ground);
  type Candidate = { x: number; z: number; priority: number; talus: number; n: THREE.Vector3; slope: number; draws: number[] };
  const candidates: Candidate[] = [], STEP = 3;
  for (let z = region.maxZ; z >= region.minZ; z -= STEP) for (let x = region.minX; x <= region.maxX; x += STEP) {
    // Every number is drawn up front, so a rejected candidate never shifts the next one. A steep cell holds more face than its
    // plan shows (a 35 m wall is a 4 m band in plan), so it gets up to six candidates, about one per 9 m² of face.
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
  const sites: CragSite[] = [], obstacles = options.obstacles ?? [], placed = { face: 0, talus: 0 };
  // Placed blocks by 8 m cell, for the overlap test.
  const grid = new Map<number, CragSite[]>(), key = (i: number, j: number): number => (i + 512) * 1024 + j + 512;
  const nearby = (x: number, z: number): CragSite[] => { const i = Math.floor(x / 8), j = Math.floor(z / 8), out: CragSite[] = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...grid.get(key(i + a, j + b)) ?? []); return out; };
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
      height = massive ? 2.6 + a * 2.8 : 2.2 + a * 3.8 * smooth(c.slope, FACE_SLOPE, 70); width = massive ? 2.8 + b * 2.8 : 3 + b * 4.5;
      depth = Math.min(5, (height + .6) / Math.tan(c.slope * DEG) + .4 + k + (hung ? 1.4 + k * .6 : 0));
      // The beds dip about 7° toward the south-south-west everywhere; a rounded mass leans as it likes. A hung ledge also tips
      // back into its wall, so its lowest corner is a seated one.
      tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-.94, 0, .34).normalize(), (massive ? (dipRoll - .5) * 16 : 7 + (dipRoll - .5) * 6) * DEG);
      if (hung) tilt.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), -(14 + 6 * dipRoll) * DEG));
    }
    const site: CragSite = { x: c.x, y: 0, z: c.z, yaw, tilt: [tilt.x, tilt.y, tilt.z, tilt.w], width, depth, height, kind, seed: Math.floor(seedRoll * 2 ** 31), slope: c.slope, reach: 0, collider: false, rank: rankRoll, hung };
    const shape = cragShape(site), outline = outlinePoints(shape, frame(site, 0));
    site.reach = Math.max(...outline.map(p => Math.hypot(p.x - site.x, p.z - site.z)));
    // Trunks, boulders and the trail; then clear ground under every point of the outline near the ground (a ledge high on a
    // wall claims none), and blocks already placed near by.
    if (obstacles.some(o => Math.hypot(o.x - site.x, o.z - site.z) < o.radius + site.reach)) continue;
    if (outline.some(p => trailDistance(p.x, p.z) < CRAG_TRAIL_CLEARANCE + .4)) continue;
    site.y = seatHeight(site, ground);
    if (outline.some(p => p.y + site.y < ground.near(p.x, p.z) + 2.5 && !clear(p.x, p.z))) continue;
    // Apart in three dimensions: ledges hung one above another on a wall share their plan position.
    const size = (s: CragSite): number => Math.hypot(s.reach, s.height / 2), centre = site.y + height / 2;
    if (nearby(site.x, site.z).some(s => Math.hypot(s.x - site.x, s.y + s.height / 2 - centre, s.z - site.z) < (size(s) + size(site)) * (s.kind === 'talus' || talus ? (s.kind === 'talus' && talus ? .95 : .75) : .55))) continue;
    site.collider = outline.some(p => p.x > TERRAIN_GRID.minX && p.x < TERRAIN_GRID.minX + (TERRAIN_GRID.columns - 1) * TERRAIN_GRID.step && p.z > TERRAIN_GRID.minZ && p.z < TERRAIN_GRID.minZ + (TERRAIN_GRID.rows - 1) * TERRAIN_GRID.step);
    sites.push(site); placed[quota]++;
    const cellKey = key(Math.floor(site.x / 8), Math.floor(site.z / 8)); (grid.get(cellKey) ?? grid.set(cellKey, []).get(cellKey)!).push(site);
    if (placed.face >= CAPS.face && placed.talus >= CAPS.talus) break;
  }
  return sites;
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
