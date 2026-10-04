import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWinterGate } from '../src/world/winter-gate';
import { WINTER } from '../src/world/winter-gate-layout';
import { Physics } from '../src/game/physics';
import { plantingAllowed, grassAllowed, WALKING_NETWORK } from '../src/world/landscape';
import { terrainHeight } from '../src/world/terrain';

let source: THREE.BufferGeometry;
beforeAll(async () => {
  const bytes = readFileSync('public/models/jewelry/eye-of-winter-gate.glb');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  source = (gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh).geometry;
});
function dispose(root: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
  materials.forEach(m => m.dispose());
}

describe('approved Eye of Winter building', () => {
  it('keeps the original silver vertices and indices, with only a uniform scale and rigid orientation', () => {
    const gate = createWinterGate(source), a = source.getAttribute('position'), b = gate.silver.geometry.getAttribute('position');
    try {
      expect(b.count).toBe(a.count); expect(gate.silver.geometry.index!.array).toEqual(source.index!.array);
      for (let i = 1; i < a.count; i += 113) {
        const p = new THREE.Vector3().fromBufferAttribute(a, i), q = new THREE.Vector3().fromBufferAttribute(a, i - 1);
        const u = new THREE.Vector3().fromBufferAttribute(b, i), v = new THREE.Vector3().fromBufferAttribute(b, i - 1);
        expect(u.distanceTo(v)).toBeCloseTo(p.distanceTo(q) * WINTER.scale, 4);
      }
      expect(gate.silver.userData.keepGeometry).toBe(true);
      gate.blue.geometry.computeBoundingBox(); gate.quartz.geometry.computeBoundingBox();
      expect(gate.blue.geometry.boundingBox!.max.x).toBeLessThan(WINTER.x);
      expect(gate.blue.geometry.boundingBox!.getSize(new THREE.Vector3()).y).toBeLessThan(gate.quartz.geometry.boundingBox!.getSize(new THREE.Vector3()).y / 2);
    } finally { dispose(gate.root); }
  });

  it('reserves the full assembly and grades a connected approach to the raised floor', () => {
    expect(plantingAllowed(-121, WINTER.z, 3)).toBe(false);
    expect(grassAllowed(WINTER.x, WINTER.z, .2)).toBe(false);
    expect(WALKING_NETWORK.clearance(WINTER.arrivalX, WINTER.z, 2)).toBeLessThan(0);
    expect(terrainHeight(WINTER.arrivalX, WINTER.z) + .13).toBeCloseTo(WINTER.floor, 6);
  });

  for (const mobile of [false, true]) it(`opens a real walkable shutter, keeps the aisle clear and closes again (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const gate = createWinterGate(source, mobile), physics = await Physics.create(gate.colliders);
    try {
      // A closed eye blocks the aperture. Opening does not disable its walls, floor or original silver.
      physics.teleport({ x: WINTER.quartzX + 5.8, y: WINTER.floor + .9, z: WINTER.z });
      for (let i = 0; i < 90; i++) physics.step(-4, 0);
      expect(physics.position().x).toBeGreaterThan(WINTER.quartzX + 4.8);
      physics.teleport({ x: WINTER.quartzX + 5.8, y: WINTER.floor + .9, z: WINTER.z });
      for (let i = 0; i < 300; i++) {
        physics.setColliderEnabled('winter-shutter', gate.step(1 / 60, physics.position()));
        physics.step(-2, 0);
        expect(physics.position().y).toBeGreaterThan(WINTER.floor + .7);
      }

      expect(gate.open).toBe(1);
      expect(physics.position().x).toBeLessThan(WINTER.quartzX + .5);
      // Standing room beneath the smaller stone; walking toward the rear stops at its enclosing quartz.
      expect(physics.position().x).toBeGreaterThan(WINTER.x - 3.7);
      for (let i = 0; i < 120; i++) gate.step(1 / 60, { x: -60, y: 1, z: 0 });
      expect(gate.open).toBe(0);
      expect(gate.step(0, { x: -60, y: 1, z: 0 })).toBe(true);
    } finally { physics.dispose(); dispose(gate.root); }
  });
});
