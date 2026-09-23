import * as THREE from 'three';
export const PATH_WIDTH = 2.6;
/** Round joins close the wedge between differently directed path ribbons. UVs stay in world coordinates. */
export function pathJoin(x: number, z: number, radius: number, y: number, offsetX = 0, offsetZ = 0): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, 24).rotateX(-Math.PI / 2).translate(x, y, z);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + offsetX) / 4, (position.getZ(i) + offsetZ) / 4);
  return geometry;
}
