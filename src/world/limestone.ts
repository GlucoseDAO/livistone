// Sub-plan 27 round 2: limestone shared by the ground's steep rock (ground-material.ts) and the crag blocks (crags.ts), so both
// read as one rock. The Poly Haven scan keeps its grain and turns pale grey at the terrain's scale (15 m, a 57 m copy against its
// repeat); bedding planes at world height and vertical joints between them cut every face into blocks, each with its own facet
// tilt and value, darker cracks and rounded grooves; water streaks run down steep faces, lichen spots it and moss holds to ledges.
// The same planes cross the smooth two-metre terrain and the block meshes, so their beds line up where they meet.
import * as THREE from 'three';
import { Fn, If, cos, dot, float, floor, fract, length, max, min, mix, normalize, pow, sin, smoothstep, texture, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { MOUNTAIN } from './mountain-layout';

/** Dev-only `?crags=off`: sub-plan 27's first-round mountains, without crag blocks (crags.ts) or jointed limestone on steep ground. */
export function cragsLook(): 'on' | 'off' {
  if (!import.meta.env?.DEV || typeof location === 'undefined') return 'on';
  return new URLSearchParams(location.search).get('crags') === 'off' ? 'off' : 'on';
}
export const CRAGS = MOUNTAIN && cragsLook() === 'on';

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;

/** The steep ground's baked vertex colour (mountains.ts); the ground divides it back out so its rock lands on the same albedo. */
export const STONE = new THREE.Color('#a6a294');
/** Triplanar scale of the rock scan, metres⁻¹ (a 15.4 m repeat), and of its broad copy. Ground, crags and colliders agree. */
export const ROCK_SCALE = .065;
const BROAD = .27;
/** Mean linear luma of rock-color.jpg, so the scan's value can be re-centred on the limestone's. */
const SCAN_LUMA = .16;
/** Limestone albedo (linear): the photographs' light, faintly warm grey; the sky's and the meadow's fill already tint it cool and green. */
const PALE = [.3, .28, .262] as const;
/** Bedding: about .45 beds per metre of height on average. Joints: Voronoi cells about 5.5 m across in plan. */
const BED = .45, JOINT = 5.5;
const LUMA = vec3(.2126, .7152, .0722);

// Sine-free hashes and value noise, stable at large world coordinates (as ground-material.ts's).
const hash12 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
}).setLayout({ name: 'limeHash12', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const hash22 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(vec3(.1031, .1030, .0973))).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(vec2(q.x, q.x).add(q.yz).mul(q.zy));
}).setLayout({ name: 'limeHash22', type: 'vec2', inputs: [{ name: 'p', type: 'vec2' }] });
const hash32 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(vec3(.1031, .1030, .0973))).toVar(); q.addAssign(dot(q, q.yxz.add(33.33)));
  return fract(vec3(q.x, q.x, q.y).add(vec3(q.y, q.z, q.z)).mul(vec3(q.z, q.y, q.x)));
}).setLayout({ name: 'limeHash32', type: 'vec3', inputs: [{ name: 'p', type: 'vec2' }] });
const valueNoise = Fn(([p]: [V2]) => {
  const i = floor(p).toVar(), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  return mix(mix(hash12(i), hash12(i.add(vec2(1, 0))), u.x), mix(hash12(i.add(vec2(0, 1))), hash12(i.add(vec2(1, 1))), u.x), u.y);
}).setLayout({ name: 'limeValueNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });

/** Nearest and second-nearest feature distances of a jittered grid in plan, and the nearest cell: the joints' Voronoi. */
const jointCells = Fn(([p]: [V2]) => {
  const cell = floor(p).toVar(), f = fract(p).toVar(), f1 = float(9).toVar(), f2 = float(9).toVar(), id = vec2(0).toVar();
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const o = vec2(i, j), c = cell.add(o), d = length(o.add(hash22(c).mul(.8).add(.1)).sub(f)).toVar();
    If(d.lessThan(f1), () => { f2.assign(f1); f1.assign(d); id.assign(c); }).ElseIf(d.lessThan(f2), () => { f2.assign(d); });
  }
  return vec4(f1, f2, id);
}).setLayout({ name: 'limeJointCells', type: 'vec4', inputs: [{ name: 'p', type: 'vec2' }] });

/**
 * Bed coordinate at a world point: bedding planes at whole numbers. Two sines make it rise unevenly with height (.04–.86 beds a
 * metre, always rising), so thin beds alternate with massive ones metres thick instead of regular courses; it shifts by a few beds
 * across the mountain, so the planes dip and wander rather than ring it like contour lines, and waves a little over a few metres.
 */
const bedCoordinate = Fn(([p]: [V3]) => {
  const swell = valueNoise(p.xz.div(57)).mul(6).toVar(), a = p.y.mul(.29).add(swell).toVar(), b = p.y.mul(.83).sub(swell.mul(.7)).toVar();
  const bed = p.y.mul(BED).add(sin(a).mul(.55)).add(sin(b).mul(.3)).add(valueNoise(p.xz.div(31)).mul(2.2)).add(valueNoise(p.xz.div(9)).mul(.35)).add(valueNoise(p.xz.div(2.3)).mul(.12));
  // Beds per metre of height here, so distances to the planes come out in metres.
  return vec2(bed, max(cos(a).mul(.55 * .29).add(cos(b).mul(.3 * .83)).add(BED), .04));
}).setLayout({ name: 'limeBedCoordinate', type: 'vec2', inputs: [{ name: 'p', type: 'vec3' }] });

/** One block of rock between two bedding planes and its joints. */
export interface Bricks {
  /** Thin dark crack lines (0–1) and the wider shaded groove where block edges round off. */
  crack: F; groove: F;
  /** The block's own value (about ±0.07) and facet tilt (each component −1..1), faded with distance. */
  shade: F; tilt: V3;
  /** 1 while cracks are wider than a pixel, fading to 0 by about 14 cm a pixel. */
  near: F;
}
/**
 * The jointed blocks at world point `p`. `pixel` is the world size of a pixel there (from derivatives taken outside any branch);
 * cracks never get thinner than about 1.5 pixels and fade before they would alias. Most bedding planes are tight and show only
 * as a faint band; about one in three opens into a parting, broken along its length. About half the beds are jointed, their
 * joints fading in and out up the face, so no regular courses appear. `joints` false keeps only the bedding (cpu).
 */
export function limestoneBricks(p: V3, pixel: F, joints = true): Bricks {
  const coordinate = bedCoordinate(p).toVar(), bedId = floor(coordinate.x).toVar(), along = fract(coordinate.x), bedHash = hash12(vec2(bedId, 3.7)).toVar();
  const bedGap = min(along, float(1).sub(along)).div(coordinate.y).toVar(), width = max(pixel.mul(1.5), .025).toVar();
  const near = float(1).sub(smoothstep(.035, .14, pixel)).toVar(), fade = float(1).sub(smoothstep(.06, .4, pixel)).toVar();
  const line = (gap: F): F => float(1).sub(smoothstep(width.mul(.5), width.mul(1.6), gap));
  const parting = smoothstep(.6, .85, bedHash).mul(smoothstep(.32, .6, valueNoise(p.xz.div(4.3).add(bedId.mul(3.1)))));
  let crack: F = line(bedGap).mul(parting), groove: F = float(1).sub(smoothstep(0, max(pixel.mul(3), .5), bedGap)).mul(parting.mul(.7).add(bedHash.mul(.3)));
  let id: V2 = vec2(bedId.mul(.731), bedId.mul(1.37));
  if (joints) {
    // Joints stop at the beds: each bed has its own cells, so vertical cracks stagger as in the photographs' blocky walls.
    const cells = jointCells(p.xz.div(JOINT).add(hash22(vec2(bedId, 11.3)).mul(23))).toVar(), jointGap = cells.y.sub(cells.x).mul(JOINT * .5).toVar();
    const jointed = smoothstep(.4, .6, hash12(vec2(bedId, 8.1))).mul(smoothstep(.3, .58, valueNoise(vec2(p.y.mul(.8), p.x.add(p.z).mul(.21)).add(cells.zw.mul(1.7))))).toVar();
    crack = max(crack, line(jointGap).mul(jointed)); groove = max(groove, float(1).sub(smoothstep(0, max(pixel.mul(3), .5), jointGap)).mul(jointed));
    id = cells.zw.add(vec2(bedId.mul(17.1), bedId.mul(-5.3)));
  }
  return { crack: crack.mul(near), groove: groove.mul(float(1).sub(smoothstep(.08, .3, pixel))), shade: hash12(id.add(.5)).sub(.5).mul(.1).mul(fade), tilt: hash32(id.add(1.7)).sub(.5).mul(2).mul(fade), near };
}

/** Triplanar inputs at a world point: position, its screen derivatives, projection weights, the surface normal and pixel size. */
export interface Limestone { p: V3; dpx: V3; dpy: V3; weights: V3; normal: V3; pixel: F }
/** Triplanar tap of `map` at `scale` with explicit gradients, legal inside branches. */
function triplanar(map: THREE.Texture, at: Limestone, scale: number): V3 {
  const q = at.p.mul(scale), dx = at.dpx.mul(scale), dy = at.dpy.mul(scale), w = at.weights;
  return texture(map, q.yz).grad(dx.yz, dy.yz).rgb.mul(w.x).add(texture(map, q.xz).grad(dx.xz, dy.xz).rgb.mul(w.y)).add(texture(map, q.xy).grad(dx.xy, dy.xy).rgb.mul(w.z));
}
/** The scan's own relief (0–1, about .35 on average) before any colour work: the ground blends meadow and rock by it. */
export interface LimestoneColour { albedo: V3; relief: F }
/**
 * Final linear albedo of the limestone at `at`, before any vertex colour: the scan's grain on pale grey, the blocks' cracks,
 * grooves and values, water streaks down steep faces and lichen. `moss` (0–1) greens upward faces in patches. The cpu tier
 * takes one scale of the scan and no streaks.
 */
export function limestoneColour(tier: GraphicsTier, rock: THREE.Texture, at: Limestone, bricks: Bricks, moss: F | number = 0): LimestoneColour {
  const near = triplanar(rock, at, ROCK_SCALE), scan = (tier === 'cpu' ? near : mix(near, triplanar(rock, at, ROCK_SCALE * BROAD), .45)).toVar();
  const luma = max(dot(scan, LUMA), 1e-3).toVar(), value = luma.div(SCAN_LUMA).toVar();
  // The scan's brown is turned to grey; a trace of its hue keeps some blocks warmer, and its value, steepened, carries the grain.
  const albedo = vec3(...PALE).mul(mix(vec3(1), scan.div(luma), .12)).mul(pow(value, 1.35)).toVar();
  albedo.mulAssign(bricks.shade.add(1)); albedo.mulAssign(float(1).sub(bricks.crack.mul(.62))); albedo.mulAssign(float(1).sub(bricks.groove.mul(.2)));
  const p = at.p, steep = float(1).sub(smoothstep(.3, .78, at.normal.y.abs())).toVar();
  if (tier !== 'cpu') {
    // Dark water streaks hang down steep faces: noise stretched along the height in the two side projections.
    const w = at.weights, streak = valueNoise(vec2(p.z.mul(1.7), p.y.mul(.09))).mul(w.x).add(valueNoise(vec2(p.x.mul(1.7), p.y.mul(.09))).mul(w.z)).div(max(w.x.add(w.z), 1e-3));
    albedo.mulAssign(float(1).sub(smoothstep(.56, .86, streak).mul(steep).mul(.34)));
  }
  // Broad stains a few metres across, then crustose lichen: clusters of small black spots and pale yellow-grey crusts.
  albedo.mulAssign(valueNoise(p.xz.div(7.5).add(p.y.mul(.13))).mul(.3).add(.85));
  const lichen = valueNoise(p.xz.mul(1.9).add(p.y.mul(1.3))).mul(.55).add(valueNoise(p.xz.mul(6.1).sub(p.y.mul(4.3))).mul(.45)).toVar();
  albedo.assign(mix(albedo, albedo.mul(.58), smoothstep(.66, .76, lichen).mul(smoothstep(.4, .6, valueNoise(p.xz.mul(.31).add(p.y.mul(.2)))))));
  albedo.assign(mix(albedo, vec3(.44, .42, .38), float(1).sub(smoothstep(.18, .27, lichen)).mul(.45)));
  if (moss !== 0) {
    const ledge = smoothstep(.55, .85, at.normal.y).mul(moss).mul(smoothstep(.38, .62, valueNoise(p.xz.mul(.7).add(4.1))));
    albedo.assign(mix(albedo, vec3(.05, .085, .025).mul(valueNoise(p.xz.mul(1.9)).mul(.6).add(.7)), ledge));
  }
  return { albedo, relief: luma.mul(2.2).clamp(0, 1) };
}

/**
 * gpu: the rock scan's normal map triplanar (as ground-material.ts blends it) plus each block's facet tilt, around `base`
 * (a world-space unit normal). `strength` scales the scan's relief.
 */
export function limestoneNormal(normalMap: THREE.Texture, at: Limestone, base: V3, bricks: Bricks, strength = .45): V3 {
  const q = at.p.mul(ROCK_SCALE), dx = at.dpx.mul(ROCK_SCALE), dy = at.dpy.mul(ROCK_SCALE), w = at.weights;
  const nx = texture(normalMap, q.yz).grad(dx.yz, dy.yz).xy.mul(2).sub(1), ny = texture(normalMap, q.xz).grad(dx.xz, dy.xz).xy.mul(2).sub(1), nz = texture(normalMap, q.xy).grad(dx.xy, dy.xy).xy.mul(2).sub(1);
  const detail = vec3(0, nx.y, nx.x).mul(w.x).add(vec3(ny.x, 0, ny.y).mul(w.y)).add(vec3(nz.x, nz.y, 0).mul(w.z));
  return normalize(base.add(detail.mul(strength)).add(bricks.tilt.mul(.3)));
}

/** Triplanar weights from a unit normal, sharpened so each face takes mostly one projection. */
export function triplanarWeights(n: V3): V3 { const w = n.abs().pow(vec3(4)).toVar(); return w.div(max(dot(w, vec3(1)), .001)); }
