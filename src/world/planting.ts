import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CIVIC_LANDMARKS } from '../game/content';
import { PATH_CURVES, PATH_WIDTH, plantingAllowed } from './landscape';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
interface Site { x: number; y: number; z: number; scale: number; angle: number; }

function leafGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // A folded, pointed leaf catches light along its midrib; no billboard or solid canopy.
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.28, .25, .025, -.36, .5, .025, -.24, .77, .01, 0, 1, 0, .24, .77, .01, .36, .5, .025, .28, .25, .025, 0, .47, .085], 3));
  g.setIndex(Array.from({ length: 8 }, (_, i) => [i, (i + 1) % 8, 8]).flat()); g.computeVertexNormals(); return g;
}
function colored(g: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = g.getAttribute('position').count, colors: number[] = [];
  for (let i = 0; i < count; i++) colors.push(color.r, color.g, color.b);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.deleteAttribute('uv'); return g;
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
function flowerGeometry(seed: number, mobile: boolean): THREE.BufferGeometry {
  const rand = random(seed), parts: THREE.BufferGeometry[] = [], leaf = leafGeometry(), color = new THREE.Color();
  const petal = new THREE.BufferGeometry(), center = new THREE.SphereGeometry(1, 4, 2), palette = ['#f4dda0', '#efe9db', '#ca8ba7', '#9e91c9'];
  petal.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.48, .08, .3, -.6, .2, .72, -.35, .3, 1, .35, .3, 1, .6, .2, .72, .48, .08, .3, 0, -.08, .48], 3));
  petal.setIndex(Array.from({ length: 7 }, (_, i) => [i, (i + 1) % 7, 7]).flat()); petal.computeVertexNormals();
  for (let stem = 0; stem < (mobile ? 4 : 7); stem++) {
    const a = stem * 2.399, r = Math.sqrt(rand()) * .38, x = Math.cos(a) * r, z = Math.sin(a) * r, h = .28 + rand() * .4;
    parts.push(colored(new THREE.CylinderGeometry(.007, .013, h, 4).translate(x, h / 2, z), color.set('#526139')));
    for (const side of [-1, 1]) {
      const g = leaf.clone(); g.scale(.15, .26, .15); g.rotateZ(side * .95); g.rotateY(a); g.translate(x, h * .3, z);
      parts.push(colored(g, color.set('#657747')));
    }
    for (let j = 0; j < 6; j++) {
      const angle = j / 6 * TAU, g = petal.clone(); g.scale(.075, .08, .115); g.rotateX((rand() - .5) * .4); g.rotateY(angle);
      g.translate(x + Math.sin(angle) * .018, h, z + Math.cos(angle) * .018); parts.push(colored(g, color.set(palette[seed % 4])));
    }
    parts.push(colored(center.clone().scale(.027, .021, .027).translate(x, h + .008, z), color.set('#b79843')));
  }
  const merged = mergeGeometries(parts)!; parts.forEach((g) => g.dispose()); leaf.dispose(); petal.dispose(); center.dispose(); return merged;
}
function batches(parent: THREE.Group, name: string, sites: Site[], geometry: THREE.BufferGeometry, material: THREE.Material, shadow: boolean): void {
  const cells = new Map<string, Site[]>();
  for (const site of sites) { const key = Math.floor(site.x / 24) + ':' + Math.floor(site.z / 24), cell = cells.get(key) ?? []; cell.push(site); cells.set(key, cell); }
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
  for (const cell of cells.values()) {
    const batch = new THREE.InstancedMesh(geometry, material, cell.length); batch.name = name;
    cell.forEach((s, i) => {
      matrix.compose(new THREE.Vector3(s.x, s.y, s.z), q.setFromAxisAngle(UP, s.angle), new THREE.Vector3(s.scale, s.scale, s.scale)); batch.setMatrixAt(i, matrix);
      color.setHSL(.15, .08, .75 + (i % 5) * .035); batch.setColorAt(i, color);
    });
    batch.castShadow = shadow; batch.receiveShadow = true; batch.computeBoundingSphere();
    batch.userData.plantLod = true;
    batch.userData.lodX = cell.reduce((sum, s) => sum + s.x, 0) / cell.length;
    batch.userData.lodZ = cell.reduce((sum, s) => sum + s.z, 0) / cell.length;
    parent.add(batch);
  }
}

export function createPlanting(root: THREE.Group, details: THREE.Group, mobile: boolean, height: (x: number, z: number) => number, river: (x: number) => number): void {
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
  shrubs.forEach((sites, i) => batches(root, 'Leafy shrubs', sites, shrubGeometry(191 + i, mobile, i > 0), material, true));
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
  flowers.forEach((sites, i) => batches(root, 'Flower borders', sites, flowerGeometry(400 + i, mobile), material, false));
  for (let i = 0; i < (mobile ? 18000 : 52000); i++) {
    const x = (rand() - .5) * 155, z = (rand() - .5) * 132, scale = .55 + rand() * .75;
    if (!plantingAllowed(x, z, .55 * scale) || Math.abs(z - river(x)) < 7.4) continue;
    grass.push({ x, y: height(x, z) + .012, z, scale, angle: rand() * TAU });
  }
  batches(details, 'Meadow grass', grass, grassGeometry(mobile), material, false);
}

export function updatePlanting(groups: THREE.Object3D[], camera: THREE.Camera, range: number): void {
  const origin = camera.position;
  for (const group of groups) group.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh) || !object.userData.plantLod) return;
    object.visible = Math.hypot(origin.x - object.userData.lodX, origin.z - object.userData.lodZ) < range;
  });
}
