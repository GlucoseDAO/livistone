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
      const part = mesh.geometry.clone().applyMatrix4(relativeMatrix(mesh, parent)), count = part.index?.count ?? part.getAttribute('position').count;
      if (parts.length && size + count > maxIndices) flush();
      parts.push(part); size += count; mesh.removeFromParent();
    }
    flush();
  }
  return result;
}
