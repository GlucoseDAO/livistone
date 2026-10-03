// Sub-plan 27, round 2: the water of the Jepii Mici gorge. A tall waterfall drops from a notch in the crags, in one or two tiers,
// into a plunge pool with mist at its foot; a stream runs out from under the old snow and tumbles down the gorge. Geometry is
// DOM-free and placed by its spec in world space, so the gorge layout only passes points in. One clock moves all of it, wind.ts's
// windTime: the game's elapsed time, frozen by ?capture=1, still under reduced motion (as the lake stands still) and pinned by
// ?wind=<seconds> for stills. The stream is the river's own shader (water-material.ts, `stream`) on a ribbon that bakes the
// attributes the river reads; the waterfall is lit foam on one sheet-and-pool mesh, with mist cards as its second draw. Nothing
// emits, so neither glows at night. Dev-only ?mountainwater=test places one of each on today's crags and couloir (world.ts).
import * as THREE from 'three';
import { Fn, abs, attribute, cameraPosition, cameraViewMatrix, clamp, cos, cross, dot, exp, faceDirection, float, fract, length, max, mix, normalWorldGeometry, normalize, positionWorld, pow, property, select, sin, smoothstep, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { waterMaterial } from './water-material';
import { rockField } from './water-surface';
import type { RockSite } from './water-surface';
import { windTime } from './wind';

/** A world-space point: x, y, z. */
export type Point3 = readonly [number, number, number];
/** The rendered ground's height at (x, z), e.g. terrainSurfaceHeight. */
export type Ground = (x: number, z: number) => number;
type F = Node<'float'>;

/** Dev-only `?mountainwater=test`: a test waterfall and stream on today's crags and couloir until the gorge exists (world.ts). */
export function mountainWaterTest(): boolean {
  return !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('mountainwater') === 'test';
}

const TAU = Math.PI * 2, G = 9.81;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Value noise with `px` × `py` cells over the unit square, wrapping at its edges. */
function tiled(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px, y = v * py, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
  const h = (i: number, j: number): number => hash(((i % px) + px) % px, ((j % py) + py) % py, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), a), THREE.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), a), b);
}
const foamMaps = new Map<number, THREE.DataTexture>();
/**
 * The foam's tiling noises, generated here rather than downloaded, each equalised so a threshold at 1 − c keeps about c of the
 * surface: red streaks drawn out along v (the fall), green round lumps of aerated water, blue fine grain.
 */
export function foamTexture(size: number): THREE.DataTexture {
  const cached = foamMaps.get(size); if (cached) return cached;
  const channels = [0, 1, 2].map(() => new Float32Array(size * size));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, k = y * size + x;
    channels[0][k] = tiled(u, v, 20, 3, 1) * .5 + tiled(u, v, 40, 5, 2) * .32 + tiled(u, v, 80, 9, 3) * .18;
    channels[1][k] = tiled(u, v, 6, 6, 4) * .55 + tiled(u, v, 13, 13, 5) * .3 + tiled(u, v, 26, 26, 6) * .15;
    channels[2][k] = tiled(u, v, 32, 32, 7) * .6 + tiled(u, v, 64, 64, 8) * .4;
  }
  const data = new Uint8Array(size * size * 4).fill(255);
  channels.forEach((values, c) => { Array.from(values.keys()).sort((a, b) => values[a] - values[b]).forEach((k, rank) => { data[k * 4 + c] = Math.round(rank / (values.length - 1) * 255); }); });
  const map = new THREE.DataTexture(data, size, size); map.name = 'Mountain water foam';
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = size > 128 ? 8 : 2; map.needsUpdate = true;
  foamMaps.set(size, map); return map;
}

// ---------------------------------------------------------------------------------------------------------------------
// The waterfall

/** Where a waterfall falls, in world space. */
export interface WaterfallSpec {
  /** The middle of the lip, where the water leaves the rock. */
  lip: Point3;
  /** Where the falling water meets its plunge pool; its height is the pool's water level. */
  foot: Point3;
  /** The sheet's width at the lip, metres. */
  width: number;
  /** A ledge for a two-tier fall: the upper tier lands on it and the lower one leaves from it. */
  ledge?: Point3;
  /** Width at the foot over width at the lip (2.2): the sheet spreads and breaks up as it falls. */
  spread?: number;
  /** The plunge pool's radius, metres (about half the foot's width plus 0.8); 0 for none. */
  pool?: number;
  /** Horizontal direction the fall faces, away from the rock: lip toward foot, or down the ground's slope at the lip. */
  out?: readonly [number, number];
  /** The rendered ground (terrainSurfaceHeight): keeps the sheet clear of the rock and fills only the pool's hollow. */
  ground?: Ground;
}
/** Speed of the water arriving at the lip, and leaving a ledge, m/s. */
const LIP_SPEED = 1.6, LEDGE_SPEED = 2.4;
/** Drop over which a falling sheet turns from glassy water to white foam (1 − 1/e of it), metres. */
const AERATION = 1.6;
/** The sheet keeps this far in front of the rock, metres. */
const CLEARANCE = .35;
/** Foam tiles per second of launch time, and metres of sheet per tile across. */
const RATE = .85, STREAK = 2.2;
/** Pool water stays this far over ground that falls away from it, as a film rather than a sheet floating off the slope. */
const FILM = .03;
/** The sheet carries on this far below the pool's level, unpushed, into the water or the ground. */
const SINK = 1.4;
const DETAIL = {
  gpu: { rows: 2.4, columns: 14, rings: 9, rays: 30, cards: 18, foam: 256 },
  mobile: { rows: 1.5, columns: 9, rings: 6, rays: 20, cards: 9, foam: 128 },
  cpu: { rows: 1, columns: 6, rings: 4, rays: 14, cards: 0, foam: 64 },
} as const;

interface Fall { lip: THREE.Vector3; foot: THREE.Vector3; ledge: THREE.Vector3 | null; out: THREE.Vector3; side: THREE.Vector3; width: number; spread: number; pool: number; height: number; ground?: Ground }
function resolve(spec: WaterfallSpec): Fall {
  const lip = new THREE.Vector3(...spec.lip), foot = new THREE.Vector3(...spec.foot), ledge = spec.ledge ? new THREE.Vector3(...spec.ledge) : null, g = spec.ground;
  const out = spec.out ? new THREE.Vector3(spec.out[0], 0, spec.out[1]) : new THREE.Vector3(foot.x - lip.x, 0, foot.z - lip.z);
  // Falling straight down: face down the rock's own slope at the lip.
  if (!spec.out && out.length() < .3) out.set(g ? g(lip.x - .5, lip.z) - g(lip.x + .5, lip.z) : 0, 0, g ? g(lip.x, lip.z - .5) - g(lip.x, lip.z + .5) : 1);
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
  out.normalize();
  const spread = spec.spread ?? 2.2;
  // `side` runs to the right of someone facing the fall.
  return { lip, foot, ledge, out, side: new THREE.Vector3(out.z, 0, -out.x), width: spec.width, spread, pool: spec.pool ?? spec.width * spread * .5 + .8, height: Math.max(lip.y - foot.y, .5), ground: g };
}

/**
 * Each point of a polar grid (ring k, ray j; ring 0 is the centre) raised to the lowest rim it would spill over: a priority flood
 * from the outer ring inward. Points outside any hollow keep their ground height.
 */
function flood(ground: number[][], rings: number, rays: number): number[][] {
  const filled = ground.map(row => row.slice()), done = ground.map(row => row.map(() => false)), open: [number, number][] = [];
  for (let j = 0; j < rays; j++) { done[rings][j] = true; open.push([rings, j]); }
  while (open.length) {
    let lowest = 0; for (let i = 1; i < open.length; i++) if (filled[open[i][0]][open[i][1]] < filled[open[lowest][0]][open[lowest][1]]) lowest = i;
    const [k, j] = open.splice(lowest, 1)[0], next: [number, number][] = [[k, (j + 1) % rays], [k, (j + rays - 1) % rays]];
    if (k < rings) next.push([k + 1, j]);
    // Every ray's ring-0 point is the same centre.
    if (k > 0) next.push([k - 1, j]); else for (let i = 0; i < rays; i++) next.push([0, i]);
    for (const [a, b] of next) if (!done[a][b]) { done[a][b] = true; filled[a][b] = Math.max(ground[a][b], filled[k][j]); open.push([a, b]); }
  }
  return filled;
}

interface Row { centre: THREE.Vector3; tau: number; drop: number; width: number; splash: number }
/**
 * The sheet's centreline, densest near the lip and each ledge where it curves. The upper tier leaves the lip horizontally and
 * falls freely, so its throw grows with the root of the drop. `tau` is the time a parcel takes to get there from the lip: the foam
 * pattern is a function of launch time, so it falls at the water's own accelerating speed and stretches into long streaks.
 */
function fallRows(f: Fall, perMetre: number): Row[] {
  // Off a ledge the water keeps about half the speed it landed with, so its streaks change length there rather than restart.
  const landing = f.ledge ? Math.max(LEDGE_SPEED, .5 * Math.sqrt(LIP_SPEED ** 2 + 2 * G * Math.max(0, f.lip.y - f.ledge.y))) : LEDGE_SPEED;
  const rows: Row[] = [], tiers: [THREE.Vector3, THREE.Vector3, number][] = f.ledge ? [[f.lip, f.ledge, LIP_SPEED], [f.ledge, f.foot, landing]] : [[f.lip, f.foot, LIP_SPEED]];
  for (const [t, [a, b, speed]] of tiers.entries()) {
    const h = Math.max(a.y - b.y, .1), n = Math.max(8, Math.ceil(h * perMetre));
    for (let k = t ? 1 : 0; k <= n; k++) {
      // Off a ledge the water slides over its rounded edge rather than leaping, so its throw grows a little more slowly.
      const s = h * (k / n) ** 1.6, fling = (s / h) ** (t ? .7 : .5), centre = new THREE.Vector3(a.x + (b.x - a.x) * fling, a.y - s, a.z + (b.z - a.z) * fling);
      const last = rows[rows.length - 1], drop = f.lip.y - centre.y;
      const tau = last ? last.tau + centre.distanceTo(last.centre) / Math.sqrt(speed * speed + 2 * G * Math.max(0, a.y - (centre.y + last.centre.y) / 2)) : 0;
      // Where it lands, on the ledge or in the pool, the water bursts white and spreads.
      const splash = Math.max(f.ledge ? Math.exp(-Math.abs(centre.y - f.ledge.y) / 1.1) : 0, Math.exp(-(centre.y - f.foot.y) / 1.4));
      rows.push({ centre, tau, drop, splash, width: f.width * (1 + (f.spread - 1) * Math.pow(Math.min(drop / f.height, 1), .85)) * (1 + .2 * splash) });
    }
  }
  // On down past the pool's level, so the sheet plunges into the water or meets the ground rather than ending in the air.
  const end = rows[rows.length - 1], speed = Math.sqrt(landing ** 2 + 2 * G * Math.max(.1, (f.ledge ?? f.lip).y - end.centre.y));
  for (const below of [.4, .8, SINK]) rows.push({ ...end, centre: end.centre.clone().setY(end.centre.y - below), tau: end.tau + below / speed, drop: end.drop + below });
  return rows;
}

/**
 * The sheet and its plunge pool as one geometry, so they share one draw. Attributes for the shader:
 *  - `fall` (vec4): sheet: metres across, launch delay `tau` (s), aeration 0–1, |across| over the water's half-width (past 1 only
 *    strands); pool: unused, metres from the impact, its froth 0–1, distance over the pool's ragged rim;
 *  - `water` (vec4): sheet: 0, the drop's share of the whole fall, splash 0–1 where it lands on a ledge or the pool; pool: 1,
 *    water depth (m), outward unit direction in x, z.
 * The cpu tier gets the core of the sheet only, with ragged edges, and baked colours.
 */
export function waterfallGeometry(spec: WaterfallSpec, tier: GraphicsTier): THREE.BufferGeometry {
  const f = resolve(spec), detail = DETAIL[tier], cpu = tier === 'cpu', rows = fallRows(f, detail.rows), columns = detail.columns;
  const positions: number[] = [], falls: number[] = [], waters: number[] = [], colours: number[] = [], indices: number[] = [];
  const reach = cpu ? 1 : 1.3, grain = cpu ? foamTexture(DETAIL.cpu.foam) : null, rand = random(911);
  const sample = (u: number, v: number, c: number): number => { const n = DETAIL.cpu.foam, x = ((Math.floor(u * n) % n) + n) % n, y = ((Math.floor(v * n) % n) + n) % n; return grain!.image.data![(y * n + x) * 4 + c] / 255; };
  // Each vertex leaves the rock by CLEARANCE; the push then spreads to the rows either side, so the sheet bends rather than kinks.
  const push = rows.map(() => new Float32Array(columns + 1)), probe = new THREE.Vector3();
  const buried = (p: THREE.Vector3, by: number): boolean => { probe.copy(p).addScaledVector(f.out, by); return f.ground!(probe.x, probe.z) > probe.y - CLEARANCE; };
  const sunk = (row: Row): boolean => row.centre.y < f.foot.y - .05;
  rows.forEach((row, i) => {
    for (let j = 0; j <= columns; j++) {
      const p = row.centre.clone().addScaledVector(f.side, (j / columns * 2 - 1) * reach * row.width / 2);
      // Below the pool's level the sheet keeps the push of the last row above it: it is meant to sink into water or ground.
      if (sunk(row)) { push[i][j] = push[i - 1][j]; continue; }
      if (!f.ground || !buried(p, 0)) continue;
      // Bracket the way out of the rock by doubling, then halve the bracket: a dozen ground samples rather than one per 10 cm.
      let inside = 0, clear = .1; while (clear < 8 && buried(p, clear)) { inside = clear; clear *= 2; }
      for (let k = 0; k < 5; k++) { const mid = (inside + clear) / 2; if (buried(p, mid)) inside = mid; else clear = mid; }
      push[i][j] = Math.min(clear, 8);
    }
  });
  const spreadPush = push.map((values, i) => values.map((value, j) => sunk(rows[i]) ? value : Math.max(value, (Math.max(push[Math.max(i - 1, 0)][j], value) + 2 * value + Math.max(push[Math.min(i + 1, rows.length - 1)][j], value)) / 4)));
  rows.forEach((row, i) => {
    const air = 1 - Math.exp(-row.drop / AERATION), share = Math.min(row.drop / f.height, 1.02);
    for (let j = 0; j <= columns; j++) {
      // cpu: no strands, so ragged edges in the geometry instead.
      const e = (j / columns * 2 - 1) * reach * (cpu && (j === 0 || j === columns) ? .8 + .3 * rand() : 1), across = e * row.width / 2;
      const p = row.centre.clone().addScaledVector(f.side, across).addScaledVector(f.out, spreadPush[i][j]);
      positions.push(p.x, p.y, p.z); falls.push(across, row.tau, air, Math.abs(e)); waters.push(0, share, row.splash, 0);
      if (cpu) {
        const streak = sample(across / STREAK, -row.tau * RATE, 0), white = air * (.6 + .4 * streak);
        const c = new THREE.Color('#3f5b57').lerp(new THREE.Color('#e9eeec'), white); colours.push(c.r, c.g, c.b);
      }
    }
  });
  // Bottom row first: where the lower tier leaves a ledge in front of the upper one's foot, that frothy foot draws over the join.
  for (let i = rows.length - 2; i >= 0; i--) for (let j = 0; j < columns; j++) { const a = i * (columns + 1) + j, b = a + columns + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  if (f.pool > 0) {
    const start = positions.length / 3, { rings, rays } = detail, centre = f.foot.clone().addScaledVector(f.out, f.pool * .35), level = f.foot.y;
    const heights: number[][] = [], grounds: number[][] = [], points: THREE.Vector3[][] = [];
    for (let k = 0; k <= rings; k++) {
      heights.push([]); grounds.push([]); points.push([]);
      for (let j = 0; j < rays; j++) {
        const angle = j / rays * TAU, rim = f.pool * (1 + .14 * Math.sin(3 * angle + 1) + .08 * Math.sin(5 * angle + 2.2)), r = rim * k / rings;
        const p = new THREE.Vector3(centre.x + Math.cos(angle) * r, level, centre.z + Math.sin(angle) * r);
        points[k].push(p); grounds[k].push(f.ground ? f.ground(p.x, p.z) : level - .7 * (1 - (k / rings) ** 2));
      }
    }
    // Water stands level only in a hollow: flood the grid from its rim inward, lowest first (a priority flood), so each point learns
    // the lowest rim it would spill over. Elsewhere the splash runs off as a film.
    const filled = flood(grounds, rings, rays), depths: number[][] = [];
    for (let k = 0; k <= rings; k++) {
      depths.push([]);
      for (let j = 0; j < rays; j++) {
        const g = grounds[k][j], hollow = !f.ground || filled[k][j] > g + .02;
        heights[k][j] = hollow ? Math.min(level, f.ground ? filled[k][j] : level) : g + FILM;
        // A film runs over gentle ground at or below the level only, never up the rock behind the fall.
        const p = points[k][j], steep = f.ground ? Math.hypot(f.ground(p.x + .3, p.z) - f.ground(p.x - .3, p.z), f.ground(p.x, p.z + .3) - f.ground(p.x, p.z - .3)) / .6 : 0;
        depths[k].push(hollow ? Math.max(0, heights[k][j] - g) : FILM * THREE.MathUtils.clamp((level + .1 - g) / .2, 0, 1) * (1 - THREE.MathUtils.smoothstep(steep, .5, 1)));
      }
    }
    for (let k = 0; k <= rings; k++) for (let j = 0; j < rays; j++) {
      const p = points[k][j], y = heights[k][j], depth = depths[k][j], dx = p.x - f.foot.x, dz = p.z - f.foot.z, d = Math.hypot(dx, dz);
      const impact = Math.exp(-d / (f.pool * .38)), outward = d > 1e-4 ? [dx / d, dz / d] : [f.out.x, f.out.z];
      positions.push(p.x, y, p.z); falls.push(0, d, impact, k / rings); waters.push(1, depth, outward[0], outward[1]);
      if (cpu) { const c = new THREE.Color('#2f4744').lerp(new THREE.Color('#dfe6e4'), THREE.MathUtils.smoothstep(impact, .35, .8)); colours.push(c.r, c.g, c.b); }
      if (k < rings) { const a = start + k * rays + j, a1 = start + k * rays + (j + 1) % rays; indices.push(a, a1, a + rays, a1, a1 + rays, a + rays); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('fall', new THREE.Float32BufferAttribute(falls, 4));
  geometry.setAttribute('water', new THREE.Float32BufferAttribute(waters, 4));
  if (cpu) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

/** Glassy water at the lip, foam once it has fallen, and the pool's body over its stones; linear colours, lit by the scene. */
const GLASS = vec3(.032, .06, .058), FOAM = vec3(.72, .76, .76), GREY = vec3(.42, .47, .49), POOL = vec3(.035, .07, .066);
/**
 * The sheet and pool's shader (gpu, mobile). Sheet: two foam samples in launch time (one on mobile), streaks and lumps whose share
 * of the surface thins toward the edges into separate strands and, lower down, opens gaps; dark translucent glassy water near
 * the lip whitens as it aerates. Pool: froth that churns outward from the impact (a two-phase flow map, as the river's), rings
 * running out over its surface, a body that veils the bed with depth, fading at the rim. Both read the same two texture samples,
 * their coordinates picked per vertex kind, so neither branch samples in non-uniform control flow.
 */
function waterfallMaterial(tier: GraphicsTier): THREE.Material {
  if (tier === 'cpu') { const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); material.name = 'Mountain waterfall'; return material; }
  const mobile = tier === 'mobile', foam = texture(foamTexture(DETAIL[tier].foam));
  const material = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, metalness: 0, roughness: .6, envMapIntensity: 1 });
  // One pass for both faces. The sheet's triangles come first, then the pool's, which veil its submerged foot.
  material.forceSinglePass = true; material.name = 'Mountain waterfall'; material.userData.heroEnv = true;
  const fall = attribute<'vec4'>('fall', 'vec4'), water = attribute<'vec4'>('water', 'vec4');
  const shade = { alpha: property('float', 'fallAlpha'), roughness: property('float', 'fallRoughness'), normal: property('vec3', 'fallNormal') };
  material.colorNode = Fn(() => {
    // normalWorldGeometry, not normalWorld, which would read this very normal back through normalNode.
    const pool = water.x.toVar(), geometric = normalWorldGeometry.mul(faceDirection).toVar(), view = normalize(cameraPosition.sub(positionWorld)).toVar();
    const launch = fract(windTime.mul(RATE)).sub(fall.y.mul(RATE)).toVar(), across = fall.x.div(STREAK).toVar();
    const phase = windTime.mul(.42).toVar(), a = fract(phase), b = fract(phase.add(.5)), blend = abs(float(1).sub(a.mul(2)));
    const outward = water.zw, bed = positionWorld.xz.mul(.32);
    const first = foam.sample(select(pool.greaterThan(.5), bed.sub(outward.mul(a.mul(1.3))), vec2(across, launch))).toVar();
    const second = mobile ? first : foam.sample(select(pool.greaterThan(.5), bed.sub(outward.mul(b.mul(1.3))).add(vec2(.37, .61)), vec2(across.mul(2.3).add(.37), launch.mul(1.9).add(.21)))).toVar();
    // The sheet. Its outline wanders with the lumps, so the edges break into strands of their own rather than following the mesh;
    // lower down and where it lands, gaps open through the middle too. Streaks keep their contrast: foam between thinner, greyer water.
    const air = fall.z, splash = water.z, low = smoothstep(.5, 1, water.y), streaks = first.r, lumps = first.g, fine = mobile ? first.b : second.b;
    const grain = streaks.mul(.55).add(lumps.mul(.25)).add(fine.mul(.2)).toVar(), edge = fall.w.add(lumps.sub(.5).mul(.4));
    const threshold = mix(float(-.3), float(.74), smoothstep(.45, 1.15, edge)).add(low.mul(.42)).add(splash.mul(.22)).toVar();
    // The first fifth of a second of fall fades in, so the lip has no cut edge.
    const cover = smoothstep(threshold, threshold.add(.14), grain).mul(smoothstep(0, .2, fall.y));
    // Where it lands the water bursts white in clumps, not in a band.
    const white = clamp(air.mul(smoothstep(.1, .9, grain.mul(.8).add(.15))).add(splash.mul(smoothstep(.3, .8, lumps)).mul(.8)), 0, 1).toVar();
    // Fluted: each streak turns a little to one side, so the sheet catches the light unevenly.
    const lateral = normalize(cross(geometric, vec3(0, 1, 0)).add(vec3(1e-4, 0, 0))), fluted = normalize(geometric.add(lateral.mul(streaks.sub(.5).mul(.8))));
    // The pool.
    const churn = mobile ? first.g : mix(first.g, second.g, blend), impact = fall.z, depth = water.y;
    const crest = fall.y.mul(TAU / .62).sub(windTime.mul(TAU * 1.2)).toVar();
    const froth = smoothstep(.35, .78, impact.mul(churn.mul(.7).add(.45)).add(impact.mul(sin(crest).mul(.5).add(.5)).mul(.28))).toVar();
    const rings = vec3(outward.x, 0, outward.y).mul(cos(crest).mul(impact.mul(.8).add(.12)).mul(.22));
    const level = normalize(geometric.add(rings)).toVar();
    const fresnel = float(.02).add(pow(float(1).sub(clamp(dot(level, view), 0, 1)), 5).mul(.98));
    const shore = smoothstep(0, .05, depth).mul(float(1).sub(smoothstep(.8, 1, fall.w)));
    const pooled = max(clamp(fresnel.add(float(1).sub(exp(depth.mul(-2.4))).mul(.7)), 0, .96), froth.mul(.92)).mul(shore);
    // Low in the fall a thin veil of spray fills the gaps between the strands.
    const veil = low.mul(.3).mul(lumps.mul(.5).add(.5)).mul(float(1).sub(smoothstep(.8, 1.3, edge)));
    white.assign(max(white, veil.mul(2.4).clamp(0, 1).mul(float(1).sub(cover))));
    shade.alpha.assign(mix(max(cover.mul(mix(.36, .95, white)), veil), pooled, pool));
    shade.roughness.assign(mix(mix(.1, .82, white), mix(.05, .8, froth), pool));
    shade.normal.assign(normalize(mix(fluted, level, pool)));
    return mix(mix(GLASS, mix(GREY, FOAM, fine), white), mix(POOL, FOAM, froth), pool);
  })();
  material.opacityNode = shade.alpha as unknown as F; material.roughnessNode = shade.roughness as unknown as F;
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(shade.normal, 0)).xyz);
  return material;
}

/** Mist cards a second, rising and swelling as they fade in and out; the largest card, metres. */
const SPRAY_RATE = .16, MIST_SIZE = 4.5;
/**
 * Soft mist at the foot, and at a ledge: camera-facing cards that drift up and outward over six seconds or so, each on its own
 * phase. `card` holds each card's centre and size, `drift` its travel over a life and its phase; uv is the corner.
 */
export function sprayGeometry(spec: WaterfallSpec, tier: GraphicsTier): THREE.BufferGeometry | null {
  const count = DETAIL[tier].cards; if (!count) return null;
  const f = resolve(spec), rand = random(4127), cards: number[][] = [], footWidth = f.width * f.spread, scale = Math.sqrt(f.height / 25);
  const add = (at: THREE.Vector3, width: number, n: number, reach: number): void => {
    for (let i = 0; i < n; i++) {
      const size = THREE.MathUtils.clamp(width * (.35 + .4 * rand()) * scale, 1, MIST_SIZE);
      const centre = at.clone().addScaledVector(f.out, size * .3 + rand() * reach).addScaledVector(f.side, (rand() - .5) * width).setY(at.y + size * .1 + rand() * .5);
      const drift = f.out.clone().multiplyScalar(.3 + rand() * .8).addScaledVector(f.side, (rand() - .5) * 1.2).setY(.5 + rand() * 1.1);
      cards.push([centre.x, centre.y, centre.z, size, drift.x, drift.y, drift.z, rand()]);
    }
  };
  add(f.foot, footWidth * 1.1, count, f.pool * .35);
  if (f.ledge) add(f.ledge, f.width, 2, .3);
  const positions: number[] = [], card: number[] = [], drift: number[] = [], uvs: number[] = [], indices: number[] = [];
  cards.forEach((c, i) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { positions.push(c[0], c[1], c[2]); card.push(c[0], c[1], c[2], c[3]); drift.push(c[4], c[5], c[6], c[7]); uvs.push(u, v); }
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('card', new THREE.Float32BufferAttribute(card, 4));
  geometry.setAttribute('drift', new THREE.Float32BufferAttribute(drift, 4)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // The vertices sit at the card centres; the cards swell and rise from there, so the bounds cover their whole life.
  geometry.computeBoundingSphere(); geometry.boundingSphere!.radius += MIST_SIZE * 1.35 + 3; return geometry;
}
/** Lit like level ground, so mist is as bright as the light it stands in: pale by day, faint grey under the moon. */
function sprayMaterial(tier: GraphicsTier, level: number): THREE.Material {
  const material = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, metalness: 0, roughness: 1 });
  material.forceSinglePass = true; material.name = 'Waterfall spray';
  // Plain expressions, not vars: both stages read them, each from its own attribute or varying.
  const card = attribute<'vec4'>('card', 'vec4'), drift = attribute<'vec4'>('drift', 'vec4'), corner = uv().sub(.5), foam = texture(foamTexture(DETAIL[tier].foam));
  const life = fract(windTime.mul(SPRAY_RATE).add(drift.w));
  material.positionNode = Fn(() => {
    const centre = card.xyz.add(drift.xyz.mul(life)).toVar(), forward = normalize(centre.sub(cameraPosition)).toVar();
    const right = normalize(cross(forward, vec3(0, 1, 0)).add(vec3(1e-4, 0, 0))).toVar(), up = cross(right, forward);
    return centre.add(right.mul(corner.x).add(up.mul(corner.y)).mul(card.w.mul(life.mul(.7).add(.65))));
  })();
  material.colorNode = vec3(.86, .9, .92);
  const wisp = foam.sample(uv().mul(.55).add(vec2(drift.w.mul(7.3), drift.w.mul(3.1)))).g;
  // Never a hard line where a card meets the pool or the ground below it.
  material.opacityNode = exp(dot(corner, corner).mul(-14)).mul(smoothstep(0, .9, wisp)).mul(pow(sin(life.mul(Math.PI)), 1.3)).mul(.3)
    .mul(smoothstep(level - .2, level + 1.1, positionWorld.y)) as unknown as F;
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz);
  return material;
}

export interface Waterfall {
  /** The falling sheet and its plunge pool: one draw. It shows on the map, as the river does. */
  sheet: THREE.Mesh;
  /** Mist cards at the foot (and ledge): one draw, gpu and mobile only. Belongs with the near details, which the map hides. */
  spray: THREE.Mesh | null;
}
/** A waterfall placed by `spec`, for the device tier: at most two draws, no colliders (the pool is shallow; the terrain is its floor). */
export function createWaterfall(spec: WaterfallSpec, tier: GraphicsTier): Waterfall {
  const sheet = new THREE.Mesh(waterfallGeometry(spec, tier), waterfallMaterial(tier));
  sheet.name = 'Mountain waterfall'; sheet.castShadow = false; sheet.receiveShadow = tier !== 'cpu'; sheet.userData.keepGeometry = true;
  const geometry = sprayGeometry(spec, tier), spray = geometry ? new THREE.Mesh(geometry, sprayMaterial(tier, spec.foot[1])) : null;
  // Mist after the sheet it veils.
  if (spray) { spray.name = 'Waterfall spray'; spray.castShadow = spray.receiveShadow = false; spray.renderOrder = 1; spray.userData.keepGeometry = true; }
  return { sheet, spray };
}

// ---------------------------------------------------------------------------------------------------------------------
// The stream

export interface StreamOptions {
  /** The rendered ground (terrainSurfaceHeight): the ribbon lies on it across its whole width. Without it, on the points' heights. */
  ground?: Ground;
  /** Stones in the stream: their footprints stir it white, as the river's rocks do. */
  rocks?: readonly RockSite[];
  /** Water depth at the middle, metres (0.08 plus a tenth of the width). */
  depth?: number;
}
const STREAM_DETAIL = { gpu: { step: .35, columns: 7, bank: [.15, .38] }, mobile: { step: .5, columns: 5, bank: [.38] }, cpu: { step: .8, columns: 4, bank: [] } } as const;
/** White water from about 11° of fall, all of it from about 40°, and more where the bed steepens. */
export function streamWhite(slope: number, steepening: number): number {
  return THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(slope, .2, .85) + .6 * THREE.MathUtils.smoothstep(steepening, .06, .3), 0, 1);
}
/** cpu: opaque, so the stream's clear water and white water are baked into colour: a wet dark bed, a sky-lit body, white foam. */
function cpuStreamColour(depth: number, white: number, deepest: number): THREE.Color {
  return new THREE.Color('#3d4a42').lerp(new THREE.Color('#5f7f80'), THREE.MathUtils.smoothstep(depth / deepest, .15, .8)).lerp(new THREE.Color('#dde4e1'), white * .85);
}

/**
 * A narrow, shallow stream as a ribbon on the ground, `points` its centreline in downhill order and `width` metres (or a function
 * of the position along it, 0–1). It bakes what the river's shader reads (water-surface.ts): `flow` downstream along the ground,
 * `along` metres down the stream, `across` metres right of the flow, `depth` (deepest mid-stream, zero at both edges, so they fade
 * clear) and `rock`, here its white water: where the bed steepens (from the points' fall) or stones stir it. Past each edge a
 * ragged margin carries `wet`, which darkens the bank (gpu and mobile). The surface is level across the middle and meets the
 * ground at the edges; it never stands more than its depth over ground that falls away to one side.
 */
export function streamGeometry(points: readonly (Point3 | THREE.Vector3)[], width: number | ((t: number) => number), tier: GraphicsTier, options: StreamOptions = {}): THREE.BufferGeometry {
  const { step, columns, bank } = STREAM_DETAIL[tier], ground = options.ground, wide = typeof width === 'number' ? (): number => width : width;
  const curve = new THREE.CatmullRomCurve3(points.map(p => p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p)), false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / step)), samples = curve.getSpacedPoints(n), stones = options.rocks?.length ? rockField(options.rocks) : null;
  const bed = samples.map(p => ground ? ground(p.x, p.z) : p.y), run = [0];
  for (let k = 1; k <= n; k++) run.push(run[k - 1] + Math.hypot(samples[k].x - samples[k - 1].x, samples[k].z - samples[k - 1].z));
  // The fall per metre over about a metre and a half either side, and how much steeper it gets than the stretch above.
  const span = Math.max(1, Math.round(1.5 / step)), at = (k: number): number => THREE.MathUtils.clamp(k, 0, n);
  const fall = bed.map((_, k) => (bed[at(k - span)] - bed[at(k + span)]) / Math.max(run[at(k + span)] - run[at(k - span)], .1));
  const positions: number[] = [], flows: number[] = [], alongs: number[] = [], acrosses: number[] = [], depths: number[] = [], whites: number[] = [], wets: number[] = [], colours: number[] = [], indices: number[] = [];
  // Columns across, in units of the half-width: the water's, then the bank's either side (in metres past the edge).
  const water = Array.from({ length: columns }, (_, j) => j / (columns - 1) * 2 - 1), count = columns + bank.length * 2;
  let along = 0;
  for (let k = 0; k <= n; k++) {
    const t = k / n, centre = samples[k], tangent = curve.getTangentAt(t), flat = Math.hypot(tangent.x, tangent.z) || 1, fx = tangent.x / flat, fz = tangent.z / flat;
    if (k) along += Math.hypot(run[k] - run[k - 1], bed[k] - bed[k - 1]);
    const half = Math.max(wide(t), .05) / 2, depth = options.depth ?? .08 + wide(t) * .1, level = bed[k] + depth, white = streamWhite(fall[k], fall[k] - fall[at(k - span)]);
    // The wet margin's outline wanders, so the bank is not drawn with a ruler.
    const ragged = .75 + .5 * hash(k, 0, 17);
    const across = [...[...bank].reverse().map(b => -half - b * ragged), ...water.map(u => u * half), ...bank.map(b => half + b * ragged)];
    for (const [j, a] of across.entries()) {
      const x = centre.x - fz * a, z = centre.z + fx * a, floor = ground ? ground(x, z) : bed[k], u = Math.min(Math.abs(a) / half, 1);
      // Level across the middle, down to the ground at the edges; never more than `depth` over ground that falls away to one side.
      const y = Math.max(floor, Math.min(level, floor + depth * (1 - u ** 4))), wet = Math.abs(a) <= half + 1e-6 ? 1 : 1 - THREE.MathUtils.smoothstep(Math.abs(a) - half, 0, bank[bank.length - 1] * ragged);
      const sunk = Math.max(0, Math.min(y - floor, depth)) * (1 - u * u);
      positions.push(x, y + .015, z); flows.push(fx, fz); alongs.push(along); acrosses.push(a); depths.push(sunk); wets.push(wet);
      // White water churns mid-stream; the edges stay clear, so they fade into the bank.
      const stir = Math.max(white, stones ? stones(x, z) : 0) * (1 - u ** 3); whites.push(stir);
      if (tier === 'cpu') { const c = cpuStreamColour(sunk, stir, depth); colours.push(c.r, c.g, c.b); }
      if (k < n && j < count - 1) { const v = k * count + j, below = v + count; indices.push(v, v + 1, below, v + 1, below + 1, below); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
  geometry.setAttribute('along', new THREE.Float32BufferAttribute(alongs, 1));
  geometry.setAttribute('across', new THREE.Float32BufferAttribute(acrosses, 1));
  geometry.setAttribute('depth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('rock', new THREE.Float32BufferAttribute(whites, 1));
  geometry.setAttribute('wet', new THREE.Float32BufferAttribute(wets, 1));
  if (tier === 'cpu') geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
/** A stream (see streamGeometry): one draw, the river's shader per tier on windTime, no colliders: the terrain is its floor. */
export function createStream(points: readonly (Point3 | THREE.Vector3)[], width: number | ((t: number) => number), tier: GraphicsTier, options: StreamOptions = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(streamGeometry(points, width, tier, options), waterMaterial(tier, { stream: true, time: windTime }));
  mesh.name = 'Mountain stream'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.keepGeometry = true;
  // As the river: nothing transparent lies under it, so it blends first and later glass or glows stay on top.
  mesh.renderOrder = -1; return mesh;
}
