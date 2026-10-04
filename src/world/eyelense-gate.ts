import * as THREE from 'three';
import { createGateLamps, gateFittingsEnabled } from './gate-lamps';
import { nightEmission } from './night-lighting';
import { EYELENSE_LAMPS } from './eyelense-gate-layout';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { modelURL } from '../game/featured';
import type { ColliderSpec } from '../game/physics';
import { EYELENSE as E } from './eyelense-gate-layout';
import { mergeStatic } from './static-batch';

/** Two open-bottom outlines with matching samples: a round bead and a tall semicircular doorway. */
function outlines(reduced: boolean): { outer: THREE.Vector2[]; inner: THREE.Vector2[] } {
  const jamb = reduced ? 6 : 12, arc = reduced ? 24 : 48, inner: THREE.Vector2[] = [];
  for (let i = 0; i < jamb; i++) inner.push(new THREE.Vector2(-E.doorHalf, E.doorSpring * i / jamb));
  for (let i = 0; i <= arc; i++) { const a = Math.PI * (1 - i / arc); inner.push(new THREE.Vector2(E.doorHalf * Math.cos(a), E.doorSpring + E.doorHalf * Math.sin(a))); }
  for (let i = 1; i <= jamb; i++) inner.push(new THREE.Vector2(E.doorHalf, E.doorSpring * (1 - i / jamb)));
  const footAngle = Math.asin(E.beadCentreY / E.beadRadiusY);
  const outer = inner.map((_, i) => { const a = Math.PI + footAngle - (Math.PI + 2 * footAngle) * i / (inner.length - 1); return new THREE.Vector2(E.beadRadiusX * Math.cos(a), Math.max(0, E.beadCentreY + E.beadRadiusY * Math.sin(a))); });
  return { outer, inner };
}

/** Closed solid red volume: domed faces, rounded outer seam, curved tunnel lining and sealed soles.
 * The doorway is a notch right through the volume, never an alpha mask or an uncut glass sphere. */
export function eyelenseBeadGeometry(reduced = false): THREE.BufferGeometry {
  const { outer, inner } = outlines(reduced), radial = reduced ? 8 : 16, positions: number[] = [], indices: number[] = [], count = inner.length;
  for (const side of [1, -1]) for (let r = 0; r <= radial; r++) for (let i = 0; i < count; i++) {
    const t = r / radial, p = inner[i].clone().lerp(outer[i], t);
    const depth = E.tunnelHalfDepth * (1 - t) + 1.4 * Math.sin(Math.PI * t);
    positions.push(p.x, p.y + E.floor, side * depth);
  }
  const back = (radial + 1) * count;
  const quad = (a: number, b: number, c: number, d: number): void => { indices.push(a, b, d, b, c, d); };
  for (let r = 0; r < radial; r++) for (let i = 0; i < count - 1; i++) {
    const a = r * count + i, b = a + count;
    quad(a, b, b + 1, a + 1); quad(back + a + 1, back + b + 1, back + b, back + a);
  }
  // The inner boundary connects the front and back continuously, leaving only the traversable air volume.
  for (let i = 0; i < count - 1; i++) quad(i + 1, back + i + 1, back + i, i);
  for (let r = 0; r < radial; r++) {
    const a = r * count, b = a + count;
    quad(a, back + a, back + b, b);
    quad(b + count - 1, back + b + count - 1, back + a + count - 1, a + count - 1);
  }
  const raw = new THREE.BufferGeometry(); raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); raw.setIndex(indices);
  const g = mergeVertices(raw, 1e-5); raw.dispose();
  // The front/back meet at the rounded outside seam: drop the collapsed sole triangles there.
  const welded = g.index!, clean: number[] = [];
  for (let i = 0; i < welded.count; i += 3) { const a = welded.getX(i), b = welded.getX(i + 1), c = welded.getX(i + 2); if (a !== b && b !== c && a !== c) clean.push(a, c, b); }
  g.setIndex(clean); g.computeVertexNormals(); return g;
}

/** A bounded bowed glass pane above the bead, with two faces and a sealed thin edge. */
export function eyelenseLensGeometry(reduced = false): THREE.BufferGeometry {
  const nx = reduced ? 16 : 32, ny = 6, positions: number[] = [], indices: number[] = [];
  for (const side of [-1, 1]) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, x = -3.7 + u * 8.1;
    const bottom = E.lensBottom + .2 * Math.sin(Math.PI * u), top = bottom + .1 + (E.lensTop - E.lensBottom) * Math.sin(Math.PI * u);
    positions.push(x, E.floor + THREE.MathUtils.lerp(bottom, top, v), -.12 + .38 * Math.sin(Math.PI * u) + side * .045);
  }
  const n = (nx + 1) * (ny + 1), quad = (a: number, b: number, c: number, d: number): void => { indices.push(a, b, d, b, c, d); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; quad(a, a + 1, b + 1, b); quad(n + b, n + b + 1, n + a + 1, n + a); }
  for (let i = 0; i < nx; i++) { quad(i, n + i, n + i + 1, i + 1); const a = ny * (nx + 1) + i; quad(a + 1, n + a + 1, n + a, a); }
  for (let j = 0; j < ny; j++) { const a = j * (nx + 1), b = a + nx + 1; quad(b, n + b, n + a, a); quad(a + nx, n + a + nx, n + b + nx, b + nx); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices.flatMap((_, i) => i % 3 === 0 ? [indices[i], indices[i + 2], indices[i + 1]] : [])); g.computeVertexNormals(); return g;
}

/** Independent of station amber/Winter quartz; intrinsic mobile reduction cannot be undone by the menu. */
export function setEyelenseQuality(material: THREE.MeshPhysicalMaterial, low: boolean): void {
  const reduced = low || !!material.userData.eyelenseReduced, kind = material.userData.eyelenseGlass;
  material.transmission = reduced ? 0 : kind === 'bead' ? .36 : .82;
  material.transparent = !reduced; material.opacity = 1; material.depthWrite = reduced || kind === 'bead';
  material.metalness = reduced ? .22 : 0; material.roughness = reduced ? .16 : .055; material.needsUpdate = true;
}
/** The existing resolved daylight state drives the tint; no timers or independent clock. */
export function setEyelenseNight(material: THREE.Material, night: boolean): void {
  if (material.userData.eyelenseGlass !== 'lens') return;
  const lens = material as THREE.MeshPhysicalMaterial;
  lens.color.set(night ? '#eef4f5' : '#80736a');
  if (lens.attenuationColor) lens.attenuationColor.set(night ? '#eef4f5' : '#968477');
}
export interface EyelenseGate { root: THREE.Group; colliders: ColliderSpec[]; crescent: THREE.Mesh; bead: THREE.Mesh; lens: THREE.Mesh; surround: THREE.Mesh }

export function createEyelenseGate(source: THREE.BufferGeometry, reduced = false, paving?: THREE.Material): EyelenseGate {
  const root = new THREE.Group(); root.name = 'Eyelense E · red bead passage';
  const transform = new THREE.Matrix4().makeRotationY(E.yaw).setPosition(E.x, 0, E.z), colliders: ColliderSpec[] = [], parts: THREE.Mesh[] = [];
  const black = new THREE.MeshPhysicalMaterial({ color: '#16151b', metalness: .32, roughness: .2, clearcoat: 1, clearcoatRoughness: .08, userData: { heroEnv: true } });
  if (gateFittingsEnabled()) nightEmission(black, '#7e8796', .045);
  const brass = new THREE.MeshStandardMaterial({ color: '#c8a45e', metalness: .9, roughness: .23, userData: { heroEnv: true } });
  const stone = paving ?? new THREE.MeshStandardMaterial({ color: '#e6dfcc', roughness: .72 });
  const glass = (kind: string, color: string, thickness: number): THREE.MeshPhysicalMaterial => {
    const m = new THREE.MeshPhysicalMaterial({ color, ior: 1.48, thickness, clearcoat: 1, attenuationColor: color, attenuationDistance: kind === 'bead' ? 3.5 : 12, userData: { heroEnv: true, eyelenseGlass: kind, eyelenseReduced: reduced } });
    if (kind === 'bead') { m.emissive.set('#980615'); m.emissiveIntensity = .13; if (gateFittingsEnabled()) nightEmission(m, '#c2152b', .35); }
    setEyelenseQuality(m, reduced); return m;
  };
  const add = (name: string, g: THREE.BufferGeometry, m: THREE.Material, solid = true, keep = false): THREE.Mesh => {
    g.applyMatrix4(transform);
    if (m === stone) { const p = g.getAttribute('position'), uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 4; uv[i * 2 + 1] = p.getZ(i) / 4; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    if (keep) mesh.userData.keepGeometry = true;
    root.add(mesh); parts.push(mesh);
    if (solid) colliders.push({ type: 'mesh', vertices: Float32Array.from(g.getAttribute('position').array), indices: g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i) });
    return mesh;
  };
  const crescentGeometry = source.clone().scale(E.sourceScale, E.sourceScale, E.sourceScale).translate(E.sourceOffsetX, E.floor, 0);
  // Relief absent from the decimation is added as separate raised swirls, seated on the actual source faces by raycast.
  const face = new THREE.Mesh(crescentGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); face.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) for (const [cx, cy, radius] of [[-3.1, 2.9, .65], [-2.1, 4.9, .56], [-.2, 6.9, .64], [1.7, 7.4, .42]]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 44; i++) {
      const a = i / 44 * Math.PI * 3.5, r = radius * (.12 + .88 * i / 44), x = (cx + r * Math.cos(a)) * E.sourceScale + E.sourceOffsetX, y = (cy + r * Math.sin(a)) * E.sourceScale + E.floor;
      ray.set(new THREE.Vector3(x, y, side * 5), new THREE.Vector3(0, 0, -side)); const hit = ray.intersectObject(face)[0];
      if (hit) points.push(hit.point.clone().add(new THREE.Vector3(0, 0, side * .035)));
    }
    if (points.length > 3) add('Raised black swirl relief', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), reduced ? 32 : 64, .12, 8, false), black, false);
  }
  (face.material as THREE.Material).dispose();
  const crescent = add('Original Eyelense crescent · uniform rigid placement', crescentGeometry, black, true, true);
  const bead = add('Rounded red bead · open arch and tunnel lining', eyelenseBeadGeometry(reduced), glass('bead', '#b60b22', 1.3), true, true);
  const { outer } = outlines(reduced);
  const surroundPath = outer.map(p => new THREE.Vector3(p.x * 1.075, p.y * 1.055 + E.floor + .06, 0));
  const surround = add('Clear glass surround · open at the walking threshold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(surroundPath), reduced ? 48 : 96, .32, reduced ? 8 : 16, false), glass('surround', '#e3f1f2', .6), true, true);
  // Cap the two tube soles; neither cap enters the doorway.
  for (const p of [surroundPath[0], surroundPath[surroundPath.length - 1]]) add('Clear surround foot', new THREE.SphereGeometry(.32, 12, 8).translate(p.x, p.y, p.z), surround.material as THREE.Material);
  const lens = add('Bowed smoky lens · clearer at night', eyelenseLensGeometry(reduced), glass('lens', '#80736a', .12), true, true);
  for (const m of [bead, surround, lens]) { m.castShadow = false; m.renderOrder = m === bead ? 1 : m === lens ? 2 : 3; }
  // Threaded crest rings, with the loops spanning both source faces through the surviving holes.
  for (const [x, y, r] of [[-3.2, 4.6, .65], [-2.3, 5.45, .66], [-1.4, 6.4, .7]]) {
    add('Threaded brass crest ring', new THREE.TorusGeometry(r * 1.75, .095, 8, 40).rotateX(1.1).rotateZ(-.25).scale(1.2, 1, 1.8).translate(x * E.sourceScale + E.sourceOffsetX, y * E.sourceScale + E.floor + .65, 0), brass);
  }
  for (const x of [-1.25, 1.25]) {
    const points = [new THREE.Vector3(x, E.floor + 6.75, 0), new THREE.Vector3(x * .85, E.floor + 7.6, .1), new THREE.Vector3(x * .9, E.floor + 9.25, .2)];
    add('Brass suspension above the arch', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, .085, 8, false), brass);
    add('Bead suspension loop', new THREE.TorusGeometry(.27, .07, 8, 24).rotateY(Math.PI / 2).translate(x, E.floor + 6.7, 0), brass);
  }
  add('Level limestone forecourt and tunnel floor', new THREE.BoxGeometry(E.forecourtHalfX * 2, .16, E.forecourtHalfZ * 2).translate(0, E.floor - .082, 0), stone);
  for (const seat of E.seats) {
    add('Limestone meadow bench', new THREE.BoxGeometry(3.2, .24, .8).translate(seat.x, E.floor + .51, seat.z), stone);
    for (const dx of [-1.1, 1.1]) add('Brass bench foot', new THREE.BoxGeometry(.2, .39, .6).translate(seat.x + dx, E.floor + .195, seat.z), brass);
  }
  mergeStatic(parts, 'Eyelense · batched fittings and seats');
  if (gateFittingsEnabled()) createGateLamps(root, colliders, EYELENSE_LAMPS, '#ffdeb0');
  return { root, colliders, crescent, bead, lens, surround };
}

export async function loadEyelenseGate(reduced: boolean, paving: THREE.Material): Promise<EyelenseGate> {
  const gltf = await new GLTFLoader().loadAsync(modelURL('eyelense-gate'));
  const source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | undefined;
  if (!source) throw new Error('Eyelense source GLB has no crescent');
  return createEyelenseGate(source.geometry, reduced, paving);
}
