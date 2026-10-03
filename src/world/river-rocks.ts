import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import type { GraphicsTier } from '../game/graphics';
import { layoutAllows } from './landscape';
import { terrainSurfaceHeight, terrainSurfaceNormal } from './terrain';
import { WATER_EDGE, WATER_LEVEL } from './water-surface';
import type { RockSite } from './water-surface';
import { GARDEN_BRIDGES, channelDistance, riverCenter, tributaryCenter, waterDistance } from './waterways';

/**
 * River boulders: four seeded shape variants on one shared subdivided sphere, blended per instance through relative morph
 * targets, so every rock differs while all of them stay one instanced draw. The unit shape spans −1..1 in x and z; instances
 * stretch it by ROCK_STRETCH × s and turn it by yaw (`rockField` in water-surface.ts reads that footprint, with 12 % to spare).
 */
export const ROCK_STRETCH: readonly [number, number, number] = [1.4, .8, 1];
/** Icosphere subdivision per tier: 320, 180 and 80 triangles. Colliders always sample detail 1. */
export const ROCK_DETAIL: Record<GraphicsTier, number> = { gpu: 3, mobile: 2, cpu: 1 };
const COLLIDER_DETAIL = 1;
/** Collider vertices sit this far outside the rendered surface, so the coarse facets between them hug it instead of cutting in. */
const COLLIDER_INFLATE = 1.025;
/** Variant heights: some boulders are domed, others low and flat-topped. Footprints stay at full width. */
const HEIGHTS = [1, .84, .93, .76];
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);

function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const GRADIENTS = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
function lattice(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ Math.imul(seed, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0;
}
/** Seeded 3D gradient noise, roughly −1..1. */
function noise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10), lerp = THREE.MathUtils.lerp;
  const dot = (i: number, j: number, k: number): number => { const g = GRADIENTS[lattice(ix + i, iy + j, iz + k, seed) % 12]; return g[0] * (fx - i) + g[1] * (fy - j) + g[2] * (fz - k); };
  const u = fade(fx), v = fade(fy), w = fade(fz);
  return lerp(lerp(lerp(dot(0, 0, 0), dot(1, 0, 0), u), lerp(dot(0, 1, 0), dot(1, 1, 0), u), v), lerp(lerp(dot(0, 0, 1), dot(1, 0, 1), u), lerp(dot(0, 1, 1), dot(1, 1, 1), u), v), w);
}
/** Polynomial smooth minimum: water-worn edges where a cleavage face meets the rounded body. */
function smoothMin(a: number, b: number, k: number): number { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k / 4; }

interface Variant { seed: number; lumps: number; facets: { normal: THREE.Vector3; offset: number }[]; scale: THREE.Vector3 }
/** Fine relief shared by every variant, so baked cavity shading stays true whichever blend a rock uses. */
function fineRelief(d: THREE.Vector3): number { return .03 * noise(d.x * 3.2 + 7.1, d.y * 3.2, d.z * 3.2 - 2.3, 31) + .014 * noise(d.x * 7.3, d.y * 7.3 + 4.4, d.z * 7.3, 37); }
function variantRadius(variant: Variant, d: THREE.Vector3): number {
  const o = variant.seed * 1.37;
  let r = 1 + variant.lumps * (noise(d.x * 1.15 + o, d.y * 1.15, d.z * 1.15 - o, variant.seed) + .45 * noise(d.x * 2.3 - o, d.y * 2.3 + o, d.z * 2.3, variant.seed + 5));
  for (const { normal, offset } of variant.facets) { const facing = d.dot(normal); if (facing > .05) r = smoothMin(r, offset / facing, .08); }
  return r * (1 + fineRelief(d));
}
const VARIANTS: Variant[] = [0, 1, 2, 3].map((k) => {
  const rand = random(4021 + k * 977), facets: Variant['facets'] = [];
  // A tilted top face and a few side cleavages read as a weathered boulder rather than a blob.
  const top = new THREE.Vector3((rand() - .5) * .8, 1, (rand() - .5) * .8).normalize();
  facets.push({ normal: top, offset: .72 + rand() * .1 });
  for (let i = 0, count = 3 + (k + 1) % 3; i < count; i++) {
    const angle = (i / count + rand() * .25) * TAU;
    facets.push({ normal: new THREE.Vector3(Math.cos(angle), (rand() - .35) * .7, Math.sin(angle)).normalize(), offset: .76 + rand() * .12 });
  }
  const variant: Variant = { seed: 11 + k * 13, lumps: .16 + rand() * .08, facets, scale: new THREE.Vector3(1, 1, 1) };
  // Normalise on a fixed dense direction set, so every tier and the colliders share the exact same unit extents.
  const extent = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < 1500; i++) {
    const y = 1 - (i + .5) / 750, ring = Math.sqrt(1 - y * y), phi = i * 2.399963;
    d.set(Math.cos(phi) * ring, y, Math.sin(phi) * ring); const r = variantRadius(variant, d);
    extent.set(Math.max(extent.x, Math.abs(d.x * r)), Math.max(extent.y, Math.abs(d.y * r)), Math.max(extent.z, Math.abs(d.z * r)));
  }
  variant.scale.set(1 / extent.x, HEIGHTS[k] / extent.y, 1 / extent.z);
  return variant;
});
/** A point of one shape variant in the unit rock frame, along unit direction d. */
function variantPoint(k: number, d: THREE.Vector3, target = new THREE.Vector3()): THREE.Vector3 {
  return target.copy(d).multiplyScalar(variantRadius(VARIANTS[k], d)).multiply(VARIANTS[k].scale);
}
/** Unit sphere directions of an icosphere, welded so normals stay smooth. */
function directions(detail: number): { points: THREE.Vector3[]; index: number[] } {
  const sphere = new THREE.IcosahedronGeometry(1, detail); sphere.deleteAttribute('normal'); sphere.deleteAttribute('uv');
  const welded = mergeVertices(sphere), p = welded.getAttribute('position'), points: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) points.push(new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize());
  const index = Array.from(welded.index!.array); sphere.dispose(); welded.dispose(); return { points, index };
}

/**
 * The shared rock mesh for one subdivision level. Variant 0 is the base; variants 1–3 are relative morph targets (positions and
 * smooth normals). It also carries `uv` (stereographic from the top, so the only seam is the buried bottom pole) for the rock
 * map, baked mineral and cavity `color`, and a 0–1 `moss` mask that the node material turns into moss on upward faces. The
 * cpu tier's Lambert copy has no node shading, so its colours also bake the lichen in (`lichen`).
 */
export function rockGeometry(detail: number, lichen = true): THREE.BufferGeometry {
  const { points, index } = directions(detail), count = points.length, p = new THREE.Vector3();
  const shapes = VARIANTS.map((_, k) => {
    const g = new THREE.BufferGeometry(), positions = new Float32Array(count * 3);
    points.forEach((d, i) => variantPoint(k, d, p).toArray(positions, i * 3));
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setIndex(index); g.computeVertexNormals();
    return { positions, normals: g.getAttribute('normal').array as Float32Array };
  });
  const uv: number[] = [], colors: number[] = [], moss: number[] = [], color = new THREE.Color();
  const mineral = new THREE.Color('#bcc3c1'), warm = new THREE.Color('#b2a790'), green = new THREE.Color('#66774a');
  const smooth = THREE.MathUtils.smoothstep;
  for (const d of points) {
    const lift = Math.max(1 + d.y, .12); uv.push(.5 + .42 * d.x / lift, .5 + .42 * d.z / lift);
    color.copy(mineral).lerp(warm, smooth(noise(d.x * 1.6, d.y * 1.6 + 3, d.z * 1.6, 91), -.3, .5) * .55);
    // Mottled mineral, darker fine hollows and a damp foot; lichen collects on the upper faces in patches.
    color.multiplyScalar((.84 + .2 * noise(d.x * 4.3, d.y * 4.3, d.z * 4.3 + 9, 92)) * (.78 + .22 * smooth(fineRelief(d), -.035, .03)) * (.8 + .2 * smooth(d.y, -.55, .05)));
    const m = smooth(d.y * .9 + .38 * noise(d.x * 2.4 + 5, d.y * 2.4, d.z * 2.4, 93), .15, .7) * (.6 + .4 * smooth(noise(d.x * 6.2, d.y * 6.2, d.z * 6.2 - 4, 94), -.2, .4));
    if (lichen) color.lerp(green, m * .7);
    colors.push(color.r, color.g, color.b); moss.push(m);
  }
  const geometry = new THREE.BufferGeometry(), base = shapes[0];
  geometry.setAttribute('position', new THREE.BufferAttribute(base.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(base.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('moss', new THREE.Float32BufferAttribute(moss, 1));
  const delta = (a: Float32Array, b: Float32Array): THREE.BufferAttribute => new THREE.BufferAttribute(a.map((value, i) => value - b[i]), 3);
  geometry.morphAttributes.position = shapes.slice(1).map(shape => delta(shape.positions, base.positions));
  geometry.morphAttributes.normal = shapes.slice(1).map(shape => delta(shape.normals, base.normals));
  geometry.morphTargetsRelative = true; geometry.setIndex(index); geometry.computeBoundingSphere();
  return geometry;
}

/** Deterministic variant weights of one rock (morph influences of variants 1–3; variant 0 takes the rest). */
export function rockWeights(site: RockSite): [number, number, number] {
  const rand = random((Math.imul(Math.round(site.x * 97), 73856093) ^ Math.imul(Math.round(site.z * 89), 19349663)) >>> 0);
  rand(); // The first draw of a hashed seed is poorly mixed.
  // Each boulder leans on one variant and borrows a little from the others.
  const raw = [0, 1, 2, 3].map(() => .04 + rand() * .3); raw[Math.floor(rand() * 4)] += 1.2 + rand() * .6;
  const total = raw[0] + raw[1] + raw[2] + raw[3]; return [raw[1] / total, raw[2] / total, raw[3] / total];
}
/** The instance transform shared by the rendered rock and its collider: stretch, turn by yaw, then lean with the bank. */
export function rockMatrix(site: RockSite, target = new THREE.Matrix4()): THREE.Matrix4 {
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, site.yaw);
  if (site.lean) { const [x, z] = site.lean; turn.premultiply(new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(x, Math.sqrt(Math.max(0, 1 - x * x - z * z)), z))); }
  return target.compose(new THREE.Vector3(site.x, site.y, site.z), turn, new THREE.Vector3(site.s * ROCK_STRETCH[0], site.s * ROCK_STRETCH[1], site.s * ROCK_STRETCH[2]));
}

/** A rock stands in the stream when its centre lies inside the water outline. */
export function inStream(site: RockSite): boolean { return waterDistance(site.x, site.z) < WATER_EDGE; }

/** All rocks as one instanced draw: shared transforms, per-rock morph blend and a slight per-rock tint (wet in the stream). */
export function createRiverRocks(sites: readonly RockSite[], material: THREE.Material, tier: GraphicsTier): THREE.InstancedMesh {
  const geometry = rockGeometry(ROCK_DETAIL[tier], tier === 'cpu'), rocks = new THREE.InstancedMesh(geometry, material, sites.length);
  const weights = new THREE.Mesh(geometry), matrix = new THREE.Matrix4(), tint = new THREE.Color();
  sites.forEach((site, i) => {
    rocks.setMatrixAt(i, rockMatrix(site, matrix));
    weights.morphTargetInfluences!.splice(0, 3, ...rockWeights(site)); rocks.setMorphAt(i, weights);
    const rand = random(Math.floor(site.yaw * 1e6) + i), shade = .88 + rand() * .18;
    // In the stream the node material darkens the wet foot; the slightly darker tint carries it on cpu.
    rocks.setColorAt(i, inStream(site) ? tint.setRGB(shade * .82, shade * .85, shade * .84) : tint.setRGB(shade, shade * (.98 + rand() * .03), shade * (.96 + rand() * .05)));
  });
  rocks.morphTexture!.needsUpdate = true; rocks.name = 'River rocks';
  rocks.castShadow = true; rocks.receiveShadow = true; rocks.computeBoundingSphere(); return rocks;
}

/**
 * One trimesh for every rock: each rock's own blended shape, sampled on a detail-1 icosphere and placed by the same instance
 * transform as its rendered mesh.
 */
export function rockColliders(sites: readonly RockSite[]): ColliderSpec {
  const { points, index } = coarse(), vertices = new Float32Array(sites.length * points.length * 3), indices = new Uint32Array(sites.length * index.length);
  const matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  sites.forEach((site, r) => {
    const w = rockWeights(site); rockMatrix(site, matrix);
    points.forEach((_, i) => coarsePoint(w, i, p).multiplyScalar(COLLIDER_INFLATE).applyMatrix4(matrix).toArray(vertices, (r * points.length + i) * 3));
    index.forEach((n, i) => { indices[r * index.length + i] = r * points.length + n; });
  });
  return { type: 'mesh', vertices, indices };
}

/** The coarse (collider) sampling of every variant, built once. */
let coarseSamples: { points: THREE.Vector3[]; index: number[]; variants: THREE.Vector3[][]; underside: number[] } | null = null;
function coarse(): NonNullable<typeof coarseSamples> {
  if (!coarseSamples) {
    const { points, index } = directions(COLLIDER_DETAIL);
    coarseSamples = { points, index, variants: VARIANTS.map((_, k) => points.map(d => variantPoint(k, d))), underside: points.flatMap((d, i) => d.y < -.45 ? [i] : []) };
  }
  return coarseSamples;
}
function coarsePoint(weights: readonly number[], i: number, target: THREE.Vector3): THREE.Vector3 {
  const { variants } = coarse(), shares = [1 - weights[0] - weights[1] - weights[2], weights[0], weights[1], weights[2]];
  target.set(0, 0, 0); shares.forEach((share, k) => target.addScaledVector(variants[k][i], share)); return target;
}
/** The highest centre height at which every underside sample of the rock sinks `depth` into the triangulated ground. */
export function seatedHeight(site: RockSite, depth: number): number {
  const matrix = rockMatrix({ ...site, y: 0 }), w = rockWeights(site), p = new THREE.Vector3(); let y = Infinity;
  for (const i of coarse().underside) { coarsePoint(w, i, p).applyMatrix4(matrix); y = Math.min(y, terrainSurfaceHeight(p.x, p.z) - depth - p.y); }
  return y;
}
/** Height of a rock's highest coarse sample. */
function rockTop(site: RockSite): number {
  const matrix = rockMatrix(site), w = rockWeights(site), p = new THREE.Vector3(); let top = -Infinity;
  coarse().points.forEach((_, i) => { top = Math.max(top, coarsePoint(w, i, p).applyMatrix4(matrix).y); });
  return top;
}

/** Horizontal reach of a rock's footprint (its long axis, with the shape's 12 % allowance). */
export function rockReach(s: number): number { return s * ROCK_STRETCH[0] * 1.12; }
/**
 * A few boulders stand in the shallow edge, so the river's rock foam has something to break around. Each leans part of the way
 * with the bank and sinks its whole underside into the bed, so none overhangs the channel; it still breaks the surface, and
 * keeps clear of bridges, routes and authored grounds. Mobile takes the first ten.
 */
export function streamRockSites(mobile: boolean, seed = 1660): RockSite[] {
  const rand = random(seed), count = mobile ? 10 : 16, sites: RockSite[] = [];
  const clear = (x: number, z: number, reach: number): boolean => !(Math.abs(x) < 6 + reach && z > 8 && z < 46)
    && !GARDEN_BRIDGES.some(b => Math.abs(z - b.z) < 5 + reach && Math.abs(x - b.x) < 12 + reach)
    && !sites.some(r => Math.hypot(r.x - x, r.z - z) < Math.max(5, rockReach(r.s) + reach)) && layoutAllows(x, z, reach);
  for (let i = 0; i < 4000 && sites.length < count; i++) {
    // Draw every number up front so a rejected candidate never shifts the next one.
    const inner = .08 + rand() * .9, side = rand() < .5 ? -1 : 1, along = rand(), tributary = rand() < .5 ? -1 : 1, sink = rand() * .1, size = .5 + rand() * .65, yaw = rand() * TAU;
    let x: number, z: number;
    if (i % 3 < 2) {
      // Two in three on the main river, most of them within sight of the bridge.
      x = (along - .5) * (i % 2 ? 150 : 70); const centre = riverCenter(x);
      z = centre + side * (-channelDistance(x, centre, 0) + WATER_EDGE - inner);
    } else {
      z = -50 + along * 66; const centre = tributaryCenter(z, tributary);
      x = centre + side * (-channelDistance(centre, z, tributary) + WATER_EDGE - inner);
    }
    const d = waterDistance(x, z); if (d > WATER_EDGE - .05 || d < WATER_EDGE - 1.05 || !clear(x, z, rockReach(size))) continue;
    const bank = terrainSurfaceNormal(x, z); let site: RockSite | null = null;
    // Grow the rock until, seated, it rises at least 0.22 m above the water; prefer leaning 60 % of the way with the bank.
    for (let s = size; s < 1.3 && !site; s += .05) for (const k of [.6, 1, .3]) {
      const up = new THREE.Vector3(0, 1, 0).lerp(bank, k).normalize(), candidate: RockSite = { x, y: 0, z, s, yaw, lean: [up.x, up.z] };
      candidate.y = seatedHeight(candidate, .04) - sink * s;
      if (rockTop(candidate) > WATER_LEVEL + .22) { site = candidate; break; }
    }
    // Clearances only tighten as a rock grows, so the cheap test at its drawn size above never rejects a rock this one would keep.
    if (site && clear(x, z, rockReach(site.s))) sites.push(site);
  }
  return sites;
}
