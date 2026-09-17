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
    const thickness = (1 - Math.cos(t)) / 2, width = 4.25 + thickness * 4.6, height = 5.55 + thickness * 4.1;
    const centerY = 3.1 + thickness * 1.5;
    p.push(x + direction * (2 + Math.sin(t) * 5 - thickness * 6 + fold), centerY + Math.cos(a) * (height + fold * thickness), STATION.trackZ + Math.sin(a) * (width + fold * thickness));
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
    profile.forEach(([z, y], i) => { p.push(direction * x, y, STATION.trackZ + z); uv.push(x / 4, distances[i] / 4); colors.push(light, light, light); });
  }
  return geometry(p, uv, gridIndices(rows, profile.length - 1), colors);
}

function railwayMaterials(): Record<string, THREE.MeshStandardMaterial> {
  return {
    ballast: new THREE.MeshStandardMaterial({ color: '#a4a49b', roughness: 1 }),
    sleeper: new THREE.MeshStandardMaterial({ color: '#a18d73', roughness: .95 }),
    rail: new THREE.MeshStandardMaterial({ color: '#9b7961', roughness: .77, metalness: .45 }),
    head: new THREE.MeshStandardMaterial({ color: '#aab1b0', roughness: .26, metalness: .9 }),
    shell: new THREE.MeshStandardMaterial({ color: '#493b36', roughness: .48, metalness: .35, side: THREE.DoubleSide }),
    bronze: new THREE.MeshStandardMaterial({ color: '#dfa872', roughness: .36, metalness: .64 }),
    lining: new THREE.MeshStandardMaterial({ color: '#817b6e', roughness: .98, vertexColors: true, side: THREE.DoubleSide }),
  };
}

/** DOM-independent geometry and colliders, also used by the headless circulation checks. */
export function createRailwayStructure(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean): THREE.Group {
  const railway = new THREE.Group(); railway.name = 'Mountain railway'; root.add(railway);
  const materials = railwayMaterials(); railway.userData.materials = materials;
  const length = STATION.railHalfLength * 2, p: number[] = [], uv: number[] = [];
  for (const x of [-STATION.railHalfLength, STATION.railHalfLength]) for (const [z, y] of [[-3.35, -.17], [-2.15, .065], [2.15, .065], [3.35, -.17]]) { p.push(x, y, STATION.trackZ + z); uv.push(x / 2, z / 2); }
  const bedIndices = gridIndices(1, 3); for (let i = 0; i < bedIndices.length; i += 3) [bedIndices[i + 1], bedIndices[i + 2]] = [bedIndices[i + 2], bedIndices[i + 1]];
  const bed = geometry(p, uv, bedIndices); add(railway, bed, materials.ballast, 'Crushed stone ballast', colliders);
  const webs: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [];
  for (const z of [-.86, .86]) {
    webs.push(box(0, .135, STATION.trackZ + z, length, .045, .18), box(0, .205, STATION.trackZ + z, length, .12, .048));
    heads.push(box(0, .277, STATION.trackZ + z, length, .055, .095));
  }
  for (const g of webs) { const pos = g.getAttribute('position'), tex = g.getAttribute('uv'); for (let i = 0; i < pos.count; i++) tex.setXY(i, pos.getX(i) / 2, (pos.getY(i) + pos.getZ(i)) * 3); }
  add(railway, merged(webs), materials.rail, 'Weathered rail webs and feet', colliders); add(railway, merged(heads), materials.head, 'Polished running surfaces', colliders);
  const sleeperGeometry = new THREE.BoxGeometry(.24, .14, 2.9), sp = sleeperGeometry.getAttribute('position'), st = sleeperGeometry.getAttribute('uv');
  for (let i = 0; i < st.count; i++) st.setXY(i, (sp.getX(i) + .12) * .55 + .21, sp.getZ(i) / 2);
  const count = Math.floor(length / .72), sleepers = new THREE.InstancedMesh(sleeperGeometry, materials.sleeper, count), matrix = new THREE.Matrix4(), tint = new THREE.Color();
  const clips = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .05, .28), materials.rail, count * 2);
  for (let i = 0; i < count; i++) {
    const x = -STATION.railHalfLength + .36 + i * .72;
    sleepers.setMatrixAt(i, matrix.makeTranslation(x, .07, STATION.trackZ)); sleepers.setColorAt(i, tint.setScalar(.8 + .2 * (Math.sin(i * 27.13) * .5 + .5)));
    for (let j = 0; j < 2; j++) clips.setMatrixAt(i * 2 + j, matrix.makeTranslation(x, .154, STATION.trackZ + (j * 2 - 1) * .86));
  }
  sleepers.name = 'Weathered timber sleepers'; clips.name = 'Rail fastening plates';
  for (const object of [sleepers, clips]) { object.receiveShadow = true; object.computeBoundingSphere(); railway.add(object); }
  // The small sleeper steps share a low support surface; rails retain their exact colliders.
  colliders.push({ type: 'box', position: [0, .02, STATION.trackZ], size: [STATION.railHalfLength, .045, 1.45] });

  const ornaments: THREE.BufferGeometry[] = [], lamps: THREE.BufferGeometry[] = [], ribs: THREE.BufferGeometry[] = [];
  for (const direction of [-1, 1]) {
    add(railway, darkNutPortalGeometry(mobile, RAILWAY.portalX * direction, direction), materials.shell, `${direction < 0 ? 'West' : 'East'} dark Nut of Power tunnel`, colliders);
    add(railway, boreGeometry(mobile, direction), materials.lining, `${direction < 0 ? 'West' : 'East'} mountain tunnel lining`, colliders);
    // A smaller shell marks the far opening, so the tracks actually emerge beyond the ridge.
    add(railway, darkNutPortalGeometry(mobile, RAILWAY.exitX * direction, -direction), materials.shell, `${direction < 0 ? 'West' : 'East'} outer tunnel portal`, colliders);
    const front = RAILWAY.portalX * direction - direction * 6.9;
    const branch = (points: Point[], radius: number): void => { ornaments.push(tube(points.map(([z, y, depth]) => [front + depth * direction, y, STATION.trackZ + z]), radius, mobile)); };
    branch([[-5.5, 8.1, 1], [-4.8, 11.4, -.2], [-2.7, 11.8, -.4], [-.9, 10.5, -.3], [1.2, 11.3, -.2], [4.8, 12, .3], [5.9, 9.4, 1]], .44);
    branch([[-2.8, 12, -.2], [-2.4, 10.7, -.7], [-3.7, 9.4, -.1]], .34);
    branch([[1.3, 11.4, -.1], [1.8, 9.5, -.4], [3.4, 8.9, .1], [4.3, 10.9, .2]], .48);
    for (const [z, y, size] of [[-4.9, 11.7, .9], [-2.8, 11.4, .7], [2.6, 9.8, 1], [4.7, 12, .9]]) {
      const nugget = new THREE.IcosahedronGeometry(size, mobile ? 1 : 2), np = nugget.getAttribute('position');
      for (let i = 0; i < np.count; i++) { const r = 1 + .16 * Math.sin(np.getX(i) * 13 + np.getY(i) * 19 + np.getZ(i) * 9); np.setXYZ(i, np.getX(i) * r, np.getY(i) * r * .83, np.getZ(i) * r); }
      nugget.computeVertexNormals(); nugget.translate(front - direction * .3, y, STATION.trackZ + z); ornaments.push(nugget.toNonIndexed()); nugget.dispose();
    }
    for (let x = RAILWAY.portalX + 12; x < RAILWAY.exitX - 4; x += mobile ? 24 : 16) {
      const points: Point[] = [[x * direction, .15, STATION.trackZ - 4]];
      for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI; points.push([x * direction, RAILWAY.boreSpring + Math.cos(a) * 5.15, STATION.trackZ + Math.sin(a) * 4]); }
      points.push([x * direction, .15, STATION.trackZ + 4]); ribs.push(tube(points, .07, mobile));
      for (const dz of [-3.94, 3.94]) lamps.push(box(x * direction, 2.8, STATION.trackZ + dz, .8, .09, .07));
    }
    // Raised maintenance ledges and their walls remain outside the train's swept width.
    for (const dz of [-3.22, 3.22]) {
      const ledge = box(direction * (RAILWAY.portalX + RAILWAY.exitX) / 2, .02, STATION.trackZ + dz, RAILWAY.exitX - RAILWAY.portalX, .36, .92);
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
  for (const name of ['ballast', 'sleeper', 'rail'] as const) for (const [suffix, slot] of [['color', 'map'], ['roughness', 'roughnessMap'], ...(!mobile ? [['normal', 'normalMap']] : [])] as const) {
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
