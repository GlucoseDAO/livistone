import * as THREE from 'three';
import { EXHIBITS, photoURL } from '../game/exhibits';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';

function label(title: string, lines: string[], small = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = small ? 512 : 768;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#eee9da'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#365044'; ctx.font = '24px sans-serif'; ctx.fillText('LIVIA ZAHARIA  /  STUDIO ARCHIVE', 60, 64);
  ctx.font = '48px Georgia'; ctx.fillText(title, 60, 146, 904);
  ctx.strokeStyle = '#b59b69'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, 177); ctx.lineTo(964, 177); ctx.stroke();
  ctx.fillStyle = '#3c493f'; ctx.font = '29px sans-serif'; lines.forEach((line, i) => ctx.fillText(line, 60, 238 + i * 58, 904));
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}

/** Freestanding gallery walls keep the photographs off the curved glass and the doorway open. */
export function createExhibition(id: string, parent: THREE.Group, x: number, z: number, floorR: number, colliders: ColliderSpec[], interactives: Interactive[]): Promise<void> {
  const exhibit = EXHIBITS.find((e) => e.landmark === id)!;
  const brass = new THREE.MeshStandardMaterial({ color: '#8b754f', metalness: .65, roughness: .38 }), backing = new THREE.MeshStandardMaterial({ color: '#e2dbc9', roughness: .85 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, group: THREE.Group, px: number, py: number, pz: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(px, py, pz); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const back = -floorR + 1.55, loader = new THREE.TextureLoader(), loads: Promise<void>[] = [];
  for (const [i, photo] of exhibit.photos.entries()) {
    const px = (i ? 1 : -1) * 1.45, wall = new THREE.Group(); wall.position.set(px, 0, back); parent.add(wall);
    add(new THREE.BoxGeometry(2.55, 3.1, .17), backing, wall, 0, 1.7, 0);
    add(new THREE.BoxGeometry(2.45, 2.45, .1), brass, wall, 0, 1.92, .12);
    const material = new THREE.MeshBasicMaterial({ map: label(exhibit.title, ['Studio photograph', 'Livia Zaharia'], true), toneMapped: false });
    const picture = add(new THREE.PlaneGeometry(2.25, 2.25), material, wall, 0, 1.92, .18); picture.name = 'Photo ' + photo.file;
    add(new THREE.BoxGeometry(2.65, .16, .65), backing, wall, 0, .08, 0);
    const caption = label(exhibit.title, [exhibit.type + ' · ' + exhibit.year, exhibit.materials, 'E / Discover the original jewelry'], true);
    add(new THREE.PlaneGeometry(2.3, .57), new THREE.MeshBasicMaterial({ map: caption, toneMapped: false }), wall, 0, .43, .1);
    colliders.push({ type: 'box', position: [x + px, 1.7, z + back], size: [1.3, 1.7, .35] });
    interactives.push({ id: exhibit.discovery, object: picture, position: new THREE.Vector3(x + px, 1.95, z + back + .2) });
    loads.push(loader.loadAsync(photoURL(photo.file)).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; material.map?.dispose(); material.map = texture; material.needsUpdate = true;
    }).catch(() => { /* The labelled frame and readable catalogue remain usable without its photo. */ }));
  }
  const table = new THREE.Group(); table.position.set(3.5, 0, 2); table.rotation.y = -.28; parent.add(table);
  add(new THREE.BoxGeometry(1.6, .12, .75), backing, table, 0, .1, 0);
  add(new THREE.CylinderGeometry(.1, .15, 1.12, 10), brass, table, 0, .63, 0);
  const board = add(new THREE.BoxGeometry(2.15, 1.6, .09), brass, table, 0, 1.35, 0); board.rotation.x = -.55;
  const map = label(exhibit.title, ['Artist   Livia Zaharia', 'Object   ' + exhibit.type + ' · ' + exhibit.year, 'Materials   ' + exhibit.materials, 'Size   ' + exhibit.dimensions, 'Romanian Jewelry Week 2025', 'E / Read the catalogue and view photographs']);
  const face = add(new THREE.PlaneGeometry(2.03, 1.48), new THREE.MeshBasicMaterial({ map, toneMapped: false }), table, 0, 1.38, .05); face.rotation.x = -.55;
  colliders.push({ type: 'box', position: [x + 3.5, 1, z + 2], size: [1.12, 1, .7], yaw: -.28 });
  interactives.push({ id: exhibit.discovery, object: face, position: new THREE.Vector3(x + 3.5, 1.5, z + 2.1) });
  return Promise.all(loads).then(() => undefined);
}
