import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createMatsuCourtyard } from '../src/world/matsu-courtyard';
import { MATSU_COURTYARD as C } from '../src/world/matsu-courtyard-layout';
import { STUMP_STENCIL as S, STUMP_STENCIL_SCALE, stumpStencilPoint } from '../src/world/stump-of-life-stencil';

const court = createMatsuCourtyard(); court.root.updateMatrixWorld(true);
const historic = court.root.children.filter(object => /exposed old|excavation earth/.test(object.name));
const origin = { x: C.stump.x * C.planScale, z: C.stump.z * C.planScale };
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
function supported(point: { x: number; z: number }): void {
  ray.set(new THREE.Vector3(point.x, 10, point.z), down);
  expect(ray.intersectObject(court.floor)[0]?.point.y, `flat support at ${point.x}, ${point.z}`).toBeCloseTo(C.floorY, 5);
  const old = ray.intersectObjects(historic, true)[0];
  expect(old?.point.y ?? -Infinity, `historic fabric at ${point.x}, ${point.z}`).toBeLessThanOrEqual(C.floorY + .001);
}
function circle(x: number, z: number, radius: number, count = 32): { x: number; z: number }[] {
  return Array.from({ length: count }, (_, i) => { const angle = i * Math.PI * 2 / count; return { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius }; });
}

describe('proposal-anchored courtyard artwork placement', () => {
  it('anchors the seat in the lower front-left concrete patch and supports its complete physical root footprint', () => {
    expect(C.stump).toEqual({ x: -.8, z: 1.8 }); expect(historic.length).toBeGreaterThan(0);
    // The physical root envelope remains 1.2 m across even when the surrounding architecture is compacted.
    for (const point of [origin, ...circle(origin.x, origin.z, .6, 64)]) supported(point);
  });

  it('keeps every circle, outside name envelope and curved connection on flat concrete clear of the old fabric', () => {
    const points: { x: number; z: number }[] = [], at = (x: number, y: number): { x: number; z: number } => ({ x: origin.x + (x - S.origin[0]) * STUMP_STENCIL_SCALE, z: origin.z + (S.origin[1] - y) * STUMP_STENCIL_SCALE });
    expect(STUMP_STENCIL_SCALE * 156).toBeCloseTo(.5, 12);
    for (const connection of S.connections) {
      const centre = at(...connection.centre), nameEnvelope = (S.nameRadius + S.nameFontSize + 1) * STUMP_STENCIL_SCALE;
      points.push(...circle(centre.x, centre.z, nameEnvelope));
      for (let i = 0; i <= 32; i++) {
        const point = at(...stumpStencilPoint(connection.curve, i / 32));
        // A conservative band covers the entire phrase above the line, rather than checking only the curve centre.
        points.push(...circle(point.x, point.z, (S.lineLabelOffset + S.lineFontSize + 1) * STUMP_STENCIL_SCALE, 8));
      }
    }
    for (const point of points) supported(point);
    const leftMargin = Math.min(...points.map(point => point.x)) - new THREE.Box3().setFromObject(court.floor).min.x;
    expect(leftMargin).toBeGreaterThan(.45);
  });
});
