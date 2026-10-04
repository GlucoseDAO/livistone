import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWinterGate } from '../src/world/winter-gate';
import { WINTER } from '../src/world/winter-gate-layout';
import { Physics } from '../src/game/physics';
import { plantingAllowed, grassAllowed } from '../src/world/landscape';
import { winterApproachFrame, WINTER_APPROACH, winterPlateauInside } from '../src/world/winter-plateau-layout';
import { STAGE, TRAIL_SAMPLES, snowCover, trailCorridor } from '../src/world/mountain-layout';
import { createTrailSigns, trailBoulders } from '../src/world/mountain-trail';
import { terrainSurfaceHeight, townTerrainGeometry, terrainHeight } from '../src/world/terrain';

let source: THREE.BufferGeometry;
beforeAll(async () => {
  const bytes = readFileSync('public/models/jewelry/eye-of-winter-gate.glb');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  source = (gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh).geometry;
});
function dispose(root: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
  materials.forEach(m => m.dispose());
}

describe('approved Eye of Winter building', () => {
  it('keeps the original silver vertices and indices, with only a uniform scale and rigid orientation', () => {
    const gate = createWinterGate(source), a = source.getAttribute('position'), b = gate.silver.geometry.getAttribute('position');
    try {
      expect(b.count).toBe(a.count); expect(gate.silver.geometry.index!.array).toEqual(source.index!.array);
      for (let i = 1; i < a.count; i += 113) {
        const p = new THREE.Vector3().fromBufferAttribute(a, i), q = new THREE.Vector3().fromBufferAttribute(a, i - 1);
        const u = new THREE.Vector3().fromBufferAttribute(b, i), v = new THREE.Vector3().fromBufferAttribute(b, i - 1);
        expect(u.distanceTo(v)).toBeCloseTo(p.distanceTo(q) * WINTER.scale, 4);
      }
      expect(gate.silver.userData.keepGeometry).toBe(true);
      gate.blue.geometry.computeBoundingBox(); gate.quartz.geometry.computeBoundingBox();
      expect(gate.blue.geometry.boundingBox!.max.x).toBeLessThan(WINTER.x);
      expect(gate.blue.geometry.boundingBox!.getSize(new THREE.Vector3()).y).toBeLessThan(gate.quartz.geometry.boundingBox!.getSize(new THREE.Vector3()).y / 2);
    } finally { dispose(gate.root); }
  });

  it('reserves the full assembly and grades a connected approach to the raised floor', () => {
    expect(plantingAllowed(WINTER.x - 13, WINTER.z, 3)).toBe(false);
    expect(grassAllowed(WINTER.x, WINTER.z, .2)).toBe(false);
    expect(winterApproachFrame(WINTER.arrivalX, WINTER.z).d).toBe(0);
    expect(winterPlateauInside(WINTER.x, WINTER.z)).toBeGreaterThan(8);
    expect(snowCover(WINTER.x, WINTER.z)).toBe(1);
    let snowyArea = 0;
    for (let x = -104; x <= -40; x++) for (let z = -294; z <= -271; z++) if (snowCover(x, z) > .5) snowyArea++;
    expect(snowyArea).toBeGreaterThan(800);
    expect(trailCorridor(WINTER.x, WINTER.z)).toBe(true);
    expect(terrainHeight(WINTER.arrivalX, WINTER.z) + .13).toBeCloseTo(WINTER.floor, 6);
  });

  it('walks from the chimney head up the snow approach and through the iris on the actual terrain', async () => {
    const gate = createWinterGate(source), ground = townTerrainGeometry();
    const colliders = [...gate.colliders, { type: 'mesh' as const, vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }];
    const signs = createTrailSigns(colliders, trailBoulders(false), []), physics = await Physics.create(colliders);
    try {
      const head = TRAIL_SAMPLES[STAGE.head];
      physics.teleport({ x: head.x, z: head.z, y: terrainSurfaceHeight(head.x, head.z) + .9 });
      for (const goal of [...WINTER_APPROACH, { x: WINTER.quartzX + 1, z: WINTER.z }]) {
        for (let k = 0; k < 900; k++) {
          const p = physics.position(), dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
          if (d < .18) break;
          physics.setColliderEnabled('winter-shutter', gate.step(1 / 60, p));
          physics.step(dx / d * Math.min(3, d * 60), dz / d * Math.min(3, d * 60));
          expect(trailCorridor(physics.position().x, physics.position().z)).toBe(true);
        }
        expect(Math.hypot(goal.x - physics.position().x, goal.z - physics.position().z), JSON.stringify(physics.position())).toBeLessThan(.2);
      }
      expect(physics.position().y).toBeGreaterThan(WINTER.floor + .7);
      expect(gate.open).toBe(1);
    } finally { physics.dispose(); ground.dispose(); signs.mesh.geometry.dispose(); dispose(gate.root); }
  });

  for (const mobile of [false, true]) it(`opens a real walkable shutter, keeps the aisle clear and closes again (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const gate = createWinterGate(source, mobile), physics = await Physics.create(gate.colliders);
    try {
      // A closed eye blocks the aperture. Opening does not disable its walls, floor or original silver.
      physics.teleport({ x: WINTER.quartzX + 5.8, y: WINTER.floor + .9, z: WINTER.z });
      for (let i = 0; i < 90; i++) physics.step(-4, 0);
      expect(physics.position().x).toBeGreaterThan(WINTER.quartzX + 4.8);
      physics.teleport({ x: WINTER.quartzX + 5.8, y: WINTER.floor + .9, z: WINTER.z });
      for (let i = 0; i < 300; i++) {
        physics.setColliderEnabled('winter-shutter', gate.step(1 / 60, physics.position()));
        physics.step(-2, 0);
        expect(physics.position().y).toBeGreaterThan(WINTER.floor + .7);
      }

      expect(gate.open).toBe(1);
      expect(physics.position().x).toBeLessThan(WINTER.quartzX + .5);
      // Standing room beneath the smaller stone; walking toward the rear stops at its enclosing quartz.
      expect(physics.position().x).toBeGreaterThan(WINTER.x - 3.7);
      for (let i = 0; i < 120; i++) gate.step(1 / 60, { x: -60, y: 1, z: 0 });
      expect(gate.open).toBe(0);
      expect(gate.step(0, { x: -60, y: 1, z: 0 })).toBe(true);
    } finally { physics.dispose(); dispose(gate.root); }
  });
});
