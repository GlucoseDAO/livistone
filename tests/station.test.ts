import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createStationStructure } from '../src/world/station';
import { STATION } from '../src/world/station-layout';
import { PATH_CURVES, plantingAllowed } from '../src/world/landscape';

describe('Embryo Station circulation', () => {
  it('reserves the station, railway, and garden approaches from planting', () => {
    for (let x = -100; x <= 100; x += 2) expect(plantingAllowed(x, STATION.trackZ, 2.5)).toBe(false);
    for (let x = -30; x <= 26; x += 2) for (let z = -76; z <= -60; z += 2) expect(plantingAllowed(x, z, .7)).toBe(false);
    for (const route of PATH_CURVES.slice(-2)) for (const point of route.getPoints(160)) {
      expect(plantingAllowed(point.x, point.z, .7)).toBe(false);
    }
  });
  for (const mobile of [false, true]) it(`walks through the ring onto the platform and keeps the railway separate (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const colliders: ColliderSpec[] = [{ type: 'box', position: [0, -.3, -65], size: [100, .3, 30] }];
    createStationStructure(root, colliders, mobile, material);
    const physics = await Physics.create(colliders);
    try {
      for (const direction of [-1, 1]) {
        physics.teleport({ x: STATION.entranceX, y: 1.05, z: direction < 0 ? -56 : -72 });
        for (let i = 0; i < 255; i++) {
          physics.step(0, direction * 4); expect(physics.position().y).toBeGreaterThan(.8); expect(physics.position().y).toBeLessThan(1.2);
        }
        expect(direction * physics.position().z).toBeGreaterThan(direction < 0 ? 71 : -57);
        expect(physics.position().x).toBeCloseTo(STATION.entranceX, 1);
      }
      // Glazed bays stop the capsule, while the ring door and side entrance stay open.
      for (const x of [-18.6, 10.5]) {
        physics.teleport({ x, y: 1.05, z: -61.4 });
        for (let i = 0; i < 120; i++) physics.step(0, -4);
        expect(physics.position().z).toBeGreaterThan(-62); expect(physics.position().z).toBeLessThan(-61.5);
      }
      physics.teleport({ x: 20.8, y: 1.05, z: -58 });
      for (let i = 0; i < 160; i++) physics.step(0, -4);
      expect(physics.position().z).toBeLessThan(-67);
      physics.teleport({ x: -16, y: 1.05, z: -73 });
      for (let i = 0; i < 410; i++) physics.step(5, 0);
      expect(physics.position().x).toBeGreaterThan(17);
      for (const x of [-16, 0, 18]) {
        physics.teleport({ x, y: 1.05, z: -73 });
        for (let i = 0; i < 160; i++) physics.step(0, -4);
        expect(physics.position().z).toBeGreaterThan(STATION.back); expect(physics.position().z).toBeLessThan(-75.5);
      }
    } finally {
      physics.dispose(); const materials = new Set<THREE.Material>();
      root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
      const textures = new Set<THREE.Texture>();
      materials.forEach((m) => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); }); textures.forEach((t) => t.dispose());
    }
  });
});
