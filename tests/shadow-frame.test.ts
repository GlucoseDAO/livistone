import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { lightAxes, shadowFrame } from '../src/game/shadow-frame';
import type { Vec3 } from '../src/game/shadow-frame';

const DAY = new THREE.Vector3(-55, 150, 100).normalize(), NIGHT = new THREE.Vector3(40, 90, 10).normalize();
const DIRECTIONS: Vec3[] = [DAY, NIGHT, new THREE.Vector3(-35, 70, 35).normalize(), new THREE.Vector3(25, 38, -70).normalize(), new THREE.Vector3(0, 1, 0)];

/** Light-space position of a world point in texels, measured from the shadow map's corner, as the real three.js shadow camera sees it. */
function texelPosition(point: THREE.Vector3, center: Vec3, half: number, size: number, direction: Vec3): THREE.Vector2 {
  const frame = shadowFrame(center, half, size, direction), camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 1, 800);
  const target = new THREE.Vector3(frame.target.x, frame.target.y, frame.target.z);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(direction.x, direction.y, direction.z).normalize(), 400); camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const ndc = point.clone().project(camera);
  return new THREE.Vector2((ndc.x + 1) / 2 * size, (ndc.y + 1) / 2 * size);
}

describe('shadow frame', () => {
  it('uses the axes three.js gives the shadow camera', () => {
    for (const direction of DIRECTIONS) {
      const matrix = new THREE.Matrix4().lookAt(new THREE.Vector3(direction.x, direction.y, direction.z), new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
      const right = new THREE.Vector3(), up = new THREE.Vector3(), z = new THREE.Vector3(); matrix.extractBasis(right, up, z);
      const axes = lightAxes(direction);
      expect(right.distanceTo(new THREE.Vector3(axes.right.x, axes.right.y, axes.right.z))).toBeLessThan(1e-9);
      expect(up.distanceTo(new THREE.Vector3(axes.up.x, axes.up.y, axes.up.z))).toBeLessThan(1e-9);
    }
  });

  it('has symmetric bounds of the requested half-size', () => {
    const frame = shadowFrame({ x: 12.3, z: -40.7 }, 50, 2048, DAY);
    expect([frame.left, frame.right, frame.top, frame.bottom]).toEqual([-50, 50, 50, -50]);
    expect(frame.texel).toBeCloseTo(100 / 2048, 12);
  });

  it('keeps the player inside the frustum, within a texel of its centre', () => {
    for (const direction of DIRECTIONS) for (let i = 0; i < 40; i++) {
      const center = { x: Math.sin(i * 7.1) * 140, y: Math.cos(i * 3.3) * 12, z: Math.cos(i * 5.7) * 160 }, half = i % 2 ? 50 : 40, size = i % 2 ? 2048 : 1024;
      const frame = shadowFrame(center, half, size, direction), { right, up } = lightAxes(direction);
      const offset = new THREE.Vector3(center.x - frame.target.x, center.y - frame.target.y, center.z - frame.target.z);
      const r = offset.dot(new THREE.Vector3(right.x, right.y, right.z)), u = offset.dot(new THREE.Vector3(up.x, up.y, up.z));
      expect(Math.abs(r)).toBeLessThanOrEqual(frame.texel / 2 + 1e-9); expect(Math.abs(u)).toBeLessThanOrEqual(frame.texel / 2 + 1e-9);
      expect(Math.abs(r)).toBeLessThan(half); expect(Math.abs(u)).toBeLessThan(half);
      // The target only slides across the light, never along it, so the light keeps its direction and distance.
      const along = offset.dot(new THREE.Vector3(right.x, right.y, right.z).cross(new THREE.Vector3(up.x, up.y, up.z)));
      expect(Math.abs(along)).toBeLessThan(1e-9);
    }
  });

  it('samples the world on the same texel grid however the player moves', () => {
    const point = new THREE.Vector3(3.17, 1.4, -21.9);
    for (const direction of [DAY, NIGHT]) {
      const base = texelPosition(point, { x: 0, y: 1, z: -20 }, 50, 2048, direction);
      // Sub-texel moves and multi-metre walks both keep the fixed point at the same fraction of a texel, so static shadows cannot shimmer.
      for (const step of [.001, .013, .02, .4, 3.3, 12.4, 37]) {
        const moved = texelPosition(point, { x: step * .6, y: 1 + step * .1, z: -20 - step * .8 }, 50, 2048, direction);
        const shift = moved.clone().sub(base);
        expect(Math.abs(shift.x - Math.round(shift.x))).toBeLessThan(2e-3);
        expect(Math.abs(shift.y - Math.round(shift.y))).toBeLessThan(2e-3);
      }
      // Moves under a third of a texel from a point on the grid leave the frame's light-space position untouched.
      const { right, up } = lightAxes(direction), onGrid = shadowFrame({ x: 0, y: 1, z: -20 }, 50, 2048, direction), texel = onGrid.texel;
      const across = (v: Vec3) => [v.x * right.x + v.y * right.y + v.z * right.z, v.x * up.x + v.y * up.y + v.z * up.z];
      for (const [dx, dy, dz] of [[.3, 0, 0], [0, .3, 0], [0, 0, -.3], [-.2, .1, .2]]) {
        const moved = shadowFrame({ x: onGrid.target.x + dx * texel, y: onGrid.target.y + dy * texel, z: onGrid.target.z + dz * texel }, 50, 2048, direction);
        const [r0, u0] = across(onGrid.target), [r1, u1] = across(moved.target);
        expect(Math.abs(r1 - r0)).toBeLessThan(1e-9); expect(Math.abs(u1 - u0)).toBeLessThan(1e-9);
      }
    }
  });
});
