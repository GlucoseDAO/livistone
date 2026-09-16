import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { jewelryCage } from './jewelry';
import { Forest } from './forest';
import { LANDMARKS } from '../game/content';

export interface Interactive { id: string; object: THREE.Object3D; position: THREE.Vector3; }
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
function seeded(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
export function riverCenter(x: number): number { return 26 + Math.sin(x * 0.036) * 4; }
export function terrainHeight(x: number, z: number): number {
  const distance = Math.abs(z - riverCenter(x));
  if (distance < 4.7) return -2.0;
  if (distance < 7.3) return -2.0 + (distance - 4.7) / 2.6 * 2;
  const edge = Math.max(0, Math.hypot(x * 0.8, z * 0.65) - 58) / 30;
  return Math.sin(x * 0.06) * Math.cos(z * 0.09) * edge * 3;
}
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, steps = 80): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2);
    for (const side of [-1, 1]) { vertices.push(p.x + normal.x * side, p.y, p.z + normal.z * side); uv.push(t * 10, (side + 1) / 2); }
    if (i < steps) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function lineTube(points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D, smooth = true): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, smooth ? 'centripetal' : 'catmullrom', smooth ? 0.5 : 0.02);
  return mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 5), radius, 6, false), material, parent);
}
function texture(kind: 'walnut' | 'stone'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; const rand = seeded(112);
  ctx.fillStyle = kind === 'walnut' ? '#8c603e' : '#d4cfbb'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const val = rand(); ctx.fillStyle = kind === 'walnut' ? 'rgba(' + (val > 0.5 ? '55,30,15,' : '192,145,90,') + (rand() * 0.22) + ')' : 'rgba(80,78,56,' + rand() * 0.08 + ')';
    ctx.fillRect(rand() * 256, rand() * 256, kind === 'walnut' ? 1 + rand() * 3 : 2, kind === 'walnut' ? 10 + rand() * 40 : 2);
  }
  const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(kind === 'walnut' ? 4 : 6, 2); return tex;
}

export class Town {
  readonly root = new THREE.Group();
  readonly interiors = new THREE.Group();
  readonly details = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly interactives: Interactive[] = [];
  readonly occluders: THREE.Object3D[] = [];
  readonly animated: { object: THREE.Object3D; id: string; speed: number }[] = [];
  readonly water: THREE.ShaderMaterial;
  private readonly white = new THREE.MeshStandardMaterial({ color: '#f4f0df', roughness: 0.57, metalness: 0.07 });
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#e2e7dd', roughness: 0.26, metalness: 0.65 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: '#b99a55', roughness: 0.3, metalness: 0.7 });
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#d1a37d', roughness: 0.8, map: texture('walnut') });
  private readonly paving = new THREE.MeshStandardMaterial({ color: '#efe5d0', roughness: 0.92, map: texture('stone'), side: THREE.DoubleSide });
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#3e5550', roughness: 0.25, metalness: 0.35 });
  private readonly sphere = new THREE.SphereGeometry(1, 16, 12);
  private readonly paths: [number, number][][] = [
    [[0, 12], [0, 4], [0, -11]],
    [[0, 7], [-13, 5], [-29, 3], [-29, -2]],
    [[0, 7], [14, 6], [29, 1], [29, -4]],
    [[-29, -1], [-16, -2], [0, -10], [17, -5], [29, -3]],
    [[0, 42], [0, 49], [-12, 54]],
  ];
  constructor(private mobile: boolean) {
    this.root.name = 'Livistone'; this.root.add(this.interiors, this.details);
    this.water = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#68a3a0') } },
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float time; uniform vec3 tint; varying vec3 vPosition; void main(){float waves=sin(vPosition.x*2.4+vPosition.z*4.0-time*1.1)*sin(vPosition.x*.7-vPosition.z*2.8-time*.7); float sparkle=pow(max(0.0,waves),12.0); gl_FragColor=vec4(tint*(.88+.10*waves)+vec3(.40)*sparkle,1.0);\n#include <tonemapping_fragment>\n #include <colorspace_fragment>\n }',
      side: THREE.DoubleSide,
    });
    this.createTerrain(); this.createPaths(); this.createBridge();
    for (const landmark of LANDMARKS) this.createLandmark(landmark.id, landmark.x, landmark.z);
    this.createHomes(); this.createTrees(); this.createGardens(); this.createHills();
  }
  private createTerrain(): void {
    const geo = new THREE.PlaneGeometry(230, 200, 115, 100); geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position'); const colors: number[] = []; const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrainHeight(x, z));
      color.setHSL(0.235 + Math.sin(x * 0.3) * 0.015, 0.42 + Math.sin(z) * 0.03, 0.13 + Math.sin(x * 0.12 + z * 0.08) * 0.028);
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), this.root).castShadow = false;
    this.colliders.push({ type: 'mesh', vertices: new Float32Array(pos.array), indices: new Uint32Array(geo.index!.array) });
    const riverPoints = Array.from({ length: 35 }, (_, i) => { const x = -115 + i / 34 * 230; return new THREE.Vector3(x, -0.42, riverCenter(x)); });
    const water = mesh(ribbon(new THREE.CatmullRomCurve3(riverPoints), 10.6, 130), this.water, this.root); water.castShadow = false;
  }
  private createPaths(): void {
    for (const path of this.paths) {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0.055, z)));
      mesh(ribbon(curve, 3.6, 45), this.paving, this.root).castShadow = false;
    }
    for (const l of LANDMARKS) {
      const ring = mesh(new THREE.RingGeometry(8.4, 12.3, 64), this.paving, this.root, l.x, 0.06, l.z); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
    }
  }
  private createBridge(): void {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.06, 40), new THREE.Vector3(0, 0.7, 34), new THREE.Vector3(0, 1.25, 26), new THREE.Vector3(0, 0.7, 18), new THREE.Vector3(0, 0.06, 12)]);
    const geo = ribbon(curve, 4.8, 60); mesh(geo, this.white, this.root);
    this.colliders.push({ type: 'mesh', vertices: new Float32Array(geo.getAttribute('position').array), indices: new Uint32Array(geo.index!.array) });
    for (const side of [-1, 1]) {
      const points = curve.getPoints(45).map((p) => p.add(new THREE.Vector3(side * 2.35, 1.05, 0)));
      lineTube(points, 0.085, this.gold, this.root);
      const lower = curve.getPoints(45).map((p) => p.add(new THREE.Vector3(side * 2.5, -0.22, 0)));
      lineTube(lower, 0.24, this.white, this.root);
      for (let i = 1; i < 15; i++) {
        const p = curve.getPoint(i / 15);
        lineTube([new THREE.Vector3(side * 2.4, p.y, p.z), new THREE.Vector3(side * 2.35, p.y + 1.05, p.z)], 0.035, this.white, this.root);
      }
      this.colliders.push({ type: 'box', position: [side * 2.6, 1.1, 26], size: [0.13, 1, 12] });
      lineTube([new THREE.Vector3(side * 1.8, -1.8, 24), new THREE.Vector3(side * 2.2, -0.4, 29), new THREE.Vector3(side * 2.4, 0.7, 34)], 0.23, this.white, this.root);
      lineTube([new THREE.Vector3(side * 1.8, -1.8, 28), new THREE.Vector3(side * 2.2, -0.4, 23), new THREE.Vector3(side * 2.4, 0.7, 18)], 0.23, this.white, this.root);
    }
  }
  private shellPoint(phi: number, theta: number, radius: number, height: number, sx = 1, sz = 1): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * radius * sx, Math.cos(theta) * radius + height, Math.cos(phi) * Math.sin(theta) * radius * sz);
  }
  private surface(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number, radius: number, height: number, material: THREE.Material, parent: THREE.Group, sx = 1, sz = 1): THREE.Mesh {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = []; const nx = 28, ny = 20;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const p = this.shellPoint(phiStart + i / nx * phiLength, thetaStart + j / ny * thetaLength, radius, height, sx, sz);
      vertices.push(p.x, p.y, p.z); uv.push(i / nx, j / ny);
      if (i < nx && j < ny) { const n = j * (nx + 1) + i; indices.push(n, n + 1, n + nx + 1, n + 1, n + nx + 2, n + nx + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo, material, parent);
  }
  private createLandmark(id: string, x: number, z: number): void {
    const exterior = new THREE.Group(); exterior.position.set(x, 0.16, z); this.root.add(exterior);
    const inside = new THREE.Group(); inside.position.copy(exterior.position); this.interiors.add(inside);
    const radius = id === 'science' ? 8.5 : 10; const centerY = id === 'energy' ? 6.8 : id === 'science' ? 6 : 5.7;
    const sx = id === 'energy' ? 0.73 : 1; const sz = id === 'energy' ? 0.56 : 1;
    const floorR = Math.sqrt(radius * radius - centerY * centerY);
    const maxTheta = Math.acos(-centerY / radius); const doorwayTheta = Math.acos((3.1 - centerY) / radius);
    const glass = new THREE.MeshPhysicalMaterial({ color: id === 'energy' ? '#c47816' : id === 'city-hall' ? '#bbbabd' : '#b4bdb8', metalness: 0.05, roughness: 0.16, transmission: this.mobile ? 0 : 0.45, thickness: 0.25, transparent: true, opacity: this.mobile ? 0.32 : 0.65, side: THREE.DoubleSide, depthWrite: false });
    const wood = this.wood.clone(); wood.side = THREE.DoubleSide;
    const halves = id === 'city-hall' ? [{ start: 0, length: Math.PI, mat: wood }, { start: Math.PI, length: Math.PI, mat: glass }] : [{ start: 0, length: TAU, mat: glass }];
    for (const half of halves) {
      if (id !== 'science') this.surface(half.start, half.length, 0.01, doorwayTheta - 0.01, radius, centerY, half.mat, exterior, sx, sz);
      const start = Math.max(0.29, half.start); const end = Math.min(TAU - 0.29, half.start + half.length);
      if (end > start) this.surface(start, end - start, doorwayTheta, maxTheta - doorwayTheta, radius, centerY, half.mat, exterior, sx, sz);
    }
    const floor = mesh(new THREE.CylinderGeometry(floorR, floorR + 0.3, 0.3, 64), this.paving, exterior, 0, -0.03); floor.scale.set(sx, 1, sz);
    const rim = mesh(new THREE.TorusGeometry(floorR + 0.15, 0.2, 8, 72), this.white, exterior, 0, 0.08); rim.rotation.x = Math.PI / 2; rim.scale.set(sx, sz, 1);
    this.colliders.push({ type: 'box', position: [x, 0.08, z], size: [floorR * sx * 0.75, 0.08, floorR * sz * 0.75] });
    // The wall ring leaves a full-width opening facing the pedestrian paths.
    for (let i = 1; i < 26; i++) {
      const phi = i / 26 * TAU;
      if (phi < 0.32 || phi > TAU - 0.32) continue;
      const cx = Math.sin(phi) * floorR * sx, cz = Math.cos(phi) * floorR * sz;
      this.colliders.push({ type: 'box', position: [x + cx, 3.8, z + cz], size: [floorR * 0.135, 3.8, 0.2], yaw: phi });
      const wall = mesh(new THREE.BoxGeometry(floorR * 0.27, 7.6, 0.4), new THREE.MeshBasicMaterial({ visible: false }), exterior, cx, 3.64, cz); wall.rotation.y = phi; this.occluders.push(wall);
    }
    const entrance = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.35, 0, floorR * sz + 0.05), new THREE.Vector3(-2.3, 2.4, floorR * sz + 0.25), new THREE.Vector3(0, 4.1, floorR * sz + 0.3), new THREE.Vector3(2.3, 2.4, floorR * sz + 0.25), new THREE.Vector3(2.35, 0, floorR * sz + 0.05)]);
    mesh(new THREE.TubeGeometry(entrance, 40, 0.22, 8, false), id === 'city-hall' ? this.gold : this.white, exterior);
    // Shell bands retain the three different jewelry identities.
    if (id === 'city-hall') {
      for (const phi of [0.45, 1.7, 3.4, 5.15]) {
        const pts = Array.from({ length: 28 }, (_, j) => this.shellPoint(phi, 0.025 + j / 27 * (maxTheta - 0.025), radius + 0.08, centerY));
        lineTube(pts, 0.13, this.gold, exterior);
      }
      for (let i = 0; i < 10; i++) {
        const phi = 0.4 + i * 0.265;
        const pts = Array.from({ length: 24 }, (_, j) => this.shellPoint(phi + Math.sin(j * 0.6 + i) * 0.025, 0.22 + j / 23 * (maxTheta - 0.25), radius + 0.02, centerY));
        lineTube(pts, 0.1, this.wood, exterior);
      }
      const belt = Array.from({ length: 49 }, (_, j) => this.shellPoint(j / 48 * TAU, 1.36, radius + 0.06, centerY)); lineTube(belt, 0.12, this.gold, exterior);
      // Walnut pendant's loop becomes a small sculptural crown.
      const loop = mesh(new THREE.TorusGeometry(1.05, 0.17, 8, 32), this.gold, exterior, 0, 16.5, 0); loop.scale.set(0.65, 1, 1);
    } else jewelryCage(id as 'energy' | 'science', exterior, radius, centerY, sx, sz);
    this.createInterior(id, inside, x, z, floorR * Math.min(sx, sz));
  }
  private createInterior(id: string, group: THREE.Group, x: number, z: number, floorR: number): void {
    const floorInset = mesh(new THREE.CircleGeometry(floorR * 0.87, 56), new THREE.MeshStandardMaterial({ color: '#ddd7c4', roughness: 0.95 }), group, 0, 0.14); floorInset.rotation.x = -Math.PI / 2;
    const central = new THREE.Group(); central.position.set(0, 1.8, -1.3); group.add(central);
    const plinth = mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.9, 32), this.white, group, 0, 0.6, -1.3);
    this.colliders.push({ type: 'box', position: [x, 0.75, z - 1.3], size: [1.35, 0.75, 1.35] });
    const glowMat = new THREE.MeshStandardMaterial({ color: id === 'energy' ? '#e4a133' : '#b6a86d', roughness: 0.24, metalness: 0.35, emissive: id === 'energy' ? '#cf6e0a' : '#647f64', emissiveIntensity: 0.15 });
    if (id === 'city-hall') {
      const shell = mesh(new THREE.SphereGeometry(0.78, 24, 16, 0, Math.PI), this.wood, central); shell.rotation.z = 0.2;
      mesh(new THREE.SphereGeometry(0.76, 24, 16, Math.PI, Math.PI), new THREE.MeshPhysicalMaterial({ color: '#cbc1d4', roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.75 }), central);
      const band = mesh(new THREE.TorusGeometry(0.79, 0.035, 8, 48), this.gold, central); band.rotation.y = Math.PI / 2;
    } else if (id === 'energy') {
      const orb = mesh(new THREE.IcosahedronGeometry(0.9, 2), glowMat, central); orb.scale.set(0.8, 1.15, 0.8);
      for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 48), this.gold, central); r.rotation.set(i * 0.8, i * 1.1, 0); }
    } else {
      mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: '#dfebe0', roughness: 0.2, metalness: 0.7, wireframe: true }), central);
      const positions = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.9, 0.4, 0), new THREE.Vector3(-0.6, 0.8, 0.3), new THREE.Vector3(0.1, -0.65, 0.65)];
      positions.forEach((p, i) => { const m = mesh(this.sphere, i === 0 ? this.gold : this.dark, central, p.x, p.y, p.z); m.scale.setScalar(i === 0 ? 0.28 : 0.2); if (i) lineTube([positions[0], p], 0.045, this.silver, central); });
    }
    const discoveryId = id === 'city-hall' ? 'nut' : id === 'energy' ? 'mitoring' : 'nanot';
    this.interactives.push({ id: discoveryId, object: central, position: new THREE.Vector3(x, 1.9, z - 1.3) });
    this.animated.push({ object: central, id: discoveryId, speed: 0.08 });
    const plaque = new THREE.Group(); plaque.position.set(-3.7, 0, 2.3); group.add(plaque);
    mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 12), this.gold, plaque, 0, 0.6);
    const panel = mesh(new THREE.BoxGeometry(1.4, 0.08, 0.8), this.dark, plaque, 0, 1.2); panel.rotation.x = 0.3;
    // Simple engraved lines are geometry, not tiny unreadable texture text.
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.85 - i * 0.15, 0.015, 0.025), this.gold, plaque, 0, 1.26 - i * 0.04, -0.2 + i * 0.13);
    this.interactives.push({ id: id === 'city-hall' ? 'artifactor' : id === 'energy' ? 'shelter' : 'connections', object: plaque, position: new THREE.Vector3(x - 3.7, 1.3, z + 2.3) });
    for (const angle of [1.6, 2.25, 3.05, 3.85, 4.65]) {
      const px = Math.sin(angle) * (floorR - 1.35), pz = Math.cos(angle) * (floorR - 1.35);
      const seat = mesh(new THREE.BoxGeometry(1.7, 0.13, 0.65), this.wood, group, px, 0.65, pz); seat.rotation.y = angle;
      for (const offset of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.13, 0.5, 0.5), this.white, group, px + offset * Math.cos(angle), 0.34, pz - offset * Math.sin(angle));
    }
    const light = new THREE.PointLight(id === 'energy' ? '#ffc56d' : '#fff2d5', this.mobile ? 7 : 12, 18, 1.8); light.position.set(0, 5.5, 0); group.add(light);
    const lantern = mesh(new THREE.TorusGeometry(2.7, 0.025, 6, 50), new THREE.MeshBasicMaterial({ color: '#f4dfad' }), group, 0, 6, 0); lantern.rotation.x = Math.PI / 2;
    plinth.userData.landmark = id;
  }
  private createHomes(): void {
    const sites = [[-49, -23], [-38, -40], [-15, -48], [12, -52], [39, -41], [53, -22], [-53, 2], [52, 3], [-24, 52], [24, 52]];
    for (const [i, site] of sites.entries()) {
      const [x, z] = site; const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = (i % 3 - 1) * 0.5; this.root.add(group);
      const roof = mesh(new THREE.SphereGeometry(4.8, 24, 14, 0, TAU, 0, 1.5), this.white, group, 0, 0.3); roof.scale.set(1.25, 0.7, 1);
      const front = new THREE.MeshStandardMaterial({ color: '#7b9588', roughness: 0.4, metalness: 0.2 });
      mesh(new THREE.BoxGeometry(7, 2.7, 4.2), front, group, 0, 1.35);
      for (const xx of [-2.6, -1.25, 1.25, 2.6]) mesh(new THREE.BoxGeometry(0.09, 2.8, 0.16), this.gold, group, xx, 1.4, 2.2);
      mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), this.wood, group, 0, 1.3, 2.2);
      const foundation = mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.2, 36), this.paving, group, 0, 0.03); foundation.scale.z = 0.85;
      this.colliders.push({ type: 'box', position: [x, 1.7, z], size: [4.2, 1.7, 3.2], yaw: group.rotation.y });
    }
  }
  private clearForTree(x: number, z: number): boolean {
    if (Math.abs(z - riverCenter(x)) < 8) return false;
    if (Math.abs(x) < 6 && z > -13 && z < 49) return false;
    if (LANDMARKS.some((l) => Math.hypot(x - l.x, z - l.z) < 14)) return false;
    if (Math.abs(x) < 40 && z > -10 && z < 10) return false;
    if (Math.abs(z + 24) < 9 && Math.abs(x) > 40 && Math.abs(x) < 60) return false;
    return true;
  }
  readonly forest = new Forest();
  async loadVegetation(): Promise<void> { await this.forest.load(this.mobile); }
  private createTrees(): void {
    const rand = seeded(3974); const sites: THREE.Vector3[] = [];
    for (let i = 0; i < 240; i++) {
      const x = (rand() - 0.5) * 185, z = (rand() - 0.5) * 155;
      if (!this.clearForTree(x, z) || sites.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
      sites.push(new THREE.Vector3(x, terrainHeight(x, z), z));
      if (Math.hypot(x, z) < 65) this.colliders.push({ type: 'box', position: [x, terrainHeight(x, z) + 2, z], size: [0.3, 2, 0.3] });
    }
    this.forest.sites = sites; this.root.add(this.forest);
  }
  private createGardens(): void {
    const rand = seeded(58); const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), 500);
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), 600);
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
    for (let i = 0; i < 500; i++) {
      const l = LANDMARKS[i % 3]; const a = rand() * TAU, r = 12.8 + rand() * 4;
      let x = l.x + Math.sin(a) * r, z = l.z + Math.cos(a) * r;
      if (Math.abs(x - l.x) < 4 && z > l.z) x += 5;
      const s = 0.35 + rand() * 0.75;
      matrix.compose(new THREE.Vector3(x, s * 0.4, z), q, new THREE.Vector3(s, s * 0.7, s)); shrubs.setMatrixAt(i, matrix); color.setHSL(0.24 + rand() * 0.07, 0.4, 0.08 + rand() * 0.06); shrubs.setColorAt(i, color);
    }
    for (let i = 0; i < 600; i++) {
      const l = LANDMARKS[i % 3]; const a = rand() * TAU, r = 12.5 + rand() * 2;
      const x = l.x + Math.sin(a) * r, z = l.z + Math.cos(a) * r;
      matrix.compose(new THREE.Vector3(x, 0.55 + rand() * 0.3, z), q, new THREE.Vector3(1, 1, 1)); flowers.setMatrixAt(i, matrix);
      color.set(['#ede6bf', '#c1bbd4', '#e5c596'][i % 3]); flowers.setColorAt(i, color);
    }
    this.root.add(shrubs); this.details.add(flowers);
    const stone = new THREE.MeshStandardMaterial({ color: '#aaa99a', roughness: 1 });
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), stone, 170);
    for (let i = 0; i < 170; i++) {
      const x = (rand() - 0.5) * 180, z = riverCenter(x) + (i % 2 ? 1 : -1) * (5.1 + rand() * 1.7); const s = 0.3 + rand() * 0.65;
      matrix.compose(new THREE.Vector3(x, -0.4, z), q.setFromAxisAngle(UP, rand() * TAU), new THREE.Vector3(s * 1.4, s, s)); rocks.setMatrixAt(i, matrix);
    }
    rocks.castShadow = true; this.root.add(rocks);
    for (const x of [-6.5, 6.5]) for (const z of [5, 13, 39]) {
      const pole = mesh(new THREE.CylinderGeometry(0.045, 0.065, 2.8, 8), this.gold, this.root, x, 1.4, z);
      const globe = mesh(this.sphere, new THREE.MeshStandardMaterial({ color: '#f3e8c9', emissive: '#e4c881', emissiveIntensity: 0.35, roughness: 0.6 }), this.root, x, 2.8, z); globe.scale.setScalar(0.23); pole.castShadow = false;
    }
  }
  private createHills(): void {
    const rand = seeded(20); const mat = new THREE.MeshStandardMaterial({ color: '#7e9980', roughness: 1 });
    for (let i = 0; i < 18; i++) {
      const phi = i / 18 * TAU; const m = mesh(new THREE.SphereGeometry(1, 20, 12), mat, this.root, Math.sin(phi) * 155, -2, Math.cos(phi) * 135); m.scale.set(28 + rand() * 25, 16 + rand() * 18, 32 + rand() * 25); m.castShadow = false;
    }
  }
  update(time: number, dt: number): void {
    this.water.uniforms.time.value = time;
    for (const item of this.animated) { item.object.rotation.y += dt * item.speed; item.object.position.y = 1.8 + Math.sin(time * 0.8) * 0.055; }
  }
  activate(id: string): void {
    const item = this.animated.find((item) => item.id === id);
    if (item) item.speed = item.speed > 0.2 ? 0.08 : 0.65;
  }
  setMapMode(active: boolean): void { this.interiors.visible = !active; this.details.visible = !active; }
}
