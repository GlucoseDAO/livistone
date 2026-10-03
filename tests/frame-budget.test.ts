import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LivingWaters } from '../src/world/living-waters';
import { GROVE_FULL_DETAIL, groveDetail, myceliumCrown } from '../src/world/mycelium';
import { budgetGroups, measure, walkCamera } from '../scripts/frame-budget';

// Sub-plan 25 part one, measured in memory on the realism capture poses. The bounds are loose ceilings over the reduced
// counts (3 October 2026: grove 1.11M → 25k triangles per gpu view; lake 85 → 18 calls; glucose 65 → 15; markers 39 → 2).
const BOUNDS = {
  gpu: { lakeBuilt: 40, lakeView: 22, groveView: 40_000, glucoseBuilt: 18 },
  mobile: { lakeBuilt: 40, lakeView: 22, groveView: 15_000, glucoseBuilt: 18 },
} as const;

describe('frame budget, renderer-independent geometry', () => {
  it('keeps every fold of the photographed crown in a light crown of about 2k triangles', () => {
    for (const mobile of [false, true]) {
      const full = myceliumCrown(mobile), light = myceliumCrown(mobile, true);
      expect(light.index!.count / 3).toBeLessThanOrEqual(2100);
      full.computeBoundingBox(); light.computeBoundingBox();
      const a = full.boundingBox!.getSize(new THREE.Vector3()), b = light.boundingBox!.getSize(new THREE.Vector3());
      // The same spread; the thinner, coarser strap loses about a pixel of height at the 36 m switch.
      for (const axis of ['x', 'z'] as const) expect(Math.abs(a[axis] - b[axis]) / a[axis]).toBeLessThan(.03);
      expect(Math.abs(a.y - b.y) / a.y).toBeLessThan(.06);
      full.dispose(); light.dispose();
    }
  });
  it('picks crown detail from distance and crown size, and hides crowns in the fog as the forest does', () => {
    expect(groveDetail(GROVE_FULL_DETAIL - 1, 1, 130)).toBe('full');
    expect(groveDetail(GROVE_FULL_DETAIL + 1, 1, 130)).toBe('light');
    expect(groveDetail(93, 1, 130)).toBe('light');
    expect(groveDetail(94, 1, 130)).toBe('hidden');
    expect(groveDetail(400, 1, 630, true)).toBe('light');
    // A ring-scale shrub keeps the full folds only up close.
    expect(groveDetail(10, .3, 130)).toBe('full');
    expect(groveDetail(12, .3, 130)).toBe('light');
  });
  it('packs the visible grove into at most six draws and none from across the lake', () => {
    const gardens = new LivingWaters(false), grove = gardens.grove.meshes, range = 130;
    try {
      const drawn = (): number => grove.filter(mesh => mesh.visible).length;
      const crowns = (): number => grove.filter(mesh => mesh.visible && mesh.name.includes('gills')).reduce((sum, mesh) => sum + mesh.count, 0);
      const opals = (): number => grove.filter(mesh => mesh.visible && mesh.name.includes('opal')).reduce((sum, mesh) => sum + mesh.count, 0);
      gardens.updateDetail(walkCamera(74, -138, Math.PI, .18), range, false);
      expect(drawn()).toBe(6); expect(crowns()).toBe(70); expect(opals()).toBe(70);
      expect(grove.find(mesh => mesh.name === 'Mycelium · curled open silver gills')!.count).toBeLessThan(30);
      gardens.updateDetail(walkCamera(-18, -64, 0, .08), range, false);
      expect(crowns()).toBeLessThan(10);
      gardens.updateDetail(walkCamera(0, 52, 0), range, false);
      expect(drawn()).toBe(0);
      // The map keeps the whole grove at light detail.
      gardens.updateDetail(new THREE.PerspectiveCamera().translateX(160).translateY(224).translateZ(192), 630, true);
      expect(crowns()).toBe(70); expect(drawn()).toBe(3);
    } finally { gardens.dispose(); }
  });
  for (const tier of ['gpu', 'mobile'] as const) it(`stays within the reduced draw budget per group (${tier})`, () => {
    const bounds = BOUNDS[tier], [lake, glucose, hill] = budgetGroups(tier).map(measure);
    expect(lake.static['lake, paths, pavilion'].calls).toBeLessThanOrEqual(bounds.lakeBuilt);
    expect(lake.perView['lake, paths, pavilion'].calls).toBeLessThanOrEqual(bounds.lakeView);
    const grove = lake.perView['mycelium grove'];
    expect(grove.triangles).toBeLessThanOrEqual(bounds.groveView);
    expect(grove.calls).toBeLessThanOrEqual(1.5); expect(grove.maxCalls).toBeLessThanOrEqual(6);
    expect(glucose.static['structure and posters'].calls).toBeLessThanOrEqual(bounds.glucoseBuilt);
    expect(hill.static['climb markers'].calls).toBeLessThanOrEqual(2);
  });
});
