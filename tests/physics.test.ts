import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { ROCK_DETAIL, rockColliders, rockGeometry, rockMatrix, rockWeights } from '../src/world/river-rocks';
import type { RockSite } from '../src/world/water-surface';
const floor: ColliderSpec = { type: 'box', position: [0, -0.2, 0], size: [20, 0.2, 20] };

describe('walking physics', () => {
  it('jumps over a gallery rail, rejects airborne jumps and lands below', async () => {
    const physics = await Physics.create([floor,
      { type: 'box', position: [0, 5, 0], size: [3, .15, 3] },
      { type: 'box', position: [2.8, 5.7, 0], size: [.08, .55, 3] },
    ]);
    try {
      physics.teleport({ x: 1.5, y: 6.1, z: 0 });
      for (let i = 0; i < 30; i++) physics.step(0, 0);
      const start = physics.position().y;
      physics.step(0, 0, 1 / 60, true);
      let peak = start;
      for (let i = 0; i < 180; i++) { physics.step(i < 70 ? 4.2 : 0, 0, 1 / 60, i < 60); peak = Math.max(peak, physics.position().y); }
      expect(peak - start).toBeGreaterThan(1.7); expect(peak - start).toBeLessThan(2.1);
      expect(physics.position().x).toBeGreaterThan(4);
      expect(physics.position().y).toBeGreaterThan(.8); expect(physics.position().y).toBeLessThan(1);
    } finally { physics.dispose(); }
  });

  it('finds the standing height on the ground, a raised meadow or a floor below a point, never on the player', async () => {
    // Dev captures teleport onto whatever lies under a view (main.ts standingHeight): a fixed height sank into raised ground.
    const physics = await Physics.create([floor, { type: 'box', position: [6, .35, 0], size: [2, .35, 2] }, { type: 'box', position: [-6, 2.1, 0], size: [2, .1, 2] }]);
    try {
      physics.teleport({ x: 0, y: 1, z: 0 }); for (let i = 0; i < 30; i++) physics.step(0, 0);
      // Rest height above a surface; each teleport starts a couple of centimetres above it and settles.
      const standing = physics.position().y, above = (ground: number, height: number | null): void => { expect(height! - ground - standing).toBeGreaterThan(.01); expect(height! - ground - standing).toBeLessThan(.04); };
      // The player's own capsule is not a floor: from above it the ray reaches the ground beneath.
      above(0, physics.standingHeight(0, 0, 3)); above(.7, physics.standingHeight(6, 0, 3.5));
      // A floor above the capsule's start is ignored; below it, the floor is found.
      above(0, physics.standingHeight(-6, 0, 1.1)); above(2.2, physics.standingHeight(-6, 0, 3.5));
      // A raised edge under the capsule's rim holds it on its rounded foot, as walking would, rather than letting it sink beside the edge.
      expect(physics.standingHeight(3.8, 0, 3)! - standing).toBeGreaterThan(.6);
      expect(physics.standingHeight(40, 0, 3)).toBeNull();
      for (const [x, ground] of [[6, .7], [-6, 2.2]]) {
        physics.teleport({ x, y: physics.standingHeight(x, 0, 3.5)!, z: 0 }); for (let i = 0; i < 30; i++) physics.step(0, 0);
        expect(physics.position().y).toBeCloseTo(ground + standing, 2);
      }
    } finally { physics.dispose(); }
  });

  it('stops at solid walls while remaining on the ground', async () => {
    const physics = await Physics.create([floor, { type: 'box', position: [0, 2, -2], size: [5, 2, 0.2] }]);
    physics.teleport({ x: 0, y: 1, z: 2 });
    for (let i = 0; i < 240; i++) physics.step(0, -4);
    expect(physics.position().z).toBeGreaterThan(-1.6);
    expect(physics.position().z).toBeLessThan(-1.3);
    expect(physics.position().y).toBeGreaterThan(0.79);
    physics.dispose();
  });
  it('keeps the capsule outside a rounded river rock, touching its rendered surface, and walks over a pebble-sized one', async () => {
    // A boulder seated on flat ground as riverRockSites would, and a tiny stone off to the side.
    const boulder: RockSite = { x: 0, y: .26, z: -3, s: 1, yaw: .4 }, stone: RockSite = { x: 4, y: .26 * .16, z: -3, s: .16, yaw: 1.1 };
    const physics = await Physics.create([floor, rockColliders([boulder, stone])]);
    const geometry = rockGeometry(ROCK_DETAIL.gpu), base = geometry.getAttribute('position'), w = rockWeights(boulder);
    geometry.morphAttributes.position!.forEach((target, k) => { for (let i = 0; i < base.count; i++) base.setXYZ(i, base.getX(i) + w[k] * target.getX(i), base.getY(i) + w[k] * target.getY(i), base.getZ(i) + w[k] * target.getZ(i)); });
    geometry.morphAttributes = {}; geometry.applyMatrix4(rockMatrix(boulder));
    const rendered = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster();
    // Horizontal gap between the capsule's side and the rendered rock, probed at knee and hip height toward the rock's centre.
    const gap = (x: number, z: number): number => Math.min(...[.25, .55].map(height => {
      const from = new THREE.Vector3(x, height, z), to = new THREE.Vector3(boulder.x, height, boulder.z);
      ray.set(from, to.clone().sub(from).normalize()); const hit = ray.intersectObject(rendered)[0];
      return hit ? hit.distance - .29 : Infinity;
    }));
    try {
      for (const x of [-.5, 0, .5]) {
        physics.teleport({ x, y: 1, z: 3 }); let closest = Infinity;
        for (let i = 0; i < 30; i++) physics.step(0, 0);
        for (let i = 0; i < 240; i++) {
          physics.step(0, -4); const p = physics.position(); closest = Math.min(closest, gap(p.x, p.z));
          expect(p.y).toBeGreaterThan(.79); expect(p.y).toBeLessThan(.9);
        }
        // It never cuts into the boulder by more than a few centimetres, yet it does reach the rendered surface.
        expect(closest).toBeGreaterThan(-.06); expect(closest).toBeLessThan(.08);
      }
      physics.teleport({ x: 4, y: 1, z: 1 });
      for (let i = 0; i < 120; i++) physics.step(0, -4);
      expect(physics.position().z).toBeLessThan(-4.5); expect(Math.abs(physics.position().x - 4)).toBeLessThan(.3);
    } finally { physics.dispose(); geometry.dispose(); }
  });
  it('passes through a doorway and steps onto a raised floor', async () => {
    const physics = await Physics.create([floor,
      { type: 'box', position: [-2.5, 2, -2], size: [1.2, 2, 0.2] },
      { type: 'box', position: [2.5, 2, -2], size: [1.2, 2, 0.2] },
      { type: 'box', position: [0, 0.09, -5], size: [4, 0.09, 3] },
    ]);
    physics.teleport({ x: 0, y: 1, z: 2 });
    for (let i = 0; i < 120; i++) physics.step(0, -4);
    expect(physics.position().z).toBeLessThan(-5);
    expect(physics.position().y).toBeGreaterThan(0.94);
    physics.dispose();
  });
});
