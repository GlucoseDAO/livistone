import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MYCELIUM_RADIUS = 2.7;
/** The ring's curled, pierced silver folds wrap an opal; no fabric panels or umbrella spokes. */
export function myceliumCrown(mobile: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], folds = mobile ? 18 : 26;
  for (let i = 0; i < folds; i++) {
    const angle = i / folds * Math.PI * 2, reach = 1 + Math.sin(i * 2.399) * .07;
    const profile = [[.42, -.6, -.06], [1.2, -.5, -.14], [2.12, -.22, -.18], [2.4, .2, 0], [2.09, .61, .16], [1.2, .85, .14], [.49, .48, .06]];
    const points = profile.map(([r, y, side]) => new THREE.Vector3(Math.cos(angle) * r * reach - Math.sin(angle) * side, y, Math.sin(angle) * r * reach + Math.cos(angle) * side));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), mobile ? 24 : 40, .105, mobile ? 5 : 8, true));
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return geometry;
}
export function myceliumStem(mobile: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const main = new THREE.CylinderGeometry(.15, .34, 1, mobile ? 7 : 12, 6), p = main.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + .5; p.setXYZ(i, p.getX(i) + Math.sin(y * Math.PI) * .13, y, p.getZ(i)); } main.computeVertexNormals(); parts.push(main);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const points = [new THREE.Vector3(.06, .62, 0), new THREE.Vector3(Math.cos(a) * .28, .86, Math.sin(a) * .28), new THREE.Vector3(Math.cos(a) * .7, 1, Math.sin(a) * .7)];
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 9, .075, 5, false));
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return geometry;
}

export function myceliumOpal(mobile: boolean): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.9, mobile ? 16 : 28, mobile ? 10 : 20), p = geometry.getAttribute('position'), colors: number[] = [], color = new THREE.Color();
  const cream = new THREE.Color('#e3dfbd'), mint = new THREE.Color('#82d5ba'), blue = new THREE.Color('#91bddb');
  for (let i = 0; i < p.count; i++) {
    const fire = Math.sin(p.getX(i) * 12 + Math.sin(p.getY(i) * 9)) * Math.cos(p.getZ(i) * 10 - p.getY(i) * 7);
    color.copy(cream).lerp(fire > 0 ? mint : blue, Math.abs(fire) * .8); colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return geometry;
}
