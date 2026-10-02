import * as THREE from 'three';

export function walnutMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#b77b36', roughness: .64, side: THREE.DoubleSide });
  material.name = 'Nut of Power walnut'; return material;
}

export async function loadWalnutTextures(material: THREE.MeshStandardMaterial, mobile: boolean): Promise<void> {
  const loader = new THREE.TextureLoader();
  await Promise.all((mobile ? ['colour', 'ao-roughness'] : ['colour', 'ao-roughness', 'normal']).map(async kind => {
    try {
      const size = kind === 'colour' ? (mobile ? 512 : 1024) : kind === 'normal' ? 512 : (mobile ? 256 : 512);
      const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/city-hall/walnut-${kind}-${size}.webp`);
      texture.colorSpace = kind === 'colour' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = mobile ? 2 : 4; texture.repeat.set(3.2, 3.2);
      if (kind === 'colour') { material.map = texture; material.color.set('#ffffff'); }
      else if (kind === 'normal') { material.normalMap = texture; material.normalScale.set(.22, .22); }
      else { material.roughnessMap = material.aoMap = texture; material.roughness = 1; material.aoMapIntensity = .45; }
      material.needsUpdate = true;
    } catch { /* The golden shell remains usable without its optional baked surface maps. */ }
  }));
}

export function walnutRadius(phi: number, theta: number, radius: number): number {
  // Broad asymmetrical folds carry the outline; finer branching relief belongs in the baked map.
  const folds = .10 * Math.cos(phi * 12 + Math.sin(theta * 6) * .55) + .08 * Math.sin(theta * 20 + phi * 8 + Math.sin(phi * 22) * .4) + .04 * Math.cos(theta * 34 - phi * 12);
  return radius + folds * Math.max(0, Math.sin(theta)) ** .7 * Math.max(0, Math.sin(phi)) ** .7;
}
