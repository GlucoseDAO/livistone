import * as THREE from 'three';
import { renderGroup, uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { hazeLook } from '../render/aerial';
import { ShellMaterial } from '../render/shell';
import { nightEmission } from './night-lighting';

/**
 * At night the hall's two front lamps stand under a metre from the amber, and the radiance there is many times what Neutral
 * shows as white: it turned those spots peach-white where ACES had kept them orange. Past `knee` the amber's own radiance now
 * eases toward knee + span (about 1.6, a tenth of the way to white under the night exposure) keeping its hue. By day the knee
 * sits out of reach, so sunlit amber and its glints are untouched; dev-only ?haze=classic keeps the night hot spots too.
 */
const NIGHT_PEAK = { knee: .8, span: .8 }, OFF = 1e6;
const knee = uniform(OFF).setGroup(renderGroup);

/** A ShellMaterial: from inside the hall the rich amber shows the classic renderer's second amber layer. */
export function mitoringAmberMaterial(mobile: boolean): ShellMaterial {
  const material = new ShellMaterial({ color: '#dba347', metalness: 0, roughness: .23,
    ior: 1.54, thickness: 1.8, attenuationColor: '#e9a044', attenuationDistance: 6,
    envMapIntensity: 1.25, clearcoatRoughness: .12, side: THREE.DoubleSide,
    emissive: '#b34c06', emissiveIntensity: .045 });
  material.name = 'Mitoring cloudy amber'; material.userData.mitoringAmber = material.userData.heroEnv = true;
  material.peak = { knee: knee as unknown as Node<'float'>, span: NIGHT_PEAK.span };
  material.userData.onNight = (night: boolean) => { knee.value = night && hazeLook() === 'behind' ? NIGHT_PEAK.knee : OFF; };
  nightEmission(material, '#e8a235', .24); setMitoringAmberQuality(material, mobile); return material;
}

export function setMitoringAmberQuality(material: ShellMaterial, low: boolean): void {
  material.transmission = low ? 0 : .68; material.clearcoat = low ? 0 : .28;
  // The reduced amber blends in linear light before tone mapping, where the bright sky behind it outweighs what it did in
  // the classic renderer's blend of encoded colours: .92 here looks as the classic .76 did.
  material.opacity = low ? .92 : 1; material.transparent = low; material.depthWrite = !low;
  material.forceSinglePass = true; material.needsUpdate = true;
}

export async function loadMitoringAmberTextures(material: ShellMaterial, mobile: boolean): Promise<void> {
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
  const material = new THREE.MeshStandardMaterial({ color: '#f1eee8', metalness: 1, roughness: .34, envMapIntensity: 1.05 });
  material.name = 'Mitoring polished cast silver'; material.userData.heroEnv = true; return material;
}

export async function loadMitoringSilverTexture(material: THREE.MeshStandardMaterial, mobile: boolean): Promise<void> {
  try {
    const texture = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/mitoring/silver-roughness-${mobile ? 128 : 256}.webp`);
    texture.colorSpace = THREE.NoColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = mobile ? 2 : 4; material.roughnessMap = texture; material.needsUpdate = true;
  } catch { /* Cast silver remains reflective without its optional surface map. */ }
}
