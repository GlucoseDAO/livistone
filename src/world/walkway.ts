import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared rendered and physical ribbon. Every segment has upward-facing triangles. */
export function walkwayGeometry(points: THREE.Vector3[], width: number): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  points.forEach((p, i) => {
    const d = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(0, i - 1)]), side = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(width / 2);
    for (const sign of [-1, 1]) positions.push(p.x + sign * side.x, p.y, p.z + sign * side.z);
    if (i < points.length - 1) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function solidMesh(parent: THREE.Group, colliders: ColliderSpec[], geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i) }); return mesh;
}
export function guardRail(parent: THREE.Group, colliders: ColliderSpec[], points: THREE.Vector3[], material: THREE.Material): void {
  const posts: THREE.BufferGeometry[] = [];
  const top = points.map(p => p.clone().add(new THREE.Vector3(0, 1.15, 0)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), points.length * 2, .045, 5, false), material); parent.add(tube);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], d = b.clone().sub(a), middle = a.clone().add(b).multiplyScalar(.5);
    colliders.push({ type: 'box', position: [middle.x, middle.y + .62, middle.z], size: [.05, .64 + Math.abs(d.y) / 2, Math.hypot(d.x, d.z) / 2 + .025], yaw: Math.atan2(d.x, d.z) });
    if (i % 4 === 0) posts.push(new THREE.CylinderGeometry(.035, .035, 1.1, 5).translate(a.x, a.y + .55, a.z));
  }
  if (posts.length) { parent.add(new THREE.Mesh(mergeGeometries(posts)!, material)); posts.forEach(g => g.dispose()); }
}
