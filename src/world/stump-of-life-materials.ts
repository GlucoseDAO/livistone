import * as THREE from 'three';
import { dot, float, mix, pow, texture, vec3 } from 'three/tsl';
import { displayMaterial } from '../render/output';
import { ShellMaterial } from '../render/shell';

/** The original called-base image remains the sole source of engraving; only its material response changes. */
export function stumpCapMaterial(map: THREE.Texture): THREE.MeshStandardNodeMaterial {
  const material = new ShellMaterial({ map, color: '#d8dde0', metalness: .96, roughness: .38 });
  material.peak = { knee: float(.45), span: .28 };
  material.colorNode = vec3(.62, .64, .66);
  material.name = 'Polished silver · actual DNA engraving'; material.envMapIntensity = .55;
  material.userData.heroEnv = true; material.userData.stumpMetal = true;
  return material;
}

/** The same UVs and original data image supply the ink, which stays dark across a metal reflection or sun glint. */
export function stumpEngravingMaterial(map: THREE.Texture): THREE.MeshBasicNodeMaterial {
  const sample = texture(map); sample.updateMatrix = true;
  // Preserve the native hairlines' filtered coverage, rather than thresholding faint tracks out at walking distance.
  const paper = new THREE.Color('#e5e5e5').r, ink = float(paper).sub(dot(sample.rgb, vec3(.2126, .7152, .0722))).div(paper).clamp();
  const material = displayMaterial({ color: '#151718', transparent: true, alphaTest: .004, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  material.opacityNode = ink; material.name = 'Native DNA marks · dark engraving'; material.userData.stumpEngraving = true;
  return material;
}

/** Weathered timber keeps the scan's knots, cavities and grain, with less forest moss in its colour. */
export function stumpWoodMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ map: source.map, normalMap: source.normalMap, roughnessMap: source.roughnessMap, normalScale: source.normalScale.clone().multiplyScalar(.65), roughness: .96, metalness: 0, side: source.side });
  const scan = texture(source.map!).rgb, value = dot(scan, vec3(.2126, .7152, .0722));
  material.colorNode = mix(vec3(pow(value, .86)), scan, .20).mul(vec3(1.70, 1.34, .94));
  material.name = 'Weathered timber · CC0 scan grain'; material.userData.stumpWood = true;
  return material;
}
