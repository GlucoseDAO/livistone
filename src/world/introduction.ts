import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { TOWN_INTRO } from '../game/introduction';
import { createPlaceSign, paintPlaceSign } from './place-sign';
import { INTRODUCTION_SITE, INTRODUCTION_SCALE } from './introduction-layout';
import { terrainHeight } from './terrain';
import { transformColliders } from './town-layout';

export function createIntroduction(parent: THREE.Group, colliders: ColliderSpec[]): { panels: THREE.Mesh[]; position: THREE.Vector3 } {
  const group = new THREE.Group(), local: ColliderSpec[] = [];
  const sign = createPlaceSign(group, local, { x: 0, z: 0, yaw: 0 }, 'Welcome to Livistone');
  paintPlaceSign(sign, { eyebrow: 'Livia Zaharia · art & science', title: 'Welcome to Livistone',
    body: 'Architect, parametric jewellery designer, citizen scientist. Livia turns her jewellery into buildings you can enter, and gives her machine learning and scientific projects places of their own. The music is her live kalimba playing, recorded on her phone.',
    footer: 'Click to meet Livia and discover the town' });
  group.scale.setScalar(INTRODUCTION_SCALE); group.rotation.y = INTRODUCTION_SITE.yaw;
  group.position.set(INTRODUCTION_SITE.x, terrainHeight(INTRODUCTION_SITE.x, INTRODUCTION_SITE.z), INTRODUCTION_SITE.z); group.updateMatrix(); parent.add(group);
  // Scale box half-extents as well as centres; transformColliders only rotates/translates boxes.
  const scaled = local.map(spec => spec.type === 'box' ? { ...spec, size: spec.size.map(n => n * INTRODUCTION_SCALE) as [number, number, number] } : spec);
  colliders.push(...transformColliders(scaled, group.matrix, INTRODUCTION_SITE.yaw));
  for (const face of sign.faces) { face.userData.discovery = 'about-livistone'; face.userData.title = TOWN_INTRO.title; }
  return { panels: sign.faces, position: sign.position.applyMatrix4(group.matrix) };
}
