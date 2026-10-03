import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTACT_GRID, createContactShadows, objectContactSites, rockContactSite, TOWN_SHADE_FOOTPRINTS, treeContactSites, treeShadeDiscs } from '../src/world/contact-shadows';
import { KEEP_DISPLAY } from '../src/render/output';
import type { ContactSite } from '../src/world/contact-shadows';
import { forestCells } from '../src/world/forest';
import { forestSites } from '../src/world/forest-layout';
import { gatewayApproachWidth } from '../src/world/gateway-layout';
import { contactFalloff, GROUND_SHADE_MIN, groundShadeField } from '../src/world/ground-cover';
import { PATH_CURVES, PATH_WIDTH } from '../src/world/landscape';
import { mountainGeometry } from '../src/world/mountains';
import { riverRockSites } from '../src/world/stone';
import { landscapeHeight } from '../src/world/terrain';
import { waterDistance } from '../src/world/waterways';

function town(mobile: boolean) {
  const trees = forestSites(mobile), cells = forestCells(trees), rocks = riverRockSites(mobile), objects = objectContactSites();
  const groups = cells.map(cell => cell.sites.flatMap(({ p, index }) => treeContactSites(p, index)));
  return { trees, cells, rocks, objects, groups, shadows: createContactShadows([...objects, ...rocks.map(rockContactSite)], groups) };
}
const radius = (site: ContactSite): number => Math.max(site.rx, site.rz);
const pathSamples = PATH_CURVES.map((curve, road) => curve.getPoints(400).map(p => ({ x: p.x, z: p.z, half: (curve.points.every(q => q.x === 0 && q.z >= 40) ? gatewayApproachWidth(p.z) : PATH_WIDTH) / 2 })));
const pathGap = (x: number, z: number): number => Math.min(...pathSamples.flat().map(p => Math.hypot(p.x - x, p.z - z) - p.half));

describe('contact shadows', () => {
  const gpu = town(false), mobile = town(true);

  it('lies exactly on the rendered terrain triangles, facing up', () => {
    const terrain = mountainGeometry(false), p = terrain.getAttribute('position'), key = (x: number, y: number, z: number): string => `${x},${y},${z}`;
    const triangles = new Set<string>();
    for (let i = 0; i < p.count; i += 3) triangles.add([0, 1, 2].map(k => key(p.getX(i + k), p.getY(i + k), p.getZ(i + k))).sort().join('|'));
    terrain.dispose();
    const ground = [...gpu.objects.filter(site => site.floor === undefined), ...gpu.rocks.map(rockContactSite), ...gpu.groups.flat()];
    const { mesh } = createContactShadows(ground), position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      expect(Number.isInteger(x / CONTACT_GRID.step)).toBe(true); expect(Number.isInteger(z / CONTACT_GRID.step)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(CONTACT_GRID.minX); expect(x).toBeLessThanOrEqual(CONTACT_GRID.maxX);
      expect(z).toBeGreaterThanOrEqual(CONTACT_GRID.minZ); expect(z).toBeLessThanOrEqual(CONTACT_GRID.maxZ);
      expect(position.getY(i)).toBe(Math.fround(landscapeHeight(x, z)));
    }
    for (let i = 0; i < index.count; i += 3) {
      const corners = [0, 1, 2].map(k => index.getX(i + k));
      expect(triangles.has(corners.map(n => key(position.getX(n), position.getY(n), position.getZ(n))).sort().join('|'))).toBe(true);
      a.fromBufferAttribute(position, corners[0]); b.fromBufferAttribute(position, corners[1]); c.fromBufferAttribute(position, corners[2]);
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
    }
  }, 60000);

  it('seats floor decals on their level floors', () => {
    const floors = gpu.objects.filter(site => site.floor !== undefined);
    expect(floors.length).toBeGreaterThan(30);
    const { mesh } = createContactShadows(floors), position = mesh.geometry.getAttribute('position');
    expect(position.count).toBe(floors.length * 4);
    for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBe(Math.fround(floors[Math.floor(i / 4)].floor!));
  });

  it('keeps tree and rock patches off the paths and out of the water', () => {
    for (const site of [...gpu.groups.flat(), ...mobile.groups.flat(), ...gpu.rocks.map(rockContactSite), ...mobile.rocks.map(rockContactSite)]) {
      expect(pathGap(site.x, site.z)).toBeGreaterThan(radius(site));
      expect(waterDistance(site.x, site.z)).toBeGreaterThan(radius(site));
    }
    // Feet and posts may stand at a path edge, where the raised paving hides the overlap, but never on the paving or in water.
    for (const site of gpu.objects.filter(site => site.floor === undefined)) {
      expect(pathGap(site.x, site.z)).toBeGreaterThan(0);
      expect(waterDistance(site.x, site.z)).toBeGreaterThan(radius(site));
    }
  });

  it('batches every tier into one draw, with a crown and a trunk patch per tree', () => {
    for (const tier of [gpu, mobile]) {
      expect(tier.groups.flat()).toHaveLength(tier.trees.length * 2);
      expect(tier.cells.reduce((sum, cell) => sum + cell.sites.length, 0)).toBe(tier.trees.length);
      expect(tier.shadows.patches).toBe(tier.trees.length * 2 + tier.rocks.length + tier.objects.length);
      expect(tier.shadows.mesh).toBeInstanceOf(THREE.Mesh);
      expect(Array.isArray(tier.shadows.mesh.material)).toBe(false);
    }
    // Mobile and CPU share the reduced town: fewer trees and rocks, the same feet and posts.
    expect(mobile.trees.length).toBeLessThan(gpu.trees.length * .7); expect(mobile.rocks.length).toBeLessThan(gpu.rocks.length);
    expect(gpu.shadows.mesh.geometry.index!.count / 3).toBeLessThan(60000);
    expect(mobile.shadows.mesh.geometry.index!.count / 3).toBeLessThan(35000);
  });

  it('draws a forest cell’s patches only while its trees are shown', () => {
    const { shadows, groups, objects, rocks } = mobile, geometry = shadows.mesh.geometry, all = Array.from(geometry.index!.array);
    const fixed = createContactShadows([...objects, ...rocks.map(rockContactSite)]).mesh.geometry.index!.count;
    // Until the forest reports its cells, no tree patch is drawn, so nothing floats where trees have not loaded.
    expect(geometry.drawRange.count).toBe(fixed);
    shadows.showGroups(groups.map(() => false));
    expect(geometry.drawRange.count).toBe(fixed);
    const shown = groups.map((_, i) => i % 3 === 0); shadows.showGroups(shown);
    const lengths = groups.map(sites => createContactShadows(sites).mesh.geometry.index!.count);
    let start = fixed, expected = fixed; const drawn: number[] = all.slice(0, fixed);
    lengths.forEach((length, i) => { if (shown[i]) { drawn.push(...all.slice(start, start + length)); expected += length; } start += length; });
    expect(geometry.drawRange.count).toBe(expected);
    expect(Array.from(geometry.index!.array.slice(0, expected))).toEqual(drawn);
    shadows.showGroups(groups.map(() => true)); expect(geometry.drawRange.count).toBe(all.length);
    expect(Array.from(geometry.index!.array)).toEqual(all);
  });

  it('multiplies the ground with a soft texture whose rim is clear', () => {
    const material = gpu.shadows.mesh.material, texture = material.map as THREE.DataTexture, { data, width, height } = texture.image as { data: Uint8Array; width: number; height: number };
    expect(material.blending).toBe(THREE.MultiplyBlending); expect(material.premultipliedAlpha).toBe(true);
    expect(material.depthWrite).toBe(false); expect(material.polygonOffset).toBe(true); expect(material.vertexColors).toBe(true);
    // A zero display output leaves the ground's paper mask and fog factor unchanged under multiply blending.
    expect(material.mrtNode).toBe(KEEP_DISPLAY); expect(material.fog).toBe(false); expect(gpu.shadows.mesh.userData.keepGeometry).toBe(true);
    expect(width).toBe(64); expect(height).toBe(64);
    for (let i = 0; i < width; i++) for (const j of [0, height - 1]) { expect(data[(j * width + i) * 4 + 3]).toBe(0); expect(data[(i * width + j) * 4 + 3]).toBe(0); }
    expect(data[(32 * width + 32) * 4 + 3]).toBe(255);
    expect(contactFalloff(0)).toBe(1); expect(contactFalloff(1)).toBe(0); expect(contactFalloff(.6)).toBeGreaterThan(contactFalloff(.8));
  });
});

describe('baked ground shade', () => {
  const trees = forestSites(false), shade = groundShadeField(treeShadeDiscs(trees), TOWN_SHADE_FOOTPRINTS), buildings = groundShadeField([], TOWN_SHADE_FOOTPRINTS);

  it('stays bounded and is darker beside trunks than in the open', () => {
    for (let z = -260; z <= 150; z += 3.7) for (let x = -240; x <= 240; x += 3.7) {
      const value = shade(x, z); expect(value).toBeGreaterThanOrEqual(GROUND_SHADE_MIN); expect(value).toBeLessThanOrEqual(1);
    }
    // Neighbouring crowns reach at most 5.5 m, so 8 m of space leaves only this tree's own shade at the sample points.
    let checked = 0;
    trees.forEach((p, i) => {
      if (trees.some((q, j) => j !== i && Math.hypot(q.x - p.x, q.z - p.z) < 8) || [.4, 2.5].some(d => buildings(p.x + d, p.z) < 1)) return;
      checked++;
      expect(shade(p.x + .4, p.z)).toBeLessThan(.65);
      expect(shade(p.x + .4, p.z)).toBeLessThan(shade(p.x + 2.5, p.z));
    });
    expect(checked).toBeGreaterThan(20);
    const lone = groundShadeField(treeShadeDiscs([{ x: 0, z: 0 }]));
    for (let d = 0; d < 7; d += .25) expect(lone(d + .25, 0)).toBeGreaterThanOrEqual(lone(d, 0));
    expect(lone(0, 0)).toBeLessThan(.55); expect(lone(6, 0)).toBe(1);
    expect(shade(0, 30)).toBe(1); // mid-river, under open sky
  });

  it('darkens the ground at building walls, fully beneath the lifted Future House', () => {
    expect(shade(-64, -110)).toBeLessThan(.6);
    expect(shade(0, -21 + 8.6)).toBeLessThan(shade(0, -21 + 13));
    expect(shade(0, -21 + 15)).toBe(1);
  });

  it('is baked into the terrain as its own attribute, deterministic and shared by every clipped vertex', () => {
    const terrain = mountainGeometry(false, shade), values = terrain.getAttribute('groundShade'), p = terrain.getAttribute('position');
    expect(values.count).toBe(p.count);
    let shaded = 0;
    for (let i = 0; i < values.count; i++) { const v = values.getX(i); expect(v).toBeGreaterThanOrEqual(GROUND_SHADE_MIN - 1e-6); expect(v).toBeLessThanOrEqual(1); if (v < .9) shaded++; }
    expect(shaded).toBeGreaterThan(1000); expect(shaded).toBeLessThan(values.count * .2);
    const plain = mountainGeometry(false).getAttribute('groundShade');
    for (let i = 0; i < plain.count; i += 997) expect(plain.getX(i)).toBe(1);
    terrain.dispose();
  }, 60000);
});
