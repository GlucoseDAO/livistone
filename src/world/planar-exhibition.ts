import * as THREE from 'three';
import { COLLECTION, EXHIBITS, photoURL, photoSize } from '../game/exhibits';
import type { Exhibit } from '../game/exhibits';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';
import { posterLayout } from './poster-layout';

const textures = new Map<string, Promise<THREE.Texture>>();
function photograph(file: string): Promise<THREE.Texture> {
  if (!textures.has(file)) textures.set(file, new THREE.TextureLoader().loadAsync(photoURL(file)).then((map) => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map; }).catch((error: unknown) => { textures.delete(file); throw error; }));
  return textures.get(file)!;
}
function textLines(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string): number {
  ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; let line = '';
  for (const word of text.split(' ')) { if (line && ctx.measureText(line + ' ' + word).width > 860) { ctx.fillText(line, 50, y); y += size * 1.32; line = word; } else line += (line ? ' ' : '') + word; }
  ctx.fillText(line, 50, y); return y + size * 1.6;
}
function caption(piece: Exhibit, width: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = Math.round(960 * 1.4 / width); const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = textLines(ctx, piece.title, 54, 40, '#25473b');
  y = textLines(ctx, `${piece.type} · ${piece.year}`, y + 4, 27, '#856c43');
  y = textLines(ctx, piece.materials, y, 25, '#445c4b');
  y = textLines(ctx, piece.dimensions, y, 24, '#445c4b');
  y = textLines(ctx, piece.collection ?? '', y + 8, 23, '#687461');
  textLines(ctx, piece.description, y + 8, 25, '#445c4b');
  textLines(ctx, 'Livia Zaharia · studio photograph', canvas.height - 67, 23, '#687461');
  textLines(ctx, 'Click photo to enlarge · E / tap for facts', canvas.height - 25, 23, '#25473b');
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}

export class PlanarExhibition {
  readonly photos: THREE.Mesh[] = [];
  readonly textSurfaces: THREE.Mesh[] = [];
  readonly ready: Promise<void>;
  readonly pieces: Exhibit[];
  selected: Exhibit;
  constructor(readonly id: string, parent: THREE.Group, x: number, z: number, colliders: ColliderSpec[], interactives: Interactive[]) {
    this.pieces = COLLECTION.filter((piece) => piece.location === id);
    this.selected = this.pieces.find((piece) => piece.discovery === EXHIBITS.find((anchor) => anchor.landmark === id)?.discovery) ?? this.pieces[0];
    const layout = posterLayout(id, this.pieces.length), tasks: Promise<void>[] = [];
    const frameMaterial = new THREE.MeshStandardMaterial({ color: '#394e42', roughness: .8 }), footMaterial = new THREE.MeshStandardMaterial({ color: '#c2aa77', roughness: .4, metalness: .5 });
    const width = id === 'science' ? 1.72 : 2, height = 2.95;
    this.pieces.forEach((piece, i) => {
      const site = layout[i], group = new THREE.Group(); group.position.set(site.x, 0, site.z); group.rotation.y = site.yaw; parent.add(group);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(width + .1, height, .09), frameMaterial); frame.position.y = 1.82; group.add(frame);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(width * .7, .16, .48), footMaterial); foot.position.y = .23; group.add(foot);
      colliders.push({ type: 'box', position: [x + site.x, 1.82 + (id === 'station' ? 0 : .16), z + site.z], size: [(width + .1) / 2, height / 2, .09], yaw: site.yaw });
      colliders.push({ type: 'box', position: [x + site.x, .23 + (id === 'station' ? 0 : .16), z + site.z], size: [width * .35, .08, .24], yaw: site.yaw });
      const info = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.4), new THREE.MeshBasicMaterial({ map: caption(piece, width), toneMapped: false })); info.position.set(0, 1.07, .051); info.userData.posterInfo = true; info.userData.piece = piece.discovery; group.add(info); this.textSurfaces.push(info);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.45), new THREE.MeshBasicMaterial({ color: '#f4f0e5', toneMapped: false })); paper.position.set(0, 2.49, .051); group.add(paper);
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(width - .06, 1.4), new THREE.MeshBasicMaterial({ color: '#c4cebd', toneMapped: false })); picture.position.set(0, 2.49, .057); picture.userData.piece = piece.discovery; picture.userData.photoIndex = 0; picture.userData.exhibition = id; group.add(picture); this.photos.push(picture);
      tasks.push(photograph(piece.photos[0].thumb ?? piece.photos[0].file).then((map) => {
        const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, width - .06, 1.4);
        picture.geometry.dispose(); picture.geometry = new THREE.PlaneGeometry(size.width, size.height); const material = picture.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
      }).catch(() => { picture.visible = false; }));
      interactives.push({ id: piece.discovery, object: info, position: new THREE.Vector3(x + site.x, 1.75, z + site.z) });
    });
    this.ready = Promise.all(tasks).then(() => undefined);
  }
  select(piece: Exhibit): boolean { if (!this.pieces.includes(piece)) return false; this.selected = piece; return true; }
  turn(direction: number): void { this.selected = this.pieces[(this.pieces.indexOf(this.selected) + direction + this.pieces.length) % this.pieces.length]; }
}
