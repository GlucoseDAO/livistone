import * as THREE from 'three';
import { nightEmission } from './night-lighting';

export function mitoringAmberMaterial(mobile: boolean): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({ color: '#dba347', metalness: 0, roughness: .23,
    ior: 1.54, thickness: 1.8, attenuationColor: '#e9a044', attenuationDistance: 6,
    envMapIntensity: 1.25, clearcoatRoughness: .12, side: THREE.DoubleSide,
    emissive: '#b34c06', emissiveIntensity: .045 });
  material.name = 'Mitoring cloudy amber'; material.userData.mitoringAmber = true;
  nightEmission(material, '#e8a235', .24); setMitoringAmberQuality(material, mobile); return material;
}

export function setMitoringAmberQuality(material: THREE.MeshPhysicalMaterial, low: boolean): void {
  material.transmission = low ? 0 : .68; material.clearcoat = low ? 0 : .28;
  material.opacity = low ? .76 : 1; material.transparent = low; material.depthWrite = !low;
  material.forceSinglePass = true; material.needsUpdate = true;
}

export async function loadMitoringAmberTextures(material: THREE.MeshPhysicalMaterial, mobile: boolean): Promise<void> {
  const loader = new THREE.TextureLoader(), size = mobile ? 512 : 1024, base = import.meta.env.BASE_URL;
  await Promise.all((['colour', 'roughness'] as const).map(async kind => {
    try {
      const texture = await loader.loadAsync(`${base}textures/mitoring/amber-${kind}-${size}.webp`);
      texture.colorSpace = kind === 'colour' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping; texture.anisotropy = mobile ? 2 : 4;
      if (kind === 'colour') { material.map = texture; material.color.set('#fff4db'); } else material.roughnessMap = texture;
      material.needsUpdate = true;
    } catch { /* The warm reflective material keeps the hall available when a map is missing. */ }
  }));
}

export function mitoringSilverMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#f1eee8', metalness: 1, roughness: .34, envMapIntensity: 1.7 });
  material.name = 'Mitoring polished cast silver'; return material;
}

export async function loadMitoringSilverTexture(material: THREE.MeshStandardMaterial, mobile: boolean): Promise<void> {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/mitoring/silver-roughness-${mobile ? 128 : 256}.webp`);
    texture.colorSpace = THREE.NoColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = mobile ? 2 : 4; material.roughnessMap = texture; material.needsUpdate = true;
  } catch { /* Cast silver remains reflective without its optional surface map. */ }
}
