import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LivingWaters } from '../src/world/living-waters';
import { GARDENS, GARDEN_PATHS, WATER_EYES, pointInPolygon } from '../src/world/living-waters-layout';
import { townTerrainGeometry } from '../src/world/terrain';
import { Physics } from '../src/game/physics';
async function follow(physics: Physics, path: THREE.Curve<THREE.Vector3>, reverse = false): Promise<void> {
  const points = path.getPoints(100); if (reverse) points.reverse();
  for (const target of points) {
    let reached = false;
    for (let i = 0; i < 240; i++) { const p = physics.position(), dx = GARDENS.x + target.x - p.x, dz = GARDENS.z + target.z - p.z, distance = Math.hypot(dx, dz);
      if (distance < .14) { reached = true; break; } physics.step(dx / distance * 3, dz / distance * 3); expect(physics.position().y).toBeGreaterThan(.5);
    } expect(reached, `route blocked near ${target.x.toFixed(1)}, ${target.z.toFixed(1)}`).toBe(true);
  }
}
describe('Living Waters traversal', () => {
  for (const mobile of [false, true]) it(`provides a pavilion, connected lake paths, a dry mushroom loop and shallow-water recovery (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const gardens = new LivingWaters(mobile), ground = townTerrainGeometry(), physics = await Physics.create([...gardens.colliders, { type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }]); ground.dispose();
    try {
      for (const route of GARDEN_PATHS) {
        const start = route.getPoint(0); physics.teleport({ x: GARDENS.x + start.x, y: 1.05, z: GARDENS.z + start.z }); await follow(physics, route);
      }
      // Both civic approaches must also enter the pavilion/loop from the town side.
      for (const route of GARDEN_PATHS.slice(4)) {
        const start = route.getPoint(1); physics.teleport({ x: GARDENS.x + start.x, y: 1.05, z: GARDENS.z + start.z }); await follow(physics, route, true);
      }
      const cell = WATER_EYES.find((cell) => pointInPolygon(-31, -12, cell))!; expect(cell).toBeDefined();
      const edge = cell.reduce((best, p) => Math.hypot(p[0] + 31, p[1] + 12) < Math.hypot(best[0] + 31, best[1] + 12) ? p : best);
      physics.teleport({ x: GARDENS.x - 31, y: 1.05, z: GARDENS.z - 12 }); const dx = edge[0] + 31, dz = edge[1] + 12, length = Math.hypot(dx, dz);
      for (let i = 0; i < Math.ceil((length + .5) * 20); i++) physics.step(dx / length * 3, dz / length * 3);
      expect(physics.position().y).toBeGreaterThan(.83);
    } finally { physics.dispose(); gardens.dispose(); }
  }, 20000);
});
