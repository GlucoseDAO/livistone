import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MATSU_COAST, MatsuCoast, coastalViewActive } from '../src/world/matsu-coast';
import { COURTYARD_CAMERAS } from '../src/world/matsu-courtyard-layout';
import { landscapeHeight } from '../src/world/terrain';
import { WATER_LEVEL } from '../src/world/water-surface';
import { DISTANT_DISPLAY } from '../src/render/output';

const coast = new MatsuCoast();
describe('Matsu far-pass coastal context', () => {
  it('keeps the original town and island ranges outside the bounded coastal view', () => {
    for (const camera of COURTYARD_CAMERAS) expect(coastalViewActive({ x: camera.x, y: camera.height + .78, z: camera.z })).toBe(true);
    for (const point of [{ x: 0, y: 2, z: -20 }, { x: 146.75, y: 2, z: 16 }, { x: 94, y: 2, z: -36 }, { x: 177, y: 40, z: 42 }, { x: 260, y: 2, z: 42 }]) expect(coastalViewActive(point)).toBe(false);
  });

  it('fills the far view with two opaque draws, an ocean to the horizon and actual bounded headlands', () => {
    expect(coast.children).toHaveLength(2);
    for (const mesh of [coast.sea, coast.headland]) {
      expect(mesh.material.transparent).toBe(false); expect(mesh.material.depthWrite).toBe(true); expect(mesh.material.fog).toBe(false);
      expect(mesh.material.mrtNode).toBeDefined(); expect(mesh.material.mrtNode).not.toBe(DISTANT_DISPLAY);
      expect(mesh.material.colorNode?.isNode).toBe(true);
    }
    const water = coast.sea.geometry.getAttribute('position');
    for (let i = 0; i < water.count; i++) expect(water.getY(i)).toBeCloseTo(WATER_LEVEL, 6);
    coast.sea.geometry.computeBoundingBox(); const bounds = coast.sea.geometry.boundingBox!;
    expect(bounds.min.x).toBe(MATSU_COAST.minX); expect(bounds.max.x).toBe(MATSU_COAST.maxX); expect(bounds.min.z).toBe(MATSU_COAST.minZ);
    expect(MATSU_COAST.hazeStart).toBeGreaterThan(1000); expect(MATSU_COAST.hazeEnd).toBeLessThan(MATSU_COAST.maxX);
    const p = coast.headland.geometry.getAttribute('position'); expect(p.count).toBeGreaterThan(2000); expect(p.count / 3).toBeLessThan(12000);
    let surface = 0, skirts = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); expect([x, y, z].every(Number.isFinite)).toBe(true);
      if (y > .081) { expect(y).toBeCloseTo(landscapeHeight(x, z), 4); surface++; }
      if (y < WATER_LEVEL) skirts++;
    }
    expect(surface).toBeGreaterThan(2000); expect(skirts).toBeGreaterThan(0);
  });

  it('uses probe position for visibility and restores the walking coast after an ordinary building face', () => {
    const ranges = [new THREE.Object3D(), new THREE.Object3D()], camera = COURTYARD_CAMERAS[0], eye = { x: camera.x, y: camera.height + .78, z: camera.z };
    coast.updateView(eye, ranges); expect(coast.visible).toBe(true); expect(ranges.every(range => !range.visible)).toBe(true);
    coast.updateView({ x: 29, y: 2, z: -11 }, ranges); expect(coast.visible).toBe(false); expect(ranges.every(range => range.visible)).toBe(true);
    coast.updateView(eye, ranges); expect(coast.visible).toBe(true); expect(ranges.every(range => !range.visible)).toBe(true);
    coast.updateView({ x: 0, y: 2, z: -20 }, ranges); expect(coast.visible).toBe(false); expect(ranges.every(range => range.visible)).toBe(true);
  });

  it('changes day/night colour without altering the visit-based visibility policy', () => {
    const ranges = [new THREE.Object3D()]; coast.updateView({ x: 177, y: 5, z: 42 }, ranges);
    coast.setNight(false); const day = coast.sea.material.color.clone();
    coast.setNight(true); expect(coast.sea.material.color.r + coast.sea.material.color.g + coast.sea.material.color.b).toBeLessThan(day.r + day.g + day.b);
    expect(coast.headland.material.color.r).toBeLessThan(.1); expect(coast.visible).toBe(true); expect(ranges[0].visible).toBe(false);
    coast.setNight(false); expect(coast.sea.material.color).toEqual(day);
  });
});
