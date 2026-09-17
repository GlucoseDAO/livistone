import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBridge, bridgeHeight } from '../src/world/bridge';
import { PATH_CURVES, PATH_WIDTH, plantingAllowed } from '../src/world/landscape';
import { CIVIC_LANDMARKS } from '../src/game/content';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';

describe('garden circulation', () => {
  it('keeps the full width of curved paths and south-facing entrances clear of foliage', () => {
    for (const curve of PATH_CURVES) for (let i = 0; i <= 200; i++) {
      const p = curve.getPoint(i / 200), tangent = curve.getTangent(i / 200), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      for (const side of [-1, 0, 1]) {
        const edge = p.clone().addScaledVector(normal, side * (PATH_WIDTH / 2 + .65));
        expect(plantingAllowed(edge.x, edge.z, .8)).toBe(false);
      }
    }
    for (const l of CIVIC_LANDMARKS) for (let z = l.z; z < l.z + 20; z += .25) {
      for (const dx of [-3, 0, 3]) expect(plantingAllowed(l.x + dx, z, 1)).toBe(false);
    }
    expect(plantingAllowed(70, -40, 1)).toBe(true);
  });
  it('crosses the complete bridge without falling and stops at its railings', async () => {
    const colliders: ColliderSpec[] = [
      { type: 'box', position: [0, -.2, 5], size: [10, .2, 13] },
      { type: 'box', position: [0, -.2, 45], size: [10, .2, 11] },
    ];
    const material = new THREE.MeshStandardMaterial(), group = new THREE.Group();
    createBridge(group, colliders, material, material, material);
    const physics = await Physics.create(colliders);
    try {
      for (const direction of [-1, 1]) {
        physics.teleport({ x: 0, y: 1, z: direction < 0 ? 42 : 10 });
        for (let i = 0; i < 510; i++) {
          physics.step(0, direction * 4); const p = physics.position();
          expect(p.y).toBeGreaterThan(.8);
          if (p.z > 13 && p.z < 39) expect(Math.abs(p.y - bridgeHeight(p.z) - .845)).toBeLessThan(.12);
        }
        expect(direction * (physics.position().z - 26)).toBeGreaterThan(16);
      }
      for (const z of [13, 26, 39]) for (const side of [-1, 1]) {
        physics.teleport({ x: 0, y: bridgeHeight(z) + .86, z });
        for (let i = 0; i < 90; i++) physics.step(side * 4, 0);
        expect(Math.abs(physics.position().x)).toBeGreaterThan(1.7);
        expect(Math.abs(physics.position().x)).toBeLessThan(2);
      }
    } finally {
      physics.dispose(); material.dispose(); group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
  });
});
