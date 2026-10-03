// Architectural surface maps (realism sub-plan 24): the generated ashlar, terrazzo and brass sets of
// scripts/build-surface-textures.py on the town's large plain surfaces. Each set's albedo averages the flat colour it
// replaces, and a material's colour is that approved colour over the set's mean, so the palette holds and the maps only add
// variation. gpu: albedo, normal and roughness; mobile: albedo and roughness; cpu: the stone albedos alone on mesh UVs,
// through cpu-detail.ts's Lambert copies. Dev-only `?surfaces=off` keeps the flat colours for comparison.
import * as THREE from 'three';
import { abs, attribute, clamp, dot, float, mix, normalLocal, normalMap, normalWorld, positionLocal, pow, smoothstep, texture, transformNormalToView, uniform, uv, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { nightEmission } from './night-lighting';
import { terrainHeight } from './terrain';
import { WATER_LEVEL } from './water-surface';

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>; type V4 = Node<'vec4'>;

/** Tile size (m), mean linear albedo and mean roughness of each baked set, from public/textures/surfaces/sources.json. */
export const SURFACE_SETS = {
  ashlar: { tile: 4, mean: [.9046, .8714, .7379], roughness: .752 },
  terrazzo: { tile: 4, mean: [.7231, .6795, .552], roughness: .406 },
  brass: { tile: 1, mean: [.5395, .402, .1845], roughness: .352 },
} as const;
type SurfaceSet = keyof typeof SURFACE_SETS;

/** Dev-only `?surfaces=off` shows the flat colours the maps replace; production always uses the maps. */
export function surfacesEnabled(): boolean {
  return !(import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('surfaces') === 'off');
}

/** Files under textures/surfaces/ per tier: gpu 1024 px stone albedo with a 512 px nrh, mobile 512 + 256, brass 512 or 256 with
 *  an nrh of its own size. The cpu tier loads the two stone albedos only; its Lambert copies drop relief, roughness and brass. */
export function surfaceFiles(tier: GraphicsTier): string[] {
  if (tier === 'cpu') return ['ashlar-albedo-512.webp', 'terrazzo-albedo-512.webp'];
  const stone = tier === 'gpu' ? 1024 : 512, brass = stone / 2;
  return [...(['ashlar', 'terrazzo'] as const).flatMap(set => [`${set}-albedo-${stone}.webp`, `${set}-nrh-${stone / 2}.webp`]), `brass-albedo-${brass}.webp`, `brass-nrh-${brass}.webp`];
}

/** The material colour that brings a set's mean albedo to an approved flat colour: their ratio, per linear channel. */
export function surfaceTint(set: SurfaceSet, approved: string): THREE.Color {
  const target = new THREE.Color(approved), mean = SURFACE_SETS[set].mean;
  return new THREE.Color(target.r / mean[0], target.g / mean[1], target.b / mean[2]);
}

const IDENTITY = new THREE.Matrix4();
/**
 * Mesh data for the ashlar: UVs boxed onto the triplanar axes in 4 m tiles, which only the cpu tier's Lambert copy reads, and
 * each vertex's height above the ground or river (`surfaceClearance`) for the weathering. `placement` is the mesh's world
 * matrix; interior pieces pass `clean` and stay above every weathering band. Non-indexed meshes project whole triangles,
 * so no triangle straddles two projections.
 */
export function bakeMasonry(geometry: THREE.BufferGeometry, placement: THREE.Matrix4 = IDENTITY, clean = false): void {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), count = position.count, tile = SURFACE_SETS.ashlar.tile;
  const uvs = new Float32Array(count * 2), clearance = new Float32Array(count), p = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (geometry.index) n.fromBufferAttribute(normal, i);
    else if (i % 3 === 0) { n.fromBufferAttribute(normal, i).add(m.fromBufferAttribute(normal, i + 1)).add(m.fromBufferAttribute(normal, i + 2)); }
    const x = Math.abs(n.x), y = Math.abs(n.y), z = Math.abs(n.z); p.fromBufferAttribute(position, i);
    const [u, v] = x >= y && x >= z ? [p.z, p.y] : z >= y ? [p.x, p.y] : [p.x, p.z];
    uvs[i * 2] = u / tile; uvs[i * 2 + 1] = v / tile;
    p.applyMatrix4(placement); clearance[i] = clean ? 10 : p.y - Math.max(terrainHeight(p.x, p.z), WATER_LEVEL);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setAttribute('surfaceClearance', new THREE.BufferAttribute(clearance, 1));
}

interface Maps { albedo: THREE.Texture; nrh: THREE.Texture }
/**
 * Object-space triplanar with v up on every side face, so masonry courses stay level and brushing runs along: three's
 * triplanarTexture reads X-facing faces by (y, z), which would stand the courses on end. X faces read (z, y), Z faces (x, y),
 * top and bottom (x, z), the axes bakeMasonry() boxes the cpu UVs onto; |n|⁴ weights blend them only across curves. Relief is
 * added to the surface normal in each projection's plane (UDN blending); `level` samples a coarse mip instead of the detail.
 */
function triplanar(maps: Maps, tile: number, relief: boolean, level?: number): { albedo: V3; nrh: V4; normal: V3 | null } {
  const p = positionLocal.div(tile).toVar(), n = normalLocal.normalize().toVar(), k = pow(abs(n), vec3(4)), w = k.div(dot(k, vec3(1))).toVar();
  const read = (map: THREE.Texture, at: V2): V4 => (level === undefined ? texture(map, at) : texture(map, at).level(float(level))) as unknown as V4;
  const at = [vec2(p.z, p.y), vec2(p.x, p.y), vec2(p.x, p.z)], weight = [w.x, w.z, w.y];
  const albedo = at.map((a, i) => read(maps.albedo, a).rgb.mul(weight[i])).reduce((sum, value) => sum.add(value));
  const nrh = at.map(a => read(maps.nrh, a).toVar());
  const packed = nrh.map((value, i) => value.mul(weight[i])).reduce((sum, value) => sum.add(value));
  if (!relief) return { albedo, nrh: packed, normal: null };
  const [x, z, y] = nrh.map(value => value.xy.mul(2).sub(1));
  return { albedo, nrh: packed, normal: n.add(vec3(0, x.y, x.x).mul(w.x)).add(vec3(z.x, z.y, 0).mul(w.z)).add(vec3(y.x, 0, y.y).mul(w.y)).normalize() };
}

/**
 * Subtle base weathering: grime in the first metre above the ground or river, deepest in joints and pores (low height); a damp,
 * slightly cooler and glossier band at the contact; darker, rougher undersides. Returns a colour factor and a roughness offset.
 */
function weathering(height: F): { shade: V3; rough: F } {
  const clearance = attribute<'float'>('surfaceClearance', 'float');
  const contact = float(1).sub(smoothstep(0, .9, clearance)).toVar(), wet = float(1).sub(smoothstep(0, .3, clearance)).toVar();
  const under = smoothstep(.15, .8, normalWorld.y.negate()).toVar(), cavity = float(1).sub(height);
  const value = float(1).sub(contact.mul(cavity.mul(.1).add(.035))).sub(wet.mul(.05)).sub(under.mul(.07));
  return { shade: mix(vec3(1), vec3(.97, .985, 1), wet).mul(value), rough: under.mul(.06).add(contact.mul(.03)).sub(wet.mul(.1)) };
}

/** Ashlar on the triplanar axes, weathered, at the approved colour. */
function ashlarMaterial(tier: GraphicsTier, maps: Maps, approved: string): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: surfaceTint('ashlar', approved), roughness: 1, metalness: 0 });
  const sample = triplanar(maps, SURFACE_SETS.ashlar.tile, tier === 'gpu'), weather = weathering(clamp(sample.nrh.w.mul(2).sub(1), 0, 1));
  material.colorNode = sample.albedo.mul(uniform(material.color) as unknown as V3).mul(weather.shade);
  material.roughnessNode = clamp(sample.nrh.z.add(weather.rough), .05, 1);
  if (sample.normal) material.normalNode = transformNormalToView(sample.normal);
  material.userData.surface = 'ashlar'; return material;
}

/** Brushed brass, mostly as roughness, keeping a material's own mean roughness; `tarnish` keeps only the broad tarnish. */
function brassMaterial(tier: GraphicsTier, maps: Maps, approved: string, roughness: number, metalness: number, tarnish = false): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: surfaceTint('brass', approved), roughness, metalness });
  // A mip of about 6 cm texels (16 per metre on either tier) averages streaks, scratches and spots away and leaves the tarnish.
  const coarse = tarnish ? (tier === 'gpu' ? 5 : 4) : undefined;
  const sample = triplanar(maps, SURFACE_SETS.brass.tile, tier === 'gpu' && !tarnish, coarse);
  material.colorNode = sample.albedo.mul(uniform(material.color) as unknown as V3);
  material.roughnessNode = clamp(sample.nrh.z.mul(roughness / SURFACE_SETS.brass.roughness), .04, 1);
  if (sample.normal) material.normalNode = transformNormalToView(sample.normal);
  material.userData.surface = 'brass'; return material;
}

/** Honed terrazzo on the floor's own UVs (world metres over 4, centred on its hall), relief through their derivative frame. */
function terrazzoMaterial(tier: GraphicsTier, maps: Maps): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: surfaceTint('terrazzo', '#ddd7c4'), roughness: 1, metalness: 0 });
  const nrh = texture(maps.nrh, uv()).toVar();
  material.colorNode = texture(maps.albedo, uv()).rgb.mul(uniform(material.color) as unknown as V3);
  // Honed, not polished: about half the hall floor's former matte .95, so chips and matrix differ in sheen without mirroring the sky.
  material.roughnessNode = clamp(nrh.z.mul(1.25), .05, 1);
  if (tier === 'gpu') { const relief = normalMap(nrh); relief.unpackNormalMode = THREE.NormalRGPacking; material.normalNode = relief; }
  material.userData.surface = 'terrazzo'; return material;
}

export interface Surfaces {
  /** Resolves when every map has loaded, or once a failure has reverted the materials to their flat colours. */
  readonly ready: Promise<void>;
  /** The town's white masonry: bridges, hall rims and the Ministry of Science arch (bakeMasonry() each mesh). */
  readonly masonry: THREE.Material;
  /** The gateway abutments, at their own warmer stone colour. */
  readonly abutments: THREE.Material;
  /** The civic hall floor insets, with UVs in world metres over 4 centred on each hall. */
  readonly floor: THREE.Material;
  /** Brass, null on the cpu tier: the town gold (bridge rails, lamp posts, City Hall arch), poster stands, place-sign frames. */
  readonly gold: THREE.Material | null;
  readonly stand: THREE.Material | null;
  readonly signGold: THREE.Material | null;
}

let active: Surfaces | null = null;
/** The surfaces of the town being built; null in tests and with `?surfaces=off`, where every module keeps its flat colours. */
export function activeSurfaces(): Surfaces | null { return active; }

/** The flat colour (the approved palette) and roughness each surface had before the maps. */
const FLAT = { masonry: ['#f4f0df', .57], abutments: ['#e5dbc7', .88], floor: ['#ddd7c4', .95], gold: ['#b99a55', .3], stand: ['#c2aa77', .4], sign: ['#d6a458', .26] } as const;

/** Town.create's first step: start loading the tier's maps and build the shared materials (none with `?surfaces=off`). */
export function activateSurfaces(tier: GraphicsTier): Surfaces | null {
  active = null;
  if (!surfacesEnabled()) return null;
  const loader = new THREE.TextureLoader(), base = import.meta.env.BASE_URL + 'textures/surfaces/', loads: Promise<void>[] = [], maps = new Map<string, THREE.Texture>();
  for (const file of surfaceFiles(tier)) {
    // load() returns the texture at once, so the materials build now; Town.loadAssets() waits for the images.
    let map!: THREE.Texture;
    loads.push(new Promise<void>((resolve, reject) => { map = loader.load(base + file, () => resolve(), undefined, reject); }));
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = tier === 'gpu' ? 8 : 2;
    if (file.includes('-albedo-')) map.colorSpace = THREE.SRGBColorSpace;
    maps.set(file.replace(/-\d+\.webp$/, ''), map);
  }
  const set = (name: SurfaceSet): Maps => ({ albedo: maps.get(`${name}-albedo`)!, nrh: maps.get(`${name}-nrh`)! });
  // The cpu tier's Lambert copies keep only a material's colour and map: the albedo on the baked UVs, tinted to the palette.
  const lambert = (name: SurfaceSet, [approved, roughness]: readonly [string, number]): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color: surfaceTint(name, approved), map: maps.get(`${name}-albedo`)!, roughness, userData: { surface: name } });
  const cpu = tier === 'cpu';
  const masonry = cpu ? lambert('ashlar', FLAT.masonry) : ashlarMaterial(tier, set('ashlar'), FLAT.masonry[0]);
  const abutments = cpu ? lambert('ashlar', FLAT.abutments) : ashlarMaterial(tier, set('ashlar'), FLAT.abutments[0]);
  const floor = cpu ? lambert('terrazzo', FLAT.floor) : terrazzoMaterial(tier, set('terrazzo'));
  const gold = cpu ? null : brassMaterial(tier, set('brass'), ...FLAT.gold, .7);
  const stand = cpu ? null : brassMaterial(tier, set('brass'), ...FLAT.stand, .5);
  const signGold = cpu ? null : brassMaterial(tier, set('brass'), ...FLAT.sign, .8, true);
  if (signGold) nightEmission(signGold, '#d4943a', .22);
  // A missing map reverts every surface to the flat colour and roughness it had, rather than sampling an empty texture.
  const ready = Promise.all(loads).then(() => undefined, () => {
    for (const [material, [approved, roughness]] of [[masonry, FLAT.masonry], [abutments, FLAT.abutments], [floor, FLAT.floor], [gold, FLAT.gold], [stand, FLAT.stand], [signGold, FLAT.sign]] as const) {
      if (!material) continue;
      if (material instanceof THREE.MeshStandardNodeMaterial) material.colorNode = material.roughnessNode = material.normalNode = null;
      material.map = null; material.color.set(approved); material.roughness = roughness; material.needsUpdate = true;
    }
  });
  active = { ready, masonry, abutments, floor, gold, stand, signGold };
  return active;
}
