import * as THREE from 'three';
import { clamp, dot, mix, texture, uv, vec3 } from 'three/tsl';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { COURTYARD_STAIRS, MATSU_COURTYARD as C } from './matsu-courtyard-layout';

export interface MatsuCourtyard {
  root: THREE.Group;
  colliders: ColliderSpec[];
  floor: THREE.Mesh;
  roof: THREE.Mesh;
  upperFloor: THREE.Mesh;
  glass: THREE.Mesh[];
  stairRoute: THREE.Vector3[];
}
const noise = (x: number, y: number, z = 0): number => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
const box = (x: number, y: number, z: number, w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function slab(points: number[][], top: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]); for (const [x, z] of points.slice(1)) shape.lineTo(x, z); shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }).rotateX(Math.PI / 2).translate(0, top, 0);
}
function grainTexture(gravel = false): THREE.DataTexture {
  const size = 256, bytes = new Uint8Array(size * size * 4);
  const cloudy = (x: number, y: number, cell: number): number => {
    const px = x / cell, py = y / cell, ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(noise(ix, iy), noise(ix + 1, iy), sx), THREE.MathUtils.lerp(noise(ix, iy + 1), noise(ix + 1, iy + 1), sx), sy);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fine = noise(x, y), broad = cloudy(x, y, 39), value = gravel ? .68 + cloudy(x, y, 5) * .23 + fine * .09 : .91 + broad * .055 + cloudy(x, y, 3) * .02 + fine * .012;
    const i = (y * size + x) * 4; bytes[i] = Math.round(value * 255); bytes[i + 1] = Math.round(value * 254); bytes[i + 2] = Math.round(value * 250); bytes[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
}
/** Rounded, non-planar fieldstone: a softly squared, deformed volume rather than an extruded polygon tile. */
function fieldstone(width: number, height: number, depth: number, seed: number): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, 1), position = source.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), r = 1 + Math.sin(x * 5.1 + seed) * Math.sin(y * 4.7 - seed * .7) * Math.sin(z * 5.9 + seed * .31) * .075;
    const rounded = (v: number): number => Math.sign(v) * Math.pow(Math.abs(v), .69);
    position.setXYZ(i, rounded(x) * r, rounded(y) * r, rounded(z) * r);
  }
  source.deleteAttribute('normal'); source.deleteAttribute('uv'); const geometry = mergeVertices(source); source.dispose(); geometry.computeVertexNormals(); return geometry.scale(width / 2, height / 2, depth / 2);
}
/** Closed exposed-earth volume, with a coarse sloping surface shared by its rendered and physical triangles. */
function earthBank(minX: number, maxX: number, minZ: number, maxZ: number, height: (x: number, z: number) => number): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], nx = 14, nz = 8;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = minX + (maxX - minX) * i / nx, z = minZ + (maxZ - minZ) * j / nz; positions.push(x, height(x, z), z); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
  const rim: number[] = []; for (let i = 0; i <= nx; i++) rim.push(i); for (let j = 1; j <= nz; j++) rim.push(j * (nx + 1) + nx); for (let i = nx - 1; i >= 0; i--) rim.push(nz * (nx + 1) + i); for (let j = nz - 1; j > 0; j--) rim.push(j * (nx + 1));
  for (let i = 0; i < rim.length; i++) { const a = rim[i], b = rim[(i + 1) % rim.length], bottom = positions.length / 3; positions.push(positions[a * 3], .24, positions[a * 3 + 2], positions[b * 3], .24, positions[b * 3 + 2]); indices.push(a, b, bottom, b, bottom + 1, bottom); }
  const bottom = positions.length / 3; positions.push(minX, .24, minZ, maxX, .24, minZ, maxX, .24, maxZ, minX, .24, maxZ); indices.push(bottom, bottom + 1, bottom + 2, bottom, bottom + 2, bottom + 3);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
/** The reference is a contemporary concrete shelter surrounding the exposed old fabric, not a new classical ruin. */
export function createMatsuCourtyard(mobile = false): MatsuCourtyard {
  const root = new THREE.Group(), colliders: ColliderSpec[] = [], batches = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[]; collision: boolean }>(); root.name = 'Matsu courtyard · Stronghold 26 reconstruction';
  root.scale.set(C.planScale, 1, C.planScale);
  const concreteMap = grainTexture(), gravelMap = grainTexture(true);
  const concrete = new THREE.MeshStandardMaterial({ color: '#c6c3ba', roughness: .94, map: concreteMap, bumpMap: concreteMap, bumpScale: .005, vertexColors: true });
  const paving = new THREE.MeshStandardMaterial({ color: '#b5b2a8', roughness: .91, map: concreteMap, bumpMap: concreteMap, bumpScale: .002, vertexColors: true });
  const stone = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .98, vertexColors: true });
  const earth = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: gravelMap, bumpMap: gravelMap, bumpScale: .012, vertexColors: true });
  const silver = new THREE.MeshStandardMaterial({ color: '#b4b9b7', metalness: .78, roughness: .37, vertexColors: true }); silver.userData.heroEnv = true; silver.envMapIntensity = .7;
  const frame = new THREE.MeshStandardMaterial({ color: '#c3c7bf', metalness: .48, roughness: .52, vertexColors: true });
  const grille = new THREE.MeshStandardMaterial({ color: '#26332f', metalness: .5, roughness: .62, vertexColors: true });
  const gravel = new THREE.MeshStandardMaterial({ color: '#b6b3a8', roughness: 1, map: gravelMap, vertexColors: true });
  const copper = new THREE.MeshStandardMaterial({ color: '#a95329', metalness: .42, roughness: .58, vertexColors: true }); copper.userData.heroEnv = true;
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#9baca9', metalness: .12, roughness: mobile ? .22 : .14, transparent: true, opacity: .36, side: THREE.DoubleSide }); glassMaterial.userData.heroEnv = true; glassMaterial.envMapIntensity = .65;

  const prepare = (source: THREE.BufferGeometry, colour: THREE.ColorRepresentation = '#ffffff', variation = 0): THREE.BufferGeometry => {
    const geometry = source.index ? source.toNonIndexed() : source; if (geometry !== source) source.dispose();
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals(); const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), colours: number[] = [], uv: number[] = [], base = new THREE.Color(colour);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), axis = Math.abs(n.getY(i)) > .7 ? 1 : Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? 0 : 2;
      uv.push((axis === 0 ? z : x) / 1.6, (axis === 1 ? z : y) / 1.6);
      const shade = 1 + (noise(Math.floor(x * 5), Math.floor(y * 5), Math.floor(z * 5)) - .5) * variation; colours.push(base.r * shade, base.g * shade, base.b * shade);
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); return geometry;
  };
  const collider = (geometry: THREE.BufferGeometry): void => { const p = geometry.getAttribute('position'); colliders.push({ type: 'mesh', vertices: Float32Array.from(p.array), indices: geometry.index ? Uint32Array.from(geometry.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i) }); };
  const emit = (name: string, material: THREE.Material, geometry: THREE.BufferGeometry, solid = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; mesh.userData.keepGeometry = true; root.add(mesh); if (solid) collider(geometry); return mesh;
  };
  const put = (name: string, material: THREE.Material, geometry: THREE.BufferGeometry, solid = true, colour: THREE.ColorRepresentation = '#ffffff', variation = 0): void => {
    let batch = batches.get(name); if (!batch) { batch = { material, parts: [], collision: solid }; batches.set(name, batch); }
    batch.parts.push(prepare(geometry, colour, variation));
  };
  const beam = (a: THREE.Vector3, b: THREE.Vector3, radius = .024): THREE.BufferGeometry => {
    const delta = b.clone().sub(a); return new THREE.CylinderGeometry(radius, radius, delta.length(), mobile ? 5 : 7).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const metal = (geometry: THREE.BufferGeometry): void => put('Matsu courtyard · stainless rails and shelter steps', silver, geometry);
  const rail = (a: THREE.Vector3, b: THREE.Vector3, crossed = true): void => {
    const length = a.distanceTo(b), count = Math.max(1, Math.ceil(length / 1.05));
    for (const h of [.12, 1.06, 1.16]) metal(beam(a.clone().add(new THREE.Vector3(0, h, 0)), b.clone().add(new THREE.Vector3(0, h, 0)), h === 1.16 ? .034 : .021));
    for (let i = 0; i <= count; i++) { const p = a.clone().lerp(b, i / count); metal(beam(p, p.clone().add(new THREE.Vector3(0, 1.17, 0)), .035)); }
    if (crossed) for (let i = 0; i < count; i++) {
      const p = a.clone().lerp(b, i / count), q = a.clone().lerp(b, (i + 1) / count);
      metal(beam(p.clone().add(new THREE.Vector3(0, .17, 0)), q.clone().add(new THREE.Vector3(0, 1.02, 0)), .018)); metal(beam(p.clone().add(new THREE.Vector3(0, 1.02, 0)), q.clone().add(new THREE.Vector3(0, .17, 0)), .018));
    }
  };

  // The two notches remove coplanar overlap with the first and last stair treads.
  const floor = emit('Matsu courtyard · lower floor', paving, prepare(slab([[-5.6, -4.5], [5.6, -4.5], [5.6, 5.25], [6.1, 5.25], [6.1, 7.1], [4.3, 7.1], [4.3, 7.4], [2.8, 7.4], [2.8, 5.5], [-5.6, 5.5]], C.floorY, .25)));
  const upperFloor = emit('Matsu courtyard · upper stone terrace', paving, prepare(slab([[5.7, -.3], [9.5, -.3], [9.5, 7.5], [8.9, 7.5], [8.9, 7.1], [7.1, 7.1], [7.1, 7.5], [5.7, 7.5]], C.upperFloorY, .22)));
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(-5.83, 1.48, -.5, .36, 2.96, 10), true, '#ffffff', .04);
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(-5.83, 1.98, 5.4, .36, 3.96, 1.8), true, '#ffffff', .04);
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(0, 1.46, -4.91, 11.6, 2.92, .32), true, '#ffffff', .04);
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(6.02, 1.87, 3.7, .30, 3.74, 8), true, '#c9c6ba', .05);
  for (const z of [-4.7, -2.45, -.15, 2.2, 4.1]) put('Matsu courtyard · cast concrete walls and beams', concrete, box(4.98, 1.84, z, .22, 3.18, .22));
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(-5.45, 3.27, -.5, .2, .28, 10));
  put('Matsu courtyard · cast concrete walls and beams', concrete, box(0, 3.3, -4.55, 11.2, .26, .24));
  for (let i = 0; i < 14; i++) {
    const x = -6 + i * .87;
    put('Matsu courtyard · cast concrete walls and beams', concrete, box(x, 3.30, -.5, .17, .26, 9.75), true, '#bcb6a9', .065);
    put('Matsu courtyard · cast concrete walls and beams', concrete, box(x, 3.10, -4.91, .14, .36, .21), true, '#deddd4', .04);
  }
  for (let i = 0; i < 10; i++) put('Matsu courtyard · cast concrete walls and beams', concrete, box(-5.83, 3.13, -4.9 + i * .98, .2, .34, .14), true, '#deddd4');
  const roofParts = [box(-.35, 3.54, -.55, 12.1, .22, 10.1), box(-.35, 3.71, -5.52, 12.1, .18, .16), box(-6.32, 3.71, -.55, .16, .18, 10.1), box(5.62, 3.71, -.55, .16, .18, 10.1), box(-.35, 3.71, 4.42, 12.1, .18, .16)];
  const roof = emit('Matsu courtyard · gravel roof and concrete fascia', concrete, mergeGeometries(roofParts.map(g => prepare(g)))!);
  put('Matsu courtyard · roof gravel', gravel, box(-.35, 3.69, -.55, 11.8, .08, 9.77), true, '#ffffff', .08);
  const pebbleCount = mobile ? 100 : 240;
  for (let i = 0; i < pebbleCount; i++) {
    const x = -6.13 + noise(i, 1) * 11.5, z = -5.3 + noise(i, 2) * 9.3, radius = .018 + noise(i, 3) * .032;
    if (x > -3 && x < 2.3 && z > -3.5 && z < -2.3) continue;
    put('Matsu courtyard · roof gravel', gravel, new THREE.IcosahedronGeometry(radius, 0).scale(1.4, .5, 1).translate(x, 3.735 + radius * .25, z), true, new THREE.Color().setHSL(.1, .04, .53 + noise(i, 4) * .24), .05);
  }

  // Black mullions and one real open doorway, with glass collision only in the rendered panels.
  const panes: THREE.BufferGeometry[] = [], x = 4.82, frameName = 'Matsu courtyard · pale glazed wall frames', bays = [-4.5, -3.5, -2.5, -1.5, -.5, .3, 1.7, 2.5, 3.5, 4.2];
  for (const z of bays) put(frameName, frame, box(x, 1.82, z, .075, 3.14, .065));
  // The compact court retains a 0.93 m clear doorway, rather than shrinking a one-metre bay below walking width.
  for (const y of [2.58, 3.34]) put(frameName, frame, box(x, y, -.15, .09, .07, 8.7));
  for (let i = 0; i < bays.length - 1; i++) {
    const from = bays[i] + .04, to = bays[i + 1] - .04, z = (from + to) / 2;
    if (i !== 5) {
      panes.push(prepare(box(x, 1.425, z, .018, 2.22, to - from)));
      for (const part of [1 / 3, 2 / 3]) put('Matsu courtyard · dark window grilles', grille, box(x - .055, 1.43, from + (to - from) * part, .027, 2.18, .025));
      for (const y of [.46, 1.88, 2.38]) put('Matsu courtyard · dark window grilles', grille, box(x - .055, y, z, .027, .025, to - from));
    }
    panes.push(prepare(box(x, 2.96, z, .018, .65, to - from)));
  }
  // Split the low sill around that same opening, leaving a level threshold.
  put(frameName, frame, box(x, .29, -2.1, .09, .07, 4.8)); put(frameName, frame, box(x, .29, 2.95, .09, .07, 2.5));
  const glassMesh = emit('Matsu courtyard · separate glazing panes', glassMaterial, mergeGeometries(panes)!); panes.forEach(g => g.dispose()); glassMesh.castShadow = false;

  // Irregular warm fieldstones sit in a continuous mortar retaining wall, with a level coping and lookout above it.
  put('Matsu courtyard · fieldstone retaining wall and rubble', stone, box(5.93, 1.86, 3.5, .35, 3.47, 8), true, '#756f60', .06);
  const warmStone = ['#9a896d', '#a58a64', '#a79477', '#827c6f', '#b09c7c', '#777a70', '#b8a88d', '#8c8676', '#9d8e75'];
  for (let row = 0; row < 9; row++) {
    const y = .48 + row * .365; let z = -.47 - (row % 2) * .24, i = 0;
    while (z < 7.4) {
      const seed = row * 41 + i++, width = Math.min(.43 + noise(seed, 24) * .63, 7.55 - z), h = .39 + noise(seed, 25) * .14;
      const centreZ = z + width / 2, doorwayAlcove = centreZ + width * .6 > .2 && centreZ - width * .6 < 1.8;
      const faceX = doorwayAlcove ? 5.95 : 5.72;
      const geometry = fieldstone(.30 + noise(seed, 26) * .10, h, width + .07, seed).rotateX((noise(seed, 27) - .5) * .44).translate(faceX - noise(seed, 28) * .035, y + (noise(seed, 29) - .5) * .1, centreZ);
      put('Matsu courtyard · fieldstone retaining wall and rubble', stone, geometry, true, warmStone[Math.floor(noise(seed, 30) * warmStone.length)], .12); z += width - .015;
    }
  }
  put('Matsu courtyard · fieldstone retaining wall and rubble', stone, box(5.89, 3.57, 3.4, .62, .16, 8.25), true, '#b5a17a', .08);
  rail(new THREE.Vector3(5.7, 3.65, -.4), new THREE.Vector3(5.7, 3.65, 7.5));
  rail(new THREE.Vector3(5.7, 3.65, -.4), new THREE.Vector3(9.5, 3.65, -.4));
  rail(new THREE.Vector3(9.5, 3.6, -.4), new THREE.Vector3(9.5, 3.6, 7.5));
  rail(new THREE.Vector3(5.7, 3.6, 7.5), new THREE.Vector3(7.1, 3.6, 7.5)); rail(new THREE.Vector3(8.9, 3.6, 7.5), new THREE.Vector3(9.5, 3.6, 7.5));

  // Recessed archaeological fabric: a rough old chamber and an exposed soil edge, below the new shelter.
  const ruin = 'Matsu courtyard · exposed old shelter stone';
  const soilName = 'Matsu courtyard · excavation earth', concreteName = 'Matsu courtyard · cast concrete walls and beams';
  // The site photographs show two small chambers cut into a continuous soil bank, with a worn plaster pier between them.
  const crest = (px: number, pz: number): number => 2.25 + Math.sin(px * 1.4 + pz) * .08 + Math.sin(px * 5.1 - pz * 2) * .035;
  const frontBank = (px: number, pz: number): number => .30 + Math.pow(Math.max(0, Math.min(1, (-.08 - pz) / 1.44)), .65) * .39 + Math.sin(px * 4.3 + pz * 2) * .025;
  put(soilName, earth, earthBank(-5.25, -.44, -4.43, -3.28, crest), true, '#8d714b', .16);
  put(soilName, earth, earthBank(-5.3, -4.6, -3.8, -1.35, (px, pz) => .49 + Math.max(0, Math.min(1, (-1.35 - pz) / 2.1)) * 1.55 + Math.sin(px * 7 + pz) * .04), true, '#92754d', .18);
  put(soilName, earth, earthBank(-5.28, -1.3, -1.52, -.08, frontBank), true, '#92754d', .18);
  put(concreteName, concrete, slab([[-4.62, -3.24], [-.4, -3.24], [-.4, -1.37], [-1.3, -1.37], [-1.3, -1.55], [-4.62, -1.55]], .70, .45), true, '#c6c1b4', .055);
  // Only the back of the left opening is dark: the opening itself is a genuine recess, not a black face over solid masonry.
  put('Matsu courtyard · dark window grilles', grille, box(-3.94, 1.46, -3.28, 1.18, 1.52, .045));
  put(soilName, earth, box(-1.73, 1.49, -2.94, .73, 1.57, .05), true, '#33533b', .16);
  put('Matsu courtyard · dark window grilles', grille, box(-1.73, 2.28, -2.90, .8, .09, .11));
  put(concreteName, concrete, box(-2.65, 1.49, -2.94, 1.03, 1.58, .52), true, '#c6c2b7', .16);
  // Uneven remnants of plaster expose the older brown substrate instead of a pristine white block.
  for (let i = 0; i < 31; i++) {
    const px = -3.13 + noise(i, 80) * .95, py = .78 + noise(i, 81) * 1.42, w = .035 + noise(i, 82) * .14, h = .07 + noise(i, 83) * .22;
    put(ruin, stone, fieldstone(w, h, .018, i + 300).translate(px, py, -2.671), true, i % 3 === 0 ? '#76776e' : '#9c8662', .14);
  }
  const oldStone = (px: number, py: number, pz: number, width: number, height: number, depth: number, seed: number): void => put(ruin, stone, fieldstone(width, height, depth, seed).rotateZ((noise(seed, 60) - .5) * .32).translate(px, py, pz), true, warmStone[Math.floor(noise(seed, 61) * warmStone.length)], .13);
  const wallPiers = [[-5.15, -4.55], [-3.35, -3.10], [-1.34, -.55]];
  for (let segment = 0; segment < wallPiers.length; segment++) {
    const [from, to] = wallPiers[segment];
    for (let row = 0; row < 7; row++) {
      let px = from; let i = 0;
      while (px < to) { const seed = segment * 200 + row * 19 + i++, w = Math.min(.22 + noise(seed, 62) * .23, to - px + .06); oldStone(px + w / 2, .81 + row * .225, -2.93 + noise(seed, 63) * .035, w + .05, .26 + noise(seed, 64) * .05, .58 + noise(seed, 65) * .09, seed); px += w; }
    }
  }
  for (const [px, w] of [[-3.94, 1.42], [-1.73, .97]]) oldStone(px, 2.38, -2.94, w, .18, .68, Math.round(px * 103));
  for (let i = 0; i < 40; i++) {
    const px = -5.1 + noise(i, 40) * 4.45, pz = -4.25 + noise(i, 41) * .94, r = .09 + noise(i, 42) * .18;
    oldStone(px, crest(px, pz) + r * .3, pz, r * 2, r, r * 1.6, 500 + i);
  }
  for (let i = 0; i < 64; i++) {
    const px = -5.15 + noise(i, 50) * 3.75, pz = -1.48 + noise(i, 51) * 1.3, r = .02 + noise(i, 52) * .075;
    oldStone(px, frontBank(px, pz) + r * .22, pz, r * 1.9, r * .85, r * 1.5, 600 + i);
  }
  // Narrow floor drains, visible in the site photos, mark the earth and glazing edges without raising the walking threshold.
  metal(box(-3.25, .256, -.02, 4.0, .009, .045)); metal(box(4.47, .256, -.1, .045, .009, 8.8));
  for (let i = 0; i < 3; i++) metal(box(-.95, .25 + (i + 1) * .15 - .035, -.65 - i * .28, .9, .07, .3));
  for (const side of [-1, 1]) metal(beam(new THREE.Vector3(-.95 + side * .38, .21, -.50), new THREE.Vector3(-.95 + side * .38, .63, -1.34), .023));

  put('Matsu courtyard · excavation earth', earth, slab([[9.6, 3.0], [10.2, 2.6], [11.7, 3.0], [12.2, 4.5], [11.9, 8.6], [10.6, 9.2], [9.6, 8.6]], 3.45, 5.95), true, '#987c4e', .12);
  for (let i = 0; i < 22; i++) {
    const px = 9.9 + noise(i, 70) * 1.8, pz = 3 + noise(i, 71) * 5.7, radius = .2 + noise(i, 72) * .32;
    put('Matsu courtyard · fieldstone retaining wall and rubble', stone, new THREE.IcosahedronGeometry(radius, 0).scale(1.7, .65, 1.15).rotateY(noise(i, 73) * 6).translate(px, 3.43 + radius * .38, pz), true, new THREE.Color().setHSL(.09, .25, .42 + noise(i, 74) * .15), .12);
  }
  for (let i = 0; i < 12; i++) {
    const px = 9.8 + noise(i, 80) * 1.75, pz = 3.2 + noise(i, 81) * 5.4, top = 3.70 + noise(i, 82) * .18;
    put('Matsu courtyard · fieldstone retaining wall and rubble', stone, beam(new THREE.Vector3(px, 3.43, pz), new THREE.Vector3(px + .025, top, pz), .009), true, '#727c2c');
    for (let leaf = 0; leaf < 3; leaf++) put('Matsu courtyard · fieldstone retaining wall and rubble', stone, new THREE.PlaneGeometry(.055, .22).rotateX(.6).rotateY(leaf * 2.3 + i).translate(px, 3.57 + leaf * .045, pz), true, '#6c792e');
    for (let petal = 0; petal < 5; petal++) { const a = petal * Math.PI * 2 / 5; put('Matsu courtyard · fieldstone retaining wall and rubble', stone, new THREE.IcosahedronGeometry(.022, 0).scale(1.4, .4, 1).translate(px + Math.cos(a) * .024, top, pz + Math.sin(a) * .024), true, '#d0b547'); }
  }

  // Twenty shallow risers fit the image's compact descending approach while retaining a full-width walking route.
  const rise = (C.upperFloorY - C.floorY) / 20, mid = C.upperFloorY - rise * 10;
  for (let i = 0; i < 10; i++) {
    const aTop = C.upperFloorY - rise * (i + 1), bTop = mid - rise * (i + 1);
    put('Matsu courtyard · approach stairs', paving, box(8, aTop / 2 - .025, 7.1 + (i + .5) * .34, 1.8, aTop + .05, .34));
    put('Matsu courtyard · approach stairs', paving, box(5.2, bTop / 2 - .025, 10.5 - (i + .5) * .34, 1.8, bTop + .05, .34));
  }
  put('Matsu courtyard · approach stairs', paving, box(6.6, mid / 2 - .025, 11.05, 4.6, mid + .05, 1.1));
  for (const side of [-.9, .9]) {
    rail(new THREE.Vector3(8 + side, C.upperFloorY, 7.1), new THREE.Vector3(8 + side, mid, 10.5), false);
    rail(new THREE.Vector3(5.2 + side, mid, 10.5), new THREE.Vector3(5.2 + side, C.floorY, 7.1), false);
  }
  rail(new THREE.Vector3(4.3, mid, 11.6), new THREE.Vector3(8.9, mid, 11.6), false);
  rail(new THREE.Vector3(4.3, mid, 10.5), new THREE.Vector3(4.3, mid, 11.6), false); rail(new THREE.Vector3(8.9, mid, 10.5), new THREE.Vector3(8.9, mid, 11.6), false);

  // The narrow orange roof form is reproduced as visible architecture, without assigning an unsupported title or artist.
  const boat = new THREE.Shape(); boat.moveTo(-3.4, -.38); boat.lineTo(2.95, -.38); boat.lineTo(3.36, .37); boat.lineTo(-3.65, .37); boat.closePath();
  const hole = new THREE.Path(); hole.moveTo(-3.18, -.22); hole.lineTo(-3.41, .2); hole.lineTo(2.98, .2); hole.lineTo(2.75, -.22); hole.closePath(); boat.holes.push(hole);
  put('Matsu courtyard · angular orange roof object', copper, new THREE.ExtrudeGeometry(boat, { depth: .17, bevelEnabled: false }).rotateX(Math.PI / 2).translate(-.4, 3.93, -2.95));
  put('Matsu courtyard · angular orange roof object', copper, box(-.4, 3.775, -2.95, 5.8, .035, .36));

  for (const [name, batch] of batches) {
    const geometry = mergeGeometries(batch.parts)!; batch.parts.forEach(part => part.dispose()); emit(name, batch.material, geometry, batch.collision);
  }
  root.updateMatrixWorld(true);
  return { root, colliders, floor, roof, upperFloor, glass: [glassMesh], stairRoute: COURTYARD_STAIRS.map(p => new THREE.Vector3(p.x, p.y, p.z)) };
}

/**
 * The existing CC0 Poly Haven Rock Face 03 scan, attributed in textures/mountains/ATTRIBUTION.md.
 * Keep its subtle mineral grain, with the warm fieldstone colours carried by the vertices.
 * One boxed-UV albedo sample on every tier; the rounded geometry supplies relief without the scan's large seam patterns.
 * Loading stays outside the DOM-independent architecture factory and never changes its geometry or collision.
 */
export async function loadMatsuCourtyardTextures(root: THREE.Object3D, mobile = false): Promise<void> {
  const names = new Set(['Matsu courtyard · fieldstone retaining wall and rubble', 'Matsu courtyard · exposed old shelter stone']);
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh && names.has(object.name)) meshes.push(object); });
  if (!meshes.length) return;
  const loader = new THREE.TextureLoader(), base = import.meta.env.BASE_URL + 'textures/mountains/';
  const load = (file: string, colour: boolean): Promise<THREE.Texture | null> => loader.loadAsync(base + file).then(map => {
    if (colour) map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 4; return map;
  }).catch(() => null);
  const albedo = await load('rock-color.jpg', true);
  if (!albedo) return;
  const material = new THREE.MeshStandardNodeMaterial({ color: '#ffffff', vertexColors: true, roughness: .97, map: grainTexture(true) });
  material.name = 'Matsu courtyard · weathered warm fieldstone';
  // Re-centre the scan's mean linear luma (.16) so the brown scan does not overwrite or darken the authored palette.
  const mineral = dot(texture(albedo, uv()).rgb, vec3(.2126, .7152, .0722)).div(.16);
  const variation = mix(1, clamp(mineral.pow(.8), .38, 1.7), .42);
  material.colorNode = vec3(variation);
  material.userData.courtyardRock = true;
  for (const mesh of meshes) mesh.material = material;
}
