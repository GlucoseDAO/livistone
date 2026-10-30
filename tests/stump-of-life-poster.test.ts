import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import { LANDMARKS } from '../src/game/content';
import { createMatsuCourtyard } from '../src/world/matsu-courtyard';
import { MATSU_COURTYARD as C, COURTYARD_POSTER as P, COURTYARD_POSTER_ARRIVAL as A, COURTYARD_LOWER_ENTRY, courtyardWorld, courtyardLocal } from '../src/world/matsu-courtyard-layout';
import { createStumpPosterStructure, stumpPosterFeet } from '../src/world/stump-of-life-poster';
import { STUMP_OF_LIFE, STUMP_ARTWORK } from '../src/world/stump-of-life-layout';
import { STUMP_STENCIL as S, STUMP_STENCIL_SCALE, stumpStencilPoint } from '../src/world/stump-of-life-stencil';
import { transformColliders } from '../src/world/town-layout';

const courtyard = createMatsuCourtyard();
courtyard.root.position.set(C.x, 0, C.z); courtyard.root.rotation.y = C.yaw; courtyard.root.updateMatrixWorld(true);
const poster = createStumpPosterStructure(), feet = stumpPosterFeet();
const historic = courtyard.root.children.filter(object => /exposed old|excavation earth/.test(object.name));
const colliders = [...transformColliders(courtyard.colliders, courtyard.root.matrixWorld, C.yaw), ...poster.colliders];
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);

describe('courtyard-supported Stump of Life poster', () => {
  it('puts both visible posts on concrete, with equally scaled board and post collision', () => {
    expect(P.y).toBe(C.floorY); expect(P.scale).toBe(.55);
    expect(courtyardLocal(P).x).toBeCloseTo(4.2, 8); expect(courtyardLocal(P).z).toBeCloseTo(3.7, 8);
    const posts = poster.sign.group.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry);
    expect(posts).toHaveLength(2); expect(poster.colliders).toHaveLength(3);
    for (let i = 0; i < posts.length; i++) {
      const bounds = new THREE.Box3().setFromObject(posts[i]), box = poster.colliders[i + 1];
      expect(bounds.min.y).toBeCloseTo(C.floorY, 6);
      expect(box.type).toBe('box'); if (box.type !== 'box') continue;
      expect(box.position[0]).toBeCloseTo(feet[i].x, 8); expect(box.position[2]).toBeCloseTo(feet[i].z, 8);
      expect(box.position[1] - box.size[1]).toBeCloseTo(C.floorY, 8);
      expect(box.size[0]).toBeCloseTo(.06 * P.scale, 8); expect(box.yaw).toBe(P.yaw);
      expect(feet[i].rx).toBeCloseTo(.15 * P.scale, 8);
      ray.set(new THREE.Vector3(feet[i].x, 10, feet[i].z), down);
      expect(ray.intersectObject(courtyard.floor)[0]?.point.y).toBeCloseTo(C.floorY, 5);
      expect(ray.intersectObjects(historic, true)[0]?.point.y ?? -Infinity).toBeLessThanOrEqual(C.floorY + .001);
    }
    const board = poster.colliders[0]; expect(board.type).toBe('box');
    if (board.type === 'box') { expect(board.size[0] * 2).toBeCloseTo(1.914, 8); expect(board.size[1] * 2).toBeCloseTo(1.364, 8); }
  });

  it('makes the registered lower arrival face a readable poster beside the artwork, clear of the native stencil', () => {
    expect(LANDMARKS.find(place => place.id === 'stump-of-life')!.entrance).toEqual(A);
    expect(Math.hypot(A.x - P.x, A.z - P.z)).toBeCloseTo(2.17, 8);
    expect(Math.hypot(A.x - STUMP_OF_LIFE.x, A.z - STUMP_OF_LIFE.z)).toBeLessThan(2);
    // The level arrival's actual eye ray meets the lettered face, not its edge or a rear-facing panel.
    ray.set(new THREE.Vector3(A.x, A.y + .78, A.z), new THREE.Vector3(-Math.sin(A.yaw), 0, -Math.cos(A.yaw)));
    expect(ray.intersectObjects(poster.sign.faces)[0]?.distance).toBeGreaterThan(2);
    expect(ray.intersectObjects(poster.sign.faces)[0]?.distance).toBeLessThan(2.2);
    ray.set(new THREE.Vector3(A.x, 2, A.z), down);
    expect(ray.intersectObject(courtyard.floor)[0]?.point.y).toBeCloseTo(C.floorY, 5);
    const ink = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(C.stump.x * C.planScale + (x - S.origin[0]) * STUMP_STENCIL_SCALE, 0, C.stump.z * C.planScale + (S.origin[1] - y) * STUMP_STENCIL_SCALE).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.yaw).add(new THREE.Vector3(C.x, 0, C.z));
    for (const connection of S.connections) {
      for (let i = 0; i <= 32; i++) {
        const point = ink(...stumpStencilPoint(connection.curve, i / 32));
        expect(Math.hypot(point.x - P.x, point.z - P.z)).toBeGreaterThan(2.5);
      }
    }
    expect(STUMP_ARTWORK.engravingRotation).toBeCloseTo(-Math.atan2(8.8, 5), 12);
  });

  it('blocks walking through the visible board while leaving the lower entry, reader approach and glazing doorway open', async () => {
    const physics = await Physics.create(colliders);
    const walk = (target: { x: number; z: number }): void => {
      for (let i = 0; i < 420; i++) {
        const at = physics.position(), dx = target.x - at.x, dz = target.z - at.z, distance = Math.hypot(dx, dz);
        if (distance < .1) break;
        physics.step(dx / distance * 1.7, dz / distance * 1.7);
      }
      const at = physics.position(); expect(Math.hypot(at.x - target.x, at.z - target.z)).toBeLessThan(.15);
      expect(at.y).toBeGreaterThan(C.floorY + .65); expect(at.y).toBeLessThan(C.floorY + 1.1);
    };
    try {
      physics.teleport(COURTYARD_LOWER_ENTRY); walk(A); walk(courtyardWorld({ x: 1, z: 2.4 }));
      physics.teleport(A); for (let i = 0; i < 120; i++) physics.step(-Math.sin(A.yaw) * 1.7, -Math.cos(A.yaw) * 1.7);
      const blocked = courtyardLocal(physics.position()); expect(blocked.x).toBeGreaterThan(3.5); expect(blocked.x).toBeLessThan(3.8);
      physics.teleport({ ...courtyardWorld({ x: 3.6, z: 1 }), y: C.floorY + .85 }); walk(courtyardWorld({ x: 5.3, z: 1 }));
    } finally { physics.dispose(); }
  });
});
