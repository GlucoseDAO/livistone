import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { grassAllowed } from '../src/world/landscape';
import { COURTYARD_APPROACH_CURVE, MATSU_COURTYARD as C, courtyardApproachDistance, courtyardWorld } from '../src/world/matsu-courtyard-layout';
import { createMatsuCourtyard } from '../src/world/matsu-courtyard';
import { terrainSurfaceHeight, townTerrainGeometry } from '../src/world/terrain';
import { transformColliders } from '../src/world/town-layout';
import { walkingSurface } from '../src/world/walking-surface';

function meshCollider(geometry: THREE.BufferGeometry): ColliderSpec {
  const position = geometry.getAttribute('position');
  return { type: 'mesh', vertices: Float32Array.from(position.array), indices: geometry.index ? Uint32Array.from(geometry.index.array) : Uint32Array.from({ length: position.count }, (_, i) => i) };
}

describe('continuous courtyard shore approach', () => {
  it('supports the actual paving faces above the same coarse terrain triangles used for rendering and collision', () => {
    const surface = walkingSurface(true), geometry = surface.paving[0], position = geometry.getAttribute('position'), index = geometry.index!;
    let samples = 0, minimum = Infinity, maximum = -Infinity;
    for (let i = 0; i < index.count; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)], centreX = ids.reduce((sum, id) => sum + position.getX(id), 0) / 3, centreZ = ids.reduce((sum, id) => sum + position.getZ(id), 0) / 3;
      if (courtyardApproachDistance(centreX, centreZ) > 1.8) continue;
      // Vertices alone missed the buried road: check barycentric points across each actual tessellated face as well.
      for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5 - a; b++) {
        const weights = [a / 5, b / 5, 1 - (a + b) / 5];
        const x = ids.reduce((sum, id, j) => sum + position.getX(id) * weights[j], 0), y = ids.reduce((sum, id, j) => sum + position.getY(id) * weights[j], 0), z = ids.reduce((sum, id, j) => sum + position.getZ(id) * weights[j], 0);
        const clearance = y - terrainSurfaceHeight(x, z); minimum = Math.min(minimum, clearance); maximum = Math.max(maximum, clearance); samples++;
        expect(grassAllowed(x, z, .2)).toBe(false);
      }
    }
    expect(samples).toBeGreaterThan(10000); expect(minimum).toBeGreaterThan(.12); expect(maximum).toBeLessThan(.14);
    for (const geometry of [...surface.paving, ...surface.kerbs]) geometry.dispose();
  });

  it('walks continuously from the island footbridge threshold along the shore paving into the lower courtyard', async () => {
    const terrain = townTerrainGeometry(), surface = walkingSurface(true), court = createMatsuCourtyard(true);
    court.root.position.set(C.x, 0, C.z); court.root.rotation.y = C.yaw; court.root.updateMatrixWorld(true);
    const physics = await Physics.create([meshCollider(terrain), meshCollider(surface.paving[0]), ...transformColliders(court.colliders, court.root.matrixWorld, C.yaw)]);
    const route = COURTYARD_APPROACH_CURVE.getSpacedPoints(Math.ceil(COURTYARD_APPROACH_CURVE.getLength()));
    const inside = courtyardWorld({ x: 3.4, z: 5.3 }); route.push(new THREE.Vector3(inside.x, C.floorY, inside.z));
    try {
      physics.teleport({ x: route[0].x, y: .98, z: route[0].z });
      for (let i = 0; i < 20; i++) physics.step(0, 0);
      for (const target of route.slice(1)) {
        for (let i = 0; i < 150; i++) {
          const at = physics.position(), dx = target.x - at.x, dz = target.z - at.z, distance = Math.hypot(dx, dz);
          if (distance < .07) break;
          physics.step(dx / distance * 1.7, dz / distance * 1.7);
        }
        const at = physics.position();
        expect(Math.hypot(at.x - target.x, at.z - target.z), JSON.stringify({ target, at })).toBeLessThan(.10);
        expect(at.y).toBeGreaterThan(.8); expect(at.y).toBeLessThan(1.3);
      }
      expect(physics.position().y).toBeCloseTo(C.floorY + .83, 1);
    } finally {
      physics.dispose(); terrain.dispose(); for (const geometry of [...surface.paving, ...surface.kerbs]) geometry.dispose();
      court.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    }
  });
});
