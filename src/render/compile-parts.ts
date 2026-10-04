import * as THREE from 'three';

/** Plain meshes share node builds by material and attribute layout; instance/morph/skin data require their own objects. */
export function compileParts(parts: THREE.Object3D[]): THREE.Object3D[] {
  const queue: THREE.Object3D[] = [], seen = new Set<string>();
  const collect = (object: THREE.Object3D): void => {
    if (!object.visible) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      const specialized = mesh as THREE.Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean; isBatchedMesh?: boolean; count?: number };
      const geometry = mesh.geometry;
      if (!object.children.length && !Array.isArray(mesh.material) && !specialized.isInstancedMesh && !specialized.isSkinnedMesh && !specialized.isBatchedMesh && !(specialized.count && specialized.count > 1) && !Object.keys(geometry.morphAttributes).length) {
        const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([name, attribute]) => {
          const interleaved = attribute as THREE.InterleavedBufferAttribute;
          return [name, attribute.constructor.name, attribute.array.constructor.name, attribute.itemSize, attribute.normalized, (attribute as THREE.BufferAttribute).gpuType, interleaved.data?.stride, interleaved.offset].join(':');
        }).join(',');
        const key = [mesh.material.uuid, attributes, geometry.index?.array.constructor.name, object.type, mesh.receiveShadow, mesh.matrixWorld.determinant() < 0].join('|');
        if (seen.has(key)) return; seen.add(key);
      }
      queue.push(object);
    } else if ((object as THREE.Sprite).isSprite || (object as THREE.Line).isLine || (object as THREE.Points).isPoints) queue.push(object);
    else for (const child of object.children) collect(child);
  };
  parts.forEach(collect); return queue;
}
