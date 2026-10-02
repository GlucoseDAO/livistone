import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { nightEmission } from './night-lighting';
import { walnutMaterial, walnutRadius, loadWalnutTextures } from './walnut';

export const CITY_HALL = { radius: 10, centerY: 5.7, doorwayY: 3.1, doorPhi: .29 };
const UP = new THREE.Vector3(0, 1, 0);
function point(phi: number, theta: number, radius: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * radius, Math.cos(theta) * radius + CITY_HALL.centerY, Math.cos(phi) * Math.sin(theta) * radius);
}

export function cityHallCrystalMaterial(low: boolean): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({ color: '#e1dce5', roughness: .075, metalness: 0, ior: 1.54, thickness: .9,
    attenuationColor: '#c9c3d0', attenuationDistance: 12, envMapIntensity: 1.5, side: THREE.DoubleSide });
  material.name = 'Nut of Power smoky crystal'; material.userData.cityHallCrystal = true;
  nightEmission(material, '#c4bad6', .16); setCityHallCrystalQuality(material, low); return material;
}

export function setCityHallCrystalQuality(material: THREE.MeshPhysicalMaterial, low: boolean): void {
  material.transmission = low ? 0 : .78; material.transparent = low; material.opacity = low ? .30 : 1;
  material.depthWrite = !low; material.clearcoat = 0; material.forceSinglePass = true; material.needsUpdate = true;
}

function shellPart(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number, walnut: boolean, low: boolean): THREE.BufferGeometry {
  const nx = walnut ? (low ? 40 : 64) : (low ? 24 : 32), ny = walnut ? (low ? 28 : 48) : (low ? 18 : 24);
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const phi = phiStart + i / nx * phiLength, theta = thetaStart + j / ny * thetaLength;
    const p = point(phi, theta, walnut ? walnutRadius(phi, theta, CITY_HALL.radius) : CITY_HALL.radius);
    positions.push(p.x, p.y, p.z); uv.push(phi / Math.PI, theta / Math.PI);
    if (i < nx && j < ny) { const n = j * (nx + 1) + i; indices.push(n, n + nx + 1, n + 1, n + 1, n + nx + 1, n + nx + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); return geometry;
}

function merged(parts: THREE.BufferGeometry[], weld = false): THREE.BufferGeometry {
  for (let i = 0; i < parts.length; i++) if (!parts[i].index) { const original = parts[i]; parts[i] = mergeVertices(original); original.dispose(); }
  const combined = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  const geometry = weld ? mergeVertices(combined) : combined; if (weld) combined.dispose(); geometry.computeVertexNormals(); return geometry;
}

function clasp(phi: number, theta: number, halfSpan: number, low: boolean): THREE.BufferGeometry {
  const section = [[-1, -.8], [-1, .6], [-.8, 1], [.8, 1], [1, .6], [1, -.8], [.8, -1], [-.8, -1]], steps = low ? 16 : 24;
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) for (const [side, depth] of section) {
    const p = phi - halfSpan + i / steps * halfSpan * 2, t = theta + side * .052;
    const radius = Math.sin(p) > 0 ? walnutRadius(p, t, CITY_HALL.radius) : CITY_HALL.radius;
    const v = point(p, t, radius + .18 + depth * .075); positions.push(v.x, v.y, v.z);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < 8; j++) { const a = i * 8 + j, b = i * 8 + (j + 1) % 8; indices.push(a, b, a + 8, b, b + 8, a + 8); }
  for (let j = 1; j < 7; j++) { const end = steps * 8; indices.push(0, j + 1, j, end, end + j, end + j + 1); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); return geometry;
}

/** Facade only: the established floor, doorway, interior and wall colliders remain in Town. */
export function createCityHallFacade(parent: THREE.Group, low: boolean): { colliders: ColliderSpec[]; walnut: THREE.MeshStandardMaterial; crystal: THREE.MeshPhysicalMaterial } {
  const wood = walnutMaterial(), crystal = cityHallCrystalMaterial(low);
  const brass = new THREE.MeshStandardMaterial({ color: '#d8bb7c', roughness: .28, metalness: 1, envMapIntensity: 1.6 });
  const silver = new THREE.MeshStandardMaterial({ color: '#eeeae5', roughness: .25, metalness: 1, envMapIntensity: 1.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#4d2d23', roughness: .9 });
  const end = Math.acos(-CITY_HALL.centerY / CITY_HALL.radius), doorway = Math.acos((CITY_HALL.doorwayY - CITY_HALL.centerY) / CITY_HALL.radius);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string): void => { const object = new THREE.Mesh(geometry, material); object.name = name; object.castShadow = object.receiveShadow = true; parent.add(object); };
  for (const walnut of [true, false]) {
    const start = walnut ? 0 : Math.PI, lowerStart = walnut ? CITY_HALL.doorPhi : Math.PI;
    const geometry = merged([shellPart(start, Math.PI, .01, doorway - .01, walnut, low), shellPart(lowerStart, Math.PI - CITY_HALL.doorPhi, doorway, end - doorway, walnut, low)], true);
    add(geometry, walnut ? wood : crystal, walnut ? 'City Hall walnut shell' : 'City Hall crystal shell');
  }
  const bands: THREE.BufferGeometry[] = [], pins: THREE.BufferGeometry[] = [], seams: THREE.BufferGeometry[] = [];
  for (const phi of [0, Math.PI]) {
    const length = phi ? end : doorway - .018;
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => point(phi, .01 + i / 32 * (length - .01), CITY_HALL.radius + .08)));
    seams.push(new THREE.TubeGeometry(path, low ? 48 : 80, .18, 6, false));
    for (const theta of [.50, 1.42, ...(phi ? [2.05] : [])]) {
      bands.push(clasp(phi, theta, .30, low));
      const boltPhi = phi === 0 ? .23 : phi - .23, r = walnutRadius(boltPhi, theta, CITY_HALL.radius), p = point(boltPhi, theta, r + .30);
      const normal = p.clone().sub(new THREE.Vector3(0, CITY_HALL.centerY, 0)).normalize(), rotation = new THREE.Quaternion().setFromUnitVectors(UP, normal);
      bands.push(new THREE.CylinderGeometry(.30, .30, .16, 6).applyQuaternion(rotation).translate(p.x, p.y, p.z));
      p.addScaledVector(normal, .11); pins.push(new THREE.CylinderGeometry(.13, .13, .04, 12).applyQuaternion(rotation).translate(p.x, p.y, p.z));
    }
  }
  // The lower front fastener sits to the walnut side, leaving the original arched doorway open.
  bands.push(clasp(.66, 1.97, .19, low));
  const lower = point(.77, 1.97, walnutRadius(.77, 1.97, CITY_HALL.radius) + .30), direction = lower.clone().sub(new THREE.Vector3(0, CITY_HALL.centerY, 0)).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(UP, direction);
  bands.push(new THREE.CylinderGeometry(.30, .30, .16, 6).applyQuaternion(rotation).translate(lower.x, lower.y, lower.z));
  lower.addScaledVector(direction, .11); pins.push(new THREE.CylinderGeometry(.13, .13, .04, 12).applyQuaternion(rotation).translate(lower.x, lower.y, lower.z));
  const tab = new THREE.Shape(); tab.moveTo(-.22, 0); tab.bezierCurveTo(-.50, .65, -.36, 1.5, -.17, 1.9); tab.lineTo(.28, 1.74); tab.bezierCurveTo(.13, 1.25, .22, .45, .28, 0); tab.closePath();
  seams.push(new THREE.ExtrudeGeometry(tab, { depth: .22, bevelEnabled: true, bevelSegments: 1, bevelSize: .045, bevelThickness: .045, curveSegments: low ? 6 : 10 }).translate(0, CITY_HALL.centerY + CITY_HALL.radius - .16, -.11));
  const colliders: ColliderSpec[] = [];
  for (const [parts, material, name] of [[bands, brass, 'City Hall brass clasps'], [pins, silver, 'City Hall silver pins'], [seams, dark, 'City Hall dark seam']] as const) {
    // Decorations share geometry with collision, including the reachable lower clasp.
    parts.forEach(part => part.deleteAttribute('uv').deleteAttribute('normal'));
    const geometry = merged(parts); add(geometry, material, name);
    colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: new Uint32Array(geometry.index!.array) });
  }
  return { colliders, walnut: wood, crystal };
}

export async function loadCityHallTextures(wood: THREE.MeshStandardMaterial, crystal: THREE.MeshPhysicalMaterial, low: boolean): Promise<void> {
  await Promise.all([loadWalnutTextures(wood, low), (async () => {
    try {
      const map = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/city-hall/crystal-cloud-${low ? 256 : 512}.webp`);
      map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = low ? 2 : 4;
      crystal.map = map; crystal.needsUpdate = true;
    } catch { /* The smoky reflective crystal keeps the hall available without its cloud map. */ }
  })()]);
}
