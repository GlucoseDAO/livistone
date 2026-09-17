import * as THREE from 'three';
import { informationTexture, TEXT_WIDTH, TEXT_HEIGHT } from './exhibition-text';
import { EXHIBITS, photoURL, photoSize } from '../game/exhibits';
import type { Exhibit } from '../game/exhibits';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';

const DIAMETER_SCALE = 1.35, RADIUS = 1.65 * DIAMETER_SCALE, PHOTO_SLOTS = 4;
export const INFORMATION_COLUMN = { x: 4.2, z: 1, radius: .53 * DIAMETER_SCALE, y: 1.6, height: 2.6, arcWidth: 2.6 * TEXT_WIDTH / TEXT_HEIGHT };
const textures = new Map<string, Promise<THREE.Texture>>();
function photograph(file: string): Promise<THREE.Texture> {
  if (!textures.has(file)) textures.set(file, new THREE.TextureLoader().loadAsync(photoURL(file)).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
  }).catch((error: unknown) => { textures.delete(file); throw error; }));
  return textures.get(file)!;
}
export class Exhibition {
  readonly rotor = new THREE.Group();
  readonly column = new THREE.Vector3();
  readonly photos: THREE.Mesh[] = [];
  readonly textSurfaces: THREE.Mesh[] = [];
  readonly ready: Promise<void>;
  selected: Exhibit;
  paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private revision = 0;
  private readonly panels = new THREE.Group();
  private readonly informationRotor = new THREE.Group();
  private readonly information = new THREE.MeshBasicMaterial({ toneMapped: false });
  private textState = '';
  private refreshText(): void {
    const state = this.selected.discovery + ':' + this.paused; if (state === this.textState) return;
    this.textState = state; this.information.map?.dispose(); this.information.map = informationTexture(this.selected, this.paused); this.information.needsUpdate = true;
  }
  constructor(readonly id: string, parent: THREE.Group, x: number, z: number, colliders: ColliderSpec[], interactives: Interactive[]) {
    this.selected = EXHIBITS.find((e) => e.landmark === id)!;
    this.rotor.position.set(0, 1.9, -1.3); parent.add(this.rotor); this.rotor.add(this.panels);
    const brass = new THREE.MeshStandardMaterial({ color: '#a88d5e', metalness: .65, roughness: .32 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS - .06, RADIUS - .06, 2.5, 64), new THREE.MeshStandardMaterial({ color: '#233c35', roughness: .65 }));
    this.rotor.add(core);
    for (const y of [-1.28, 1.28]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, .035, 8, 64), brass); rim.rotation.x = Math.PI / 2; rim.position.y = y; this.rotor.add(rim);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.72 * DIAMETER_SCALE, 1.85 * DIAMETER_SCALE, .22, 64), brass); base.position.set(0, .25, -1.3); parent.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, .6, 16), brass); stem.position.set(0, .5, -1.3); parent.add(stem);
    // The square envelope includes every rotating panel and leaves a generous passage around it.
    colliders.push({ type: 'box', position: [x, 1.8, z - 1.3], size: [1.75 * DIAMETER_SCALE, 1.7, 1.75 * DIAMETER_SCALE] });
    interactives.push({ id: this.selected.discovery, object: core, position: new THREE.Vector3(x, 1.9, z + .35) });
    const info = INFORMATION_COLUMN;
    this.informationRotor.position.set(info.x, 0, info.z); parent.add(this.informationRotor);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(info.radius - .015, info.radius - .015, 2.9, 64), new THREE.MeshStandardMaterial({ color: '#e2e8d6', roughness: .65, emissive: '#bdebe2', emissiveIntensity: .12 }));
    column.position.y = info.y; this.informationRotor.add(column); this.column.set(x + info.x, info.y, z + info.z);
    for (const angle of [0, Math.PI]) {
      const arc = info.arcWidth / info.radius;
      const text = new THREE.Mesh(new THREE.CylinderGeometry(info.radius, info.radius, info.height, 64, 1, true, angle - arc / 2, arc), this.information);
      text.position.copy(column.position); text.name = 'Curved catalogue text'; text.userData.exhibition = id; text.userData.information = true;
      this.informationRotor.add(text); this.textSurfaces.push(text);
    }
    for (const y of [.18, .38, 2.85, 3.08]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(info.radius, .022, 8, 48), new THREE.MeshBasicMaterial({ color: '#c8f2df' })); ring.rotation.x = Math.PI / 2; ring.position.y = y; this.informationRotor.add(ring);
    }
    colliders.push({ type: 'box', position: [x + info.x, 1.5, z + info.z], size: [info.radius + .035, 1.5, info.radius + .035] });
    interactives.push({ id: this.selected.discovery, object: column, position: new THREE.Vector3(x + info.x, 1.6, z + info.z) });
    this.ready = this.select(this.selected).then(() => undefined);
  }
  async select(exhibit: Exhibit): Promise<boolean> {
    const revision = ++this.revision;
    const loaded = await Promise.all(exhibit.photos.map((photo) => photograph(photo.file).catch(() => null)));
    if (revision !== this.revision) return false;
    if (loaded.some((map) => !map) && this.photos.length) return false;
    this.selected = exhibit;
    this.panels.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    this.panels.clear(); this.photos.length = 0;
    // An unwrapped arc has the source image's aspect ratio. No crop or square stretching.
    for (let slot = 0; slot < PHOTO_SLOTS; slot++) {
      const index = slot % exhibit.photos.length, texture = loaded[index];
      const image = texture?.image as HTMLImageElement | undefined;
      const size = photoSize(image?.naturalWidth ?? 1, image?.naturalHeight ?? 1);
      const arc = size.width / RADIUS, angle = slot * Math.PI * 2 / PHOTO_SLOTS - arc / 2;
      const picture = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, size.height, 48, 1, true, angle, arc), new THREE.MeshBasicMaterial({ map: texture, color: texture ? '#ffffff' : '#bccbc0', toneMapped: false }));
      picture.name = 'Curved photograph ' + exhibit.photos[index].file; picture.userData.photoIndex = index; picture.userData.exhibition = this.id;
      this.panels.add(picture); this.photos.push(picture);
    }
    this.refreshText();
    this.rotor.rotation.y = 0; this.informationRotor.rotation.y = 0; return true;
  }
  update(dt: number): void { this.refreshText(); if (!this.paused) { this.rotor.rotation.y += dt * .12; this.informationRotor.rotation.y += dt * .06; } }
  turn(direction: number): void { this.paused = true; this.rotor.rotation.y += direction * Math.PI * 2 / PHOTO_SLOTS; }
}
