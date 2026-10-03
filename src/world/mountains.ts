import * as THREE from 'three';
import { RAILWAY, STATION } from './station-layout';

export { landscapeHeight as mountainHeight } from './terrain';
import { landscapeHeight, ridgesLook } from './terrain';
import { FAR_LAYER, farLandscapeGeometry, farLandscapeMaterial } from './far-landscape';
import { groundCover } from './ground-cover';
import { COULOIR_SHADE_BOX, MOUNTAIN, couloirShade, meltwater, snowCover, trailFrame, turfCover } from './mountain-layout';
import { SUN_DIR } from './sky';
import { groundLook, groundNodes, groundTextureFiles } from './ground-material';
import type { GrassShade } from './ground-material';
import { attribute } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { shoreTextureFiles } from './shore-nodes';
import { CRAGS, STONE } from './limestone';
import type { GraphicsTier } from '../game/graphics';

/** Baseline meadow vertex colour; the ground shader divides it back out of its palette. FRESH is the young-growth tint. */
export const GRASS = new THREE.Color('#c5c5a4'), FRESH = new THREE.Color('#a1b894');

/** Subtract the rail clearance from the actual hillside triangles, including both far exits. */
function cutRailwayOpening(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const soil = source.getAttribute('groundSoil'), soils: number[] = [], shade = source.getAttribute('groundShade'), shades: number[] = [], paint = source.getAttribute('groundPaint'), paints: number[] = [], frame = source.getAttribute('trailFrame'), frames: number[] = [];
  const pos = source.getAttribute('position'), color = source.getAttribute('color'), normal = source.getAttribute('normal'), positions: number[] = [], colors: number[] = [], normals: number[] = [];
  type Vertex = number[];
  // The Dark Nut mouths flare wider than the lined bore; cut that same apron out of the hillside.
  const flare = (v: Vertex): number => 1 - THREE.MathUtils.smoothstep(Math.min(Math.abs(Math.abs(v[0]) - RAILWAY.portalX), Math.abs(Math.abs(v[0]) - RAILWAY.exitX)), 7, 20);
  const tunnelPlanes = [(v: Vertex): number => v[2] - RAILWAY.centerZ + RAILWAY.boreHalfWidth + .45 + flare(v) * 2.2, (v: Vertex): number => RAILWAY.centerZ + RAILWAY.boreHalfWidth + .45 + flare(v) * 2.2 - v[2], (v: Vertex): number => RAILWAY.clearanceHeight + flare(v) * 2 - v[1]];
  const floorPlanes = [(v: Vertex): number => v[2] - RAILWAY.centerZ + 7, (v: Vertex): number => RAILWAY.centerZ + 7 - v[2], (v: Vertex): number => STATION.railHalfLength - Math.abs(v[0])];
  const clip = (polygon: Vertex[], distance: (v: Vertex) => number, inside: boolean): Vertex[] => {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a) * (inside ? 1 : -1), db = distance(b) * (inside ? 1 : -1);
      if (da >= 0) result.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); result.push(a.map((value, k) => value + (b[k] - value) * t)); }
    }
    return result;
  };
  const emit = (polygon: Vertex[]): void => { for (let i = 1; i < polygon.length - 1; i++) for (const v of [polygon[0], polygon[i], polygon[i + 1]]) { positions.push(...v.slice(0, 3)); colors.push(...v.slice(3, 6)); normals.push(...v.slice(6, 9)); soils.push(v[9]); shades.push(v[10]); if (paint) paints.push(...v.slice(11, 15)); if (frame) frames.push(...v.slice(15, 19)); } };
  const index = source.index!;
  for (let i = 0; i < index.count; i += 3) {
    let polygon = [0, 1, 2].map((j) => { const n = index.getX(i + j); return [pos.getX(n), pos.getY(n), pos.getZ(n), color.getX(n), color.getY(n), color.getZ(n), normal.getX(n), normal.getY(n), normal.getZ(n), soil.getX(n), shade.getX(n), ...paint ? [paint.getX(n), paint.getY(n), paint.getZ(n), paint.getW(n)] : [], ...frame ? [frame.getX(n), frame.getY(n), frame.getZ(n), frame.getW(n)] : []]; });
    const planes = polygon.every(v => v[1] <= .02) ? floorPlanes : tunnelPlanes;
    if (planes.some((plane) => polygon.every((v) => plane(v) <= 0))) { emit(polygon); continue; }
    for (const plane of planes) { emit(clip(polygon, plane, false)); polygon = clip(polygon, plane, true); if (!polygon.length) break; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setAttribute('groundSoil', new THREE.Float32BufferAttribute(soils, 1)); g.setAttribute('groundShade', new THREE.Float32BufferAttribute(shades, 1)); if (paint) g.setAttribute('groundPaint', new THREE.Float32BufferAttribute(paints, 4)); if (frame) g.setAttribute('trailFrame', new THREE.Float32BufferAttribute(frames, 4)); g.normalizeNormals(); source.dispose(); return g;
}

/**
 * The tiles' vertex columns and rows: two-metre cells over the walking terrain, then 4 m (mobile 8 m) to 520 m. `wide` continues
 * with 32 m cells to 1.4 km, the rounds 1–2 extent that the cpu tier and ?ridges=classic keep; otherwise the distant ranges
 * (far-landscape.ts) take over at 520 m.
 */
export function terrainAxes(mobile: boolean, wide: boolean): { xs: number[]; zs: number[] } {
  const axis = (start: number, end: number, nearStart: number, nearEnd: number): number[] => {
    const values: number[] = []; for (let value = start; value <= end; value += value >= nearStart && value < nearEnd ? 2 : Math.abs(value) > 520 ? 32 : mobile ? 8 : 4) values.push(value); return values;
  };
  return wide ? { xs: axis(-1400, 1400, -240, 240), zs: axis(-1280, 1280, -296, 150) } : { xs: axis(-520, 520, -240, 240), zs: axis(-520, 520, -296, 150) };
}
/** The tiles' outer edge, ordered by angle around its centre: where the distant ranges' first ring starts. */
export function terrainEdge(mobile: boolean): { x: number; z: number }[] {
  const { xs, zs } = terrainAxes(mobile, false), edge: { x: number; z: number }[] = [];
  for (const x of xs) edge.push({ x, z: zs[0] }, { x, z: zs[zs.length - 1] });
  for (const z of zs.slice(1, -1)) edge.push({ x: xs[0], z }, { x: xs[xs.length - 1], z });
  const cx = (xs[0] + xs[xs.length - 1]) / 2, cz = (zs[0] + zs[zs.length - 1]) / 2, angle = (p: { x: number; z: number }): number => { const a = Math.atan2(p.z - cz, p.x - cx); return a < 0 ? a + Math.PI * 2 : a; };
  return edge.sort((a, b) => angle(a) - angle(b));
}

const toSun = SUN_DIR.clone().normalize();
/**
 * How much of the default sun reaches the ground at (x, z, y), 0–1, baked only round the couloir (sub-plan 27). The terrain casts
 * no shadow-map shadows, and the sun's shadow box covers only 50 m round the walker, so the peaks' and the couloir walls' shade is
 * ray-marched here instead; the inner couloir is shaded further (`couloirShade`), as the default high south-western sun alone
 * would leave much of its floor lit.
 */
function sunVisibility(x: number, z: number, y: number): number {
  const box = COULOIR_SHADE_BOX; if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) return 1;
  let visible = 1;
  for (let t = 1; t < 70 && visible > 0; t += 1.25) {
    const margin = y + toSun.y * t + .2 - landscapeHeight(x + toSun.x * t, z + toSun.z * t);
    visible = Math.min(visible, THREE.MathUtils.clamp(.5 + margin / (.12 * t + .4), 0, 1));
  }
  return visible * (1 - couloirShade(x, z));
}

/** `shade` bakes ambient ground occlusion into the `groundShade` attribute (1 = open sky), the ground material's aoNode. */
export function mountainGeometry(mobile: boolean, shade: (x: number, z: number) => number = () => 1, wide = ridgesLook() === 'classic'): THREE.BufferGeometry {
    // Two-metre cells match the walking terrain; distant ridges use wider cells in both quality tiers.
    const { xs, zs } = terrainAxes(mobile, wide);
    const positions: number[] = [], colors: number[] = [], soils: number[] = [], shades: number[] = [], paints: number[] = [], frames: number[] = [], indices: number[] = [], color = new THREE.Color(), grass = GRASS, fresh = FRESH, stone = STONE;
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) {
      const x = xs[i], z = zs[j], y = landscapeHeight(x, z);
      positions.push(x, y, z);
      const slope = Math.hypot(landscapeHeight(x + 1, z) - landscapeHeight(x - 1, z), landscapeHeight(x, z + 1) - landscapeHeight(x, z - 1)) / 2;
      // Jointed limestone (CRAGS) divides the stone back out of the colour, so steep ground takes it whole; meadow left in it greened the rock.
      const rock = Math.min(1, THREE.MathUtils.smoothstep(slope, .6, 1.7) * (CRAGS ? 1 : .85) + THREE.MathUtils.smoothstep(y, 58, 100) * .65);
      const cover = groundCover(x, z); soils.push(cover.soil); shades.push(shade(x, z));
      // Sub-plan 27: alpine turf round the plants, old snow, meltwater (painted by ground-material.ts) and the sun's visibility, which
      // scales the sun's shadow term there (`receivedShadowNode` below).
      if (MOUNTAIN) paints.push(turfCover(x, z), snowCover(x, z), meltwater(x, z), sunVisibility(x, z, y));
      // The trail's frame on the snow, where the ground lays its boot prints (9 m across: none); true values out to 6 m, so the two-metre
      // triangles round the prints interpolate it correctly.
      if (MOUNTAIN) { const f = trailFrame(x, z); frames.push(...f ? [f.along, f.across, f.dx, f.dz] : [0, 9, 0, 0]); }
      color.copy(grass).lerp(fresh, cover.freshness * .6).lerp(stone, rock).multiplyScalar(cover.shade);
      colors.push(color.r, color.g, color.b);
      if (i < xs.length - 1 && j < zs.length - 1) { const n = j * xs.length + i; indices.push(n, n + xs.length, n + 1, n + 1, n + xs.length, n + xs.length + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setAttribute('groundSoil', new THREE.Float32BufferAttribute(soils, 1)); geo.setAttribute('groundShade', new THREE.Float32BufferAttribute(shades, 1)); if (MOUNTAIN) { geo.setAttribute('groundPaint', new THREE.Float32BufferAttribute(paints, 4)); geo.setAttribute('trailFrame', new THREE.Float32BufferAttribute(frames, 4)); } geo.setIndex(indices); geo.computeVertexNormals();
    return cutRailwayOpening(geo);
}

// Tile edges: a 3 × 3 town core of about 160 × 140 m inside the two-metre grid, then one ring to 520 m and one beyond.
const TILE_X = [-1400, -520, -240, -80, 80, 240, 520, 1400], TILE_Z = [-1280, -520, -270, -130, 10, 150, 520, 1280];
/** Tile of each (column, row) of those edges: the near ring keeps the town's columns and rows, the outer ring has eight sides. */
const TILE_OF = Array.from({ length: 49 }, (_, n) => {
  const i = n % 7, j = Math.floor(n / 7), ring = Math.min(i, j, 6 - i, 6 - j), side = (k: number): string => k < 1 + ring ? 'a' : k > 5 - ring ? 'b' : String(k);
  return ring >= 2 ? `town ${i}${j}` : ring === 1 ? `near ${side(i)}${side(j)}` : `far ${i ? i < 6 ? 'c' : 'b' : 'a'}${j ? j < 6 ? 'c' : 'b' : 'a'}`;
});
/**
 * The ground split into tiles by triangle centre: nine town tiles, sixteen around them out to 520 m and eight beyond. Each is
 * culled on its own, so a walking view draws a few tiles near the player instead of every ridge out to 1.4 km.
 */
export function terrainTiles(source: THREE.BufferGeometry): THREE.BufferGeometry[] {
  if (source.index) source = source.toNonIndexed();
  const band = (edges: number[], value: number): number => { let i = 0; while (i < edges.length - 2 && value >= edges[i + 1]) i++; return i; };
  const p = source.getAttribute('position').array as Float32Array, triangles = p.length / 9, tileOf = new Uint8Array(triangles), keys: string[] = [], counts: number[] = [];
  for (let t = 0; t < triangles; t++) {
    const v = t * 9, key = TILE_OF[band(TILE_Z, (p[v + 2] + p[v + 5] + p[v + 8]) / 3) * 7 + band(TILE_X, (p[v] + p[v + 3] + p[v + 6]) / 3)];
    let id = keys.indexOf(key); if (id < 0) { id = keys.push(key) - 1; counts.push(0); }
    tileOf[t] = id; counts[id]++;
  }
  const tiles = keys.map((key) => { const tile = new THREE.BufferGeometry(); tile.name = 'Terrain tile ' + key; return tile; });
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const from = attribute.array as Float32Array, stride = attribute.itemSize * 3, targets = counts.map((count) => new Float32Array(count * stride)), offsets = counts.map(() => 0);
    for (let t = 0; t < triangles; t++) { const id = tileOf[t], target = targets[id], base = t * stride; let o = offsets[id]; for (let k = 0; k < stride; k++) target[o++] = from[base + k]; offsets[id] = o; }
    tiles.forEach((tile, id) => tile.setAttribute(name, new THREE.BufferAttribute(targets[id], attribute.itemSize)));
  }
  for (const tile of tiles) tile.computeBoundingSphere();
  return tiles;
}

export class Mountains extends THREE.Group {
  readonly ready: Promise<void>;
  /** The rock scan's colour and (gpu) normal maps once loaded, shared with the crag blocks (crags.ts). */
  readonly rock: Promise<{ rock: THREE.Texture; rockNormal: THREE.Texture | null }>;
  /** `grass` is the near grass field's lookup, so the ground shades the soil between its blades. */
  constructor(mobile: boolean, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', shade?: (x: number, z: number) => number, grass?: GrassShade) {
    super(); this.name = 'Continuous valley and mountain ridges';
    // The distant ranges and the walking view's distant pass (main.ts): gpu and mobile, unless ?ridges=classic.
    const far = tier !== 'cpu' && ridgesLook() === 'ranges', geo = mountainGeometry(mobile, shade, !far);
    // The cpu tier lights everything with Lambert (cpu-detail.ts) and keeps only the ground colour, so it starts there.
    const material = tier === 'cpu' ? new THREE.MeshLambertNodeMaterial({ vertexColors: true }) : new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: .96 });
    // Baked crown, trunk and wall occlusion dims only indirect light (sky, hemisphere, environment), on Lambert and standard alike:
    // direct sun stays with the shadow maps, and the cpu tier, which has none, keeps its sunlit meadow.
    material.aoNode = attribute<'float'>('groundShade', 'float');
    // The couloir's baked sun shade scales the sun's (and at night the moon's) shadow term at every distance.
    if (MOUNTAIN) (material as unknown as { receivedShadowNode: (shadow: Node<'float'>) => Node<'float'> }).receivedShadowNode = (shadow) => shadow.mul(attribute<'vec4'>('groundPaint', 'vec4').w);
    // One material for every tile; cpu-detail.ts keeps each tile's vertices by this name.
    for (const tile of terrainTiles(geo)) { const landscape = new THREE.Mesh(tile, material); landscape.name = 'Textured meadow and soil'; landscape.receiveShadow = true; this.add(landscape); }
    geo.dispose();
    const plain = far ? farLandscapeMaterial(tier, null, null) : null, ranges = plain ? farLandscapeGeometry(mobile, terrainEdge(mobile)).map((sector) => {
      const mesh = new THREE.Mesh(sector, plain); mesh.name = 'Distant ranges'; mesh.layers.set(FAR_LAYER); this.add(mesh); return mesh;
    }) : [];
    const loader = new THREE.TextureLoader(), base = import.meta.env.BASE_URL, look = groundLook();
    const load = (file: string, colour: boolean): Promise<THREE.Texture> => loader.loadAsync(base + file).then((texture) => {
      if (colour) texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = tier === 'gpu' ? 4 : 2; return texture;
    });
    const files = groundTextureFiles(tier), shoreFiles = shoreTextureFiles(tier);
    // The snow's boot prints (sub-plan 27): height, normal and wear on the trail's frame, wrapping along it; gpu and mobile only.
    const prints = MOUNTAIN && tier !== 'cpu' ? load(`textures/snow/footprints-${tier === 'gpu' ? 'gpu' : 'mobile'}.webp`, false).then((t) => { t.wrapS = THREE.ClampToEdgeWrapping; t.flipY = false; t.anisotropy = tier === 'gpu' ? 8 : 4; t.needsUpdate = true; return t; }).catch(() => null) : Promise.resolve(null);
    // The shore gravel is optional: without it the banks keep their wet band, silt and caustics.
    const shore = Promise.all(shoreFiles.map(file => load(`textures/ground/${file}`, file.includes('-albedo-')))).catch(() => []);
    this.rock = Promise.all([load('textures/mountains/rock-color.jpg', true), tier === 'gpu' ? load('textures/mountains/rock-normal.jpg', false) : Promise.resolve(null)]).then(([rock, rockNormal]) => ({ rock, rockNormal }));
    this.ready = Promise.all([Promise.all(files.map(file => load(`textures/ground/${file}`, file.includes('-albedo-')))), this.rock, shore, prints]).then(([ground, { rock, rockNormal }, gravel, footprints]) => {
      const albedo = ground.filter((_, i) => files[i].includes('-albedo-')), nrh = tier === 'cpu' ? albedo : ground.filter((_, i) => files[i].includes('-nrh-'));
      // Sub-plan 27 round 2: steep ground shares the crags' jointed limestone (limestone.ts) unless ?crags=off or ?mountain=off.
      const nodes = groundNodes(tier, look, { albedo, nrh, rock, rockNormal, shore: gravel.length === 2 ? { albedo: gravel[0], nrh: gravel[1] } : null, footprints }, GRASS, grass, ridgesLook() === 'ranges', MOUNTAIN, CRAGS && ridgesLook() === 'ranges');
      material.colorNode = nodes.colorNode; material.normalNode = nodes.normalNode;
      if (plain) { const ridge = farLandscapeMaterial(tier, rock, rockNormal); plain.dispose(); for (const mesh of ranges) mesh.material = ridge; }
      if (material instanceof THREE.MeshStandardNodeMaterial) material.roughnessNode = nodes.roughnessNode;
      material.needsUpdate = true;
    }).catch(() => { material.color.set('#587448'); /* Playable vertex-coloured terrain if local images fail. */ });
  }
}
