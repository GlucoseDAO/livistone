import * as THREE from 'three';
import { modelURL } from '../game/featured';
import { activeSurfaces } from './surfaces';
import { terrainSurfaceHeight } from './terrain';

/**
 * Dev-only `?concept=gates`: the two proposed moon gates (docs/jewelry-models-plan.md) stood on their meadows from Livia's
 * decimated STL assemblies, for the owner to approve before any path, clearance or collider is built. No colliders, no
 * planting clearance: trees may stand inside them. Not loaded without the switch.
 */
export const GATE_CONCEPTS = [
  { id: 'eye-of-winter-gate', x: -108, z: -30, yaw: Math.PI / 2, name: 'Eye of Winter Gate (concept)' },
  { id: 'eyelense-gate', x: 106, z: -36, yaw: -Math.PI / 2, name: 'Eyelense Gate (concept)' },
] as const;

export async function addGateConcepts(root: THREE.Object3D): Promise<void> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), loader = new GLTFLoader();
  const silver = new THREE.MeshStandardMaterial({ color: '#eef1f2', metalness: 1, roughness: .2, userData: { heroEnv: true } });
  const brass = activeSurfaces()?.gold ?? new THREE.MeshStandardMaterial({ color: '#b99a55', metalness: .85, roughness: .3, userData: { heroEnv: true } });
  for (const site of GATE_CONCEPTS) {
    const gltf = await loader.loadAsync(modelURL(site.id)), source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    const winter = site.id === 'eye-of-winter-gate', group = new THREE.Group(); group.name = site.name;
    group.position.set(site.x, terrainSurfaceHeight(site.x, site.z) - .15, site.z); group.rotation.y = site.yaw; root.add(group);
    const gate = new THREE.Mesh(source.geometry, winter ? silver : brass); gate.castShadow = gate.receiveShadow = true; group.add(gate);
    source.geometry.computeBoundingBox(); const box = source.geometry.boundingBox!, top = box.max.y, centre = (box.min.x + box.max.x) / 2;
    if (winter) {
      // The blue stone in the honeycomb basket over the join of the two rings.
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshPhysicalMaterial({ color: '#6fa7d6', metalness: 0, roughness: .05, transmission: .6, thickness: 1.5, ior: 1.6, flatShading: true }));
      stone.position.set(centre, top - 1.6, 0); group.add(stone);
      // A frozen pond across both openings, faded into the meadow.
      const ice = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: '#dceef6', roughness: .12, metalness: .1, transparent: true, opacity: .85 }));
      ice.rotation.x = -Math.PI / 2; ice.position.y = .2; group.add(ice);
    } else {
      // The colour-changing lens hanging in the crescent's eye.
      const lens = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshPhysicalMaterial({ color: '#8a6fb0', roughness: .05, transmission: .55, thickness: .3, transparent: true, opacity: .75, side: THREE.DoubleSide }));
      lens.position.set(centre + .3, top * .62, 0); group.add(lens);
    }
  }
}
