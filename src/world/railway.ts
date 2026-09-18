import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { RAILWAY, STATION } from './station-layout';

type Point = [number, number, number];
function box(x: number, y: number, z: number, width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts)!; parts.forEach((part) => part.dispose()); return geometry;
}
function add(root: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string, colliders?: ColliderSpec[]): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  if (colliders) colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i) });
  return mesh;
}
function geometry(positions: number[], uv: number[], indices: number[], colors?: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices);
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}
function gridIndices(rows: number, columns: number): number[] {
  const indices: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) { const n = j * (columns + 1) + i; indices.push(n, n + columns + 1, n + 1, n + 1, n + columns + 1, n + columns + 2); }
  return indices;
}
function tube(points: Point[], radius: number, mobile: boolean): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), mobile ? 28 : 64, radius, mobile ? 6 : 10, false);
}

/** Closed, uneven cast shell: the aperture is geometry, with its lower edge buried in the ballast. */
export function darkNutPortalGeometry(mobile: boolean, x: number, direction: number): THREE.BufferGeometry {
  const sides = mobile ? 64 : 128, rows = mobile ? 20 : 36, p: number[] = [], uv: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= sides; i++) {
    const a = i / sides * Math.PI * 2, t = j / rows * Math.PI * 2;
    const fold = .23 * Math.sin(a * 7 + .8 * Math.sin(t * 3)) + .11 * Math.sin(a * 19 - t * 5) + .06 * Math.sin(a * 37 + t * 13);
    const thickness = (1 - Math.cos(t)) / 2, width = 8.1 + thickness * 4.6, height = 5.55 + thickness * 4.1;
    const centerY = 3.1 + thickness * 1.5;
    p.push(x + direction * (2 + Math.sin(t) * 5 - thickness * 6 + fold), centerY + Math.cos(a) * (height + fold * thickness), RAILWAY.centerZ + Math.sin(a) * (width + fold * thickness));
    uv.push(i / sides * 3, j / rows * 2);
  }
  return geometry(p, uv, gridIndices(rows, sides));
}

function boreGeometry(mobile: boolean, direction: number): THREE.BufferGeometry {
  const sides = mobile ? 20 : 40, rows = 44, p: number[] = [], uv: number[] = [], colors: number[] = [];
  // Vertical lower walls join an elliptical vault, leaving the entire track gauge open.
  const profile: [number, number][] = [[-RAILWAY.boreHalfWidth, -.18]];
  for (let i = 0; i <= sides; i++) { const a = -Math.PI / 2 + i / sides * Math.PI; profile.push([Math.sin(a) * RAILWAY.boreHalfWidth, RAILWAY.boreSpring + Math.cos(a) * RAILWAY.boreRise]); }
  profile.push([RAILWAY.boreHalfWidth, -.18]);
  const distances = [0]; for (let i = 1; i < profile.length; i++) distances.push(distances[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  for (let j = 0; j <= rows; j++) {
    const x = RAILWAY.portalX + 1 + j / rows * (RAILWAY.exitX - RAILWAY.portalX - 1);
    const light = .13 + .87 * Math.exp(-Math.min(x - RAILWAY.portalX, RAILWAY.exitX - x) / 15);
    profile.forEach(([z, y], i) => { p.push(direction * x, y, RAILWAY.centerZ + z); uv.push(x / 4, distances[i] / 4); colors.push(light, light, light); });
  }
  return geometry(p, uv, gridIndices(rows, profile.length - 1), colors);
}

function railwayMaterials(): Record<string, THREE.MeshStandardMaterial> {
  return {
    ballast: new THREE.MeshStandardMaterial({ color: '#a4a49b', roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: '#9b7961', roughness: .77, metalness: .45 }),
    head: new THREE.MeshStandardMaterial({ color: '#aab1b0', roughness: .26, metalness: .9 }),
    shell: new THREE.MeshStandardMaterial({ color: '#261e1b', roughness: .36, metalness: .48, side: THREE.DoubleSide }),
    bronze: new THREE.MeshStandardMaterial({ color: '#dfa872', roughness: .36, metalness: .64 }),
    lining: new THREE.MeshStandardMaterial({ color: '#817b6e', roughness: .98, vertexColors: true, side: THREE.DoubleSide }),
  };
}

/** DOM-independent geometry and colliders, also used by the headless circulation checks. */
export function createRailwayStructure(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean): THREE.Group {
  const railway = new THREE.Group(); railway.name = 'Mountain railway'; root.add(railway);
  const materials = railwayMaterials(); railway.userData.materials = materials;
  const length = STATION.railHalfLength * 2;
  const concrete = new THREE.MeshStandardMaterial({ color: '#b7b8b0', roughness: .88 });
  const foundation = box(0, -.12, RAILWAY.centerZ, length, .24, 14), fp = foundation.getAttribute('position'), ft = foundation.getAttribute('uv');
  for (let i = 0; i < fp.count; i++) ft.setXY(i, fp.getX(i) / 2, fp.getZ(i) / 2);
  add(railway, foundation, materials.ballast, 'Railway service foundation');
  colliders.push({ type: 'box', position: [0, -.12, RAILWAY.centerZ], size: [length / 2, .12, 7] });
  const guides: THREE.BufferGeometry[] = [], coils: THREE.BufferGeometry[] = [], joints: THREE.BufferGeometry[] = [];
  for (const z of RAILWAY.tracks) {
    add(railway, box(0, .08, z, length, .16, 2.5), concrete, 'Concrete maglev guideway');
    colliders.push({ type: 'box', position: [0, .08, z], size: [length / 2, .08, 1.25] });
    for (const side of [-1, 1]) {
      colliders.push({ type: 'box', position: [0, .24, z + side * 1.06], size: [length / 2, .08, .11] });
      guides.push(box(0, .24, z + side * 1.06, length, .16, .22));
      coils.push(box(0, .22, z + side * 1.19, length, .1, .035));
    }
    for (let x = -STATION.railHalfLength; x < STATION.railHalfLength; x += 6) joints.push(box(x, .166, z, .035, .012, 2.48));
  }
  add(railway, merged(guides), materials.head, 'Twin magnetic guidance beams');
  add(railway, merged(coils), materials.rail, 'Linear motor stator strips');
  add(railway, merged(joints), materials.rail, 'Guideway expansion joints');

  const ornaments: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [], ribs: THREE.BufferGeometry[] = [];
  for (const direction of [-1, 1]) {
    add(railway, darkNutPortalGeometry(mobile, RAILWAY.portalX * direction, direction), materials.shell, `${direction < 0 ? 'West' : 'East'} dark Nut of Power tunnel`, colliders);
    add(railway, boreGeometry(mobile, direction), materials.lining, `${direction < 0 ? 'West' : 'East'} mountain tunnel lining`, colliders);
    // A smaller shell marks the far opening, so the tracks actually emerge beyond the ridge.
    add(railway, darkNutPortalGeometry(mobile, RAILWAY.exitX * direction, -direction), materials.shell, `${direction < 0 ? 'West' : 'East'} outer tunnel portal`, colliders);
    const front = RAILWAY.portalX * direction - direction * 6.9;
    const branch = (points: Point[], radius: number): void => { ornaments.push(tube(points.map(([z, y, depth]) => [front + depth * direction, y, RAILWAY.centerZ + z * 1.38]), radius * 1.55, mobile)); };
    branch([[-5.5, 8.1, 1], [-4.8, 11.4, -.2], [-2.7, 11.8, -.4], [-.9, 10.5, -.3], [1.2, 11.3, -.2], [4.8, 12, .3], [5.9, 9.4, 1]], .44);
    branch([[-2.8, 12, -.2], [-2.4, 10.7, -.7], [-3.7, 9.4, -.1]], .34);
    branch([[1.3, 11.4, -.1], [1.8, 9.5, -.4], [3.4, 8.9, .1], [4.3, 10.9, .2]], .48);
    for (const [z, y, size] of [[-4.9, 11.7, .9], [-2.8, 11.4, .7], [2.6, 9.8, 1], [4.7, 12, .9]]) {
      const nugget = new THREE.IcosahedronGeometry(size * 1.5, mobile ? 1 : 2), np = nugget.getAttribute('position');
      for (let i = 0; i < np.count; i++) { const r = 1 + .16 * Math.sin(np.getX(i) * 13 + np.getY(i) * 19 + np.getZ(i) * 9); np.setXYZ(i, np.getX(i) * r, np.getY(i) * r * .83, np.getZ(i) * r); }
      nugget.computeVertexNormals(); nugget.translate(front - direction * .3, y, RAILWAY.centerZ + z * 1.38); ornaments.push(nugget);
    }
    for (let x = RAILWAY.portalX + 12; x < RAILWAY.exitX - 4; x += mobile ? 24 : 16) {
      const points: Point[] = [[x * direction, .15, RAILWAY.centerZ - 7]];
      for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI; points.push([x * direction, RAILWAY.boreSpring + Math.cos(a) * 5.15, RAILWAY.centerZ + Math.sin(a) * 7]); }
      points.push([x * direction, .15, RAILWAY.centerZ + 7]); ribs.push(tube(points, .07, mobile));
      for (const dz of [-6.94, 6.94]) lamps.push(box(x * direction, 2.8, RAILWAY.centerZ + dz, .8, .09, .07));
    }
    // Raised maintenance ledges and their walls remain outside the train's swept width.
    for (const dz of [-6.22, 6.22]) {
      const ledge = box(direction * (RAILWAY.portalX + RAILWAY.exitX) / 2, .02, RAILWAY.centerZ + dz, RAILWAY.exitX - RAILWAY.portalX, .36, .92);
      const lp = ledge.getAttribute('position'), lt = ledge.getAttribute('uv'); for (let i = 0; i < lp.count; i++) lt.setXY(i, lp.getX(i) / 2, lp.getZ(i) / 2);
      add(railway, ledge, materials.ballast, 'Tunnel maintenance ledge', colliders);
    }
  }
  // Tube and nugget topology differs, so normalize before merging the cast ornament.
  const cast = ornaments.map((part) => part.index ? part.toNonIndexed() : part); ornaments.forEach((part) => { if (part.index) part.dispose(); });
  add(railway, merged(cast), materials.bronze, 'Organic bronze tunnel clasps', colliders);
  add(railway, merged(ribs), materials.rail, 'Tunnel vault ribs', colliders);
  add(railway, merged(lamps), new THREE.MeshBasicMaterial({ color: '#e6bb78' }), 'Recessed tunnel guide lights');
  return railway;
}

export async function loadRailwayTextures(railway: THREE.Group, mobile: boolean): Promise<void> {
  const materials = railway.userData.materials as ReturnType<typeof railwayMaterials>, loader = new THREE.TextureLoader();
  const jobs: Promise<void>[] = [];
  for (const name of ['ballast', 'rail'] as const) for (const [suffix, slot] of [['color', 'map'], ['roughness', 'roughnessMap'], ...(!mobile ? [['normal', 'normalMap']] : [])] as const) {
    jobs.push(loader.loadAsync(import.meta.env.BASE_URL + `textures/railway/${name}-${suffix}.jpg`).then((map) => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 8; if (slot === 'map') map.colorSpace = THREE.SRGBColorSpace;
      const material = materials[name]; if (slot === 'map') material.map = map; else if (slot === 'roughnessMap') material.roughnessMap = map; else { material.normalMap = map; material.normalScale.set(name === 'ballast' ? 1.1 : .45, name === 'ballast' ? 1.1 : .45); } material.needsUpdate = true;
    }).catch(() => { /* Base materials keep the corridor visible if a local map is unavailable. */ }));
  }
  for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap']] as const) {
    if (mobile && slot === 'normalMap') continue;
    jobs.push(loader.loadAsync(import.meta.env.BASE_URL + `textures/mountains/rock-${suffix}.jpg`).then((map) => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 4; if (slot === 'map') map.colorSpace = THREE.SRGBColorSpace;
      for (const name of ['shell', 'bronze', 'lining']) { if (name === 'bronze' && slot === 'map') continue; materials[name][slot] = map; materials[name].normalScale.set(.65, .65); materials[name].needsUpdate = true; }
    }).catch(() => { /* Modelled folds still define the portal silhouette. */ }));
  }
  await Promise.all(jobs);
}
