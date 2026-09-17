import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GARDEN_BRIDGES, TIME_TOWER, tributaryCenter, waterDistance } from '../src/world/waterways';
import { terrainHeight } from '../src/world/world';
import { plantingAllowed } from '../src/world/landscape';
import { createGardenBridge } from '../src/world/bridge';
import { createTimeTower } from '../src/world/time-tower';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';

function terrain(x: number, z: number): ColliderSpec {
  const g = new THREE.PlaneGeometry(26, 12, 52, 24); g.rotateX(-Math.PI / 2); g.translate(x, 0, z);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  return { type: 'mesh', vertices: new Float32Array(p.array), indices: new Uint32Array(g.index!.array) };
}

describe('branching river gardens', () => {
  it('carves both tributaries and excludes full plant footprints from their banks', () => {
    for (const side of [-1, 1]) for (let z = -48; z < 20; z++) {
      const x = tributaryCenter(z, side);
      expect(terrainHeight(x, z)).toBeLessThan(-1.9);
      expect(plantingAllowed(x, z, .5)).toBe(false);
      for (const offset of [-3, 3]) expect(plantingAllowed(x + offset, z, 1)).toBe(false);
    }
    for (const b of GARDEN_BRIDGES) {
      expect(waterDistance(b.x, b.z)).toBeLessThan(-3);
      expect(terrainHeight(b.x - 9.1, b.z)).toBeCloseTo(0);
      expect(terrainHeight(b.x + 9.1, b.z)).toBeCloseTo(0);
    }
  });
  for (const b of GARDEN_BRIDGES) it(`walks across the ${b.x < 0 ? 'west' : 'east'} bridge in both directions and blocks its rails`, async () => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial(), colliders = [terrain(b.x, b.z)];
    createGardenBridge(root, colliders, material, material, material, b);
    const physics = await Physics.create(colliders);
    try {
      for (const direction of [-1, 1]) {
        physics.teleport({ x: b.x - direction * 11, y: 1, z: b.z });
        for (let i = 0; i < 350; i++) { physics.step(direction * 4, 0); expect(physics.position().y).toBeGreaterThan(.8); }
        expect(direction * (physics.position().x - b.x)).toBeGreaterThan(11);
      }
      for (const side of [-1, 1]) {
        physics.teleport({ x: b.x, y: 2.5, z: b.z });
        for (let i = 0; i < 90; i++) physics.step(0, side * 4);
        expect(Math.abs(physics.position().z - b.z)).toBeLessThan(1.3);
      }
    } finally { physics.dispose(); root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); material.dispose(); }
  });
  it('keeps the silver tower passage open at ground level', async () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = [{ type: 'box', position: [TIME_TOWER.x, -.2, TIME_TOWER.z], size: [8, .2, 8] }];
    createTimeTower(root, colliders, true);
    const physics = await Physics.create(colliders);
    try {
      physics.teleport({ x: TIME_TOWER.x, y: 1, z: TIME_TOWER.z + 6 });
      for (let i = 0; i < 200; i++) physics.step(0, -4);
      expect(physics.position().z).toBeLessThan(TIME_TOWER.z - 5.5);
    } finally { physics.dispose(); root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); }
  });
});
