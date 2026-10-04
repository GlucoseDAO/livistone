import * as THREE from 'three';
import { modelURL } from '../game/featured';
import { activeSurfaces } from './surfaces';
import { terrainSurfaceHeight } from './terrain';

/**
 * Dev-only `?concept=gates`: the remaining proposed Eyelense moon gate (docs/jewelry-models-plan.md) stands on its meadow from Livia's
 * decimated STL assembly, for the owner to approve before any path, clearance or collider is built. No colliders, no
 * planting clearance: trees may stand inside it. Not loaded without the switch.
 */
export const GATE_CONCEPTS = [
  { id: 'eyelense-gate', x: 106, z: -36, yaw: -Math.PI / 2, name: 'Eyelense Gate (concept)' },
] as const;

export async function addGateConcepts(root: THREE.Object3D): Promise<void> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), loader = new GLTFLoader();
  const brass = activeSurfaces()?.gold ?? new THREE.MeshStandardMaterial({ color: '#b99a55', metalness: .85, roughness: .3, userData: { heroEnv: true } });
  for (const site of GATE_CONCEPTS) {
    const gltf = await loader.loadAsync(modelURL(site.id)), source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    const group = new THREE.Group(); group.name = site.name;
    group.position.set(site.x, terrainSurfaceHeight(site.x, site.z) - .15, site.z); group.rotation.y = site.yaw; root.add(group);
    const gate = new THREE.Mesh(source.geometry, brass); gate.castShadow = gate.receiveShadow = true; group.add(gate);
    source.geometry.computeBoundingBox(); const box = source.geometry.boundingBox!, top = box.max.y, centre = (box.min.x + box.max.x) / 2;
    // The colour-changing lens hanging in the crescent's eye.
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshPhysicalMaterial({ color: '#8a6fb0', roughness: .05, transmission: .55, thickness: .3, transparent: true, opacity: .75, side: THREE.DoubleSide }));
    lens.position.set(centre + .3, top * .62, 0); group.add(lens);
  }
}
