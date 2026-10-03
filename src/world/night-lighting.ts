import * as THREE from 'three';
import { float, materialOpacity, materialReference, texture, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphicsProfile } from '../game/graphics';
import { fromSRGB, toSRGB, untoneMapped } from '../render/output';
import type { GraphicsTier } from '../game/graphics';

let halo: THREE.DataTexture | undefined;
function haloTexture(): THREE.DataTexture {
  if (halo) return halo;
  const size = 64, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2)), i = (y * size + x) * 4;
    bytes[i] = bytes[i + 1] = bytes[i + 2] = 255; bytes[i + 3] = Math.round(255 * Math.exp(-r * r * 7) * Math.max(0, 1 - r) ** 2);
  }
  halo = new THREE.DataTexture(bytes, size, size); halo.minFilter = halo.magFilter = THREE.LinearFilter; halo.needsUpdate = true; return halo;
}

// Additive halos were blended after the classic renderer encoded sRGB, untouched by tone mapping: they added the sRGB colour
// times the falloff. The output pass now tone-maps them, so each pixel adds the radiance that maps back to that over the dark
// night scene. One node for every halo; colour and opacity stay per material.
let haloNode: Node<'vec4'> | undefined;
/** A depth-tested halo and a light location; the renderer shares a fixed pool of actual lights. */
export function addGlow(parent: THREE.Object3D, position: THREE.Vector3, color: string, size: number, intensity = 0, distance = 12, opacity = .45): THREE.Sprite {
  haloNode ??= vec4(untoneMapped(fromSRGB(toSRGB(materialReference('color', 'color') as unknown as Node<'vec3'>).mul(texture(haloTexture()).a.mul(materialOpacity)))), 1);
  const material = new THREE.SpriteNodeMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  material.colorNode = haloNode; material.opacityNode = float(1);
  const glow = new THREE.Sprite(material); glow.position.copy(position); glow.scale.setScalar(size); glow.name = 'Night halo';
  glow.userData.nightGlow = true; glow.userData.lightSource = { color, intensity, distance }; parent.add(glow); return glow;
}

export function nightEmission(material: THREE.MeshStandardMaterial, color: string, intensity: number): void {
  material.userData.dayEmission = { color: material.emissive.getHex(), intensity: material.emissiveIntensity };
  material.userData.nightEmission = { color, intensity };
}

export class NightLighting {
  private readonly halos: THREE.Sprite[] = [];
  private readonly materials = new Set<THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>();
  private readonly sources: { position: THREE.Vector3; color: string; intensity: number; distance: number }[] = [];
  private readonly surfaceHalos: { sprite: THREE.Sprite; center: THREE.Vector3; offset: number }[] = [];
  private readonly direction = new THREE.Vector3();
  private readonly lights: THREE.PointLight[];
  private night = false;
  constructor(root: THREE.Object3D, scene: THREE.Scene, reduced: boolean, private tier: GraphicsTier = reduced ? 'mobile' : 'gpu') {
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (object instanceof THREE.Sprite && object.userData.nightGlow) {
        this.halos.push(object);
        if (object.userData.surfaceOffset) this.surfaceHalos.push({ sprite: object, center: object.getWorldPosition(new THREE.Vector3()), offset: object.userData.surfaceOffset });
        if (object.userData.lightSource.intensity) this.sources.push({ ...object.userData.lightSource, position: object.getWorldPosition(new THREE.Vector3()) });
      }
      if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ((material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial) && material.userData.nightEmission) this.materials.add(material);
      }
    });
    this.lights = Array.from({ length: graphicsProfile(tier).lights }, () => { const light = new THREE.PointLight('#ffffff', 0, 15, 2); scene.add(light); return light; });
  }
  setNight(night: boolean): void {
    this.night = night; this.halos.forEach(halo => { halo.visible = night && this.tier !== 'cpu'; });
    this.materials.forEach(material => { const value = material.userData[night ? 'nightEmission' : 'dayEmission']; material.emissive.set(value.color); material.emissiveIntensity = value.intensity; });
    if (!night) this.lights.forEach(light => { light.intensity = 0; });
  }
  update(camera: THREE.Camera): void {
    if (!this.night) return;
    // Place the halo just in front of its own opaque opal, retaining depth tests against intervening scenery.
    for (const halo of this.surfaceHalos) { this.direction.copy(camera.position).sub(halo.center).normalize().multiplyScalar(halo.offset).add(halo.center); halo.sprite.position.copy(halo.sprite.parent!.worldToLocal(this.direction)); }
    const sorted = [...this.sources].sort((a, b) => a.position.distanceToSquared(camera.position) - b.position.distanceToSquared(camera.position));
    this.lights.forEach((light, i) => { const source = sorted[i]; if (!source) { light.intensity = 0; return; } light.position.copy(source.position); light.color.set(source.color); light.intensity = source.intensity; light.distance = source.distance; });
  }
}
