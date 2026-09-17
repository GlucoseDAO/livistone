import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createRailwayStructure } from '../src/world/railway';
import { mountainGeometry, mountainHeight } from '../src/world/mountains';
import { plantingAllowed } from '../src/world/landscape';
import { RAILWAY, railwayCorridor, STATION } from '../src/world/station-layout';

function dispose(root: THREE.Group): void {
  const materials = new Set<THREE.Material>(); root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } }); materials.forEach((m) => m.dispose());
}

describe('Mountain railway', () => {
  it('reserves the full railway and portal footprints and extends the walking boundary only along the corridor', () => {
    for (let x = -STATION.railHalfLength; x <= STATION.railHalfLength; x += 4) expect(plantingAllowed(x, STATION.trackZ, 2.5)).toBe(false);
    for (const sign of [-1, 1]) {
      expect(plantingAllowed(sign * RAILWAY.portalX, STATION.trackZ + 9, 2)).toBe(false);
      expect(railwayCorridor(sign * 200, STATION.trackZ + 3.2)).toBe(true);
      expect(railwayCorridor(sign * 200, STATION.trackZ + 8)).toBe(false);
      expect(railwayCorridor(sign * 500, STATION.trackZ)).toBe(false);
      expect(mountainHeight(sign * 150, STATION.trackZ)).toBeGreaterThan(RAILWAY.clearanceHeight);
    }
  });

  for (const mobile of [false, true]) {
    it(`has open train clearance through real mountain apertures (${mobile ? 'mobile' : 'desktop'})`, () => {
      const root = new THREE.Group(), colliders: ColliderSpec[] = []; createRailwayStructure(root, colliders, mobile);
      root.add(new THREE.Mesh(mountainGeometry(mobile), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))); root.updateMatrixWorld(true);
      try {
        for (const sign of [-1, 1]) for (const height of [1, 2.6, 4.2]) for (const dz of [-1.45, 0, 1.45]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(sign * 90, height, STATION.trackZ + dz), new THREE.Vector3(sign, 0, 0), 0, 370);
          expect(ray.intersectObject(root, true).map((hit) => hit.object.name)).toEqual([]);
        }
        const down = new THREE.Raycaster(new THREE.Vector3(70, 2, STATION.trackZ + 1.8), new THREE.Vector3(0, -1, 0));
        expect(down.intersectObject(root, true)[0]?.object.name).toBe('Crushed stone ballast');
      } finally { dispose(root); }
    });

    it(`crosses both tunnel mouths and exits, with solid floors and side walls (${mobile ? 'mobile' : 'desktop'})`, async () => {
      const root = new THREE.Group(), colliders: ColliderSpec[] = []; createRailwayStructure(root, colliders, mobile); const physics = await Physics.create(colliders);
      try {
        for (const sign of [-1, 1]) {
          physics.teleport({ x: sign * 98, y: 1.05, z: STATION.trackZ });
          for (let i = 0; i < 1320; i++) { physics.step(sign * 16, 0); expect(physics.position().y).toBeGreaterThan(.8); expect(physics.position().y).toBeLessThan(1.4); }
          expect(sign * physics.position().x).toBeGreaterThan(RAILWAY.exitX + 8);
          physics.teleport({ x: sign * 180, y: 1.05, z: STATION.trackZ + 3.1 });
          for (let i = 0; i < 180; i++) physics.step(0, 4);
          expect(physics.position().z).toBeLessThan(STATION.trackZ + RAILWAY.boreHalfWidth); expect(physics.position().z).toBeGreaterThan(STATION.trackZ + 3.5);
        }
      } finally { physics.dispose(); dispose(root); }
    }, 20000);
  }
});
