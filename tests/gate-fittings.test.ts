import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGateLamps } from '../src/world/gate-lamps';
import { NightLighting } from '../src/world/night-lighting';
import { gatePosterColliders } from '../src/world/gate-posters';
import { WINTER, WINTER_POSTER, WINTER_ARRIVAL } from '../src/world/winter-gate-layout';
import { EYELENSE, EYELENSE_LAMPS, EYELENSE_POSTER } from '../src/world/eyelense-gate-layout';
import { grassAllowed, plantingAllowed } from '../src/world/landscape';
import { snowCover } from '../src/world/mountain-layout';
import type { ColliderSpec } from '../src/game/physics';

describe('gate photo boards and night fittings', () => {
  it('reserves source-board feet and leaves each gate approach clear', () => {
    for (const p of [WINTER_POSTER, EYELENSE_POSTER]) {
      expect(grassAllowed(p.x, p.z, .4)).toBe(false);
      expect(plantingAllowed(p.x, p.z, 1)).toBe(false);
      const boxes = gatePosterColliders(p);
      expect(boxes).toHaveLength(2);
      expect(boxes.every(b => b.type === 'box' && b.yaw === p.yaw)).toBe(true);
    }
    expect(Math.abs(WINTER_POSTER.z - WINTER.z)).toBeGreaterThan(3);
    expect(Math.abs(EYELENSE_POSTER.z - EYELENSE.z)).toBeGreaterThan(3);
    expect(snowCover(WINTER_ARRIVAL.x, WINTER_ARRIVAL.z)).toBeGreaterThan(.8);
    expect(WINTER_ARRIVAL.x - WINTER.x).toBeGreaterThan(WINTER.arrivalX - WINTER.x);
  });
  for (const tier of ['gpu', 'mobile', 'cpu'] as const) it(`lights the Eyelense approach at night and restores daytime (${tier})`, () => {
    const root = new THREE.Group(), scene = new THREE.Scene(), colliders: ColliderSpec[] = [];
    createGateLamps(root, colliders, EYELENSE_LAMPS, '#ffdeb0');
    expect(colliders).toHaveLength(2);
    const night = new NightLighting(root, scene, tier !== 'gpu', tier);
    const camera = new THREE.PerspectiveCamera();
    night.setNight(true);
    for (const p of EYELENSE_LAMPS) {
      camera.position.set(p.x, p.y + 1, p.z); night.update(camera);
      expect(scene.children.some(c => c instanceof THREE.PointLight && c.intensity > 0 && c.position.distanceTo(camera.position) < 2)).toBe(true);
    }
    night.setNight(false);
    expect(scene.children.every(c => !(c instanceof THREE.PointLight) || c.intensity === 0)).toBe(true);
    root.traverse(c => { if (c instanceof THREE.Sprite) expect(c.visible).toBe(false); });
  });
});
