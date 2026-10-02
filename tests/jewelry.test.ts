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

  it('gives the closed Mitoring silver outward normals and finite surface coordinates in both tiers', () => {
    for (const mobile of [false, true]) {
      const group = new THREE.Group(), silver = mitoringCage(group, mobile);
      const geometry = (group.getObjectByName('Jewelry silver') as THREE.Mesh<THREE.BufferGeometry>).geometry;
      const position = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
      expect(uv.count).toBe(position.count); expect([...uv.array].every(Number.isFinite)).toBe(true);
      let outward = 0;
      const center = new THREE.Vector3(), radial = new THREE.Vector3(), normal = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 8) {
        center.set(0, 0, 0);
        for (let j = 0; j < 8; j++) center.add(radial.fromBufferAttribute(position, i + j));
        center.divideScalar(8);
        for (let j = 0; j < 8; j++) if (radial.fromBufferAttribute(position, i + j).sub(center).dot(normal.fromBufferAttribute(normals, i + j)) > 0) outward++;
      }
      expect(outward / position.count).toBeGreaterThan(.99);
      geometry.dispose(); silver.dispose();
    }
  });

  it('keeps complete silver triangles outside the Mitoring amber wall and roof in both tiers', () => {
    const { a, b, wall, dome } = ENERGY_HALL;
    const normalized = (p: THREE.Vector3): number => Math.hypot(p.x / a, p.z / b, Math.max(0, p.y - wall) / dome);
    for (const mobile of [false, true]) {
      const group = new THREE.Group(), silver = mitoringCage(group, mobile);
      const g = (group.getObjectByName('Jewelry silver') as THREE.Mesh<THREE.BufferGeometry>).geometry, positions = g.getAttribute('position'), indices = g.index!;
      const triangle = new THREE.Triangle(), scaled = new THREE.Triangle(), sample = new THREE.Vector3(), origin = new THREE.Vector3();
      for (let i = 0; i < indices.count; i += 3) {
        triangle.a.fromBufferAttribute(positions, indices.getX(i)); triangle.b.fromBufferAttribute(positions, indices.getX(i + 1)); triangle.c.fromBufferAttribute(positions, indices.getX(i + 2));
        for (const p of [triangle.a, triangle.b, triangle.c, triangle.getMidpoint(sample)]) {
          if (normalized(p) <= 1) throw new Error(`Mitoring silver intersects amber in ${mobile ? 'reduced' : 'rich'} triangle ${i / 3}`);
        }
        for (const [target, p] of [[scaled.a, triangle.a], [scaled.b, triangle.b], [scaled.c, triangle.c]]) target.set(p.x / a, Math.max(0, p.y - wall) / dome, p.z / b);
        scaled.closestPointToPoint(origin, sample);
        if (sample.length() <= 1) throw new Error(`Mitoring silver chord intersects amber at triangle ${i / 3}`);
      }
      g.dispose(); silver.dispose();
    }
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
