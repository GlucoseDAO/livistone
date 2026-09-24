import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { COLLECTION, photoSize, photoURL } from '../game/exhibits';
import { GATEWAY_POSTER } from './gateway-layout';
import { paintPosterText } from './poster-text';
import { terrainHeight } from './terrain';

function caption(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 800;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 1024, 800);
  ctx.fillStyle = '#8b7046'; ctx.font = '600 30px sans-serif'; ctx.letterSpacing = '4px'; ctx.fillText('THE RING BEHIND THE BRIDGE', 58, 82);
  ctx.fillStyle = '#25473b'; ctx.font = '58px Georgia, serif'; ctx.letterSpacing = '0px'; ctx.fillText('King’s Chapel', 58, 163); ctx.fillText('Double Ring', 58, 224);
  ctx.fillStyle = '#6b755f'; ctx.font = '29px sans-serif'; ctx.fillText('Livia Zaharia · silver, enhanced tourmaline · 2022', 58, 285);
  paintPosterText(ctx, 'The ring’s open silver tips, fan ribs and long green stone inspired the arch above this bridge. The walk-through gateway is a Livistone interpretation of the original jewel.', 58, 342, 908, 355, 44);
  ctx.fillStyle = '#25473b'; ctx.font = '27px sans-serif'; ctx.fillText('Click the photo · E / tap for the story', 58, 754);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}

/** The source photograph sits beside the bridge arch, outside its clear walking span. */
export function createGatewayPoster(parent: THREE.Group, colliders: ColliderSpec[]): { panels: THREE.Mesh[]; position: THREE.Vector3; ready: Promise<void> } {
  const site = GATEWAY_POSTER, ground = terrainHeight(site.x, site.z), group = new THREE.Group();
  group.name = 'King’s Chapel source poster'; group.position.set(site.x, ground, site.z); group.rotation.y = site.yaw; parent.add(group);
  const paper = new THREE.MeshBasicMaterial({ color: '#f4f0e5', toneMapped: false }), metal = new THREE.MeshStandardMaterial({ color: '#c2aa77', roughness: .4, metalness: .5 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.05, .1), paper); frame.position.y = 1.78; group.add(frame);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.45, .16, .48), metal); foot.position.y = .23; group.add(foot);
  colliders.push({ type: 'box', position: [site.x, ground + 1.78, site.z], size: [1.1, 1.525, .05], yaw: site.yaw });
  colliders.push({ type: 'box', position: [site.x, ground + .23, site.z], size: [.725, .08, .24], yaw: site.yaw });
  const panels: THREE.Mesh[] = [], photoFaces: THREE.Mesh[] = [], texture = caption();
  for (const side of [1, -1]) {
    const info = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.45), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    info.position.set(0, 1.08, side * .056); if (side < 0) info.rotation.y = Math.PI;
    info.userData.discovery = 'kings-chapel'; info.userData.posterInfo = true; group.add(info); panels.push(info);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.45), new THREE.MeshBasicMaterial({ color: '#f4f0e5', toneMapped: false }));
    photo.position.set(0, 2.50, side * .058); if (side < 0) photo.rotation.y = Math.PI;
    photo.userData.piece = 'kings-chapel'; photo.userData.photoIndex = 0; group.add(photo); panels.push(photo); photoFaces.push(photo);
  }
  const piece = COLLECTION.find(p => p.discovery === 'kings-chapel')!;
  const ready = new THREE.TextureLoader().loadAsync(photoURL(piece.photos[0].thumb ?? piece.photos[0].file)).then(map => {
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, 2.05, 1.45);
    for (const face of photoFaces) { face.geometry.dispose(); face.geometry = new THREE.PlaneGeometry(size.width, size.height); const material = face.material as THREE.MeshBasicMaterial; material.map = map; material.needsUpdate = true; }
  }).catch(() => { for (const face of photoFaces) face.visible = false; });
  return { panels, position: new THREE.Vector3(site.x, ground + 1.78, site.z), ready };
}
