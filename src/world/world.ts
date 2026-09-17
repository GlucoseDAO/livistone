import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { mitoringCage, nanotCage, ENERGY_HALL } from './jewelry';
import { Forest } from './forest';
import { createBridge } from './bridge';
import { createPlanting, meadowMaterial } from './planting';
import { HOME_SITES, PATH_CURVES, PATH_WIDTH, plantingAllowed } from './landscape';
import { Mountains } from './mountains';
import { createExhibition } from './exhibition';
import { walnutMaterial, walnutRadius } from './walnut';
import { LANDMARKS } from '../game/content';
import type { Landmark } from '../game/content';

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
/** Footprint scale of a landmark's surroundings; k < 1 stretches gardens less than the shell itself. */
function spread(l: Landmark, k = 1): { x: number; z: number } { return { x: 1 + (l.stretch.x - 1) * k, z: 1 + (l.stretch.z - 1) * k }; }
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
  private readonly exhibitLoads: Promise<void>[] = [];
  private readonly mountains: Mountains;
  private readonly white = new THREE.MeshStandardMaterial({ color: '#f4f0df', roughness: 0.57, metalness: 0.07 });
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#e2e7dd', roughness: 0.26, metalness: 0.65 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: '#b99a55', roughness: 0.3, metalness: 0.7 });
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#d1a37d', roughness: 0.8, map: texture('walnut') });
  private readonly walnut = walnutMaterial();
  private readonly paving = new THREE.MeshStandardMaterial({ color: '#efe5d0', roughness: 0.92, map: texture('stone'), side: THREE.DoubleSide });
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#3e5550', roughness: 0.25, metalness: 0.35 });
  private readonly sphere = new THREE.SphereGeometry(1, 16, 12);
  constructor(private mobile: boolean) {
    this.root.name = 'Livistone'; this.root.add(this.interiors, this.details);
    this.water = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#68a3a0') } },
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float time; uniform vec3 tint; varying vec3 vPosition; void main(){float waves=sin(vPosition.x*2.4+vPosition.z*4.0-time*1.1)*sin(vPosition.x*.7-vPosition.z*2.8-time*.7); float sparkle=pow(max(0.0,waves),12.0); gl_FragColor=vec4(tint*(.88+.10*waves)+vec3(.40)*sparkle,1.0);\n#include <tonemapping_fragment>\n #include <colorspace_fragment>\n }',
      side: THREE.DoubleSide,
    });
    this.createTerrain(); this.createPaths(); createBridge(this.root, this.colliders, this.white, this.paving, this.gold);
    for (const landmark of LANDMARKS) landmark.id === 'energy' ? this.createEnergyHall(landmark.x, landmark.z) : this.createLandmark(landmark.id, landmark.x, landmark.z);
    this.createHomes(); this.createTrees(); this.createGardens();
    this.mountains = new Mountains(mobile); this.root.add(this.mountains);
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
    mesh(geo, meadowMaterial(), this.root).castShadow = false;
    this.colliders.push({ type: 'mesh', vertices: new Float32Array(pos.array), indices: new Uint32Array(geo.index!.array) });
    const riverPoints = Array.from({ length: 35 }, (_, i) => { const x = -115 + i / 34 * 230; return new THREE.Vector3(x, -0.42, riverCenter(x)); });
    const water = mesh(ribbon(new THREE.CatmullRomCurve3(riverPoints), 10.6, 130), this.water, this.root); water.castShadow = false;
  }
  private createPaths(): void {
    const edging = new THREE.MeshStandardMaterial({ color: '#bbb39e', roughness: .92, side: THREE.DoubleSide });
    for (const curve of PATH_CURVES) {
      mesh(ribbon(curve, PATH_WIDTH + .32, 100), edging, this.root, 0, -.012).castShadow = false;
      mesh(ribbon(curve, PATH_WIDTH, 100), this.paving, this.root).castShadow = false;
    }
    for (const l of LANDMARKS) {
      const ring = mesh(new THREE.RingGeometry(8.4, 12.3, 64), this.paving, this.root, l.x, 0.06, l.z); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; const sp = spread(l, .85); ring.scale.set(sp.x, sp.z, 1);
    }
  }
  private shellPoint(phi: number, theta: number, radius: number, height: number, sx = 1, sz = 1): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * radius * sx, Math.cos(theta) * radius + height, Math.cos(phi) * Math.sin(theta) * radius * sz);
  }
  private surface(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number, radius: number, height: number, material: THREE.Material, parent: THREE.Group, sx = 1, sz = 1): THREE.Mesh {
    const isWalnut = material === this.walnut;
    const vertices: number[] = [], uv: number[] = [], indices: number[] = []; const nx = isWalnut ? (this.mobile ? 48 : 80) : 28, ny = isWalnut ? (this.mobile ? 36 : 64) : 20;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const phi = phiStart + i / nx * phiLength, theta = thetaStart + j / ny * thetaLength;
      const p = this.shellPoint(phi, theta, isWalnut ? walnutRadius(phi, theta, radius) : radius, height, sx, sz);
      vertices.push(p.x, p.y, p.z); uv.push(phi / Math.PI, theta / Math.PI);
      if (i < nx && j < ny) { const n = j * (nx + 1) + i; indices.push(n, n + nx + 1, n + 1, n + 1, n + nx + 1, n + nx + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo, material, parent);
  }
  private createLandmark(id: string, x: number, z: number): void {
    const exterior = new THREE.Group(); exterior.position.set(x, 0.16, z); this.root.add(exterior);
    const inside = new THREE.Group(); inside.position.copy(exterior.position); this.interiors.add(inside);
    const radius = id === 'science' ? 8.5 : 10; const centerY = id === 'science' ? 6 : 5.7;
    const sx = 1, sz = 1;
    const floorR = Math.sqrt(radius * radius - centerY * centerY);
    const maxTheta = Math.acos(-centerY / radius); const doorwayTheta = Math.acos((3.1 - centerY) / radius);
    const glass = this.glass(id === 'city-hall' ? '#bbbabd' : '#b4bdb8');
    if (id === 'science') { glass.opacity = this.mobile ? .18 : .26; glass.userData.clearGallery = true; }
    const wood = this.walnut;
    const halves = id === 'city-hall' ? [{ start: 0, length: Math.PI, mat: wood }, { start: Math.PI, length: Math.PI, mat: glass }] : [{ start: 0, length: TAU, mat: glass }];
    for (const half of halves) {
      this.surface(half.start, half.length, 0.01, doorwayTheta - 0.01, radius, centerY, half.mat, exterior, sx, sz);
      const start = Math.max(0.29 / sx, half.start); const end = Math.min(TAU - 0.29 / sx, half.start + half.length);
      if (end > start) this.surface(start, end - start, doorwayTheta, maxTheta - doorwayTheta, radius, centerY, half.mat, exterior, sx, sz);
    }
    const floor = mesh(new THREE.CylinderGeometry(floorR, floorR + 0.3, 0.3, 64), this.paving, exterior, 0, -0.03); floor.scale.set(sx, 1, sz);
    const rim = mesh(new THREE.TorusGeometry(floorR + 0.15, 0.2, 8, 72), this.white, exterior, 0, 0.08); rim.rotation.x = Math.PI / 2; rim.scale.set(sx, sz, 1);
    this.colliders.push({ type: 'box', position: [x, 0.08, z], size: [floorR * sx * 0.75, 0.08, floorR * sz * 0.75] });
    this.wallRing(exterior, x, z, floorR * sx, floorR * sz, 0.32);
    this.entranceArch(exterior, floorR * sz, id === 'city-hall' ? this.gold : this.white);
    // Shell bands retain the three different jewelry identities.
    if (id === 'city-hall') {
      const seam = new THREE.MeshStandardMaterial({ color: '#4d3325', roughness: .93 });
      for (const phi of [0, Math.PI]) {
        const end = phi === 0 ? doorwayTheta : maxTheta;
        lineTube(Array.from({ length: 48 }, (_, j) => this.shellPoint(phi, .01 + j / 47 * (end - .01), radius + .06, centerY)), .16, seam, exterior);
        // Wide clasps bridge the walnut/crystal seam, with hexagonal fasteners on the shell side.
        for (const theta of [.47, 1.48, ...(phi ? [2.05] : [])]) {
          this.surface(phi - .32, .64, theta - .055, .11, radius + .23, centerY, this.gold, exterior);
          const boltPhi = phi === 0 ? .25 : phi - .25;
          const p = this.shellPoint(boltPhi, theta, radius + .30, centerY), normal = p.clone().sub(new THREE.Vector3(0, centerY, 0)).normalize();
          const bolt = mesh(new THREE.CylinderGeometry(.23, .23, .13, 6), this.gold, exterior, p.x, p.y, p.z); bolt.quaternion.setFromUnitVectors(UP, normal);
          p.addScaledVector(normal, .09);
          const pin = mesh(new THREE.CylinderGeometry(.11, .11, .04, 12), this.silver, exterior, p.x, p.y, p.z); pin.quaternion.copy(bolt.quaternion);
        }
      }
      const loop = mesh(new THREE.TorusGeometry(.85, .18, 8, 40), seam, exterior, 0, 16.6, 0); loop.scale.set(.5, 1.25, .6);
    } else {
      const frame = nanotCage(exterior, radius, centerY, this.mobile).clone().translate(x, .16, z);
      this.colliders.push({ type: 'mesh', vertices: new Float32Array(frame.getAttribute('position').array), indices: new Uint32Array(frame.index!.array) }); frame.dispose();
      const base = new THREE.RingGeometry(floorR - .1, 7.7, 80); base.rotateX(-Math.PI / 2); base.translate(x, .25, z);
      mesh(base, this.paving, this.root);
      this.colliders.push({ type: 'mesh', vertices: new Float32Array(base.getAttribute('position').array), indices: new Uint32Array(base.index!.array) });
    }
    this.createInterior(id, inside, x, z, floorR);
  }
  private glass(color: string, emissive = '#000000'): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.35, metalness: 0.05, roughness: 0.16, transmission: this.mobile ? 0 : 0.45, thickness: 0.25, transparent: true, opacity: this.mobile ? 0.32 : 0.65, side: THREE.DoubleSide, depthWrite: false });
  }
  /** Invisible wall segments (colliders + occluders) around an elliptical floor, leaving a gap of ±gap radians at the south door. */
  private wallRing(exterior: THREE.Group, x: number, z: number, a: number, b: number, gap: number): void {
    const segments = Math.ceil(Math.PI * (a + b) / 1.15);
    for (let i = 1; i < segments; i++) {
      const phi = i / segments * TAU;
      if (phi < gap || phi > TAU - gap) continue;
      const cx = Math.sin(phi) * a, cz = Math.cos(phi) * b, yaw = Math.atan2(b * Math.sin(phi), a * Math.cos(phi));
      const width = Math.hypot(a * Math.cos(phi), b * Math.sin(phi)) * TAU / segments * 1.1;
      this.colliders.push({ type: 'box', position: [x + cx, 3.8, z + cz], size: [width / 2, 3.8, 0.2], yaw });
      const wall = mesh(new THREE.BoxGeometry(width, 7.6, 0.4), new THREE.MeshBasicMaterial({ visible: false }), exterior, cx, 3.64, cz); wall.rotation.y = yaw; this.occluders.push(wall);
    }
  }
  private entranceArch(exterior: THREE.Group, depth: number, material: THREE.Material): void {
    const entrance = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.35, 0, depth + 0.05), new THREE.Vector3(-2.3, 2.4, depth + 0.25), new THREE.Vector3(0, 4.1, depth + 0.3), new THREE.Vector3(2.3, 2.4, depth + 0.25), new THREE.Vector3(2.35, 0, depth + 0.05)]);
    mesh(new THREE.TubeGeometry(entrance, 40, 0.22, 8, false), material, exterior);
  }
  /** The Mitoring: an amber cup with a domed lid seated inside the bezel's silver basket, entered through the ring. */
  private createEnergyHall(x: number, z: number): void {
    const { a, b, wall, dome, doorPhi } = ENERGY_HALL;
    const exterior = new THREE.Group(); exterior.position.set(x, 0.16, z); this.root.add(exterior);
    const inside = new THREE.Group(); inside.position.copy(exterior.position); this.interiors.add(inside);
    // A cabochon: the wall flares slightly up to the rim, then the dome closes over the hall.
    const profile: [number, number][] = [[0, 0.98], [3.7, 1], [wall, 1]];
    for (let k = 1; k <= 8; k++) profile.push([wall + dome * Math.sin(k / 8 * Math.PI / 2), Math.cos(k / 8 * Math.PI / 2)]);
    const nx = 72, vertices: number[] = [], indices: number[] = [];
    for (const [j, [y, f]] of profile.entries()) for (let i = 0; i <= nx; i++) {
      const phi = i / nx * TAU; vertices.push(Math.sin(phi) * a * f, y, Math.cos(phi) * b * f);
      if (i === nx || j === profile.length - 1) continue;
      // The doorway is the only cut in the amber; the arch and wall gap below match it.
      const angle = Math.atan2(Math.sin((i + 0.5) / nx * TAU), Math.cos((i + 0.5) / nx * TAU));
      if (Math.abs(angle) < doorPhi && y < 3.7) continue;
      const n = j * (nx + 1) + i; indices.push(n, n + 1, n + nx + 1, n + 1, n + nx + 2, n + nx + 1);
    }
    const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); shell.setIndex(indices); shell.computeVertexNormals();
    const amberShell = this.glass('#dba347', '#422005'); amberShell.opacity = this.mobile ? .24 : .38;
    mesh(shell, amberShell, exterior);
    const floor = mesh(new THREE.CylinderGeometry(a, a + 0.3, 0.3, 72), this.paving, exterior, 0, -0.03); floor.scale.z = b / a;
    const rim = mesh(new THREE.TorusGeometry(a + 0.15, 0.2, 8, 96), this.white, exterior, 0, 0.08); rim.rotation.x = Math.PI / 2; rim.scale.y = b / a;
    this.colliders.push({ type: 'box', position: [x, 0.08, z], size: [a * 0.75, 0.08, b * 0.75] });
    this.wallRing(exterior, x, z, a, b, doorPhi + 0.06);
    this.entranceArch(exterior, b, this.white);
    mitoringCage(exterior, this.mobile);
    // The ring's shank becomes the gateway: visitors walk through the Mitoring to reach the amber.
    const gateZ = b + 3.2;
    mesh(new THREE.TorusGeometry(3.15, 0.3, 12, 72), this.silver, exterior, 0, 2.1, gateZ);
    for (const side of [-1, 1]) this.colliders.push({ type: 'box', position: [x + side * 2.85, 1.4, z + gateZ], size: [0.4, 1.4, 0.4] });
    const ceiling = (px: number, pz: number): number => { const rho = Math.min(1, Math.hypot(px / a, pz / b)); return wall + dome * Math.sqrt(1 - rho * rho); };
    this.createInterior('energy', inside, x, z, b - 0.3, { a, b, ceiling, structure: exterior });
  }
  private createInterior(id: string, group: THREE.Group, x: number, z: number, floorR: number, hall?: { a: number; b: number; ceiling: (px: number, pz: number) => number; structure: THREE.Group }): void {
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
      // Folded membranes descend from alternating sides, leaving a clear public hall below.
      const { a, b, ceiling, structure } = hall!;
      const fins: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 7; i++) {
        const px = (i - 3) * a / 4, side = i % 2 ? 1 : -1;
        const zWall = b * Math.sqrt(Math.max(0, 1 - (px / a) ** 2)) - 0.4;
        const vertices: number[] = [], indices: number[] = [];
        const edge: THREE.Vector3[] = [];
        for (let k = 0; k <= 32; k++) {
          const t = k / 32, reach = Math.sin(t * Math.PI), pz = side * zWall * (1 - reach * 1.18);
          const wx = px + (t - .5) * 1.9 + Math.sin(t * Math.PI * 2) * .24;
          const bottom = Math.max(3.7, Math.min(ceiling(wx, pz) - .4, 3.8 + 1.1 * reach));
          vertices.push(wx, ceiling(wx, pz) - .12, pz, wx, bottom, pz); edge.push(new THREE.Vector3(wx, bottom, pz));
          if (k < 32) { const n = k * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
        }
        lineTube(edge, .09, this.silver, structure);
        const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); fin.setIndex(indices); fin.computeVertexNormals(); fins.push(fin);
      }
      const amber = new THREE.MeshStandardMaterial({ color: '#dc9140', emissive: '#a94908', emissiveIntensity: 0.18, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4 });
      const shelves = new THREE.Mesh(mergeGeometries(fins, false)!, amber); shelves.position.y = -0.16; structure.add(shelves);
      for (const fin of fins) fin.dispose();
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
    this.exhibitLoads.push(createExhibition(id, group, x, z, floorR, this.colliders, this.interactives));
    for (const angle of [1.6, 2.1, 4.2, 4.65]) {
      const px = Math.sin(angle) * (floorR - 1.35), pz = Math.cos(angle) * (floorR - 1.35);
      const seat = mesh(new THREE.BoxGeometry(1.7, 0.13, 0.65), this.wood, group, px, 0.65, pz); seat.rotation.y = angle;
      for (const offset of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.13, 0.5, 0.5), this.white, group, px + offset * Math.cos(angle), 0.34, pz - offset * Math.sin(angle));
    }
    const light = new THREE.PointLight(id === 'energy' ? '#ffc56d' : '#fff2d5', this.mobile ? 7 : 12, 18, 1.8); light.position.set(0, 5.5, 0); group.add(light);
    const lantern = mesh(new THREE.TorusGeometry(2.7, 0.025, 6, 50), new THREE.MeshBasicMaterial({ color: '#f4dfad' }), group, 0, 6, 0); lantern.rotation.x = Math.PI / 2;
    plinth.userData.landmark = id;
  }
  private createHomes(): void {
    for (const [i, site] of HOME_SITES.entries()) {
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
    if (!plantingAllowed(x, z, 2.5) || Math.abs(z - riverCenter(x)) < 8) return false;
    if (Math.abs(x) < 6 && z > -13 && z < 49) return false;
    if (LANDMARKS.some((l) => Math.hypot((x - l.x) / l.stretch.x, (z - l.z) / Math.max(1, l.stretch.z)) < 14)) return false;
    if (Math.abs(x) < 40 && z > -10 && z < 10) return false;
    if (Math.abs(z + 24) < 9 && Math.abs(x) > 40 && Math.abs(x) < 60) return false;
    return true;
  }
  readonly forest = new Forest();
  async loadAssets(): Promise<void> { await Promise.all([this.forest.load(this.mobile), this.mountains.ready, ...this.exhibitLoads]); }
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
    createPlanting(this.root, this.details, this.mobile, terrainHeight, riverCenter);
    const rand = seeded(58), matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
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
