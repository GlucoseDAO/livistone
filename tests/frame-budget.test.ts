import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LivingWaters } from '../src/world/living-waters';
import { GROVE_FULL_DETAIL, groveDetail, myceliumCrown } from '../src/world/mycelium';
import { mountainGeometry, terrainTiles } from '../src/world/mountains';
import { dropTwigs } from '../src/world/forest';
import { mergeStatic } from '../src/world/static-batch';
import { createPlanting } from '../src/world/planting';
import { terrainHeight } from '../src/world/terrain';
import { riverCenter } from '../src/world/waterways';
import { budgetGroups, measure, walkCamera } from '../scripts/frame-budget';

// Sub-plan 25, measured in memory on the realism capture poses with the walk camera's 130 m far plane. The bounds are loose
// ceilings over the reduced counts (3 October 2026, per gpu view: grove 1.11M → 25k triangles; lake 86 → 17 calls; glucose
// 28 → 7; terrain 352k → 113k triangles; flowers 3.5 → 0.9 calls).
const BOUNDS = {
  gpu: { lakeBuilt: 40, lakeView: 22, groveView: 40_000, glucoseBuilt: 18, terrainCalls: 14, terrainView: 160_000 },
  mobile: { lakeBuilt: 40, lakeView: 22, groveView: 15_000, glucoseBuilt: 18, terrainCalls: 14, terrainView: 130_000 },
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
      // Loading draws every mushroom at both levels so WebGPU builds all six shaders; the next update repacks from the camera.
      gardens.warmUp(true); expect(drawn()).toBe(6); expect(crowns()).toBe(140);
      expect(gardens.updateDetail(walkCamera(0, 52, 0), range, false)).toBe(false); expect(drawn()).toBe(6);
      gardens.warmUp(false); gardens.updateDetail(walkCamera(0, 52, 0), range, false); expect(drawn()).toBe(0);
    } finally { gardens.dispose(); }
  });
  it('tiles the terrain without losing or moving a triangle', () => {
    const ground = mountainGeometry(true), tiles = terrainTiles(ground), position = ground.getAttribute('position');
    // Nine town tiles and sixteen to 520 m; past them the distant ranges (sub-plan 26). The classic extent adds eight to 1.4 km.
    expect(tiles).toHaveLength(25);
    expect(terrainTiles(mountainGeometry(true, undefined, true))).toHaveLength(33);
    expect(tiles.reduce((sum, tile) => sum + tile.getAttribute('position').count, 0)).toBe(position.count);
    for (const tile of tiles) expect(Object.keys(tile.attributes).sort()).toEqual(Object.keys(ground.attributes).sort());
    const box = (geometries: THREE.BufferGeometry[]): THREE.Box3 => geometries.reduce((all, g) => { g.computeBoundingBox(); return all.union(g.boundingBox!); }, new THREE.Box3());
    expect(box(tiles).equals(box([ground]))).toBe(true);
    // Town tiles stay small enough to cull: their bounds sit inside about 120 m.
    for (const tile of tiles.filter((t) => t.name.includes('town'))) expect(tile.boundingSphere!.radius).toBeLessThan(120);
  }, 30000);
  it('drops only small branch pieces for distant trees', () => {
    // Three tubes: a trunk and a limb that stay, and a twig under two metres that goes.
    const parts = [new THREE.CylinderGeometry(.3, .4, 8), new THREE.CylinderGeometry(.1, .15, 3).translate(1, 5, 0), new THREE.CylinderGeometry(.02, .03, 1).translate(2, 6, 0)];
    const branches = mergeGeometries(parts)!, twigless = dropTwigs(branches);
    expect(twigless.index!.count).toBe(branches.index!.count - parts[2].index!.count);
    // Only the index changes; every kept triangle belongs to the trunk or the limb.
    const position = twigless.getAttribute('position'), drawn = Array.from(twigless.index!.array, (i) => position.getX(i));
    expect(Math.max(...drawn)).toBeLessThan(1.5);
  });
  it('bakes each part into the ancestor it merges into', () => {
    const into = new THREE.Group(), poster = new THREE.Group(), material = new THREE.MeshBasicMaterial(); into.add(poster);
    poster.position.set(10, 0, -4); poster.rotation.y = Math.PI / 2;
    const frames = [0, 1].map((i) => { const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); frame.position.set(i * 3, 2, 0); poster.add(frame); return frame; });
    const expected = frames.map((frame) => { frame.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(frame.matrixWorld); });
    const [merged] = mergeStatic(frames, 'Frames', Infinity, into);
    expect(merged.parent).toBe(into); expect(poster.children).toHaveLength(0);
    merged.geometry.computeBoundingBox(); const box = merged.geometry.boundingBox!;
    for (const point of expected) expect(box.containsPoint(point)).toBe(true);
    expect(box.getSize(new THREE.Vector3()).toArray().map((v) => Math.round(v))).toEqual([1, 1, 4]);
  });
  it('draws every flower palette through one mesh, coloured per instance', () => {
    const root = new THREE.Group(), details = new THREE.Group(), planting = createPlanting(root, details, true, terrainHeight, riverCenter, 'mobile');
    const flowers = planting.meshes.filter((mesh) => mesh.name === 'Flower borders');
    expect(flowers).toHaveLength(1);
    const geometry = flowers[0].geometry;
    expect(geometry.getAttribute('petal')).toBeDefined(); expect(geometry.getAttribute('petalColor')).toBeInstanceOf(THREE.InstancedBufferAttribute);
    // The software tier keeps four vertex-coloured kinds; its Lambert copies carry no colour node.
    const cpu = createPlanting(new THREE.Group(), new THREE.Group(), true, terrainHeight, riverCenter, 'cpu');
    expect(cpu.meshes.filter((mesh) => mesh.name === 'Flower borders')).toHaveLength(4);
  }, 30000);
  for (const tier of ['gpu', 'mobile'] as const) it(`stays within the reduced draw budget per group (${tier})`, () => {
    const bounds = BOUNDS[tier], [lake, glucose, hill, terrain, planting] = budgetGroups(tier).map((group) => measure(group));
    expect(lake.static['lake, paths, pavilion'].calls).toBeLessThanOrEqual(bounds.lakeBuilt);
    expect(lake.perView['lake, paths, pavilion'].calls).toBeLessThanOrEqual(bounds.lakeView);
    const grove = lake.perView['mycelium grove'];
    expect(grove.triangles).toBeLessThanOrEqual(bounds.groveView);
    expect(grove.calls).toBeLessThanOrEqual(1.5); expect(grove.maxCalls).toBeLessThanOrEqual(6);
    expect(glucose.static['structure and posters'].calls).toBeLessThanOrEqual(bounds.glucoseBuilt);
    expect(hill.static['climb markers'].calls).toBeLessThanOrEqual(2);
    expect(terrain.perView['meadow and ridges'].calls).toBeLessThanOrEqual(bounds.terrainCalls);
    expect(terrain.perView['meadow and ridges'].triangles).toBeLessThanOrEqual(bounds.terrainView);
    expect(planting.perView['Flower borders'].maxCalls).toBe(1);
  }, 60000);
});
