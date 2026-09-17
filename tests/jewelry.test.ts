import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENERGY_HALL, mitoringCage, nanotCage } from '../src/world/jewelry';
import { LANDMARKS } from '../src/game/content';

describe('architectural jewelry', () => {
  for (const kind of ['energy', 'science'] as const) it(`${kind} has finite, bounded geometry with a clear pedestrian entrance on desktop and mobile`, () => {
    const counts: number[] = [];
    for (const mobile of [false, true]) {
      const group = new THREE.Group();
      if (kind === 'energy') mitoringCage(group, mobile); else nanotCage(group, 8.5, 6, mobile);
      const sculpture = group.getObjectByName('Jewelry silver') as THREE.Mesh<THREE.BufferGeometry>;
      const geometry = sculpture.geometry, position = geometry.getAttribute('position'), indices = geometry.index!;
      expect([...position.array, ...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
      const doorway = new THREE.Box3(new THREE.Vector3(-2, .5, 3), new THREE.Vector3(2, 3.1, 15));
      const hall = new THREE.Box3(new THREE.Vector3(-3, .5, -3), new THREE.Vector3(3, 3.1, 3));
      const triangle = new THREE.Triangle();
      for (let i = 0; i < indices.count; i += 3) {
        triangle.a.fromBufferAttribute(position, indices.getX(i)); triangle.b.fromBufferAttribute(position, indices.getX(i + 1)); triangle.c.fromBufferAttribute(position, indices.getX(i + 2));
        if (doorway.intersectsTriangle(triangle) || hall.intersectsTriangle(triangle)) throw new Error(`${kind} silver crosses the walking space at triangle ${i / 3}`);
      }
      counts.push(indices.count / 3);
      expect(counts.at(-1)).toBeLessThan(80000);
      group.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); object.material.dispose(); } });
    }
    expect(counts[1]).toBeLessThan(counts[0] * .7);
  });

  it('keeps the Energy hall footprint consistent with gardens and location detection', () => {
    const energy = LANDMARKS.find((landmark) => landmark.id === 'energy')!;
    expect(energy.stretch.x * 7.1).toBeCloseTo(ENERGY_HALL.a);
    expect(energy.stretch.z * 7.1).toBeCloseTo(ENERGY_HALL.b);
  });

  it('keeps Nanot silver outside its glazing and grounds the supporting ribs', () => {
    const group = new THREE.Group(), frame = nanotCage(group, 8.5, 6, false), center = new THREE.Vector3(0, 6, 0), triangle = new THREE.Triangle(), nearest = new THREE.Vector3();
    for (const name of ['Jewelry silver', 'Nanot supporting frame']) {
      const g = (group.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry>).geometry, p = g.getAttribute('position'), indices = g.index!;
      for (let i = 0; i < indices.count; i += 3) {
        triangle.a.fromBufferAttribute(p, indices.getX(i)); triangle.b.fromBufferAttribute(p, indices.getX(i + 1)); triangle.c.fromBufferAttribute(p, indices.getX(i + 2));
        triangle.closestPointToPoint(center, nearest); expect(nearest.distanceTo(center)).toBeGreaterThan(8.7);
      }
    }
    frame.computeBoundingBox(); expect(frame.boundingBox!.min.y).toBeLessThan(.4); expect(frame.boundingBox!.max.y).toBeGreaterThan(15);
    group.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); object.material.dispose(); } });
  });
});
