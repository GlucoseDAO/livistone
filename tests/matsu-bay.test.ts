import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MATSU_BAY, channelDistance, matsuBaySpread, riverBanks, riverCenter, riverWidthVariation, waterDistance } from '../src/world/waterways';
import { WATER_EDGE, WATER_LEVEL, waterFlow, waterSurfaceGeometry } from '../src/world/water-surface';
import { cpuWaterColour } from '../src/world/water-material';
import { landscapeHeight, terrainHeight, terrainSurfaceHeight } from '../src/world/terrain';
import { COURTYARD_CAMERAS, MATSU_COURTYARD, courtyardWorld } from '../src/world/matsu-courtyard-layout';
import { createMatsuCourtyard } from '../src/world/matsu-courtyard';

function originalWaterDistance(x: number, z: number): number {
  const main = Math.abs(z - riverCenter(x)) - 7.3 - riverWidthVariation(x);
  const tributary = (side: number): number => {
    if (z <= -58 || z >= 32) return Infinity;
    const width = (3.5 + .45 * Math.sin(z * .21)) * Math.min(1, (z + 58) / 8);
    return Math.abs(x - side * (57 + 6 * Math.sin((z + 12) * .065))) - width;
  };
  return Math.min(main, tributary(-1), tributary(1));
}

describe('Stronghold coastal bay', () => {
  it('renders the same courtyard grade that the walking collider uses, including the camera surroundings', () => {
    for (let x = 155; x <= 199; x += 2) for (let z = 35; z <= 65; z += 2) expect(landscapeHeight(x, z)).toBe(terrainHeight(x, z));
    for (const camera of COURTYARD_CAMERAS) expect(landscapeHeight(camera.x, camera.z)).toBeLessThan(camera.height - .5);
    for (const local of [{ x: 0, z: 0 }, { x: -3, z: 3 }, { x: 3, z: 3 }]) {
      const point = courtyardWorld(local); expect(landscapeHeight(point.x, point.z)).toBeLessThan(MATSU_COURTYARD.floorY);
    }
  });

  it('keeps the two-metre ground triangles below the actual compact, rotated lower floor', () => {
    const court = createMatsuCourtyard(true), c = MATSU_COURTYARD, ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    court.root.position.set(c.x, 0, c.z); court.root.rotation.y = c.yaw; court.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(court.floor, true); let samples = 0, highest = -Infinity;
    for (let x = bounds.min.x + .01; x < bounds.max.x; x += .15) for (let z = bounds.min.z + .01; z < bounds.max.z; z += .15) {
      ray.set(new THREE.Vector3(x, 5, z), down);
      const hit = ray.intersectObject(court.floor)[0]; if (!hit || Math.abs(hit.point.y - c.floorY) > .001) continue;
      highest = Math.max(highest, terrainSurfaceHeight(x, z)); samples++;
    }
    expect(samples).toBeGreaterThan(2000); expect(highest).toBeLessThan(c.floorY - .12);
    court.root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
  });

  it('looks across open water from the source-composition camera instead of into the inland slope', () => {
    const camera = COURTYARD_CAMERAS.find(view => view.name === 'courtyard-external-overlook')!;
    expect(terrainSurfaceHeight(camera.x, camera.z)).toBeLessThan(camera.height - .5);
    for (let distance = 35; distance <= 130; distance += 5) {
      const x = camera.x - Math.sin(camera.yaw) * distance, z = camera.z - Math.cos(camera.yaw) * distance;
      expect(waterDistance(x, z)).toBeLessThan(WATER_EDGE);
      // The first visible strip is the sloping shore; the view beyond it remains deep water to the far handoff.
      if (distance >= 50) { expect(waterDistance(x, z)).toBeLessThan(-2.6); expect(landscapeHeight(x, z)).toBe(-2); }
    }
  });

  it('preserves the town and Taiwan island water field exactly upstream of x = 150', () => {
    expect(MATSU_BAY.startX).toBe(150);
    for (let x = -240; x <= 150; x += 13) for (let z = -180; z <= 100; z += 7) expect(waterDistance(x, z)).toBe(originalWaterDistance(x, z));
    for (const x of [136.5, 146.74344477515635, 150]) for (const z of [8, 15.778558442398987, 20.302535024526335, 30]) expect(waterDistance(x, z)).toBe(originalWaterDistance(x, z));
    for (const [point, expected] of [
      [[145, 19], { x: .9990998342503213, z: .04242076379534685, along: 818.1204293201746, across: -.5256688768145404 }],
      [[57, -12], { x: .3633452542840268, z: .9316545637677497, along: 693.4779650790111, across: 0 }],
    ] as const) {
      const actual = waterFlow(point[0], point[1]);
      for (const key of ['x', 'z', 'along', 'across'] as const) expect(actual[key]).toBeCloseTo(expected[key], 12);
    }
  });

  it('opens only the north shore, leaving the courtyard bank and railway dry', () => {
    expect(matsuBaySpread(150)).toBe(0); expect(matsuBaySpread(225)).toBe(160);
    let previous = 0;
    for (let x = 150; x <= 225; x++) { const spread = matsuBaySpread(x); expect(spread).toBeGreaterThanOrEqual(previous); previous = spread; }
    for (const x of [151, 177, 200, 225, 400, 600]) {
      const banks = riverBanks(x), originalNorth = riverCenter(x) - 7.3 - riverWidthVariation(x);
      expect(banks.south).toBeCloseTo(riverCenter(x) + 7.3 + riverWidthVariation(x), 12);
      expect(banks.north).toBeCloseTo(originalNorth - matsuBaySpread(x), 12);
      expect(channelDistance(x, banks.north, 0)).toBe(0); expect(channelDistance(x, banks.south, 0)).toBe(0);
      expect(waterDistance(x, 79)).toBeGreaterThan(35);
    }
    expect(waterDistance(225, -100)).toBeLessThan(-20);
    expect(waterDistance(177, 36.5)).toBeGreaterThan(0);
  });

  it('joins a coarse bay to the original indexed sheet with all shader attributes and no overlapping domains', () => {
    for (const cell of [1, 2]) {
      const geometry = waterSurfaceGeometry([], cell === 2 ? cpuWaterColour() : undefined, cell), p = geometry.getAttribute('position'), index = geometry.index!;
      expect(index).toBeDefined(); expect(geometry.groups).toHaveLength(0); expect(p.count).toBeLessThan(cell === 1 ? 100000 : 30000);
      for (const name of ['normal', 'flow', 'along', 'across', 'depth', 'rock']) expect(geometry.getAttribute(name).count).toBe(p.count);
      if (cell === 2) expect(geometry.getAttribute('color').count).toBe(p.count);
      let bayVertices = 0, upstreamVertices = 0, northExtent = 0;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        expect(p.getY(i)).toBeCloseTo(WATER_LEVEL, 6);
        if (x < 150) upstreamVertices++;
        if (x > 225 && z < -30) {
          bayVertices++; northExtent = Math.min(northExtent, z);
          expect(waterDistance(x, z) - WATER_EDGE).toBeLessThan(.001);
          const flow = geometry.getAttribute('flow'); expect(Math.hypot(flow.getX(i), flow.getY(i))).toBeCloseTo(1, 5);
          if (x < 600 && waterDistance(x, z) < -6) {
            expect((x - 150) / (cell * 2)).toBeCloseTo(Math.round((x - 150) / (cell * 2)), 4);
            expect((z + 180) / (cell * 2)).toBeCloseTo(Math.round((z + 180) / (cell * 2)), 4);
          }
        }
      }
      expect(upstreamVertices).toBeGreaterThan(cell === 1 ? 10000 : 4000); expect(bayVertices).toBeGreaterThan(1000); expect(northExtent).toBeLessThan(-130);
      for (let i = 0; i < index.count; i += 3) {
        const x = [0, 1, 2].map(j => p.getX(index.getX(i + j)));
        expect(Math.min(...x) < 150 && Math.max(...x) > 150).toBe(false);
      }
      geometry.dispose();
    }
  });

  it('keeps the upstream palette and gives the downstream bay a blue body on the lightweight tier', () => {
    const colour = cpuWaterColour('b'), river = colour(1.58, 0), bay = colour(1.58, 0, 225);
    expect(colour(1.58, 0, 150)).toEqual(river); expect(bay.b).toBeGreaterThan(bay.g); expect(bay.g).toBeGreaterThan(bay.r);
    expect(colour(1.58, 0, 177).b).toBeGreaterThan(river.b);
    expect(bay).toBeInstanceOf(THREE.Color);
  });
});
