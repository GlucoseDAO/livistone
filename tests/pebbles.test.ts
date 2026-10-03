import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PEBBLE_COUNT, SHORE_BAND, createPebbles, pebbleGeometry, pebbleSites } from '../src/world/pebbles';
import { riverRockSites } from '../src/world/stone';
import { PATH_CURVES, PATH_WIDTH } from '../src/world/landscape';
import { GARDEN_BRIDGES, waterDistance } from '../src/world/waterways';
import { WATER_EDGE } from '../src/world/water-surface';
import { terrainSurfaceHeight, terrainSurfaceNormal } from '../src/world/terrain';

const routes = PATH_CURVES.map(curve => curve.getPoints(600));

describe('shore pebbles', () => {
  const gpuRocks = riverRockSites(false), mobileRocks = riverRockSites(true);
  const gpu = pebbleSites('gpu', gpuRocks), mobile = pebbleSites('mobile', mobileRocks);
  it('places a fixed seeded count per tier, fewer on mobile and none on cpu', () => {
    expect(gpu).toHaveLength(PEBBLE_COUNT.gpu); expect(mobile).toHaveLength(PEBBLE_COUNT.mobile);
    expect(PEBBLE_COUNT.mobile).toBeLessThan(PEBBLE_COUNT.gpu / 2);
    expect(pebbleSites('cpu', mobileRocks)).toHaveLength(0); expect(createPebbles('cpu', mobileRocks)).toBeNull();
    expect(pebbleSites('gpu', gpuRocks)).toEqual(gpu);
    // Both banks of the river and both tributaries carry some, on dry stones and under the shallow edge alike.
    for (const sites of [gpu, mobile]) {
      expect(sites.filter(p => p.z > 10 && p.z < 45).length).toBeGreaterThan(sites.length * .3);
      for (const side of [-1, 1]) expect(sites.filter(p => p.z < 10 && Math.abs(p.x - side * 57) < 9).length).toBeGreaterThan(sites.length * .08);
      const under = sites.filter(p => waterDistance(p.x, p.z) < WATER_EDGE).length;
      expect(under).toBeGreaterThan(sites.length * .15); expect(under).toBeLessThan(sites.length * .5);
    }
  });
  it('keeps every pebble in the shore band, off routes and bridges and out of every rock', () => {
    let violations = 0;
    for (const [sites, rocks] of [[gpu, gpuRocks], [mobile, mobileRocks]] as const) for (const p of sites) {
      const d = waterDistance(p.x, p.z); if (d < SHORE_BAND[0] || d > SHORE_BAND[1]) violations++;
      // Clear of the paving and its kerb, whatever the spacing of the clearance samples.
      let route = Infinity; for (const samples of routes) for (const q of samples) route = Math.min(route, Math.hypot(q.x - p.x, q.z - p.z));
      if (route <= PATH_WIDTH / 2 + .2 + p.size) violations++;
      if (Math.abs(p.x) < 3.6 + p.size && p.z > 10 && p.z < 45) violations++;
      for (const b of GARDEN_BRIDGES) if (Math.abs(p.z - b.z) < 2.6 + p.size && Math.abs(p.x - b.x) < 10.5 + p.size) violations++;
      for (const rock of rocks) {
        const dx = p.x - rock.x, dz = p.z - rock.z, c = Math.cos(rock.yaw), s = Math.sin(rock.yaw);
        if (Math.hypot((dx * c - dz * s) / (rock.s * 1.4 * 1.12), (dx * s + dz * c) / (rock.s * 1.12)) <= 1) violations++;
      }
    }
    expect(violations).toBe(0);
  });
  it('lies each pebble on the walking ground, aligned with its slope and mostly sunk into it', () => {
    const mesh = createPebbles('gpu', gpuRocks)!, matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    for (let i = 0; i < gpu.length; i += 37) {
      const p = gpu[i]; mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
      const normal = terrainSurfaceNormal(p.x, p.z), up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      expect(p.y).toBeCloseTo(terrainSurfaceHeight(p.x, p.z), 6); expect(up.dot(normal)).toBeGreaterThan(.9999);
      // The centre stands above the ground by less than half the pebble's own height, so its foot is buried.
      const lift = position.clone().sub(new THREE.Vector3(p.x, p.y, p.z)).dot(normal);
      expect(lift).toBeGreaterThan(0); expect(lift).toBeLessThan(scale.y * .5);
      expect(scale.x).toBeCloseTo(p.size, 5); expect(scale.y).toBeLessThan(scale.x); expect(scale.z).toBeLessThanOrEqual(scale.x + 1e-6);
    }
  });
  it('draws one unshadowed instanced batch with smooth low-poly pebbles and per-pebble colour', () => {
    for (const tier of ['gpu', 'mobile'] as const) {
      const mesh = createPebbles(tier, tier === 'gpu' ? gpuRocks : mobileRocks)!, geometry = pebbleGeometry(tier);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh); expect(mesh.count).toBe(PEBBLE_COUNT[tier]);
      expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true); expect(mesh.instanceColor).not.toBeNull();
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial); expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
      expect(mesh.geometry.index!.count / 3).toBe(tier === 'gpu' ? 32 : 20);
      expect(geometry.getAttribute('position').count).toBe(tier === 'gpu' ? 18 : 12);
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    }
  });
});
