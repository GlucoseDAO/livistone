import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BLADE_CLEARANCE } from '../src/world/grass-field';
import { PEBBLE_BED, PEBBLE_CELL, PEBBLE_COUNT, PEBBLE_RING, SHORE_BAND, createPebbles, pebbleGeometry, pebbleMatrix, pebbleSites } from '../src/world/pebbles';
import { riverRockSites } from '../src/world/stone';
import { PATH_CURVES, PATH_WIDTH, WATER_CLEARANCE } from '../src/world/landscape';
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
  it('gathers small pebbles into drifts along the waterline, never out on the meadow', () => {
    for (const sites of [gpu, mobile]) {
      const near = sites.filter(p => Math.abs(waterDistance(p.x, p.z) - WATER_EDGE) < .35).length;
      expect(near).toBeGreaterThan(sites.length * .9);
      // Grass roots start at WATER_CLEARANCE + BLADE_CLEARANCE up the bank (grass-field.ts); every pebble ends short of them.
      for (const p of sites) expect(waterDistance(p.x, p.z) + p.size).toBeLessThan(WATER_CLEARANCE + BLADE_CLEARANCE);
      // Small stones, a few larger ones; most within a hand's breadth of another in the same drift.
      const sizes = sites.map(p => p.size).sort((a, b) => a - b);
      expect(sizes[sizes.length >> 1]).toBeLessThan(.03); expect(sizes.at(-1)!).toBeLessThan(.085);
      const neighbours = sites.filter((p, i) => sites.some((q, j) => j !== i && Math.hypot(q.x - p.x, q.z - p.z) < .4)).length;
      expect(neighbours).toBeGreaterThan(sites.length * .85);
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
  it('beds each pebble in the walking ground, aligned with its slope, with only its crown showing', () => {
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    for (let i = 0; i < gpu.length; i += 37) {
      const p = gpu[i]; pebbleMatrix(p, matrix).decompose(position, rotation, scale);
      const normal = terrainSurfaceNormal(p.x, p.z), up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      expect(p.y).toBeCloseTo(terrainSurfaceHeight(p.x, p.z), 6); expect(up.dot(normal)).toBeGreaterThan(.9999);
      // The centre lies below the ground, so with the flattened underside (0.7) over half the pebble is buried; the crown shows.
      const lift = position.clone().sub(new THREE.Vector3(p.x, p.y, p.z)).dot(normal);
      expect(lift).toBeCloseTo(-PEBBLE_BED * scale.y, 6); expect((.7 + PEBBLE_BED) / 1.7).toBeGreaterThan(.5); expect(lift + scale.y).toBeGreaterThan(scale.y * .7);
      expect(scale.x).toBeCloseTo(p.size, 5); expect(scale.y).toBeLessThan(scale.x); expect(scale.z).toBeLessThanOrEqual(scale.x + 1e-6);
    }
  });
  it('draws one unshadowed instanced mesh with smooth low-poly pebbles and per-pebble colour', () => {
    for (const tier of ['gpu', 'mobile'] as const) {
      const { mesh } = createPebbles(tier, tier === 'gpu' ? gpuRocks : mobileRocks)!, geometry = pebbleGeometry(tier);
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh); expect(mesh.instanceMatrix.count).toBe(PEBBLE_COUNT[tier]);
      expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true); expect(mesh.instanceColor).not.toBeNull();
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial); expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
      expect(mesh.geometry.index!.count / 3).toBe(tier === 'gpu' ? 32 : 20);
      expect(geometry.getAttribute('position').count).toBe(tier === 'gpu' ? 18 : 12);
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    }
  });
  it('refills its one mesh with the cells around the camera, only when the camera crosses a cell', () => {
    const pebbles = createPebbles('gpu', gpuRocks)!, { mesh } = pebbles, camera = new THREE.PerspectiveCamera(), position = new THREE.Vector3(), matrix = new THREE.Matrix4();
    // Before the first frame every pebble is shown, so the precompile builds the shader.
    pebbles.warmUp(true); expect(mesh.count).toBe(PEBBLE_COUNT.gpu); expect(mesh.visible).toBe(true);
    pebbles.warmUp(false); expect(mesh.count).toBe(0);
    const near = (x: number, z: number): number => gpu.filter(p => Math.abs(Math.floor(p.x / PEBBLE_CELL) - Math.floor(x / PEBBLE_CELL)) <= PEBBLE_RING && Math.abs(Math.floor(p.z / PEBBLE_CELL) - Math.floor(z / PEBBLE_CELL)) <= PEBBLE_RING).length;
    camera.position.set(14, 1.6, 36); pebbles.update(camera);
    expect(mesh.count).toBe(near(14, 36)); expect(mesh.count).toBeGreaterThan(40); expect(mesh.count).toBeLessThan(PEBBLE_COUNT.gpu / 5);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
      expect(Math.abs(Math.floor(position.x / PEBBLE_CELL) - Math.floor(14 / PEBBLE_CELL))).toBeLessThanOrEqual(PEBBLE_RING);
      expect(Math.abs(Math.floor(position.z / PEBBLE_CELL) - Math.floor(36 / PEBBLE_CELL))).toBeLessThanOrEqual(PEBBLE_RING);
    }
    expect(mesh.boundingSphere!.containsPoint(position)).toBe(true);
    // Walking within the cell leaves the buffers alone; crossing into the next one refills them.
    const version = mesh.instanceMatrix.version;
    camera.position.set(14.9, 1.6, 37.5); pebbles.update(camera); expect(mesh.instanceMatrix.version).toBe(version);
    camera.position.set(18.5, 1.6, 37.5); pebbles.update(camera); expect(mesh.instanceMatrix.version).toBeGreaterThan(version); expect(mesh.count).toBe(near(18.5, 37.5));
    // Far from any channel, nothing draws.
    camera.position.set(-18, 1.6, -100); pebbles.update(camera); expect(mesh.count).toBe(0); expect(mesh.visible).toBe(false);
  });
});
