import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { addGlow, nightEmission } from './night-lighting';
import { mergeStatic } from './static-batch';

export function gateFittingsEnabled(): boolean { return !(import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('gate-fittings') === 'off'); }
export interface GateLampSite { x: number; y: number; z: number }
/** Low shielded lamps share the town's existing light pool; no additional per-building lights or shaders. */
export function createGateLamps(parent: THREE.Group, colliders: ColliderSpec[], sites: readonly GateLampSite[], color: string): void {
  const metal = new THREE.MeshStandardMaterial({ color: '#a99976', metalness: .8, roughness: .38, userData: { heroEnv: true } });
  const diffuser = new THREE.MeshStandardMaterial({ color: '#e5edf0', roughness: .4 }); nightEmission(diffuser, color, 2.2);
  const parts: THREE.Mesh[] = [];
  for (const site of sites) {
    const add = (name: string, geometry: THREE.BufferGeometry, y: number, material = metal): void => {
      geometry.translate(site.x, site.y + y, site.z); const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); parts.push(mesh);
    };
    add('Gate lamp foot', new THREE.CylinderGeometry(.24, .28, .1, 12), .05);
    add('Gate lamp post', new THREE.CylinderGeometry(.085, .11, .92, 12), .56);
    add('Gate lamp diffuser', new THREE.CylinderGeometry(.18, .18, .23, 12), 1.08, diffuser);
    add('Gate lamp shade', new THREE.CylinderGeometry(.27, .27, .08, 12), 1.235);
    colliders.push({ type: 'box', position: [site.x, site.y + .64, site.z], size: [.28, .64, .28] });
    addGlow(parent, new THREE.Vector3(site.x, site.y + 1.08, site.z), color, 2.4, 160, 22, .27);
  }
  mergeStatic(parts, 'Gate lamps');
}
