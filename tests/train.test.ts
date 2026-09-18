import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMaglevTrain } from '../src/world/train';
import { STATION } from '../src/world/station-layout';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';

for (const mobile of [false, true]) describe(`Panoramic maglev (${mobile ? 'mobile' : 'desktop'})`, () => {
  it('has transparent sightlines through both sides and solid glass that keeps passengers inside', async () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = []; createMaglevTrain(root, colliders, mobile); root.updateMatrixWorld(true);
    const physics = await Physics.create(colliders);
    try {
      for (const x of [-8.6, -2.8, 3, 15.2]) for (const side of [-1, 1]) {
        for (const outside of [false, true]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(STATION.x + x, 2.3, STATION.trackZ + (outside ? side * 2 : 0)), new THREE.Vector3(0, 0, side * (outside ? -1 : 1)), 0, 1.9);
          const hits = ray.intersectObject(root, true); expect(hits.length).toBeGreaterThan(0);
          expect(hits.every((hit) => hit.object.name === 'Transparent panoramic train windows')).toBe(true);
        }
      }
      physics.teleport({ x: STATION.x + .1, y: 1.55, z: STATION.trackZ + .3 });
      for (let i = 0; i < 100; i++) physics.step(0, 3);
      expect(physics.position().z).toBeLessThan(STATION.trackZ + 1.2);
      expect(physics.position().y).toBeGreaterThan(1.4);
    } finally {
      physics.dispose(); const materials = new Set<THREE.Material>();
      root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); materials.add(object.material as THREE.Material); } }); materials.forEach((m) => m.dispose());
    }
  });
});
