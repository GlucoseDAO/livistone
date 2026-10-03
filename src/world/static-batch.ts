import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** cpu-detail.ts simplifies a mesh above this many indices; reduced batches stay below it, so the CPU tier keeps each part's shape. */
export const CPU_SIMPLIFY_INDICES = 3600;

/** A mesh's transform relative to an ancestor, from local matrices (world matrices may not be current while building). */
function relativeMatrix(mesh: THREE.Object3D, ancestor: THREE.Object3D): THREE.Matrix4 {
  mesh.updateMatrix(); const matrix = mesh.matrix.clone();
  for (let object = mesh.parent; object && object !== ancestor; object = object.parent) { object.updateMatrix(); matrix.premultiply(object.matrix); }
  return matrix;
}
/**
 * A part of an object-space mapped material (surfaces.ts brass) keeps its own frame through the merge: its position and normal
 * before the transform, and the transform's rotation for the relief, so the map lands on every part as it did unmerged.
 */
function bakeFrame(part: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
  const rotation = new THREE.Quaternion(); matrix.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
  const count = part.getAttribute('position').count, q = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) rotation.toArray(q, i * 4);
  part.setAttribute('surfacePosition', part.getAttribute('position').clone()); part.setAttribute('surfaceNormal', part.getAttribute('normal').clone());
  part.setAttribute('surfaceRotation', new THREE.BufferAttribute(q, 4));
}
/**
 * Static meshes sharing a parent (or the ancestor `into`), material, shadow flags and vertex layout draw as one mesh, with
 * their transforms baked. Take colliders from the separate parts first. Meshes carrying interaction tags in userData stay
 * separate; `maxIndices` splits a large batch. Returns the meshes that now draw the parts.
 */
export function mergeStatic(meshes: THREE.Mesh[], name: string, maxIndices = Infinity, into?: THREE.Object3D): THREE.Mesh[] {
  const groups = new Map<string, THREE.Mesh[]>(), result: THREE.Mesh[] = [];
  for (const mesh of meshes) {
    if (!mesh.parent || Array.isArray(mesh.material) || Object.keys(mesh.userData).length) { result.push(mesh); continue; }
    const geometry = mesh.geometry, key = [(into ?? mesh.parent).uuid, mesh.material.uuid, !!geometry.index, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, Object.keys(geometry.attributes).sort().join(',')].join(':');
    groups.set(key, [...(groups.get(key) ?? []), mesh]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) { result.push(...group); continue; }
    const [first] = group, parent = into ?? first.parent!;
    let parts: THREE.BufferGeometry[] = [], size = 0;
    const flush = (): void => {
      const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose()); parts = []; size = 0;
      if (!geometry) throw new Error(`${name}: parts do not share a vertex layout`);
      const mesh = new THREE.Mesh(geometry, first.material); mesh.name = name; mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
      parent.add(mesh); result.push(mesh);
    };
    for (const mesh of group) {
      const matrix = relativeMatrix(mesh, parent), part = mesh.geometry.clone();
      if ((first.material as THREE.Material).userData.objectSpace) bakeFrame(part, matrix);
      part.applyMatrix4(matrix); const count = part.index?.count ?? part.getAttribute('position').count;
      if (parts.length && size + count > maxIndices) flush();
      parts.push(part); size += count; mesh.removeFromParent();
    }
    flush();
  }
  return result;
}
