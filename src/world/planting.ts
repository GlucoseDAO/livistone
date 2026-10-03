import * as THREE from 'three';
import { attribute, cameraPosition, distance, float, mix, positionLocal, smoothstep, vec3 } from 'three/tsl';
import type { GraphicsTier } from '../game/graphics';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainNoise } from './terrain';
import { CIVIC_LANDMARKS } from '../game/content';
import { PATH_CURVES, PATH_WIDTH, plantingAllowed } from './landscape';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
interface Site { x: number; y: number; z: number; scale: number; angle: number; petal?: THREE.Color }
const PETALS = ['#f4dda0', '#efe9db', '#ca8ba7', '#9e91c9'];

function leafGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // A folded, pointed leaf catches light along its midrib; no billboard or solid canopy.
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.28, .25, .025, -.36, .5, .025, -.24, .77, .01, 0, 1, 0, .24, .77, .01, .36, .5, .025, .28, .25, .025, 0, .47, .085], 3));
  g.setIndex(Array.from({ length: 8 }, (_, i) => [i, (i + 1) % 8, 8]).flat()); g.computeVertexNormals(); return g;
}
function colored(g: THREE.BufferGeometry, color: THREE.Color, petal?: number): THREE.BufferGeometry {
  const count = g.getAttribute('position').count, colors: number[] = [];
  for (let i = 0; i < count; i++) colors.push(color.r, color.g, color.b);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.deleteAttribute('uv');
  if (petal !== undefined) g.setAttribute('petal', new THREE.Float32BufferAttribute(new Float32Array(count).fill(petal), 1));
  return g;
}
function shrubGeometry(seed: number, mobile: boolean, flowering: boolean): THREE.BufferGeometry {
  const rand = random(seed), parts: THREE.BufferGeometry[] = [], leaf = leafGeometry(), color = new THREE.Color();
  const stem = (a: THREE.Vector3, b: THREE.Vector3, radius: number): void => {
    const g = new THREE.CylinderGeometry(radius * .5, radius, a.distanceTo(b), 5, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())); g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
    parts.push(colored(g, color.set('#685c3c')));
  };
  for (let branch = 0; branch < (mobile ? 6 : 9); branch++) {
    const angle = branch * 2.399 + rand() * .4;
    const tip = new THREE.Vector3(Math.sin(angle) * (.35 + rand() * .35), .65 + rand() * .45, Math.cos(angle) * (.35 + rand() * .35));
    stem(new THREE.Vector3(0, .02, 0), tip, .022);
    for (let shoot = 0; shoot < 3; shoot++) {
      const base = tip.clone().multiplyScalar(.42 + shoot * .2), direction = new THREE.Vector3(Math.sin(angle + shoot - 1) * .28, .3, Math.cos(angle + shoot - 1) * .28);
      const end = base.clone().add(direction); stem(base, end, .008);
      for (let pair = 0; pair < (mobile ? 3 : 4); pair++) for (const side of [-1, 1]) {
        const p = base.clone().addScaledVector(direction, .15 + pair * .23);
        const size = .12 + rand() * .10, g = leaf.clone();
        g.scale(size * (flowering ? .65 : 1), size, size); g.rotateZ(side * (.7 + rand() * .65)); g.rotateY(angle + rand() * .9); g.translate(p.x, p.y, p.z);
        parts.push(colored(g, color.setHSL(.22 + rand() * .075, .34 + rand() * .24, .14 + rand() * .13)));
      }
      if (flowering && shoot > 0) for (let petal = 0; petal < 5; petal++) {
        const g = leaf.clone(); g.scale(.065, .08, .045); g.rotateZ(petal / 5 * TAU); g.rotateX(-.65); g.translate(end.x, end.y, end.z);
        parts.push(colored(g, color.set(seed % 2 ? '#ede8cc' : '#ab91be')));
      }
    }
  }
  const merged = mergeGeometries(parts)!; parts.forEach((g) => g.dispose()); leaf.dispose(); return merged;
}
function grassGeometry(mobile: boolean): THREE.BufferGeometry {
  const rand = random(907), positions: number[] = [], colors: number[] = [], indices: number[] = [], color = new THREE.Color();
  for (let blade = 0; blade < (mobile ? 5 : 8); blade++) {
    const angle = rand() * TAU, x = (rand() - .5) * .35, z = (rand() - .5) * .35, h = .17 + rand() * .27, w = .008 + rand() * .009, lean = .08 + rand() * .16, start = positions.length / 3;
    for (let j = 0; j < 3; j++) for (const side of [-1, 1]) {
      const t = j / 3, bend = lean * t * t;
      positions.push(x + Math.sin(angle) * bend + Math.cos(angle) * side * w * (1 - t), h * t, z + Math.cos(angle) * bend - Math.sin(angle) * side * w * (1 - t));
      color.setHSL(.215 + blade * .004, .42, .1 + t * .18); colors.push(color.r, color.g, color.b);
    }
    positions.push(x + Math.sin(angle) * lean, h, z + Math.cos(angle) * lean); color.set('#8d9a50'); colors.push(color.r, color.g, color.b);
    for (let j = 0; j < 2; j++) { const n = start + j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    indices.push(start + 4, start + 5, start + 6);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
/** With `instanced`, petals are white and flagged by a `petal` attribute, so one geometry takes each clump's colour per instance. */
function flowerGeometry(seed: number, mobile: boolean, instanced = false): THREE.BufferGeometry {
  const rand = random(seed), parts: THREE.BufferGeometry[] = [], leaf = leafGeometry(), color = new THREE.Color(), mask = (value: number): number | undefined => instanced ? value : undefined;
  const petal = new THREE.BufferGeometry(), center = new THREE.SphereGeometry(1, 4, 2);
  petal.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.48, .08, .3, -.6, .2, .72, -.35, .3, 1, .35, .3, 1, .6, .2, .72, .48, .08, .3, 0, -.08, .48], 3));
  petal.setIndex(Array.from({ length: 7 }, (_, i) => [i, (i + 1) % 7, 7]).flat()); petal.computeVertexNormals();
  for (let stem = 0; stem < (mobile ? 4 : 7); stem++) {
    const a = stem * 2.399, r = Math.sqrt(rand()) * .38, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .28 + rand() * .4;
    parts.push(colored(new THREE.CylinderGeometry(.007, .013, h, 4).translate(x, h / 2, z), color.set('#526139'), mask(0)));
    for (const side of [-1, 1]) {
      const g = leaf.clone(); g.scale(.15, .26, .15); g.rotateZ(side * .95); g.rotateY(a); g.translate(x, h * .3, z);
      parts.push(colored(g, color.set('#657747'), mask(0)));
    }
    for (let j = 0; j < 6; j++) {
      const angle = j / 6 * TAU, g = petal.clone(); g.scale(.075, .08, .115); g.rotateX((rand() - .5) * .4); g.rotateY(angle);
      g.translate(x + Math.sin(angle) * .018, h, z + Math.cos(angle) * .018); parts.push(colored(g, color.set(instanced ? '#ffffff' : PETALS[seed % 4]), mask(1)));
    }
    parts.push(colored(center.clone().scale(.027, .021, .027).translate(x, h + .008, z), color.set('#b79843'), mask(0)));
  }
  const merged = mergeGeometries(parts)!; parts.forEach((g) => g.dispose()); leaf.dispose(); petal.dispose(); center.dispose(); return merged;
}
/** A 24 m cell of one planting kind: a slice of the kind's instance arrays, its centre and a bounding sphere. */
interface PlantCell { x: number; z: number; first: number; count: number; sphere: THREE.Sphere; shown: boolean }
interface PlantKind { mesh: THREE.InstancedMesh; cells: PlantCell[]; matrices: Float32Array; colors: Float32Array; petals: Float32Array | null }

function kind(parent: THREE.Group, name: string, sites: Site[], geometry: THREE.BufferGeometry, material: THREE.Material, shadow: boolean): PlantKind {
  const cells = new Map<string, Site[]>();
  for (const site of sites) { const key = Math.floor(site.x / 24) + ':' + Math.floor(site.z / 24), cell = cells.get(key) ?? []; cell.push(site); cells.set(key, cell); }
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color(), scaled = new THREE.Sphere();
  const matrices = new Float32Array(sites.length * 16), colors = new Float32Array(sites.length * 3), result: PlantCell[] = [];
  const petals = sites.some((site) => site.petal) ? new Float32Array(sites.length * 3) : null;
  geometry.computeBoundingSphere(); let next = 0;
  for (const members of cells.values()) {
    const cell: PlantCell = { x: members.reduce((sum, s) => sum + s.x, 0) / members.length, z: members.reduce((sum, s) => sum + s.z, 0) / members.length, first: next, count: members.length, sphere: new THREE.Sphere(new THREE.Vector3(), -1), shown: false };
    members.forEach((s, i) => {
      matrix.compose(new THREE.Vector3(s.x, s.y, s.z), q.setFromAxisAngle(UP, s.angle), new THREE.Vector3(s.scale, s.scale, s.scale)); matrix.toArray(matrices, next * 16);
      color.setHSL(.15, .08, .75 + (i % 5) * .035); color.toArray(colors, next * 3); if (petals) s.petal!.toArray(petals, next * 3);
      scaled.copy(geometry.boundingSphere!).applyMatrix4(matrix); if (cell.sphere.radius < 0) cell.sphere.copy(scaled); else cell.sphere.union(scaled);
      next++;
    });
    result.push(cell);
  }
  const mesh = new THREE.InstancedMesh(geometry, material, sites.length); mesh.name = name;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(sites.length * 3), 3);
  mesh.count = 0; mesh.visible = false; mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
  if (petals) geometry.setAttribute('petalColor', new THREE.InstancedBufferAttribute(new Float32Array(sites.length * 3), 3));
  return { mesh, cells: result, matrices, colors, petals };
}

/**
 * Leafy shrubs, flower borders and meadow grass. Each kind is planted in 24 m cells shown within a walking range, and drawn
 * through one instanced mesh: on WebGPU every instanced mesh costs its own shader build, so the cells only pick instances.
 */
export class Planting {
  readonly meshes: THREE.InstancedMesh[] = [];
  private warm = false;
  constructor(private readonly kinds: PlantKind[]) { this.meshes = kinds.map(k => k.mesh); }
  /** Returns whether a shadow-casting cell appeared or disappeared, so a cached shadow map can follow. */
  update(camera: THREE.Camera, range: number): boolean {
    if (this.warm) return false;
    const origin = camera.position, range2 = range * range; let casters = false;
    for (const kind of this.kinds) {
      let changed = false;
      for (const cell of kind.cells) {
        const dx = origin.x - cell.x, dz = origin.z - cell.z, shown = dx * dx + dz * dz < range2;
        if (shown !== cell.shown) { cell.shown = shown; changed = true; }
      }
      if (!changed) continue;
      if (kind.mesh.castShadow) casters = true;
      this.refill(kind);
    }
    return casters;
  }
  /** Before the first frame, show every plant with culling off so the precompile and first shadow pass build each shader. */
  warmUp(on: boolean): void {
    this.warm = on;
    for (const kind of this.kinds) {
      kind.mesh.frustumCulled = !on;
      for (const cell of kind.cells) cell.shown = on;
      this.refill(kind);
      // Leave no cell marked shown, so the next update() refills from the camera.
      if (!on) for (const cell of kind.cells) cell.shown = false;
    }
  }
  private refill(kind: PlantKind): void {
    const { mesh } = kind, target = mesh.instanceMatrix.array as Float32Array, colors = mesh.instanceColor!.array as Float32Array, sphere = new THREE.Sphere(new THREE.Vector3(), -1);
    const petals = kind.petals ? mesh.geometry.getAttribute('petalColor') as THREE.InstancedBufferAttribute : null;
    let count = 0;
    for (const cell of kind.cells) {
      if (!cell.shown) continue;
      target.set(kind.matrices.subarray(cell.first * 16, (cell.first + cell.count) * 16), count * 16);
      colors.set(kind.colors.subarray(cell.first * 3, (cell.first + cell.count) * 3), count * 3);
      if (petals) (petals.array as Float32Array).set(kind.petals!.subarray(cell.first * 3, (cell.first + cell.count) * 3), count * 3);
      count += cell.count; if (sphere.radius < 0) sphere.copy(cell.sphere); else sphere.union(cell.sphere);
    }
    mesh.count = count; mesh.visible = count > 0; mesh.boundingSphere = count > 0 ? sphere : null;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true; if (petals) petals.needsUpdate = true;
  }
}

/**
 * Meadow tufts for towns with a near grass field (grass-field.ts): inside its radius the field's blades replace them, so they
 * sink into the ground as the camera comes near, over the band where the field's outer blades thin out.
 */
function tuftMaterial(radius: number): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide });
  // 1 - smoothstep(a, b) rather than reversed edges, which WGSL leaves undefined.
  material.positionNode = positionLocal.sub(vec3(0, float(1).sub(smoothstep(radius * .6, radius * .95, distance(positionLocal.xz, cameraPosition.xz))).mul(.8), 0));
  return material;
}

/** `grassRadius` is the near grass field's radius, or 0 where the tier draws none. */
export function createPlanting(root: THREE.Group, details: THREE.Group, mobile: boolean, height: (x: number, z: number) => number, river: (x: number) => number, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', grassRadius = 0): Planting {
  const result: PlantKind[] = [];
  const rand = random(58), shrubs: Site[][] = [[], [], []], grass: Site[] = [];
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide });
  for (let i = 0; i < 2600; i++) {
    const l = CIVIC_LANDMARKS[i % CIVIC_LANDMARKS.length], angle = rand() * TAU, r = 12.8 + rand() * 7.5, scale = .65 + rand() * .65;
    const x = i % 4 ? l.x + Math.sin(angle) * r * (1 + (l.stretch.x - 1) * .85) : (rand() - .5) * 120;
    const z = i % 4 ? l.z + Math.cos(angle) * r : river(x) + (i % 8 ? -1 : 1) * (8.4 + rand() * 5);
    if (!plantingAllowed(x, z, scale * 1.15) || Math.abs(z - river(x)) < 7.8) continue;
    if (shrubs.some((sites) => sites.some((p) => Math.hypot(p.x - x, p.z - z) < (p.scale + scale) * .8))) continue;
    shrubs[i % 3].push({ x, y: height(x, z), z, scale, angle });
    if (shrubs.flat().length >= (mobile ? 200 : 320)) break;
  }
  shrubs.forEach((sites, i) => result.push(kind(root, 'Leafy shrubs', sites, shrubGeometry(191 + i, mobile, i > 0), material, true)));
  // Short, separated patches leave grass between flowers and keep the routes visually quiet.
  const flowers: Site[][] = [[], [], [], []];
  const plant = (x: number, z: number, palette: number): void => {
    const scale = .6 + rand() * .4;
    if (!plantingAllowed(x, z, .58 * scale) || Math.abs(z - river(x)) < 7.5) return;
    flowers[palette % 4].push({ x, y: height(x, z) + .015, z, scale, angle: rand() * TAU });
  };
  for (const curve of PATH_CURVES) {
    const steps = Math.ceil(curve.getLength() / (mobile ? 1.3 : .95));
    for (let i = 0; i <= steps; i++) {
      if (i % 12 > 3) continue;
      const p = curve.getPointAt(i / steps), tangent = curve.getTangentAt(i / steps), nx = -tangent.z, nz = tangent.x;
      for (const side of [-1, 1]) {
        const offset = side * (PATH_WIDTH / 2 + 1.1 + rand() * .6);
        plant(p.x + nx * offset, p.z + nz * offset, Math.floor(i / 9) + (side > 0 ? 1 : 0));
      }
    }
  }
  for (let i = 0; i < (mobile ? 95 : 180); i++) {
    const x = (rand() - .5) * 125, z = river(x) + (i % 2 ? 1 : -1) * (8.1 + rand() * 3.7);
    plant(x, z, Math.floor((x + 65) / 7));
  }
  if (tier === 'cpu') flowers.forEach((sites, i) => result.push(kind(root, 'Flower borders', sites, flowerGeometry(400 + i, mobile), material, false)));
  else {
    // One clump shape for every palette, coloured per instance: a single mesh and shader build instead of four. The cpu tier keeps
    // four vertex-coloured kinds, as its Lambert copies (cpu-detail.ts) carry no colour node.
    const petal = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: .94, side: THREE.DoubleSide });
    petal.colorNode = mix(vec3(1), attribute('petalColor', 'vec3'), attribute('petal', 'float'));
    const palette = PETALS.map((hex) => new THREE.Color(hex));
    result.push(kind(root, 'Flower borders', flowers.flatMap((sites, i) => sites.map((site) => ({ ...site, petal: palette[i] }))), flowerGeometry(400, mobile, true), petal, false));
  }
  for (let i = 0; i < (mobile ? 18000 : 52000); i++) {
    const x = (rand() - .5) * 155, z = (rand() - .5) * 132, scale = .55 + rand() * .75;
    // Open lawns alternate with denser meadow islands; keep the original maximum tuft footprint.
    if (terrainNoise(x * .085 + 23, z * .085 - 9) < .32) continue;
    if (!plantingAllowed(x, z, .55 * scale) || Math.abs(z - river(x)) < 7.4) continue;
    grass.push({ x, y: height(x, z) + .012, z, scale, angle: rand() * TAU });
  }
  result.push(kind(details, 'Meadow grass', grass, grassGeometry(mobile), grassRadius > 0 ? tuftMaterial(grassRadius) : material, false));
  return new Planting(result);
}
