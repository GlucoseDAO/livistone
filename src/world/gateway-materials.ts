import * as THREE from 'three';

function texture(data: Uint8Array, width: number, height: number, mobile: boolean, color = false): THREE.DataTexture {
  const map = new THREE.DataTexture(data, width, height); map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = mobile ? 2 : 8; map.needsUpdate = true; return map;
}

export function gatewayMaterials(mobile: boolean): { silver: THREE.MeshStandardMaterial; limestone: THREE.MeshStandardMaterial; gem: THREE.MeshPhysicalMaterial } {
  const n = mobile ? 128 : 256, stone = new Uint8Array(n * n * 4), relief = new Uint8Array(stone.length), polish = new Uint8Array(stone.length);
  let seed = 701; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = (y * n + x) * 4, grain = rand(), pore = grain < .022 ? 25 + rand() * 23 : 0;
    const cloud = Math.sin(x / n * Math.PI * 4 + Math.sin(y / n * Math.PI * 2)) * Math.cos(y / n * Math.PI * 6), tone = cloud * 5 + (grain - .5) * 12 - pore;
    stone[k] = 230 + tone; stone[k + 1] = 220 + tone; stone[k + 2] = 200 + tone; stone[k + 3] = 255;
    relief[k] = relief[k + 1] = relief[k + 2] = 163 + (grain - .5) * 26 - pore * 2; relief[k + 3] = 255;
    polish[k] = polish[k + 1] = polish[k + 2] = 205 + rand() * 32; polish[k + 3] = 255;
  }
  const silver = new THREE.MeshStandardMaterial({ color: '#f1f3f4', metalness: 1, roughness: .21, roughnessMap: texture(polish, n, n, mobile), envMapIntensity: 1.65 });
  silver.name = 'Polished cast silver';
  const limestone = new THREE.MeshStandardMaterial({ map: texture(stone, n, n, mobile, true), bumpMap: texture(relief, n, n, mobile), bumpScale: .016, roughness: .88, metalness: 0 });
  limestone.name = 'Honed porous limestone';
  const width = 512, height = 64, color = new Uint8Array(width * height * 4);
  const emerald = new THREE.Color('#07864b'), lime = new THREE.Color('#c8df3b'), c = new THREE.Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1), k = (y * width + x) * 4;
    // The reference tourmaline is colour-zoned along its length, with fine growth striations.
    const band = .95 + .035 * Math.sin(v * 155 + Math.sin(u * 18) * .7) + .015 * Math.sin(v * 510 + u * 7);
    c.copy(emerald).lerp(lime, THREE.MathUtils.smoothstep(u, .08, .96)).multiplyScalar(band).convertLinearToSRGB();
    color[k] = c.r * 255; color[k + 1] = c.g * 255; color[k + 2] = c.b * 255; color[k + 3] = 255;
  }
  const map = texture(color, width, height, mobile, true); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const gem = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map, metalness: 0, roughness: .065, transmission: .82, ior: 1.62,
    thickness: .8, attenuationColor: '#bde99a', attenuationDistance: 3.5, dispersion: mobile ? 0 : .025,
    envMapIntensity: 1.45, clearcoat: .5, clearcoatRoughness: .06, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .035 });
  gem.name = 'Green colour-zoned tourmaline'; gem.userData.gatewayGem = true; setGatewayQuality(gem, mobile);
  return { silver, limestone, gem };
}

export function setGatewayQuality(gem: THREE.MeshPhysicalMaterial, low: boolean): void {
  gem.transmission = low ? 0 : .82; gem.opacity = 1; gem.roughness = low ? .12 : .065; gem.dispersion = low ? 0 : .025;
  gem.emissiveIntensity = low ? .12 : .035; gem.needsUpdate = true;
}
