import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ColliderSpec } from '../game/physics';
import { STUMP_ISLAND as S, STUMP_ARTWORK as A } from './stump-of-life-layout';
import { createStumpBridges } from './stump-of-life-bridges';
import { createStumpPoster } from './stump-of-life-poster';
import { stumpCapMaterial, stumpEngravingMaterial, stumpWoodMaterial } from './stump-of-life-materials';
import { createStumpStencil, STUMP_STENCIL_SCALE } from './stump-of-life-stencil';
import { createMatsuCourtyard, loadMatsuCourtyardTextures } from './matsu-courtyard';
import { MATSU_COURTYARD as C, courtyardWorld } from './matsu-courtyard-layout';
import { transformColliders } from './town-layout';

export interface StumpInstallation {
  root: THREE.Group;
  model: THREE.Object3D;
  colliders: ColliderSpec[];
  panels: THREE.Mesh[];
  position: THREE.Vector3;
}

/** Scale only the timber and plate around their shared foot. The source map, data buffers and UVs stay unchanged. */
function proposalScale(model: THREE.Object3D): THREE.Group {
  const origin = new THREE.Vector3(S.matsu.x, A.sourceFloor, S.matsu.z);
  const artwork = new THREE.Group(), site = courtyardWorld(C.stump); artwork.name = 'Stump of Life · proposal seat'; artwork.position.set(site.x, 0, site.z); artwork.rotation.y = C.yaw;
  for (const name of ['Giant_Wood_Stump', 'Giant_Solid_Cap_Edge', 'Giant_Solid_DNA_Cap']) {
    const part = model.getObjectByName(name); if (!part) throw new Error('Missing Stump of Life artwork part: ' + name);
    const wrapper = new THREE.Group(); wrapper.name = 'Proposal scale · ' + name; wrapper.position.set(0, A.sourceFloor, 0);
    const wood = name === 'Giant_Wood_Stump', horizontal = wood ? A.woodScale : A.capScale, vertical = wood ? A.woodVerticalScale : A.capVerticalScale;
    if (!wood) wrapper.position.y = S.capHeight - (A.sourceCapTop - A.sourceFloor) * vertical;
    wrapper.scale.set(horizontal, vertical, horizontal); artwork.add(wrapper); wrapper.add(part); part.position.sub(origin);
  }
  return artwork;
}

/** Physical proposal proportions inside the reconstructed courtyard, with geographic context and scientific evidence retained. */
export function placeStumpModel(model: THREE.Object3D, height: number, engravingMap?: THREE.Texture, mobile = false): { root: THREE.Group; colliders: ColliderSpec[] } {
  const root = new THREE.Group(), placement = new THREE.Group(), colliders: ColliderSpec[] = [], caps: THREE.Mesh[] = [];
  const artwork = proposalScale(model), court = createMatsuCourtyard(mobile);
  root.name = 'Stump of Life · Matsu courtyard and Taiwan islands'; root.position.y = height;
  placement.position.set(S.x, 0, S.z); placement.rotation.y = S.yaw; placement.add(model); root.add(placement, artwork);
  court.root.position.set(C.x, 0, C.z); court.root.rotation.y = C.yaw; root.add(court.root);
  const stencil = createStumpStencil({ scale: STUMP_STENCIL_SCALE, height: C.floorY + .003, rootContinuation: .04 });
  stencil.position.set(C.stump.x, 0, C.stump.z);
  // The architecture is compacted in plan; the physical proposal drawing keeps its original metre scale.
  stencil.scale.set(1 / C.planScale, 1, 1 / C.planScale); court.root.add(stencil);
  root.updateMatrixWorld(true);
  const prepare = (object: THREE.Object3D): void => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object.receiveShadow = true; object.userData.keepGeometry = true;
    if (object.name === 'Giant_Solid_DNA_Cap') {
      const texture = engravingMap ?? (object.material as THREE.MeshStandardMaterial).map!;
      texture.center.set(.5, .5); texture.rotation = A.engravingRotation;
      object.material = stumpCapMaterial(texture); caps.push(object);
    }
    if (object.name.startsWith('Giant_Wood_Stump')) {
      const weather = (material: THREE.Material): THREE.Material => material instanceof THREE.MeshStandardMaterial && material.map ? stumpWoodMaterial(material) : material;
      object.material = Array.isArray(object.material) ? object.material.map(weather) : weather(object.material);
    }
    // The four proposal curves replace the old three diagram links. The geographical source labels and coast stay intact.
    if (object.name === 'Copper_Provenance_Roots_Not_Bridges' || object.name === 'Matsu_Islet_Grass') object.visible = false;
    if (object.name.endsWith('_Grass')) {
      object.castShadow = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -2; }
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof THREE.MeshStandardMaterial) material.userData.heroEnv = true;
    if (!object.visible) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld), positions = geometry.getAttribute('position');
    colliders.push({ type: 'mesh', vertices: Float32Array.from(positions.array), indices: geometry.index ? Uint32Array.from(geometry.index.array) : Uint32Array.from({ length: positions.count }, (_, i) => i) }); geometry.dispose();
  };
  model.traverse(prepare); artwork.traverse(prepare);
  for (const cap of caps) {
    const ink = new THREE.Mesh(cap.geometry, stumpEngravingMaterial((cap.material as THREE.MeshStandardMaterial).map!));
    ink.position.y = .0008; ink.name = 'Stump of Life · native DNA engraving'; ink.userData.keepGeometry = true; cap.add(ink);
  }
  colliders.push(...transformColliders(court.colliders, court.root.matrixWorld, C.yaw));
  return { root, colliders };
}

export async function loadStumpOfLife(timber: THREE.Material, silver: THREE.Material, mobile = false): Promise<StumpInstallation> {
  const [gltf, engraving] = await Promise.all([
    new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/jewelry/stump-of-life-livistone.glb'),
    new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + 'images/stump-of-life/exact-cap-texture.png'),
  ]);
  engraving.colorSpace = THREE.SRGBColorSpace; engraving.flipY = false; engraving.anisotropy = 8;
  // The native export's 960-unit plate occupies a 1000-unit canvas. Crop its blank margin, preserving every real mark.
  engraving.repeat.set(.96, .96);
  // The land extends below the town river bed and writes depth above its existing water sheet; it shares the town physics.
  const { root, colliders } = placeStumpModel(gltf.scene, 0, engraving, mobile);
  createStumpBridges(root, colliders, timber, silver);
  const poster = createStumpPoster(root, colliders, S.sign);
  await Promise.all([poster.ready, loadMatsuCourtyardTextures(root, mobile)]);
  const cap = root.getObjectByName('Giant_Solid_DNA_Cap') as THREE.Mesh;
  cap.userData.discovery = 'stump-of-life-story'; cap.userData.title = 'Stump of Life · inspect the DNA';
  return { root, model: gltf.scene, colliders, panels: [...poster.panels, cap], position: poster.position };
}
