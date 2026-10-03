import * as THREE from 'three';
import { Fn, attribute, cameraPosition, cameraViewMatrix, clamp, cos, cross, dot, exp2, float, floor, fract, instanceIndex, ivec2, length, max, min, mix, normalize, positionGeometry, pow, sin, smoothstep, step, texture, textureLoad, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { WALKING_NETWORK, WATER_CLEARANCE, groundReserved } from './landscape';
import { tributaryCenter, waterDistance } from './waterways';
import { landscapeHeight } from './terrain';
import { groundCover } from './ground-cover';
import { FRESH, GRASS } from './mountains';
import { TOWN_BOUNDS } from './town-layout';
import { groundLook, macroField, meadowAverage } from './ground-material';
import type { GrassShade, GroundLook } from './ground-material';
import { windSway } from './wind';
import { rockReach } from './river-rocks';
import type { RockSite } from './water-surface';

/**
 * Near-player grass (realism sub-plan 13): one instanced draw of blade patches around the camera, on gpu and mobile only.
 * Each instance is one cell of a square tile; three tiles at 1×, 2× and 4× the cell size nest like clipmap levels, so blades
 * are dense at the feet and sparser where perspective packs them together. A cell wraps to the copy of itself nearest the
 * camera, i.e. every level re-centres on its own snapped world grid: a blade belongs to a world cell and never swims, and a
 * cell only jumps across its tile where its level has already faded out. A baked 2 m lookup (the terrain mesh's own vertex
 * grid) gives the rendered ground height and where grass may grow.
 */
export const GRASS_TIERS = {
  gpu: { levels: 3, cells: 22, cell: .5, blades: 36, segments: 3, height: .3, width: .024 },
  mobile: { levels: 3, cells: 16, cell: .375, blades: 25, segments: 2, height: .32, width: .032 },
} as const;
type Spec = (typeof GRASS_TIERS)[keyof typeof GRASS_TIERS];

/**
 * Blade roots keep this much ground clear of every reserved footprint (grassAllowed's radius); full height from .3 m
 * further. The 2 m lookup overestimates the clearance by up to ~.2 m outside tight path bends, so kerbs stay bare too.
 */
export const BLADE_CLEARANCE = .25;
const FULL_CLEARANCE = BLADE_CLEARANCE + .3;

/** Instances, blades and triangles drawn per frame, and the field radius in metres; null where the tier draws no field. */
export function grassFieldCounts(tier: GraphicsTier): { instances: number; blades: number; triangles: number; radius: number } | null {
  if (tier === 'cpu') return null;
  const spec = GRASS_TIERS[tier], instances = spec.levels * spec.cells ** 2;
  return { instances, blades: instances * spec.blades, triangles: instances * spec.blades * (2 * spec.segments - 1), radius: fieldRadius(spec) };
}
const fieldRadius = (spec: Spec): number => spec.cells * spec.cell * 2 ** (spec.levels - 1) / 2;

/** Dev-only `?grass=off` drops the field for before/after review. */
export function grassFieldEnabled(): boolean {
  return !import.meta.env.DEV || typeof location === 'undefined' || new URLSearchParams(location.search).get('grass') !== 'off';
}

// ---------------------------------------------------------------------------------------------------------------------
// Bake

/** A round footprint on the ground (a trunk or stem), world metres. */
export interface GroundDisc { x: number; z: number; radius: number }

const STEP = 2, LIMIT = 3, COARSE = 4;
/** The walkable town on the terrain mesh's 2 m vertex grid (even world coordinates), plus the clearance and tint lookups. */
export interface GrassBake {
  minX: number; minZ: number; width: number; depth: number;
  /**
   * Per vertex: rendered ground height, clearance from reserved ground (m, ±3), how densely grass grows from soil wear and
   * slope (0–1), and the ground's baked ambient occlusion under crowns and walls (contact-shadows.ts; 1 under open sky).
   */
  field: Float32Array;
  /** Per vertex: the ground's vertex-colour factor over its grass baseline (÷ 1.5), and how fully grass grows there (alpha). */
  tint: Uint8Array;
}

/** Clearance from water and from the merged walking network (paving, fillets and planting margins), capped at ±LIMIT. */
function openClearance(x: number, z: number): number {
  return Math.max(-LIMIT, Math.min(LIMIT, waterDistance(x, z) - WATER_CLEARANCE, WALKING_NETWORK.clearance(x, z, LIMIT)));
}
/** The largest footprint radius that still fits below `upper` (every groundReserved predicate grows with the radius). */
function footprintClearance(x: number, z: number, upper: number): number {
  if (!groundReserved(x, z, upper)) return upper;
  if (groundReserved(x, z, -LIMIT)) return -LIMIT;
  let lo = -LIMIT, hi = upper;
  for (let k = 0; k < 9; k++) { const mid = (lo + hi) / 2; if (groundReserved(x, z, mid)) hi = mid; else lo = mid; }
  return lo;
}
/**
 * Signed distance (m, capped at ±3) from the nearest ground grassAllowed reserves: positive outside, so grassAllowed(x, z, r)
 * holds exactly where this is at least r. Canopy clearings (the mycelium grove, the Enhancement meadow) keep their grass.
 */
export function grassClearance(x: number, z: number): number {
  const open = openClearance(x, z);
  return open <= -LIMIT ? -LIMIT : footprintClearance(x, z, open);
}

/**
 * Bakes the lookups once at load. Rocks and the grove's stems (LivingWaters.stems: trunk discs, crowns excluded) keep their
 * own footprints; `height` defaults to the rendered landscape; `shade` is the terrain's baked ground occlusion
 * (groundShadeField), so blades under crowns lose the same sky light as the ground.
 */
export function bakeGrassField(options: { rocks?: readonly RockSite[]; stems?: readonly GroundDisc[]; height?: (x: number, z: number) => number; shade?: (x: number, z: number) => number } = {}): GrassBake {
  const height = options.height ?? landscapeHeight, shade = options.shade ?? ((): number => 1);
  const minX = STEP * Math.floor(TOWN_BOUNDS.minX / STEP), minZ = STEP * Math.floor(TOWN_BOUNDS.minZ / STEP);
  const width = (STEP * Math.ceil(TOWN_BOUNDS.maxX / STEP) - minX) / STEP + 1, depth = (STEP * Math.ceil(TOWN_BOUNDS.maxZ / STEP) - minZ) / STEP + 1;
  const field = new Float32Array(width * depth * 4), tint = new Uint8Array(width * depth * 4), heights = new Float32Array(width * depth);
  for (let j = 0; j < depth; j++) for (let i = 0; i < width; i++) heights[j * width + i] = height(minX + i * STEP, minZ + j * STEP);
  // Footprints: whole 6 m blocks far outside (or deep inside) every footprint skip the per-vertex search. Each predicate is
  // 1-Lipschitz in its radius, so the block centre's clearance bounds every vertex in it; .5 m covers the elliptical ones.
  const reach = (COARSE - 1) * STEP / 2 * Math.SQRT2 + LIMIT + .5;
  for (let j0 = 0; j0 < depth; j0 += COARSE) for (let i0 = 0; i0 < width; i0 += COARSE) {
    const cx = minX + (i0 + (COARSE - 1) / 2) * STEP, cz = minZ + (j0 + (COARSE - 1) / 2) * STEP;
    const block = !groundReserved(cx, cz, reach) ? LIMIT : groundReserved(cx, cz, -reach) ? -LIMIT : NaN;
    for (let j = j0; j < Math.min(depth, j0 + COARSE); j++) for (let i = i0; i < Math.min(width, i0 + COARSE); i++) {
      const x = minX + i * STEP, z = minZ + j * STEP, n = j * width + i, open = openClearance(x, z);
      field[n * 4 + 1] = open <= -LIMIT || block === -LIMIT ? -LIMIT : block === LIMIT ? open : footprintClearance(x, z, open);
    }
  }
  // Each tributary starts from a point at z = -58, and south of it waterDistance sees no channel at all (waterways.ts). That
  // step falls between two rows of the grid, which would let blades into the first metre of water; vertices on and south of
  // the head row also keep their distance to the head.
  for (const side of [-1, 1]) {
    const hx = tributaryCenter(-58, side), i0 = Math.max(0, Math.floor((hx - LIMIT - 1 - minX) / STEP)), j1 = Math.min(depth - 1, Math.floor((-58 - minZ) / STEP));
    for (let j = Math.max(0, j1 - 3); j <= j1; j++) for (let i = i0; i <= Math.min(width - 1, i0 + 6); i++) {
      const n = (j * width + i) * 4 + 1; field[n] = Math.min(field[n], Math.hypot(minX + i * STEP - hx, minZ + j * STEP + 58) - WATER_CLEARANCE);
    }
  }
  // Rocks keep their footprint and a ring of bank around it. Below about 40 cm the 2 m grid cannot resolve a rock, so a few
  // short bank blades may still meet the smallest pebbles. Stems keep their own trunk disc.
  for (const disc of [...(options.rocks ?? []).map(rock => ({ x: rock.x, z: rock.z, radius: rockReach(rock.s) + .5 })), ...options.stems ?? []]) {
    const radius = disc.radius, i0 = Math.floor((disc.x - radius - LIMIT - minX) / STEP), j0 = Math.floor((disc.z - radius - LIMIT - minZ) / STEP);
    for (let j = Math.max(0, j0); j <= Math.min(depth - 1, j0 + Math.ceil((radius + LIMIT) * 2 / STEP) + 1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(width - 1, i0 + Math.ceil((radius + LIMIT) * 2 / STEP) + 1); i++) {
        const n = (j * width + i) * 4 + 1; field[n] = Math.min(field[n], Math.hypot(minX + i * STEP - disc.x, minZ + j * STEP - disc.z) - radius);
      }
  }
  const colour = new THREE.Color();
  for (let j = 0; j < depth; j++) for (let i = 0; i < width; i++) {
    const n = j * width + i, x = minX + i * STEP, z = minZ + j * STEP, h = heights[n];
    const gx = (heights[j * width + Math.min(width - 1, i + 1)] - heights[j * width + Math.max(0, i - 1)]) / (STEP * 2), gz = (heights[Math.min(depth - 1, j + 1) * width + i] - heights[Math.max(0, j - 1) * width + i]) / (STEP * 2);
    // Grass gives way to rock on steep slopes and thins over worn soil and banks.
    const slope = 1 - THREE.MathUtils.smoothstep(1 - 1 / Math.sqrt(1 + gx * gx + gz * gz), .06, .18);
    field[n * 4] = h; field[n * 4 + 2] = slope; field[n * 4 + 3] = 1;
    // No blade's cell reaches ground deep inside a footprint (clearance changes at most 2 m across a cell): skip it.
    if (field[n * 4 + 1] <= -LIMIT) { tint.set([170, 170, 170, 0], n * 4); continue; }
    field[n * 4 + 3] = shade(x, z);
    // Ground too steep for grass skips its cover, which would only thin the neighbouring blades further.
    if (slope === 0) { tint.set([170, 170, 170, 0], n * 4); continue; }
    const cover = groundCover(x, z); field[n * 4 + 2] = slope * (1 - THREE.MathUtils.smoothstep(cover.soil, .1, .38) * .9);
    // The ground's own vertex colour over its grass baseline (mountains.ts), so blades share its broad shade and freshness.
    colour.copy(GRASS).lerp(FRESH, cover.freshness * .6).multiplyScalar(cover.shade);
    tint.set([colour.r / GRASS.r, colour.g / GRASS.g, colour.b / GRASS.b].map(v => Math.round(THREE.MathUtils.clamp(v / 1.5, 0, 1) * 255)).concat(Math.round(meadowAmount(field[n * 4 + 1], field[n * 4 + 2]) * 255)), n * 4);
  }
  return { minX, minZ, width, depth, field, tint };
}

/** How fully grass grows (0–1): outside reserved ground, at the density its soil and slope allow. */
const meadowAmount = (clearance: number, density: number): number => THREE.MathUtils.smoothstep(clearance, BLADE_CLEARANCE, FULL_CLEARANCE) * density;

/** What the vertex shader reads at a point: the terrain mesh's own triangle for height, bilinear for the rest. */
export function sampleGrassField(bake: GrassBake, x: number, z: number): { ground: number; clearance: number; density: number; shade: number } | null {
  const gx = (x - bake.minX) / STEP, gz = (z - bake.minZ) / STEP;
  if (!(gx >= 0 && gz >= 0 && gx <= bake.width - 1 && gz <= bake.depth - 1)) return null;
  const i = Math.min(bake.width - 2, Math.floor(gx)), j = Math.min(bake.depth - 2, Math.floor(gz)), u = gx - i, v = gz - j;
  const at = (di: number, dj: number, k: number): number => bake.field[((j + dj) * bake.width + i + di) * 4 + k];
  const bilinear = (k: number): number => (at(0, 0, k) * (1 - u) + at(1, 0, k) * u) * (1 - v) + (at(0, 1, k) * (1 - u) + at(1, 1, k) * u) * v;
  const ground = u + v <= 1 ? at(0, 0, 0) + u * (at(1, 0, 0) - at(0, 0, 0)) + v * (at(0, 1, 0) - at(0, 0, 0)) : at(1, 1, 0) + (1 - u) * (at(0, 1, 0) - at(1, 1, 0)) + (1 - v) * (at(1, 0, 0) - at(1, 1, 0));
  return { ground, clearance: bilinear(1), density: bilinear(2), shade: bilinear(3) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry and material

/** One patch: blades on a jittered grid in the unit square; position = (u, height fraction, v). */
function patchGeometry(spec: Spec): THREE.InstancedBufferGeometry {
  let seed = 1307; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const k = Math.round(Math.sqrt(spec.blades)), positions: number[] = [], sides: number[] = [], seeds: number[] = [], indices: number[] = [];
  for (let blade = 0; blade < spec.blades; blade++) {
    const u = (blade % k + rand()) / k, v = (Math.floor(blade / k) + rand()) / k, random = [rand(), rand(), rand(), rand()], first = positions.length / 3;
    for (let s = 0; s < spec.segments; s++) for (const side of [-1, 1]) { positions.push(u, s / spec.segments, v); sides.push(side); seeds.push(...random); }
    positions.push(u, 1, v); sides.push(0); seeds.push(...random);
    for (let s = 0; s < spec.segments - 1; s++) { const n = first + s * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    const last = first + (spec.segments - 1) * 2; indices.push(last, last + 1, last + 2);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('bladeSide', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setAttribute('bladeSeed', new THREE.Float32BufferAttribute(seeds, 4)); geometry.setIndex(indices);
  geometry.instanceCount = spec.levels * spec.cells ** 2; return geometry;
}

type F = Node<'float'>; type V2 = Node<'vec2'>;
// Hoskins' sin-free hash: stable at large world coordinates (as in ground-material.ts).
const hash = (p: V2): F => { const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); };

function grassMaterial(spec: Spec, bake: GrassBake, look: GroundLook): THREE.MeshStandardNodeMaterial {
  // RGBA32F data is read texel by texel (textureLoad), so it needs no float32-filterable feature or extension. Nearest
  // filtering also keeps it complete on WebGL 2, which would otherwise read a linear-filtered float texture as zeros.
  const data = new THREE.DataTexture(bake.field, bake.width, bake.depth, THREE.RGBAFormat, THREE.FloatType);
  data.magFilter = data.minFilter = THREE.NearestFilter; data.needsUpdate = true;
  const tints = new THREE.DataTexture(bake.tint, bake.width, bake.depth, THREE.RGBAFormat, THREE.UnsignedByteType);
  tints.magFilter = tints.minFilter = THREE.LinearFilter; tints.needsUpdate = true;
  const colour = varyingProperty('vec3', 'vGrassColour'), normal = varyingProperty('vec3', 'vGrassNormal'), occlusion = varyingProperty('float', 'vGrassOcclusion');
  const perLevel = spec.cells ** 2, radius = fieldRadius(spec);
  const position = Fn(() => {
    // Instance → level and cell. +.5 keeps the integer divisions exact under fast GPU division.
    const id = float(instanceIndex), level = floor(id.add(.5).div(perLevel)).toVar(), local = id.sub(level.mul(perLevel)).toVar();
    const row = floor(local.add(.5).div(spec.cells)), size = exp2(level).mul(spec.cell).toVar(), span = size.mul(spec.cells).toVar();
    const corner = vec2(local.sub(row.mul(spec.cells)), row).mul(size);
    const origin = corner.add(span.mul(floor(cameraPosition.xz.sub(corner).sub(size.mul(.5)).div(span).add(.5)))).toVar();
    // The world cell picks one of the patch's eight symmetries and rotates every blade's randoms, so no two cells repeat.
    const key = floor(origin.div(size).add(.5)).add(vec2(level.mul(53.7), level.mul(-17.3))).toVar();
    const turn = hash(key).toVar(), shift = hash(key.add(vec2(19.19, 7.7))).toVar(), sym = floor(turn.mul(8)).toVar();
    const seed = fract(attribute<'vec4'>('bladeSeed', 'vec4').add(vec4(shift, turn.mul(3.7), shift.mul(5.3), turn.mul(9.1)))).toVar();
    const swapped = mix(positionGeometry.xz, positionGeometry.zx, sym.sub(floor(sym.mul(.5)).mul(2)));
    const flipU = floor(sym.mul(.5)).sub(floor(sym.mul(.25)).mul(2)), flipV = floor(sym.mul(.25));
    const root = origin.add(vec2(mix(swapped.x, float(1).sub(swapped.x), flipU), mix(swapped.y, float(1).sub(swapped.y), flipV)).mul(size)).toVar();
    // The baked lookups: four vertices of the terrain cell under the root.
    const g = root.sub(vec2(bake.minX, bake.minZ)).div(STEP).toVar(), cell = clamp(floor(g), vec2(0), vec2(bake.width - 2, bake.depth - 2)).toVar();
    const f = clamp(g.sub(cell), 0, 1).toVar(), inside = step(0, g.x).mul(step(0, g.y)).mul(step(g.x, bake.width - 1)).mul(step(g.y, bake.depth - 1));
    const at = (dx: number, dz: number): Node<'vec4'> => textureLoad(data, ivec2(cell.add(vec2(dx, dz)))).toVar() as unknown as Node<'vec4'>;
    const t00 = at(0, 0), t10 = at(1, 0), t01 = at(0, 1), t11 = at(1, 1);
    // The rendered ground is the terrain mesh's triangles, split along the (1, 0)–(0, 1) diagonal (mountains.ts, terrain.ts).
    const ground = f.x.add(f.y).lessThanEqual(1).select(t00.x.add(f.x.mul(t10.x.sub(t00.x))).add(f.y.mul(t01.x.sub(t00.x))),
      t11.x.add(float(1).sub(f.x).mul(t01.x.sub(t11.x))).add(float(1).sub(f.y).mul(t10.x.sub(t11.x)))).toVar();
    const lookup = mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y).toVar();
    const slope = vec2(mix(t10.x.sub(t00.x), t11.x.sub(t01.x), f.y), mix(t01.x.sub(t00.x), t11.x.sub(t10.x), f.x)).div(STEP);
    // Grass grows outside reserved ground at the density its soil and slope allow; it shares the ground's crown occlusion.
    const meadow = smoothstep(BLADE_CLEARANCE, FULL_CLEARANCE, lookup.y).mul(lookup.z).mul(inside).toVar(); occlusion.assign(lookup.w);
    const macro = macroField(root).toVar(), tint = texture(tints, g.add(.5).div(vec2(bake.width, bake.depth))).level(float(0)).rgb.mul(1.5);
    const base = vec3(root.x, ground, root.y), distance = length(base.sub(cameraPosition)).toVar();
    // Each level thins out before its tile edge; blades go one by one (their own threshold), shrinking as they go.
    const keep = meadow.mul(float(1).sub(smoothstep(span.mul(.25), span.mul(.485), distance))).mul(macro.x.mul(.2).sub(macro.y.mul(.25)).add(.95));
    const grown = clamp(keep.sub(seed.x.mul(.75)).div(.25), 0, 1).toVar();
    // Mostly short blades with a few tall ones, taller in lush patches, shorter in dry ones and at worn edges.
    const height = grown.mul(spec.height).mul(seed.y.mul(seed.y).mul(1.1).add(.45)).mul(macro.x.mul(.3).sub(macro.y.mul(.25)).add(.9)).mul(meadow.mul(.45).add(.55)).toVar();
    const breadth = min(grown.mul(4), 1).mul(spec.width).mul(seed.w.mul(.6).add(.7)).mul(level.mul(.5).add(1)).mul(distance.mul(.035).add(1));
    // The blade: a tapering strip that leans and curls toward one side and sways downwind, keeping roughly its length.
    const angle = seed.z.mul(6.2831853).toVar(), across = vec2(cos(angle), sin(angle)).toVar();
    // Most blades arch gently; a few lie well over. Either way they bend across their face, as real blades do.
    const arch = fract(seed.z.mul(7.31)).toVar(), lean = vec2(across.y.negate(), across.x).mul(arch.mul(arch).mul(.75).add(.12)).mul(height);
    const bend = lean.add(windSway(root, seed.y).mul(height).mul(.5)).toVar(), t = positionGeometry.y, curl = pow(t, arch.mul(.6).add(1.6));
    const side = attribute<'float'>('bladeSide', 'float');
    const xz = root.add(across.mul(side).mul(breadth).mul(.5).mul(pow(float(1).sub(t), .75))).add(bend.mul(curl));
    const droop = dot(bend, bend).div(max(height.mul(height), 1e-4)).mul(.3).mul(t);
    // Roots sit 3 cm into the ground so blades never float over the triangle they stand on.
    const y = ground.sub(.03).add(height.mul(t).mul(max(float(1).sub(droop), .4)));
    // Lighting normal: mostly the ground's, so the field lights as the meadow does, tilted by the blade's facing and curl.
    const terrain = normalize(vec3(slope.x.negate(), 1, slope.y.negate()));
    const facing = cross(vec3(across.x, 0, across.y), vec3(bend.x.mul(t).mul(2), height.add(1e-3), bend.y.mul(t).mul(2)));
    normal.assign(normalize(terrain.mul(1.6).add(normalize(facing).mul(fract(seed.w.mul(5.7)).sub(.5).sign()).mul(.55))));
    // Colour: the ground's meadow albedo and vertex tint, dark at the base, lighter and drier toward the tips, fading back
    // to the ground's own average with distance so the field ends in the meadow it stands on.
    const albedo = meadowAverage(look, macro).mul(tint).toVar();
    // Blades are brighter than the shaded ground between them; only their roots sit in the canopy's shade.
    const tone = mix(vec3(.5, .54, .46), vec3(1.08, 1.1, 1.02), smoothstep(0, .4, t)).mul(mix(vec3(1), vec3(1.14, 1.1, .9), smoothstep(.55, 1, t))).mul(fract(seed.w.mul(13.7)).mul(.34).add(.86));
    const dry = clamp(macro.y.mul(.7).add(fract(seed.y.mul(5.3)).mul(.35)).sub(.2), 0, 1).mul(smoothstep(.45, 1, t));
    colour.assign(mix(albedo.mul(tone).mul(mix(vec3(1), vec3(1.45, 1.25, .62), dry.mul(.6))), albedo, smoothstep(radius * .3, radius * .85, distance)));
    return vec3(xz.x, y, xz.y);
  })();
  const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: .72, metalness: 0 });
  material.name = 'Near grass field'; material.positionNode = position; material.colorNode = colour; material.aoNode = occlusion; material.userData.tints = tints;
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(normalize(normal), 0)).xyz);
  return material;
}

/** The field for a tier (null on cpu or with `?grass=off`). Map mode hides it with the rest of the town's details. */
export function createGrassField(tier: GraphicsTier, options: Parameters<typeof bakeGrassField>[0] = {}, look: GroundLook = groundLook()): { mesh: THREE.Mesh; ground: GrassShade } | null {
  if (tier === 'cpu' || !grassFieldEnabled()) return null;
  const spec = GRASS_TIERS[tier], bake = bakeGrassField(options), material = grassMaterial(spec, bake, look), mesh = new THREE.Mesh(patchGeometry(spec), material);
  // The field follows the camera in the vertex shader, so it is always in view; it receives shadows but casts none.
  mesh.name = 'Near grass field'; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
  return { mesh, ground: { mask: material.userData.tints as THREE.Texture, minX: bake.minX, minZ: bake.minZ, width: bake.width, depth: bake.depth, radius: fieldRadius(spec) } };
}
