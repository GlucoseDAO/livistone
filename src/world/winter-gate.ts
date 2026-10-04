import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modelURL } from '../game/featured';
import type { ColliderSpec } from '../game/physics';
import { WINTER } from './winter-gate-layout';

const TAU = Math.PI * 2;
const hex = Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos(i * TAU / 6), Math.sin(i * TAU / 6)));
// Horizontal top and bottom: offsets in the door's (z,y) plane.
const doorHex = Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos(i * TAU / 6), Math.sin(i * TAU / 6)).multiplyScalar(WINTER.doorRadius));
type Point = THREE.Vector3;

function geometry(triangles: Point[][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(triangles.filter(t => t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).lengthSq() > 1e-12).flatMap(t => t.flatMap(p => p.toArray())), 3));
  g.computeVertexNormals(); return g;
}
/** Clip a triangle against one half-plane in the door projection, preserving intersections exactly. */
function clip(poly: Point[], a: THREE.Vector2, b: THREE.Vector2, inside: boolean): Point[] {
  const d = (p: Point): number => (b.x - a.x) * (p.y - WINTER.doorY - a.y) - (b.y - a.y) * (p.z - WINTER.z - a.x);
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = d(p), dq = d(q);
    const pin = inside ? dp >= -1e-8 : dp <= 1e-8, qin = inside ? dq >= -1e-8 : dq <= 1e-8;
    if (pin) result.push(p);
    if (pin !== qin) result.push(p.clone().lerp(q, dp / (dp - dq)));
  }
  return result;
}
const fan = (poly: Point[]): Point[][] => poly.slice(1, -1).map((p, i) => [poly[0], p, poly[i + 2]]);
/** Smooth closed cabochon, with only the operable entrance cut out of its front surface. */
export function winterQuartzGeometry(mobile = false): THREE.BufferGeometry {
  const latitudes = mobile ? 32 : 64, longitudes = mobile ? 64 : 128, triangles: Point[][] = [];
  const at = (i: number, j: number): Point => {
    const a = i * Math.PI / latitudes, b = j * TAU / longitudes;
    return new THREE.Vector3(WINTER.quartzX + WINTER.depth * Math.sin(a) * Math.cos(b), WINTER.centreY + WINTER.radius * Math.cos(a), WINTER.z + WINTER.radius * Math.sin(a) * Math.sin(b));
  };
  for (let i = 0; i < latitudes; i++) for (let j = 0; j < longitudes; j++) {
    for (const t of [[at(i, j), at(i + 1, j), at(i, j + 1)], [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]]) {
      if (t.every(p => p.x <= WINTER.quartzX)) { triangles.push(t); continue; }
      // Polygon difference: emit the part outside each hex edge, then continue clipping the remaining inside part.
      let remaining = t;
      for (let k = 0; k < 6 && remaining.length; k++) {
        triangles.push(...fan(clip(remaining, doorHex[k], doorHex[(k + 1) % 6], false)));
        remaining = clip(remaining, doorHex[k], doorHex[(k + 1) % 6], true);
      }
    }
  }
  const g = geometry(triangles), p = g.getAttribute('position'), normals: number[] = [];
  for (let i = 0; i < p.count; i++) normals.push(...new THREE.Vector3((p.getX(i) - WINTER.quartzX) / WINTER.depth ** 2, (p.getY(i) - WINTER.centreY) / WINTER.radius ** 2, (p.getZ(i) - WINTER.z) / WINTER.radius ** 2).normalize().toArray());
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); return g;
}

/** A smaller six-sided cut gem, with a table, crown, girdle and pointed pavilion; distinct from the clear outer stone. */
export function winterBlueGeometry(): THREE.BufferGeometry {
  const rings = [{ x: WINTER.x - 2.4, r: .08 }, { x: WINTER.x - 2.1, r: 2.05 }, { x: WINTER.x - 1.55, r: 2.05 }, { x: WINTER.x - 1.12, r: 1.12 }];
  const pts = rings.map(r => hex.map(p => new THREE.Vector3(r.x, WINTER.centreY + p.y * r.r, WINTER.z + p.x * r.r))), tris: Point[][] = [];
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 6; i++) { const n = (i + 1) % 6; tris.push([pts[j][i], pts[j][n], pts[j + 1][n]], [pts[j][i], pts[j + 1][n], pts[j + 1][i]]); }
  const centre = new THREE.Vector3(rings[3].x, WINTER.centreY, WINTER.z);
  for (let i = 0; i < 6; i++) tris.push([centre, pts[3][i], pts[3][(i + 1) % 6]]);
  // Flat normals preserve the faceted stone; the little rear face seals its pavilion.
  tris.push(...fan([...pts[0]].reverse())); return geometry(tris);
}

function doorPoint(p: THREE.Vector2, outward = .025): Point {
  const y = WINTER.doorY + p.y, z = WINTER.z + p.x;
  const x = WINTER.quartzX + WINTER.depth * Math.sqrt(Math.max(0, 1 - ((y - WINTER.centreY) / WINTER.radius) ** 2 - (p.x / WINTER.radius) ** 2));
  return new THREE.Vector3(x + outward, y, z);
}

export interface WinterGate {
  root: THREE.Group; colliders: ColliderSpec[]; silver: THREE.Mesh; quartz: THREE.Mesh; blue: THREE.Mesh;
  open: number;
  /** Six shutter leaves retract into the surrounding bezel. Advance only in the game's fixed physics loop. */
  step(dt: number, position: { x: number; y: number; z: number }): boolean;
}

/** DOM-independent builder; tests and the town use the same source transformation and solid surfaces. */
export function createWinterGate(source: THREE.BufferGeometry, mobile = false, paving?: THREE.Material): WinterGate {
  const root = new THREE.Group(); root.name = 'Eye of Winter · two-stone pavilion';
  const colliders: ColliderSpec[] = [];
  const silverMaterial = new THREE.MeshStandardMaterial({ color: '#e3e9ed', metalness: 1, roughness: .27, userData: { heroEnv: true } });
  const gold = new THREE.MeshStandardMaterial({ color: '#c3a15c', metalness: .85, roughness: .24, userData: { heroEnv: true } });
  const quartzMaterial = new THREE.MeshPhysicalMaterial({ color: '#eaf7ff', roughness: .045, metalness: 0, transmission: mobile ? 0 : .88, thickness: .2, ior: 1.46, transparent: true, opacity: mobile ? .22 : .5, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, userData: { winterQuartz: true, winterReduced: mobile, heroEnv: true } });
  const blueMaterial = new THREE.MeshPhysicalMaterial({ color: '#237bb4', roughness: .035, metalness: .12, transmission: mobile ? 0 : .35, thickness: .8, ior: 1.62, clearcoat: 1, flatShading: true, emissive: '#0b2942', emissiveIntensity: .22, userData: { heroEnv: true } });
  const add = (name: string, g: THREE.BufferGeometry, m: THREE.Material, solid = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    if (solid) colliders.push({ type: 'mesh', vertices: Float32Array.from(g.getAttribute('position').array), indices: g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i) });
    return mesh;
  };
  // Y-up source: the bezel sits above the finger loops. Rotate the whole assembly onto its side, with its eye facing east.
  // No clipping, deformation, remeshing, or changes to the source vertex/index order.
  const metal = source.clone().scale(WINTER.scale, WINTER.scale, WINTER.scale).rotateZ(-Math.PI / 2);
  metal.computeBoundingBox(); const base = WINTER.silverBase - metal.boundingBox!.min.y;
  metal.translate(WINTER.x - WINTER.sourceHeadY * WINTER.scale, base, WINTER.z);
  const silver = add('Original Eye of Winter silver · rigid transform', metal, silverMaterial); silver.userData.keepGeometry = true;
  const quartz = add('Clear outer cabochon · enclosed room', winterQuartzGeometry(mobile), quartzMaterial); quartz.castShadow = false; quartz.renderOrder = 3; quartz.userData.keepGeometry = true;
  const blue = add('Smaller blue hexagonal stone behind the quartz', winterBlueGeometry(), blueMaterial);
  const stone = paving ?? new THREE.MeshStandardMaterial({ color: '#e6e0cf', roughness: .72 });
  // The room and its raised forecourt share one level. The terrain and connected paving grade up to this threshold.
  const floor = new THREE.Shape();
  const floorPoints = Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos(i * TAU / 6) * 3.1, Math.sin(i * TAU / 6) * 3.3));
  floor.moveTo(floorPoints[0].x, floorPoints[0].y); floorPoints.slice(1).forEach(p => floor.lineTo(p.x, p.y)); floor.closePath();
  add('Hexagonal Winter room floor', new THREE.ExtrudeGeometry(floor, { depth: .22, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(WINTER.quartzX, WINTER.floor - .22, WINTER.z), stone);
  add('Winter threshold and forecourt', new THREE.CylinderGeometry(WINTER.plazaRadius, WINTER.plazaRadius, .16, 64).translate(WINTER.plazaX, WINTER.floor - .08, WINTER.z), stone);
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = doorHex[i], b = doorHex[(i + 1) % 6], points: Point[][] = [];
    // Curved crystal shutters continue the cabochon's convex surface when closed.
    for (let r = 0; r < 8; r++) for (let j = 0; j < 8; j++) {
      const at = (radial: number, angle: number): Point => doorPoint(a.clone().lerp(b, angle / 8).multiplyScalar(radial / 8));
      points.push([at(r, j), at(r + 1, j), at(r, j + 1)], [at(r + 1, j), at(r + 1, j + 1), at(r, j + 1)]);
    }
    const leaf = add(`Hexagonal iris shutter · leaf ${i + 1}`, geometry(points), quartzMaterial, false); leaf.castShadow = false; leaf.renderOrder = 4; leaf.userData.moving = true; leaves.push(leaf);
    const rim = Array.from({ length: 17 }, (_, n) => doorPoint(a.clone().lerp(b, n / 16), .055));
    add(`Hexagonal iris bezel · side ${i + 1}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 16, .065, 8, false), silverMaterial, false);
    // The six seams show the camera-shutter mechanism without a dark permanent opening.
    const seam = add(`Iris seam ${i + 1}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, n) => doorPoint(a.clone().multiplyScalar(n / 8), .05))), 8, .018, 4, false), gold, false);
    seam.userData.moving = true; leaf.add(seam);
  }
  colliders.push({ type: 'box', position: [WINTER.quartzX + 3.2, WINTER.doorY, WINTER.z], size: [1.7, WINTER.doorRadius * Math.sqrt(3) / 2, WINTER.doorRadius], dynamic: 'winter-shutter' });
  // Seats stay at the side of the room, below the smaller blue stone, with a clear central aisle.
  for (const side of [-1, 1]) {
    add('Winter side bench', new THREE.BoxGeometry(2.3, .22, .62).translate(WINTER.quartzX - .3, WINTER.floor + .5, WINTER.z + side * 2.1), stone);
    for (const dx of [-.85, .85]) add('Winter bench foot', new THREE.BoxGeometry(.18, .4, .4).translate(WINTER.quartzX - .3 + dx, WINTER.floor + .2, WINTER.z + side * 2.1), silverMaterial);
  }
  const gate: WinterGate = { root, colliders, silver, quartz, blue, open: 0, step(dt, position) {
    const inside = Math.abs(position.x - WINTER.x) < 6.2 && Math.abs(position.z - WINTER.z) < 5.8;
    const approaching = Math.hypot(position.x - (WINTER.quartzX + 3), position.z - WINTER.z) < 9 && position.y > WINTER.floor - 1;
    const target = inside || approaching ? 1 : 0;
    gate.open = THREE.MathUtils.clamp(gate.open + (target ? 1 : -1) * dt / 1.1, 0, 1);
    const eased = gate.open * gate.open * (3 - 2 * gate.open);
    leaves.forEach((leaf, i) => {
      const direction = doorHex[i].clone().add(doorHex[(i + 1) % 6]).normalize();
      leaf.position.set(-.8 * eased, direction.y * eased * 3.3, direction.x * eased * 3.3); leaf.visible = gate.open < .98;
    });
    return gate.open < .98;
  } };
  return gate;
}

export async function loadWinterGate(mobile: boolean, paving: THREE.Material): Promise<WinterGate> {
  const gltf = await new GLTFLoader().loadAsync(modelURL('eye-of-winter-gate'));
  const mesh = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | undefined;
  if (!mesh) throw new Error('Eye of Winter source GLB has no silver mesh');
  return createWinterGate(mesh.geometry, mobile, paving);
}
