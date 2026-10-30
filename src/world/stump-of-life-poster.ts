import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { STUMP_IMAGES, STUMP_POSTER_INTRO, STUMP_POSTER_READING } from '../game/stump-of-life';
import { createPlaceSign } from './place-sign';
import type { PlaceSign } from './place-sign';
import { paintPosterText } from './poster-text';
import { terrainSurfaceHeight } from './terrain';
import { transformColliders } from './town-layout';

async function paintStumpPoster(sign: PlaceSign): Promise<void> {
  const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1600;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#171914'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d4b072'; ctx.font = '600 54px sans-serif'; ctx.fillText('LIVIA ZAHARIA · ART, ISLANDS & DNA', 110, 115);
  ctx.fillStyle = '#f5f1df'; ctx.font = '150px Georgia, serif'; ctx.fillText('Stump of Life', 105, 295);
  const rule = ctx.createLinearGradient(110, 0, 740, 0); rule.addColorStop(0, '#d4b072'); rule.addColorStop(1, '#80b7aa'); ctx.fillStyle = rule; ctx.fillRect(110, 345, 630, 8);
  ctx.fillStyle = '#f5f1df'; paintPosterText(ctx, STUMP_POSTER_INTRO, 110, 410, 1260, 390, 65);
  ctx.fillStyle = '#9dccbc'; ctx.font = '600 56px sans-serif'; ctx.fillText('CIRCULAR DNA · ALIGNED RINGS', 110, 890);
  ctx.fillStyle = '#f5f1df'; paintPosterText(ctx, STUMP_POSTER_READING, 110, 950, 1260, 350, 61);
  const image = new Image(); image.src = STUMP_IMAGES.geography; await image.decode();
  const width = 805, height = image.naturalHeight * width / image.naturalWidth;
  ctx.drawImage(image, 1485, 400, width, height);
  ctx.fillStyle = '#9dccbc'; ctx.font = '600 58px sans-serif'; ctx.fillText('550 modern mtDNA sequences', 1485, 1230); ctx.fillText('50 ancient individuals', 1485, 1310);
  ctx.fillStyle = '#f5f1df'; ctx.font = '42px sans-serif'; ctx.fillText('Shown: Liangdao 1 + 9 modern profiles; 6 ancient tracks reserved.', 110, 1400);
  ctx.fillStyle = '#d4b072'; ctx.font = '42px sans-serif'; ctx.fillText('Proposal-scale visualization · 500 mm cap · 45 cm seat height', 110, 1480);
  ctx.fillStyle = '#f5f1df'; ctx.font = '38px sans-serif'; ctx.fillText('Code: github.com/antonkulaga/stump-of-life · Click / E for the story', 110, 1540);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const material = sign.faces[0].material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = texture; material.needsUpdate = true;
}

/** Same two-sided, high-contrast place-sign component as the town's other stories, at full reading scale. */
export function createStumpPoster(parent: THREE.Object3D, colliders: ColliderSpec[], site: { x: number; z: number; yaw: number }): { panels: THREE.Mesh[]; position: THREE.Vector3; ready: Promise<void> } {
  const root = new THREE.Group(), local: ColliderSpec[] = [], sign = createPlaceSign(root, local, { x: 0, z: 0, yaw: 0 }, 'Stump of Life · project poster');
  root.position.set(site.x, terrainSurfaceHeight(site.x, site.z), site.z); root.rotation.y = site.yaw; root.updateMatrix(); parent.add(root);
  colliders.push(...transformColliders(local, root.matrix, site.yaw));
  for (const face of sign.faces) { face.userData.discovery = 'stump-of-life-story'; face.userData.title = 'Stump of Life'; }
  return { panels: sign.faces, position: sign.position.applyMatrix4(root.matrix), ready: paintStumpPoster(sign) };
}
