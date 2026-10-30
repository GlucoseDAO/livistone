import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMatsuCourtyard } from '../src/world/matsu-courtyard';
import { Physics } from '../src/game/physics';
import { transformColliders } from '../src/world/town-layout';
import { MATSU_COURTYARD as C } from '../src/world/matsu-courtyard-layout';

const courtyard = createMatsuCourtyard();
const physicalColliders = transformColliders(courtyard.colliders, courtyard.root.matrixWorld);
describe('Matsu courtyard reconstruction', () => {
  it('keeps the roof, flat lower court, upper lookout and source glazing as bounded local geometry', () => {
    expect(courtyard.root.children.length).toBeLessThanOrEqual(15);
    expect(courtyard.floor.name).toBe('Matsu courtyard · lower floor');
    const floor = new THREE.Box3().setFromObject(courtyard.floor), roof = new THREE.Box3().setFromObject(courtyard.roof), upper = new THREE.Box3().setFromObject(courtyard.upperFloor);
    expect(floor.max.y).toBeCloseTo(.25, 5); expect(upper.max.y).toBeCloseTo(3.6, 5); expect(roof.min.y).toBeGreaterThan(3.4);
    expect(floor.max.x - floor.min.x).toBeCloseTo(11.7 * C.planScale, 5);
    expect(floor.max.z - floor.min.z).toBeCloseTo(11.9 * C.planScale, 5);
    expect(courtyard.root.scale).toEqual(new THREE.Vector3(.7, 1, .7));
    expect(courtyard.glass).toHaveLength(1); expect(courtyard.colliders).toHaveLength(courtyard.root.children.length);
    let triangles = 0;
    courtyard.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const p = object.geometry.getAttribute('position'); expect(p).toBeDefined();
      expect(Array.from(p.array).every(Number.isFinite)).toBe(true); triangles += (object.geometry.index?.count ?? p.count) / 3;
    });
    expect(triangles).toBeLessThan(45000);
    // Stump and its four floor connections have a genuinely empty, level area in front of the old fabric.
    const ray = new THREE.Raycaster(new THREE.Vector3(C.stump.x * C.planScale, 2, C.stump.z * C.planScale), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects(courtyard.root.children, true)[0]?.point.y).toBeCloseTo(.25, 5);
    // Interior site photos put the art's flat floor patch beneath the concrete shelter, not outside the roof's front edge.
    ray.set(new THREE.Vector3(C.stump.x * C.planScale, 2, C.stump.z * C.planScale), new THREE.Vector3(0, 1, 0));
    const shelter = ray.intersectObjects(courtyard.root.children, true)[0];
    expect(shelter?.point.y).toBeGreaterThan(3.1); expect(shelter?.point.y).toBeLessThan(3.66);
    // The exposed retaining-wall stones stay in front of their backing beyond the separately recessed door alcove.
    const stones = courtyard.root.getObjectByName('Matsu courtyard · fieldstone retaining wall and rubble')!;
    for (const z of [2.5, 3.5, 4.5, 6]) {
      ray.set(new THREE.Vector3(0, 1.575, z * C.planScale), new THREE.Vector3(1, 0, 0));
      expect(ray.intersectObject(stones)[0]?.point.x).toBeLessThan(5.71 * C.planScale);
    }
  });

  it('walks from the upper viewpoint down both shallow flights into the lower courtyard', async () => {
    const physics = await Physics.create(physicalColliders);
    try {
      const points = courtyard.stairRoute.map(p => p.clone().applyMatrix4(courtyard.root.matrixWorld)); physics.teleport({ x: points[0].x, y: points[0].y + .85, z: points[0].z });
      for (const target of points.slice(1)) {
        for (let i = 0; i < 420; i++) {
          const p = physics.position(), dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
          if (distance < .12) break;
          physics.step(dx / distance * 1.7, dz / distance * 1.7);
        }
        const arrived = physics.position(); expect(Math.hypot(arrived.x - target.x, arrived.z - target.z), JSON.stringify({ target, arrived })).toBeLessThan(.18);
        expect(arrived.y).toBeGreaterThan(target.y + .65); expect(arrived.y).toBeLessThan(target.y + 1.1);
      }
      expect(physics.position().y).toBeLessThan(1.3);
    } finally { physics.dispose(); }
  });

  it('keeps a real doorway through the glazed wall while adjacent rendered panes block the capsule', async () => {
    const physics = await Physics.create(physicalColliders);
    try {
      physics.teleport({ x: 3.6 * C.planScale, y: 1.1, z: C.planScale }); for (let i = 0; i < 95; i++) physics.step(1.7, 0);
      expect(physics.position().x).toBeGreaterThan(5.15 * C.planScale); expect(physics.position().x).toBeLessThan(5.55 * C.planScale);
      physics.teleport({ x: 3.6 * C.planScale, y: 1.1, z: 0 }); for (let i = 0; i < 95; i++) physics.step(1.7, 0);
      expect(physics.position().x).toBeLessThan(4.55 * C.planScale);
    } finally { physics.dispose(); }
  });
});
