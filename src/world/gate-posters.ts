import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { COLLECTION, photoSize, photoURL } from '../game/exhibits';
import { displayMaterial, paperPhotoMaterial } from '../render/output';
import { paintPosterText } from './poster-text';
import { activeSurfaces } from './surfaces';

export interface GatePosterSite { x: number; y: number; z: number; yaw: number }
export function gatePosterColliders(site: GatePosterSite): ColliderSpec[] {
  return [{ type: 'box', position: [site.x, site.y + 1.88, site.z], size: [1.23, 1.63, .05], yaw: site.yaw }, { type: 'box', position: [site.x, site.y + .1, site.z], size: [.8, .1, .3], yaw: site.yaw }];
}
/** A source board at the architectural interpretation; the jewel's original physical collection remains where it is. */
export function createGatePoster(parent: THREE.Group, colliders: ColliderSpec[], site: GatePosterSite, pieceId: string, story: string, title: string): { panels: THREE.Mesh[]; position: THREE.Vector3; ready: Promise<void> } {
  const piece = COLLECTION.find(piece => piece.discovery === pieceId)!;
  const group = new THREE.Group(); group.name = title + ' · original work poster'; group.position.set(site.x, site.y, site.z); group.rotation.y = site.yaw; parent.add(group);
  const metal = activeSurfaces()?.stand ?? new THREE.MeshStandardMaterial({ color: '#c2aa77', metalness: .5, roughness: .4 });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(2.46, 3.26, .1), new THREE.MeshStandardMaterial({ color: '#e6dfcc', roughness: .82 })); backing.position.y = 1.88; backing.castShadow = true; group.add(backing);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(1.6, .2, .6), metal); foot.position.y = .1; foot.castShadow = true; group.add(foot);
  // Cream photo boards remain distinct from the dark pierced-gold building story signs.
  for (const x of [-1.2, 1.2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.045, 3.26, .14), metal); rail.position.set(x, 1.88, 0); group.add(rail); }
  for (const y of [.2725, 3.4875]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(2.46, .045, .14), metal); rail.position.y = y; group.add(rail); }
  colliders.push(...gatePosterColliders(site));
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 960, 600);
  ctx.fillStyle = '#25473b'; ctx.font = '54px Georgia, serif'; ctx.fillText(title, 45, 78);
  ctx.font = '27px sans-serif'; ctx.fillStyle = '#856c43'; ctx.fillText(`${piece.type} · ${piece.year} · Livia Zaharia`, 45, 129);
  paintPosterText(ctx, `${piece.materials}. ${piece.dimensions}. ${piece.description} The building beside this board is a Livistone interpretation of the original work.`, 45, 165, 870, 330, 34);
  ctx.fillStyle = '#25473b'; ctx.font = '26px sans-serif'; ctx.fillText('Click the photo to enlarge · E / tap for the building story', 45, 554);
  const caption = new THREE.CanvasTexture(canvas); caption.colorSpace = THREE.SRGBColorSpace;
  const panels: THREE.Mesh[] = [], tasks: Promise<void>[] = [];
  for (const side of [1, -1]) {
    const index = pieceId === 'eye-of-winter' ? (side === 1 ? Math.min(1, piece.photos.length - 1) : 0) : (side === 1 ? 0 : Math.min(1, piece.photos.length - 1)), source = piece.photos[index];
    const info = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.475), displayMaterial({ map: caption })); info.position.set(0, 1.0775, side * .073); if (side < 0) info.rotation.y = Math.PI;
    Object.assign(info.userData, { discovery: story, posterInfo: true }); group.add(info); panels.push(info);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.63), displayMaterial({ color: '#f4f0e5' })); photo.position.set(0, 2.6325, side * .073); if (side < 0) photo.rotation.y = Math.PI;
    Object.assign(photo.userData, { piece: pieceId, photoIndex: index, gatePoster: true }); group.add(photo); panels.push(photo);
    const ready = new THREE.TextureLoader().loadAsync(photoURL(source.thumb ?? source.file)).then(map => {
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, 2.36, 1.63);
      photo.geometry.dispose(); photo.geometry = new THREE.PlaneGeometry(size.width, size.height); (photo.material as THREE.Material).dispose(); photo.material = paperPhotoMaterial(map);
    }).catch(() => { photo.visible = false; }); tasks.push(ready);
  }
  return { panels, position: new THREE.Vector3(site.x, site.y + 1.88, site.z), ready: Promise.all(tasks).then(() => undefined) };
}
