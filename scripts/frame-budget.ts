// Draw calls and triangles of the town's main producers, built in memory (sub-plan 25).
// Usage: bun scripts/frame-budget.ts [--json] [--far <metres>]. No browser: drawCost() replays the walking camera's frustum
// culling over the realism capture poses, so the numbers cover the main pass only (no shadow pass) and are not device
// timings. --far sets the walk camera's far plane (150 before sub-plan 25). Under Bun the posters (on a stub canvas) and
// the forest (models parsed from disk) are measured too; Vitest builds the DOM-free groups only.
import type * as THREE_TYPES from 'three';
import type { GraphicsTier } from '../src/game/graphics';
import type { DrawCost } from '../src/game/render-budget';
import type { ColliderSpec } from '../src/game/physics';

// The game and Vitest resolve `three` to `three/webgpu` (vite.config.ts). Bun has no alias, so when Bun runs this file the
// classic entry re-exports the WebGPU build; every game module is then imported dynamically, after this hook exists.
const bun = (globalThis as { Bun?: { resolveSync(id: string, from: string): string; plugin(plugin: { name: string; setup(build: { onLoad(options: { filter: RegExp }, load: () => { contents: string; loader: 'js' }): void }): void }): void } }).Bun;
if (bun) { const webgpu = bun.resolveSync('three/webgpu', import.meta.dirname); bun.plugin({ name: 'three-webgpu', setup: (build) => build.onLoad({ filter: /three[\\/]build[\\/]three\.module\.js$/ }, () => ({ contents: `export * from ${JSON.stringify(webgpu)};`, loader: 'js' })) }); }
const THREE = await import('three');
const { LivingWaters } = await import('../src/world/living-waters');
const { createGlucoseStructure } = await import('../src/world/glucose-pavilion');
const { createEnhancementHill } = await import('../src/world/enhancement');
const { Mountains } = await import('../src/world/mountains');
const { createPlanting } = await import('../src/world/planting');
const { terrainHeight } = await import('../src/world/terrain');
const { riverCenter } = await import('../src/world/waterways');
const { graphicsProfile } = await import('../src/game/graphics');
const { drawCost } = await import('../src/game/render-budget');

// The capture poses of scripts/screenshot-realism.ts (name, x, z, yaw, pitch); keep the two lists in step.
export const VIEWS: [string, number, number, number, number?][] = [
  ['winter-gate-front', -92, -30, Math.PI / 2, .2], ['winter-gate-angle', -90, -17, 1, .2], ['winter-gate-inside', -104.8, -30, Math.PI / 2, .3],
  ['station-arrival', 0, 58, 0], ['arrival-meadow', 10, 52, -.9], ['garden-overview', 0, 52, 0], ['gateway-front', 0, 52, 0, .18],
  ['gateway-side', 9, 47, .92, .26], ['bridge-crossing', 0, 36, 0], ['garden-path', -14, 8, 1.2],
  ['city-hall-front', 0, 4, 0], ['energy-front', -29, 12, 0], ['energy-side', -4, -9, Math.PI / 2], ['science-front', 29, 14, 0], ['science-side', 6, -11, -Math.PI / 2],
  ['time-tower', 17, -15, 0, .4], ['embryo-station-front', 0, 43, Math.PI, .31], ['glucose-pavilion', 38, -23, 0, .23], ['railway-east-portal', 130, 79, -Math.PI / 2, .13],
  ['north-meadow', 0, -42, 0], ['meadow-ground', 10, 52, -.9, -.38], ['path-edge', -14, 8, 1.2, -.42], ['woodland-edge', -46, -12, Math.PI / 2, .12],
  ['bridge-bank', 14, 36, 1.0], ['shore-closeup', 14, 36, 1.0, -.34], ['east-tributary', 67, -5, .8, .08], ['west-tributary', -46, -12, Math.PI / 2],
  ['vittoria-lake', -18, -64, 0, .08], ['mycelium-grove', 74, -138, Math.PI, .18],
  ['city-hall-gallery', -2.4, -24, -.23], ['energy-gallery', -31.4, -10.5, -.28], ['science-gallery', 26.6, -12.2, -.28], ['energy-inside', -29, -5, 0], ['science-inside', 29, -7, 0],
  ['catalogue-poster', 2.51, -18.21, -2.409], ['embryo-station-platform', 0, 73, Math.PI - 1.1],
];
/** The gpu tier's walking full-fog distance (GraphicsProfile.fog), where main.ts stops the walk camera and the forest and grove stop drawing. */
export const WALK_FAR = graphicsProfile('gpu').fog;

export function walkCamera(x: number, z: number, yaw: number, pitch = 0, far = WALK_FAR): THREE_TYPES.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(66, 1280 / 800, .08, far);
  camera.position.set(x, terrainHeight(x, z) + 1.83, z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return camera;
}
export interface Group { name: string; root: THREE_TYPES.Object3D; classify: (object: THREE_TYPES.Object3D) => string | null; prepare?: (camera: THREE_TYPES.Camera) => void }
export interface Report { static: Record<string, DrawCost>; perView: Record<string, DrawCost & { views: number; maxCalls: number; maxTriangles: number }> }

export function measure(group: Group, far = WALK_FAR): Report {
  const report: Report = { static: drawCost(group.root, undefined, group.classify), perView: {} };
  // The static total is everything as built; a detail update would hide part of it, so take it first.
  for (const [, x, z, yaw, pitch] of VIEWS) {
    const camera = walkCamera(x, z, yaw, pitch, far); group.prepare?.(camera);
    for (const [key, cost] of Object.entries(drawCost(group.root, camera, group.classify))) {
      const sum = report.perView[key] ??= { calls: 0, triangles: 0, views: 0, maxCalls: 0, maxTriangles: 0 };
      sum.calls += cost.calls; sum.triangles += cost.triangles; if (cost.calls) sum.views++;
      sum.maxCalls = Math.max(sum.maxCalls, cost.calls); sum.maxTriangles = Math.max(sum.maxTriangles, cost.triangles);
    }
  }
  for (const sum of Object.values(report.perView)) { sum.calls /= VIEWS.length; sum.triangles /= VIEWS.length; }
  return report;
}

/** The DOM-free groups for one tier; night halos are left out because they draw only after dark. */
export function budgetGroups(tier: GraphicsTier): Group[] {
  // Grove crowns stop at the full-fog distance, as Town.update does on gpu and mobile; trees a little short of it (the forest group).
  const mobile = tier !== 'gpu', profile = graphicsProfile(tier), range = profile.fog;
  const day = (object: THREE_TYPES.Object3D): boolean => !object.userData.nightGlow;
  const gardens = new LivingWaters(mobile) as InstanceType<typeof LivingWaters> & { updateDetail?: (camera: THREE_TYPES.Camera, range: number, mapView: boolean) => boolean };
  const glucose = new THREE.Group(), hill = new THREE.Group(), ground = new THREE.Group(), plants = new THREE.Group(), details = new THREE.Group(), colliders: ColliderSpec[] = [];
  createGlucoseStructure(glucose, colliders, mobile, new THREE.MeshStandardMaterial());
  createEnhancementHill(hill, colliders);
  ground.add(new Mountains(mobile, tier)); plants.add(details);
  const planting = createPlanting(plants, details, mobile, terrainHeight, riverCenter, tier);
  const marker = (object: THREE_TYPES.Object3D): boolean => /arrow|marker/i.test(object.name) || (object as THREE_TYPES.Mesh).geometry?.type === 'IcosahedronGeometry';
  return [
    { name: 'Living Waters', root: gardens.root, classify: (o) => !day(o) ? null : o.name.startsWith('Mycelium') ? 'mycelium grove' : 'lake, paths, pavilion', prepare: (camera) => gardens.updateDetail?.(camera, range, false) },
    { name: 'Glucose Commons', root: glucose, classify: (o) => day(o) ? 'structure and posters' : null },
    { name: 'Enhancement hill', root: hill, classify: (o) => !day(o) ? null : marker(o) ? 'climb markers' : 'shell, ramp, figure' },
    { name: 'Terrain', root: ground, classify: () => 'meadow and ridges' },
    { name: 'Planting', root: plants, classify: (o) => o.name || 'unnamed', prepare: (camera) => planting.update(camera, profile.plants) },
  ];
}

/** Bun only: the poster collections on a stub canvas, and the forest from the models on disk. */
async function browserlessGroups(tier: GraphicsTier): Promise<Group[]> {
  const mobile = tier !== 'gpu', profile = graphicsProfile(tier), range = Math.min(profile.fog, profile.forest), groups: Group[] = [];
  const context = new Proxy({}, { get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 14 }) : () => undefined });
  (globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => context }), createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
  // The tree and jewelry models from disk, parsed into the meshes GLTFLoader would give: geometry, a plain material, the part's name.
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), { readFileSync } = await import('node:fs');
  GLTFLoader.prototype.loadAsync = async function (url: string) {
    const buffer = readFileSync(new URL(`../public/models/${url.includes('/jewelry/') ? 'jewelry' : 'trees'}/${url.split('/').pop()}`, import.meta.url)), length = buffer.readUInt32LE(12), json = JSON.parse(buffer.subarray(20, 20 + length).toString()), binary = buffer.subarray(28 + length);
    const read = (index: number) => { const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView], size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type as 'SCALAR'], Type = accessor.componentType === 5126 ? Float32Array : accessor.componentType === 5125 ? Uint32Array : Uint16Array, start = binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0); return { array: new Type(binary.buffer.slice(start, start + accessor.count * size * Type.BYTES_PER_ELEMENT)), size }; };
    const scene = new THREE.Group();
    for (const node of json.nodes) if (node.mesh !== undefined) {
      const primitive = json.meshes[node.mesh].primitives[0], geometry = new THREE.BufferGeometry();
      for (const [name, key] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) { if (primitive.attributes[key] === undefined) continue; const { array, size } = read(primitive.attributes[key]); geometry.setAttribute(name, new THREE.BufferAttribute(array, size)); }
      geometry.setIndex(new THREE.BufferAttribute(read(primitive.indices).array, 1));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); mesh.name = node.name; scene.add(mesh);
    }
    return { scene } as unknown as Awaited<ReturnType<InstanceType<typeof GLTFLoader>['loadAsync']>>;
  };
  const winter = await import('../src/world/winter-gate').then(({ loadWinterGate }) => loadWinterGate(mobile, new THREE.MeshStandardMaterial()));
  groups.push({ name: 'Eye of Winter', root: winter.root, classify: o => o.name.startsWith('Original Eye') ? 'original silver' : o.name.includes('stone') || o.name.includes('cabochon') ? 'two stones' : 'room and iris' });
  const { PlanarExhibition } = await import('../src/world/planar-exhibition'), { CIVIC_LANDMARKS } = await import('../src/game/content'), world = await import('../src/world/world');
  // Placed as Town does: hall collections in the halls, the station's in the turned arrival group, the rest in the town.
  const posters = new THREE.Group(), rooms: { center: THREE_TYPES.Vector3; parts: THREE_TYPES.Object3D[] }[] = [], colliders: ColliderSpec[] = [];
  for (const landmark of CIVIC_LANDMARKS) {
    const inside = new THREE.Group(); inside.position.set(landmark.x, .16, landmark.z); posters.add(inside);
    const exhibition = new PlanarExhibition(landmark.id, inside, landmark.x, landmark.z, colliders, []) as { objects?: THREE_TYPES.Object3D[] };
    if (exhibition.objects) rooms.push({ center: new THREE.Vector3(landmark.x, 0, landmark.z), parts: [...inside.children] });
  }
  const arrival = new THREE.Group(), gallery = new THREE.Group(); arrival.add(gallery); arrival.rotation.y = Math.PI; arrival.position.x = -16; arrival.updateMatrix(); posters.add(arrival);
  for (const [id, parent, matrix] of [['station', gallery, arrival.matrix], ['timeface', posters, null], ['future-house', posters, null]] as const) {
    const exhibition = new PlanarExhibition(id, parent, 0, 0, colliders, []) as { objects?: THREE_TYPES.Object3D[]; center?: THREE_TYPES.Vector3 };
    if (exhibition.objects && exhibition.center && id !== 'timeface') rooms.push({ center: exhibition.center.clone().applyMatrix4(matrix ?? new THREE.Matrix4()).setY(0), parts: exhibition.objects });
  }
  const roomRange = (world as { ROOM_RANGE?: number }).ROOM_RANGE ?? Infinity;
  groups.push({ name: 'Posters', root: posters, classify: (o) => o.name.startsWith('Featured jewelry') ? 'hovering jewelry models' : 'six collections', prepare: (camera) => { for (const room of rooms) for (const part of room.parts) part.visible = camera.position.distanceTo(room.center) < roomRange; } });
  // Sub-plan 16's seeded woodland; trees before it lived inside Town, so an older checkout measures the posters only.
  const treeSites = await import('../src/world/forest-layout').then((layout) => layout.forestSites, () => null);
  if (!treeSites) return groups;
  const { Forest, FOREST_DETAIL } = await import('../src/world/forest');
  for (const twigless of [false, true]) {
    FOREST_DETAIL.twigless = twigless; const forest = new Forest(); forest.sites = treeSites(mobile); await forest.load(mobile, true);
    groups.push({ name: twigless ? 'Forest' : 'Forest, every branch', root: forest, classify: (o) => o.name, prepare: (camera) => { forest.update(camera, range, false); } });
  }
  return groups;
}

if (import.meta.main) {
  const json = process.argv.includes('--json'), farIndex = process.argv.indexOf('--far'), far = (tier: 'gpu' | 'mobile'): number => farIndex > 0 ? Number(process.argv[farIndex + 1]) : graphicsProfile(tier).fog;
  const out: Record<string, Record<string, Report>> = {};
  for (const tier of ['gpu', 'mobile'] as const) for (const group of [...budgetGroups(tier), ...await browserlessGroups(tier)]) (out[tier] ??= {})[group.name] = measure(group, far(tier));
  if (json) console.log(JSON.stringify(out, null, 2));
  else for (const [tier, groups] of Object.entries(out)) {
    console.log(`\n${tier} · walk camera far plane ${far(tier as 'gpu' | 'mobile')} m`);
    for (const [name, report] of Object.entries(groups)) for (const key of new Set([...Object.keys(report.static), ...Object.keys(report.perView)])) {
      const s = report.static[key] ?? { calls: 0, triangles: 0 }, v = report.perView[key] ?? { calls: 0, triangles: 0, views: 0, maxCalls: 0, maxTriangles: 0 };
      console.log(`  ${(name + ' · ' + key).padEnd(48)} built ${String(s.calls).padStart(4)} calls ${String(s.triangles).padStart(9)} tris | per view ${v.calls.toFixed(1).padStart(6)} calls ${Math.round(v.triangles).toString().padStart(9)} tris, drawn in ${v.views}/${VIEWS.length}, max ${v.maxCalls} / ${v.maxTriangles}`);
    }
  }
}
