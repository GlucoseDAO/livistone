import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';

export const TOWN_BOUNDS = { minX: -165, maxX: 195, minZ: -225, maxZ: 115 };
export function transformColliders(specs: ColliderSpec[], matrix: THREE.Matrix4, yaw = 0): ColliderSpec[] {
  return specs.map(spec => {
    if (spec.type === 'box') return { ...spec, position: new THREE.Vector3(...spec.position).applyMatrix4(matrix).toArray() as [number, number, number], yaw: (spec.yaw ?? 0) + yaw };
    const vertices = spec.vertices.slice(), p = new THREE.Vector3();
    for (let i = 0; i < vertices.length; i += 3) { p.fromArray(vertices, i).applyMatrix4(matrix).toArray(vertices, i); }
    return { ...spec, vertices };
  });
}
