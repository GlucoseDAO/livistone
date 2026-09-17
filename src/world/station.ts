import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { STATION } from './station-layout';
import { stationRingGeometry, stationRingAnchor } from './station-ring';
import { stationAmberGeometry, stationAmberMaterial, stationAmberPoint, stationAmberSoffit } from './station-amber';

const TAU = Math.PI * 2;
type Point = [number, number, number];
function tube(points: Point[], radius: number, mobile: boolean, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, Math.max(16, points.length * (mobile ? 3 : 6)), radius, mobile ? 6 : 10, closed);
}
function add(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material); object.name = name; object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function solid(colliders: ColliderSpec[], geometry: THREE.BufferGeometry): void {
  colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i) });
}
function box(x: number, y: number, z: number, width: number, height: number, depth: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(normalized)!; normalized.forEach((part) => part.dispose()); parts.forEach((part) => part.dispose()); return geometry;
}

function castProng(points: Point[], mobile: boolean): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, mobile ? 72 : 144, .51, mobile ? 10 : 18, false);
  // A continuous rounded section catches reflections all the way around the cast silver.
  return geometry;
}

function createFoyer(station: THREE.Group, colliders: ColliderSpec[], mobile: boolean, silver: THREE.Material, brass: THREE.Material): void {
  const structure: THREE.BufferGeometry[] = [], panes: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  const r = 6.58, cy = 6.45, z = -62.15, x = STATION.entranceX;
  const arch = (depth: number, radius = r): THREE.BufferGeometry => tube(Array.from({ length: 61 }, (_, i) => { const a = -.5 * Math.PI + i / 60 * Math.PI; return [x + Math.sin(a) * radius, cy + Math.cos(a) * radius, depth] as Point; }), .085, mobile);
  structure.push(arch(z), arch(-65.5)); lights.push(arch(-61.4, 6.72));
  const panel = (left: number, right: number, bottomLeft: number, bottomRight: number, topLeft: number, topRight: number, depth: number): void => {
    if (Math.min(topLeft, topRight) <= Math.max(bottomLeft, bottomRight)) return;
    const shape = new THREE.Shape(); shape.moveTo(left, bottomLeft); shape.lineTo(right, bottomRight); shape.lineTo(right, topRight); shape.lineTo(left, topLeft); shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape).translate(0, 0, depth); panes.push(geometry); solid(colliders, geometry);
  };
  // Real glazing encloses the portal; the central ground-level bay is deliberately open.
  for (let i = 0; i < 12; i++) {
    const a = -r + i / 12 * r * 2, b = -r + (i + 1) / 12 * r * 2;
    const topA = cy + Math.sqrt(Math.max(0, r * r - a * a)), topB = cy + Math.sqrt(Math.max(0, r * r - b * b));
    const lowA = Math.max(.18, cy - Math.sqrt(Math.max(0, r * r - a * a))), lowB = Math.max(.18, cy - Math.sqrt(Math.max(0, r * r - b * b)));
    const doorway = a >= -2.2 && b <= 2.2;
    panel(x + a, x + b, doorway ? 3.5 : lowA, doorway ? 3.5 : lowB, topA, topB, z);
    if (i > 0 && Math.abs(a) > 2.2) structure.push(box(x + a, (topA + lowA) / 2, z + .03, .075, topA - lowA, .1));
    else if (i > 0) structure.push(box(x + a, (topA + 3.5) / 2, z + .03, .075, topA - 3.5, .1));
  }
  for (const y of [3.5, 5.1, 9.2]) {
    const half = Math.sqrt(r * r - (y - cy) ** 2); structure.push(box(x, y, z, half * 2, .09, .12));
  }
  for (const dx of [-2.2, 2.2]) structure.push(box(x + dx, 1.85, z, .1, 3.34, .14));
  for (const dx of [-5.1, 5.1]) structure.push(box(x + dx, 2.75, -64.4, .16, 5.15, .2));
  // A shallow clerestory gallery adds depth through the ring without blocking the concourse.
  for (const dx of [-4.45, 4.45]) {
    const balcony = box(x + dx, 5, -64.5, 3.2, .2, 3.5); structure.push(balcony); solid(colliders, balcony);
    structure.push(box(x + dx, 6.05, -63, 3.2, .05, .05));
    for (let i = -2; i <= 2; i++) structure.push(box(x + dx + i * .65, 5.55, -63, .035, 1, .035));
    lights.push(box(x + dx, 4.85, -63.05, 3, .025, .08));
  }
  for (const left of [-5.7, -2.1, 1.5, 8.7, 12.3, 15.9, 23.1]) {
    const right = Math.min(26.5, left + 3.4), depth = -62.1;
    panel(left, right, .2, .2, 5.6, 5.6, depth);
    structure.push(box(left, 2.9, depth, .1, 5.45, .15), box((left + right) / 2, 5.6, depth, right - left, .15, .2));
    lights.push(box((left + right) / 2, 5.42, depth + .04, right - left - .2, .035, .08));
  }
  const columns = merge(structure); add(station, columns, brass, 'Glazed entrance hall frames'); solid(colliders, columns);
  const glass = add(station, merge(panes), new THREE.MeshStandardMaterial({ color: '#ebd7a3', metalness: .15, roughness: .12, envMapIntensity: 1.6, transparent: true, opacity: mobile ? .12 : .18, side: THREE.DoubleSide, depthWrite: false }), 'Entrance hall glazing'); glass.castShadow = false;
  add(station, merge(lights), new THREE.MeshBasicMaterial({ color: '#ffdd8e' }), 'Warm entrance and concourse lighting');
  for (const [lx, lz] of [[-16, -64], ...(mobile ? [] : [[6, -68]])]) { const glow = new THREE.PointLight('#ffc86c', 16, 18, 1.3); glow.position.set(lx, 4.2, lz); station.add(glow); }
  // Solid jambs connect the pierced shank to the sheltered foyer behind it.
  const jambs: THREE.BufferGeometry[] = [];
  for (const a of [-1.12, -.68, 0, .68, 1.12]) {
    const px = x + Math.sin(a) * 6.8, py = cy + Math.cos(a) * 6.8;
    jambs.push(tube([[px, py, -60.6], [px, py, -63], [px, py - .15, -65.3]], .13, mobile));
  }
  add(station, merge(jambs), silver, 'Ring foyer vault');
}

function cabWindow(end: number): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 12; i++) {
    const x = 21.1 + j / 8 * 3.25, t = (x - 21) / 3.5, scale = 1 - t * .27, center = 2.02 - t * .37, z = (i / 12 - .5) * 1.95 * scale;
    const sine = Math.pow(Math.abs(z / (1.38 * scale)), 1 / .68), cosine = Math.sqrt(1 - sine * sine);
    positions.push(STATION.x + x * end, center + 1.52 * scale * Math.pow(cosine, .78) + .035, STATION.trackZ + z);
    if (i < 12 && j < 8) { const n = j * 13 + i; indices.push(n, n + 13, n + 1, n + 1, n + 13, n + 14); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function trainBody(): THREE.BufferGeometry {
  const sections = [[-27, .03, 1.0], [-26, .38, 1.25], [-24.5, .73, 1.65], [-21, 1, 2.02], [-18, 1, 2.02], [18, 1, 2.02], [21, 1, 2.02], [24.5, .73, 1.65], [26, .38, 1.25], [27, .03, 1.0]];
  const p: number[] = [], uv: number[] = [], ix: number[] = [], sides = 24;
  sections.forEach(([x, scale, y], j) => {
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * TAU, s = Math.sin(a), c = Math.cos(a);
      p.push(STATION.x + x, y + Math.sign(c) * Math.pow(Math.abs(c), .78) * 1.52 * scale, STATION.trackZ + Math.sign(s) * Math.pow(Math.abs(s), .68) * 1.38 * scale); uv.push(j / (sections.length - 1), i / sides);
      if (j < sections.length - 1 && i < sides) { const n = j * (sides + 1) + i; ix.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1); }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals(); return g;
}

export function createStationStructure(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): THREE.Group {
  const station = new THREE.Group(); station.name = 'Embryo Station'; root.add(station);
  const silver = new THREE.MeshStandardMaterial({ color: '#eee7db', metalness: .82, roughness: .23, envMapIntensity: 1.6 });
  const white = new THREE.MeshStandardMaterial({ color: '#ede9dc', metalness: .18, roughness: .43 });
  const dark = new THREE.MeshStandardMaterial({ color: '#17302f', metalness: .45, roughness: .24 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b28d42', metalness: .65, roughness: .3 });
  const amber = stationAmberMaterial(mobile), roof = stationAmberGeometry(mobile);
  const stone = add(station, roof, amber, 'Sculpted amber body'); stone.castShadow = false; solid(colliders, roof);
  // A recessed resin core gives the transparent surface depth and warm internal reflections.
  if (!mobile) {
    const core = add(station, stationAmberGeometry(true, .14), new THREE.MeshStandardMaterial({ color: '#fff3ad', map: amber.map, bumpMap: amber.bumpMap, bumpScale: .3, roughness: .28, emissive: '#ffda3d', emissiveMap: amber.map, emissiveIntensity: .2 }), 'Amber resin core'); core.castShadow = false;
  }
  const floor = box(STATION.x, .015, -68.1, 58, .33, 16.2);
  const floorUV = floor.getAttribute('uv'), floorPosition = floor.getAttribute('position');
  for (let i = 0; i < floorUV.count; i++) floorUV.setXY(i, floorPosition.getX(i) / 4, floorPosition.getZ(i) / 4);
  add(station, floor, paving, 'Concourse and platform'); colliders.push({ type: 'box', position: [STATION.x, .015, -68.1], size: [29, .165, 8.1] });

  const frame: THREE.BufferGeometry[] = [], supports: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [];
  frame.push(stationRingGeometry(mobile));
  const clasp = (x: number, angle: number): Point => { const point = stationAmberPoint(x, angle); point.z += .15; return point.toArray() as Point; };
  const prongs: Point[][] = [
    [stationRingAnchor(-.84), [-23.5, 17.4, -58.6], [-22.1, 21.5, -61.5], [-20.9, 22, -62.3], [-19.8, 19.5, -61.5], [-18.5, 15, -60.4], clasp(-18.2, 1.42)],
    [stationRingAnchor(.59), [-7.7, 16.8, -58.6], [-.8, 18.8, -59.4], [.5, 18.2, -59.5], [-2.2, 13.6, -59.3], [-6.5, 9.9, -60.2], stationRingAnchor(.8, 1.1)],
    [stationRingAnchor(-1.88, 1.4), [-29.6, 8.1, -65.2], [-30, 15.1, -69.5], [-27, 19.4, -71], clasp(-23.5, -.65)],
    [stationRingAnchor(1.84), [-5, 4.9, -59.3], [5.2, 6.8, -58.8], [6.4, 10.1, -59.4], [3.2, 12.1, -59.3], clasp(-2.5, 1.35)],
  ];
  for (const points of prongs) { frame.push(castProng(points, mobile)); const end = points.at(-1)!; frame.push(new THREE.SphereGeometry(.51, 16, 10).translate(...end)); }
  frame.push(castProng([[-23.2, 16.7, -58.9], [-20.7, 16, -58.1], [-16.2, 16.8, -58.8], [-15, 17.2, -62.2]], mobile));
  // The lower clasp retains the photographed wire's wound attachment to the shank.
  for (const dx of [0, .38, .76]) frame.push(new THREE.TorusGeometry(.68, .16, 8, 32).rotateY(Math.PI / 2).translate(-7.5 + dx, 4.85, -60.1));
  for (const [x, z] of [[-28, -68], [-5, -67], [12, -68], [24, -69], [-22, -74.8], [2, -74.8], [23, -74.8]]) {
    const left = Math.max(-30, x - 3), right = Math.min(26, x + 2.8);
    supports.push(tube([[x, .18, z], [x, 3.6, z], [x - .7, 5, z], stationAmberSoffit(left, z - .4).toArray() as Point], .21, mobile));
    supports.push(tube([[x, 3.2, z], [x + .7, 4.8, z], stationAmberSoffit(right, z + .5).toArray() as Point], .15, mobile));
  }
  const mergedFrame = merge(frame), silverGeometry = mergeVertices(mergedFrame), supportGeometry = merge(supports); mergedFrame.dispose(); silverGeometry.computeVertexNormals();
  const silverwork = add(station, silverGeometry, silver, 'Pierced ring and clasping silver prongs');
  silverwork.receiveShadow = false; solid(colliders, silverGeometry);
  add(station, supportGeometry, white, 'Branching platform columns'); solid(colliders, supportGeometry);
  createFoyer(station, colliders, mobile, silver, brass);

  const matrix = new THREE.Matrix4();

  // A continuous platform screen keeps the walking capsule away from the train and track.
  const rails: THREE.BufferGeometry[] = [], screens: THREE.BufferGeometry[] = [];
  for (const z of [STATION.back, STATION.trackZ - 3]) {
    rails.push(box(0, 1.26, z, 214, .07, .07));
    for (let x = -105; x <= 105; x += 3) {
      rails.push(box(x, .72, z, .07, 1.15, .07));
      if (x >= -30 && x < 27) screens.push(box(x + 1.5, .77, z, 2.9, .92, .025));
    }
    colliders.push({ type: 'box', position: [0, .72, z], size: [107, .6, .08] });
  }
  add(station, merge(rails), silver, 'Track and platform railings');
  add(station, merge(screens), new THREE.MeshStandardMaterial({ color: '#bbd6cc', roughness: .13, metalness: .22, transparent: true, opacity: .2, depthWrite: false }), 'Platform safety glass');
  trim.push(box(STATION.x, .186, STATION.back + .58, 57.5, .012, .17));
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 3), brass, 360);
  for (let i = 0; i < dots.count; i++) dots.setMatrixAt(i, matrix.makeTranslation(-30 + (i % 180) * .32, .2, STATION.back + .85 + Math.floor(i / 180) * .16));
  dots.name = 'Platform tactile edge'; dots.computeBoundingSphere(); station.add(dots);

  const train = trainBody(); add(station, train, white, 'Ultra-fast passenger train'); solid(colliders, train);
  const windows: THREE.BufferGeometry[] = [], fittings: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let x = -19; x < 19; x += 2.3) {
      const shape = new THREE.Shape(); shape.moveTo(-.73, -.32); shape.lineTo(.73, -.32); shape.quadraticCurveTo(.83, -.32, .83, -.22); shape.lineTo(.83, .22); shape.quadraticCurveTo(.83, .32, .73, .32); shape.lineTo(-.73, .32); shape.quadraticCurveTo(-.83, .32, -.83, .22); shape.lineTo(-.83, -.22); shape.quadraticCurveTo(-.83, -.32, -.73, -.32);
      const g = new THREE.ShapeGeometry(shape); if (side < 0) g.rotateY(Math.PI); g.translate(STATION.x + x, 2.55, STATION.trackZ + side * 1.405); windows.push(g);
    }
    for (const x of [-16, -4, 8, 17]) {
      fittings.push(box(STATION.x + x, 1.85, STATION.trackZ + side * 1.39, .035, 2.2, .015));
      fittings.push(box(STATION.x + x + 1.15, 1.85, STATION.trackZ + side * 1.39, .035, 2.2, .015));
    }
    trim.push(box(STATION.x, 1.05, STATION.trackZ + side * 1.22, 41.5, .12, .04));
  }
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) lights.push(new THREE.SphereGeometry(1, 8, 6).scale(.2, .08, .2).translate(STATION.x + end * 25.2, 1.48, STATION.trackZ + side * .46));
  }
  for (const x of [-8.8, 5.6]) {
    const seam = new THREE.TorusGeometry(1, .035, 5, 28); seam.rotateY(Math.PI / 2); seam.scale(1, 1.51, 1.38); seam.translate(STATION.x + x, 2.02, STATION.trackZ); fittings.push(seam);
  }
  for (const x of [-18, -15.5, -6, -3.5, 6, 8.5, 17, 19.5]) {
    fittings.push(box(STATION.x + x, .66, STATION.trackZ, 1.4, .33, 1.7));
    for (const side of [-1, 1]) fittings.push(new THREE.CylinderGeometry(.24, .24, .16, 12).rotateX(Math.PI / 2).translate(STATION.x + x, .5, STATION.trackZ + side * .86));
  }
  add(station, merge(windows), dark, 'Train passenger windows'); add(station, merge(fittings), dark, 'Train cab and door seams'); add(station, merge(lights), new THREE.MeshBasicMaterial({ color: '#fff6d4' }), 'Train headlights');
  add(station, merge([cabWindow(-1), cabWindow(1)]), new THREE.MeshStandardMaterial({ color: '#142c30', metalness: .6, roughness: .19, side: THREE.DoubleSide }), 'Curved cab windshields');

  const benches: THREE.BufferGeometry[] = [];
  for (const x of [-25, 5, 19]) {
    benches.push(box(x, .64, -70.2, 3, .16, .65), box(x, 1.12, -70.48, 3, .65, .12));
    for (const dx of [-1.05, 1.05]) trim.push(box(x + dx, .4, -70.2, .1, .48, .5));
    colliders.push({ type: 'box', position: [x, .81, -70.3], size: [1.5, .65, .42] });
  }
  add(station, merge(benches), new THREE.MeshStandardMaterial({ color: '#ad8051', roughness: .74 }), 'Waiting benches');
  add(station, merge(trim), brass, 'Brass platform and train details');
  return station;
}

export function createStation(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): { object: THREE.Object3D; position: THREE.Vector3 } {
  const station = createStationStructure(root, colliders, mobile, paving);
  const white = new THREE.MeshStandardMaterial({ color: '#ede9dc', roughness: .43 }), silver = new THREE.MeshStandardMaterial({ color: '#e1e8e8', metalness: .86, roughness: .21 });
  // Signs are world-space surfaces; the ordinary discovery input remains the only interaction.
  const sign = (width: number, height: number, title: string, subtitle: string): THREE.Mesh => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#233a35'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#bca467'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    ctx.fillStyle = '#f5e9c9'; ctx.textAlign = 'center'; ctx.font = '500 88px Georgia'; ctx.fillText(title, 512, canvas.height * .5);
    ctx.font = '30px sans-serif'; ctx.fillText(subtitle, 512, canvas.height * .77);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return add(station, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: .8, side: THREE.DoubleSide, emissive: '#d4c69a', emissiveMap: map, emissiveIntensity: .25 }), title);
  };
  const entrance = sign(5.4, 1.3, 'EMBRYO', 'LIVISTONE  /  RAILWAY STATION'); entrance.position.set(-16, 4.25, -61.85);
  const platform = sign(5.2, 1.3, '01  /  NEW HORIZONS', 'ULTRA-FAST RAIL  ·  LIVISTONE'); platform.position.set(6, 3.8, -73.4);
  const hangers: THREE.BufferGeometry[] = [];
  for (const board of [entrance, platform]) for (const dx of [-2, 2]) {
    const x = board.position.x + dx, z = board.position.z, bottom = board.position.y + .65, top = stationAmberSoffit(x, z).y;
    hangers.push(box(x, (top + bottom) / 2, z, .035, top - bottom, .035));
  }
  add(station, merge(hangers), silver, 'Suspended station signs');
  const story = sign(2.8, 1.3, 'NEW BEGINNINGS', 'The story of the Embryo Ring'); story.position.set(-8.5, 1.75, -66.3);
  const storyBack = box(-8.5, 1.75, -66.4, 3, 1.5, .16); add(station, storyBack, white, 'Station story panel'); solid(colliders, storyBack);
  for (const x of [-9.65, -7.35]) { const leg = box(x, .72, -66.4, .08, 1.1, .08); add(station, leg, silver, 'Story panel support'); solid(colliders, leg); }
  return { object: story, position: story.position.clone() };
}
