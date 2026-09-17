import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { TIME_TOWER } from './waterways';

/** Architectural interpretation of the supplied silver hourglass, with an open ground-level passage. */
export function createTimeTower(parent: THREE.Group, colliders: ColliderSpec[], mobile: boolean): void {
  const parts: THREE.BufferGeometry[] = [], inner: THREE.BufferGeometry[] = [];
  const point = (angle: number, radius: number, y: number): THREE.Vector3 => new THREE.Vector3(Math.sin(angle + Math.PI / 6) * radius, y, Math.cos(angle + Math.PI / 6) * radius);
  const strand = (points: THREE.Vector3[], radius = .19, target = parts): void => {
    target.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), mobile ? 36 : 72, radius, mobile ? 6 : 10, false));
  };
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, next = a + Math.PI / 3;
    strand([point(a, 3.8, .08), point(a + .12, 3.1, 4), point(a + .2, 1.5, 9), point(a + .28, 1.05, 12), point(a + .38, 1.8, 18), point(a + .3, 3.1, 23), point(a + .2, 4.25, 27)]);
    // Tall scallops make a flared, pointed crown instead of a flat circular cap.
    strand([point(a + .2, 4.25, 27), point(a + .35, 3.4, 23), point(a + .6, 2.7, 21), point(next - .05, 3.4, 23), point(next + .2, 4.25, 27)], .23);
    strand([point(a, 3.8, .08), point(a + .15, 3.2, 3.5), point(a + .55, 2.8, 5.7), point(next - .15, 3.2, 3.5), point(next, 3.8, .08)], .23);
    for (const [y, r, height] of [[6, 2.5, 4.3], [15.5, 1.55, 4.8], [20.5, 2.65, 3.6]]) {
      strand([point(a + .25, r, y), point(a + .55, r + .45, y + height * .45), point(next + .15, r + .2, y + height), point(next + .25, r, y + .6)], .13);
    }
    strand([point(a + .18, 2.8, 5), point(a + .45, .8, 12), point(a + .5, 2, 21)], .08, inner);
  }
  const silver = new THREE.MeshStandardMaterial({ color: '#dce5e8', metalness: .9, roughness: .22, envMapIntensity: 1.4 });
  const shadowSilver = new THREE.MeshStandardMaterial({ color: '#727e83', metalness: .82, roughness: .3 });
  for (const [geometries, material] of [[parts, silver], [inner, shadowSilver]] as const) {
    const geometry = mergeGeometries(geometries)!.translate(TIME_TOWER.x, 0, TIME_TOWER.z);
    const tower = new THREE.Mesh(geometry, material); tower.name = 'Time tower — silver hourglass'; tower.castShadow = tower.receiveShadow = true; parent.add(tower);
    colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: new Uint32Array(geometry.index!.array) });
    geometries.forEach((g) => g.dispose());
  }
}
