import * as THREE from 'three';
import { float, materialOpacity, materialReference, max, min, texture, vec3, vec4, viewportSharedTexture } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graphicsProfile } from '../game/graphics';
import { KEEP_DISPLAY, displayed, fromSRGB, toSRGB, untoneMapped } from '../render/output';
import { aerialFactor } from '../render/aerial';
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
// times the falloff to what was displayed. The output pass now tone-maps them, so each pixel reads what is drawn behind it
// (copied once per frame, at the first halo) and adds the radiance that raises its displayed colour by that much: over the
// lit amber as over the dark sky, where the tone curve's shoulder would otherwise swallow a fixed amount. One node for every
// halo; colour and opacity stay per material.
let haloNode: Node<'vec4'> | undefined;
/** A depth-tested halo and a light location; the renderer shares a fixed pool of actual lights. */
export function addGlow(parent: THREE.Object3D, position: THREE.Vector3, color: string, size: number, intensity = 0, distance = 12, opacity = .45): THREE.Sprite {
  if (!haloNode) {
    const behind = viewportSharedTexture().rgb as unknown as Node<'vec3'>, glow = toSRGB(materialReference('color', 'color') as unknown as Node<'vec3'>).mul(texture(haloTexture()).a.mul(materialOpacity));
    // Aerial perspective dims added light by the air's transmittance; fogging it toward the sky would add sky instead.
    haloNode = vec4(max(untoneMapped(fromSRGB(min(displayed(behind).add(glow), vec3(1)))).sub(behind), vec3(0)).mul(vec3(1).sub(aerialFactor)), 1);
  }
  const material = new THREE.SpriteNodeMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  material.colorNode = haloNode; material.opacityNode = float(1); material.mrtNode = KEEP_DISPLAY;
  const glow = new THREE.Sprite(material); glow.position.copy(position); glow.scale.setScalar(size); glow.name = 'Night halo';
  glow.userData.nightGlow = true; glow.userData.lightSource = { color, intensity, distance }; parent.add(glow); return glow;
}

/** Metres over which a pooled light fades before it passes to a nearer source (NightLighting.update). */
export const POOL_FADE = 4;

export function nightEmission(material: THREE.MeshStandardMaterial | THREE.MeshStandardNodeMaterial, color: string, intensity: number): void {
  material.userData.dayEmission = { color: material.emissive.getHex(), intensity: material.emissiveIntensity };
  material.userData.nightEmission = { color, intensity };
}

export class NightLighting {
  private readonly halos: THREE.Sprite[] = [];
  private readonly materials = new Set<THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshStandardNodeMaterial>();
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
        if ((material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshStandardNodeMaterial) && material.userData.nightEmission) this.materials.add(material);
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
    // A source about to hand its light to the nearest one without a light fades out over the last POOL_FADE metres, and that one
    // fades in, so walking past a swap never pops a light pool on or off (the station's lamps put seven candidates on the platform).
    const next = sorted[this.lights.length], reach = next ? next.position.distanceTo(camera.position) : Infinity;
    this.lights.forEach((light, i) => {
      const source = sorted[i]; if (!source) { light.intensity = 0; return; }
      light.position.copy(source.position); light.color.set(source.color); light.distance = source.distance;
      light.intensity = source.intensity * THREE.MathUtils.smoothstep(reach - source.position.distanceTo(camera.position), 0, POOL_FADE);
    });
  }
}
