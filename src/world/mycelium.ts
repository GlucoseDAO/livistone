import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { forestLod } from './forest';

export const MYCELIUM_RADIUS = 2.7;
/**
 * The ring's curled, pierced silver folds wrap an opal; no fabric panels or umbrella spokes.
 * The light crown keeps every fold and its profile with fewer samples, about 2k triangles: each strap becomes two facing
 * ribbons whose normals stay flat across the strap, so its broad faces catch the light as the full strap's do.
 */
export function myceliumCrown(mobile: boolean, light = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], folds = mobile ? 22 : 28;
  for (let i = 0; i < folds; i++) {
    const angle = i / folds * Math.PI * 2, reach = 1 + Math.sin(i * 2.399) * .07;
    const profile = [[.7, -.43, -.045], [1.46, -.53, -.07], [2.23, -.23, -.065], [2.39, .18, 0], [2.12, .67, .07], [1.4, .86, .085], [.81, .51, .04]];
    const points = profile.map(([r, y, side]) => new THREE.Vector3(Math.cos(angle) * r * reach - Math.sin(angle) * side, y, Math.sin(angle) * r * reach + Math.cos(angle) * side));
    // The photograph shows flattened folded straps, with wide faces and narrow open slots.
    const curve = new THREE.CatmullRomCurve3(points, true), steps = light ? 18 : mobile ? 32 : 52, vertices: number[] = [], normals: number[] = [], indices: number[] = [];
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    for (let j = 0; j <= steps; j++) {
      const p = curve.getPoint(j / steps), radial = curve.getTangent(j / steps).cross(tangent).normalize();
      const width = .12 + .055 * Math.sin(Math.PI * j / steps) ** 2;
      if (light) {
        for (const face of [1, -1]) for (const edge of [-1, 1]) {
          const v = p.clone().addScaledVector(tangent, edge * width).addScaledVector(radial, face * .04); vertices.push(v.x, v.y, v.z); normals.push(radial.x * face, radial.y * face, radial.z * face);
        }
        if (j < steps) { const n = j * 4; indices.push(n, n + 4, n + 1, n + 1, n + 4, n + 5, n + 2, n + 3, n + 6, n + 3, n + 7, n + 6); }
        continue;
      }
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, v = p.clone().addScaledVector(tangent, Math.cos(a) * width).addScaledVector(radial, Math.sin(a) * .065);
        vertices.push(v.x, v.y, v.z);
        if (j < steps) { const n = j * 8 + k, next = j * 8 + (k + 1) % 8; indices.push(n, next, n + 8, next, next + 8, n + 8); }
      }
    }
    const fold = new THREE.BufferGeometry(); fold.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); fold.setIndex(indices);
    if (light) fold.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); else fold.computeVertexNormals();
    parts.push(fold);
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return geometry;
}
export function myceliumStem(mobile: boolean, light = false): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = new THREE.CylinderGeometry(.15, .34, 1, light ? 6 : mobile ? 7 : 12, light ? 3 : 6), p = main.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + .5; p.setXYZ(i, p.getX(i) + Math.sin(y * Math.PI) * .13, y, p.getZ(i)); } main.computeVertexNormals(); parts.push(main);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const points = [new THREE.Vector3(.06, .62, 0), new THREE.Vector3(Math.cos(a) * .28, .86, Math.sin(a) * .28), new THREE.Vector3(Math.cos(a) * .7, 1, Math.sin(a) * .7)];
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), light ? 4 : 9, .075, light ? 3 : 5, false));
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return geometry;
}

export function myceliumOpal(mobile: boolean, light = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.9, light ? 12 : mobile ? 16 : 28, light ? 8 : mobile ? 10 : 20), p = geometry.getAttribute('position'), colors: number[] = [], color = new THREE.Color();
  const cream = new THREE.Color('#e3dfbd'), mint = new THREE.Color('#82d5ba'), blue = new THREE.Color('#91bddb');
  for (let i = 0; i < p.count; i++) {
    const fire = Math.sin(p.getX(i) * 12 + Math.sin(p.getY(i) * 9)) * Math.cos(p.getZ(i) * 10 - p.getY(i) * 7);
    color.copy(cream).lerp(fire > 0 ? mint : blue, Math.abs(fire) * .8); colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return geometry;
}

/** One mushroom: its crown centre in world space for distance tests, and the local matrices of its three parts. */
export interface GroveInstance { center: THREE.Vector3; scale: number; crown: THREE.Matrix4; stem: THREE.Matrix4; opal: THREE.Matrix4 }
/** Within this many metres per unit of crown scale a crown keeps every sample: about 36 m for a tall crown, 13 m for a ring-scale shrub. */
export const GROVE_FULL_DETAIL = 36;
export type GroveDetail = 'full' | 'light' | 'hidden';
/** The forest's fog margin hides a crown; its own size picks the detail, so small shrubs switch to full only up close. */
export function groveDetail(distance: number, scale: number, range: number, mapView = false): GroveDetail {
  if (!mapView && forestLod(distance, range) === 'hidden') return 'hidden';
  return distance < GROVE_FULL_DETAIL * scale ? 'full' : 'light';
}
const PARTS = ['crown', 'stem', 'opal'] as const, LEVELS: GroveDetail[] = ['hidden', 'light', 'full'];

/**
 * Tall crowns and ring-scale shrubs share six instanced batches (full and light crown, stem and opal). Each update gives every
 * mushroom a detail level from its own distance, then repacks the batches only when a level changed, so the grove costs at most
 * six draws and its bounds shrink to the crowns actually drawn. The light silhouette matches, so a cached shadow map can wait.
 */
export class MyceliumGrove {
  readonly meshes: THREE.InstancedMesh[] = [];
  private readonly batches: Record<'full' | 'light', THREE.InstancedMesh[]>;
  private readonly detail: Uint8Array;
  private warm = false;
  constructor(parent: THREE.Object3D, private readonly instances: GroveInstance[], silver: THREE.Material, opal: THREE.Material, mobile: boolean) {
    const batch = (light: boolean): THREE.InstancedMesh[] => PARTS.map((part) => {
      const geometry = part === 'crown' ? myceliumCrown(mobile, light) : part === 'stem' ? myceliumStem(mobile, light) : myceliumOpal(mobile, light);
      const mesh = new THREE.InstancedMesh(geometry, part === 'opal' ? opal : silver, Math.max(1, instances.length));
      mesh.name = light ? { crown: 'Mycelium · light silver gills (distance and shrubs)', stem: 'Mycelium · light branching stems', opal: 'Mycelium · light opal hearts' }[part]
        : { crown: 'Mycelium · curled open silver gills', stem: 'Mycelium · branching stems', opal: 'Mycelium · opal hearts' }[part];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); this.meshes.push(mesh); return mesh;
    });
    this.batches = { full: batch(false), light: batch(true) };
    this.detail = new Uint8Array(instances.length).fill(255);
    // Until the first camera update every crown is full, as the grove was built before detail levels existed.
    this.pack(() => 'full');
  }
  /** `range` is the forest's fog-limited walking range; the map view never hides a crown. Returns whether the batches were repacked. */
  update(camera: THREE.Camera, range: number, mapView = false, pinned?: 'full' | 'light' | null): boolean {
    if (this.warm) return false;
    const origin = camera.position;
    return this.pack((instance) => pinned ?? groveDetail(origin.distanceTo(instance.center), instance.scale, range, mapView));
  }
  /**
   * Before the first frame every mushroom fills both detail levels, so the precompile and the first shadow pass build all six
   * shaders during loading (on WebGPU each instanced mesh builds its own). The next update() repacks from the camera.
   */
  warmUp(on: boolean): void {
    this.warm = on; this.detail.fill(255);
    if (!on) return;
    for (const batch of Object.values(this.batches)) PARTS.forEach((part, p) => {
      const mesh = batch[p]; mesh.count = 0;
      for (const instance of this.instances) mesh.setMatrixAt(mesh.count++, instance[part]);
      mesh.visible = mesh.count > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.count) mesh.computeBoundingSphere();
    });
  }
  private pack(choose: (instance: GroveInstance) => GroveDetail): boolean {
    let changed = false;
    this.instances.forEach((instance, i) => { const level = LEVELS.indexOf(choose(instance)); if (this.detail[i] !== level) { this.detail[i] = level; changed = true; } });
    if (!changed) return false;
    for (const mesh of this.meshes) mesh.count = 0;
    this.instances.forEach((instance, i) => {
      if (!this.detail[i]) return;
      const batch = this.batches[this.detail[i] === 2 ? 'full' : 'light'];
      PARTS.forEach((part, p) => batch[p].setMatrixAt(batch[p].count++, instance[part]));
    });
    for (const mesh of this.meshes) { mesh.visible = mesh.count > 0; mesh.instanceMatrix.needsUpdate = true; if (mesh.count) mesh.computeBoundingSphere(); }
    return true;
  }
}
