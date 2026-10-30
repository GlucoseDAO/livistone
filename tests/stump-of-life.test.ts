import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { placeStumpModel } from '../src/world/stump-of-life';
import { STUMP_ISLAND as S, STUMP_OF_LIFE, STUMP_BRIDGES, stumpWorld, stumpGround } from '../src/world/stump-of-life-layout';
import { grassAllowed, plantingAllowed } from '../src/world/landscape';
import { Physics } from '../src/game/physics';
import { createStumpBridges } from '../src/world/stump-of-life-bridges';
import { prepareCpuDetail } from '../src/world/cpu-detail';
import { waterDistance } from '../src/world/waterways';
import { DISCOVERIES, LANDMARKS } from '../src/game/content';
import { MATSU_COURTYARD as C, courtyardWorld, courtyardGround } from '../src/world/matsu-courtyard-layout';

let source: THREE.Object3D;
beforeAll(async () => {
  const bytes = readFileSync('public/models/jewelry/stump-of-life-livistone.glb');
  // Node checks the source geometry; the actual embedded label texture is checked in Chrome.
  const loader = new GLTFLoader().register(() => ({ name: 'geometry-only-test', loadMaterial: () => Promise.resolve(new THREE.MeshStandardMaterial({ map: new THREE.Texture() })) }));
  source = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')).scene;
});

describe('Stump of Life installation', () => {
  it('keeps native geometry and UVs while placing only the artwork at physical size with matching collision', () => {
    const model = source.clone(true), before = new THREE.Box3().setFromObject(model), meshes: THREE.Mesh[] = [];
    model.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
    const sourceCounts = meshes.map(mesh => [mesh.geometry.getAttribute('position').count, mesh.geometry.index?.count ?? 0]);
    const uvArrays = meshes.map(mesh => mesh.geometry.getAttribute('uv')?.array.slice());
    const { root, colliders } = placeStumpModel(model, .23), after = new THREE.Box3().setFromObject(root);
    expect(before.min.y).toBeCloseTo(-2.5, 5); expect(before.max.y).toBeCloseTo(2.04, 4);
    expect(after.min.y).toBeCloseTo(before.min.y + .23, 5); expect(after.max.y).toBeGreaterThan(C.upperFloorY + .23);
    expect(meshes.map(mesh => [mesh.geometry.getAttribute('position').count, mesh.geometry.index?.count ?? 0])).toEqual(sourceCounts);
    expect(meshes.map(mesh => mesh.geometry.getAttribute('uv')?.array)).toEqual(uvArrays);
    const solid = meshes.filter(mesh => mesh.visible);
    expect(colliders.length).toBeGreaterThan(solid.length);
    solid.forEach(mesh => {
      expect(mesh.userData.keepGeometry).toBe(true); expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
      const positions = mesh.geometry.getAttribute('position');
      const first = new THREE.Vector3().fromBufferAttribute(positions, 0).applyMatrix4(mesh.matrixWorld);
      const collider = colliders.find(spec => spec.type === 'mesh' && spec.vertices.length === positions.count * 3
        && spec.indices.length === (mesh.geometry.index?.count ?? positions.count) && new THREE.Vector3().fromArray(spec.vertices).distanceTo(first) < 1e-5);
      expect(collider?.type).toBe('mesh'); if (collider?.type !== 'mesh') return;
      expect(collider.indices.length).toBe(mesh.geometry.index?.count ?? positions.count);
      if (!mesh.name.startsWith('Giant_Wood_Stump') && !mesh.name.startsWith('Giant_Solid_')) {
        const local = new THREE.Vector3().fromBufferAttribute(positions, 0), world = stumpWorld(local);
        expect(first.distanceTo(new THREE.Vector3(world.x, local.y + .23, world.z))).toBeLessThan(1e-5);
      }
      for (let i = 0; i < positions.count; i += 97) {
        const expected = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        expect(new THREE.Vector3().fromArray(collider.vertices, i * 3).distanceTo(expected)).toBeLessThan(1e-5);
      }
    });
    expect(model.getObjectByName('Copper_Provenance_Roots_Not_Bridges')?.visible).toBe(false);
  });

  it('uses a 500 mm cap at a 45 cm seat height above the unchanged island floor', () => {
    const { root } = placeStumpModel(source.clone(true), 0), cap = root.getObjectByName('Giant_Solid_DNA_Cap') as THREE.Mesh;
    root.updateMatrixWorld(true);
    const placed = cap.geometry.clone().applyMatrix4(cap.matrixWorld), top = new THREE.Box3().setFromBufferAttribute(placed.getAttribute('position') as THREE.BufferAttribute), size = top.getSize(new THREE.Vector3()); placed.dispose();
    const centre = top.getCenter(new THREE.Vector3());
    expect(size.x).toBeCloseTo(.5, 4); expect(size.z).toBeCloseTo(.5, 4);
    expect(centre.x).toBeCloseTo(STUMP_OF_LIFE.x, 4); expect(centre.z).toBeCloseTo(STUMP_OF_LIFE.z, 4);
    expect(top.max.y).toBeCloseTo(.70, 5); expect(top.max.y - S.islandHeight).toBeCloseTo(.45, 5);
    const edge = root.getObjectByName('Giant_Solid_Cap_Edge')!, plate = new THREE.Box3().setFromObject(edge, true);
    expect(plate.max.y - plate.min.y).toBeCloseTo(.003, 6); expect(plate.max.y).toBeCloseTo(top.max.y, 5);
    const wood = root.getObjectByName('Giant_Wood_Stump')!, body = new THREE.Box3().setFromObject(wood, true), bodySize = body.getSize(new THREE.Vector3());
    expect(body.min.y).toBeCloseTo(.25, 5); expect(body.max.y).toBeLessThan(.70);
    expect(Math.max(bodySize.x, bodySize.z)).toBeGreaterThan(1.05); expect(Math.max(bodySize.x, bodySize.z)).toBeLessThan(1.17);
    expect(STUMP_BRIDGES).toHaveLength(3);
    for (const bridge of STUMP_BRIDGES) expect(Math.max(bridge.from.y, bridge.to.y)).toBeLessThan(.27);
  });

  it('keeps the real coast within the river banks and connects to a paved bank arrival', () => {
    const metadata = JSON.parse(readFileSync('public/models/jewelry/stump-of-life-livistone.provenance.json', 'utf8')) as { land_boundaries_xz: Record<string, number[][]> };
    for (const outline of Object.values(metadata.land_boundaries_xz)) for (const [x, z] of outline) {
      const p = stumpWorld({ x, z });
      expect(stumpGround(p.x, p.z)).toBe(true); expect(grassAllowed(p.x, p.z, .1)).toBe(false);
      expect(plantingAllowed(p.x, p.z, 1.5)).toBe(false);
      expect(waterDistance(p.x, p.z)).toBeLessThan(-1.3);
    }
    expect(courtyardGround(STUMP_OF_LIFE.arrival.x, STUMP_OF_LIFE.arrival.z)).toBe(true);
    expect(LANDMARKS.find(item => item.id === 'stump-of-life')?.entrance).toEqual(STUMP_OF_LIFE.arrival);
    expect(DISCOVERIES.find(item => item.id === 'stump-of-life-story')?.body).toContain('do not form successive generations');
  });

  it('walks both level visitor bridges onto the Matsu floor and Taiwan island without entering the water', async () => {
    const { root, colliders } = placeStumpModel(source.clone(true), 0), wood = new THREE.MeshStandardMaterial(), silver = new THREE.MeshStandardMaterial();
    createStumpBridges(root, colliders, wood, silver);
    const physics = await Physics.create(colliders);
    try {
      for (const bridge of STUMP_BRIDGES) {
        const dx = bridge.to.x - bridge.from.x, dz = bridge.to.z - bridge.from.z, distance = Math.hypot(dx, dz), steps = Math.ceil((distance + .35) / 2 * 60 * 1.5);
        physics.teleport({ x: bridge.from.x, y: bridge.from.y + .85, z: bridge.from.z });
        // Uphill capsule motion has less horizontal speed; require arrival within a bounded walking interval.
        for (let i = 0; i < steps; i++) {
          physics.step(dx / distance * 2, dz / distance * 2); expect(physics.position().y).toBeGreaterThan(.8);
          const position = physics.position();
          if (((position.x - bridge.from.x) * dx + (position.z - bridge.from.z) * dz) / distance > distance + .2) break;
        }
        const end = physics.position(), along = ((end.x - bridge.from.x) * dx + (end.z - bridge.from.z) * dz) / distance;
        expect(along, JSON.stringify({ bridge, end })).toBeGreaterThan(distance - .2);
        expect(Math.abs((end.x - bridge.from.x) * dz - (end.z - bridge.from.z) * dx) / distance).toBeLessThan(.2);
        expect(physics.position().y).toBeGreaterThan(bridge.to.y + .72);
      }
    } finally { physics.dispose(); wood.dispose(); silver.dispose(); }
  });

  it('preserves the original DNA map and silver engraving on the lightweight rendering path', async () => {
    const { root } = placeStumpModel(source.clone(true), 0);
    const cap = root.getObjectByName('Giant_Solid_DNA_Cap') as THREE.Mesh, material = cap.material as THREE.MeshStandardNodeMaterial;
    expect(material.userData.stumpMetal).toBe(true); expect(material.colorNode).toBeDefined();
    expect(material.map).toBeDefined(); expect(material.metalness).toBeGreaterThan(.9);
    const ink = root.getObjectByName('Stump of Life · native DNA engraving') as THREE.Mesh;
    expect(ink.geometry).toBe(cap.geometry); expect((ink.material as THREE.Material).userData.stumpEngraving).toBe(true);
    expect((ink.material as THREE.MeshBasicNodeMaterial).opacityNode).toBeDefined();
    let weathered = 0;
    root.traverse(object => { if (object instanceof THREE.Mesh && object.name.startsWith('Giant_Wood_Stump') && (object.material as THREE.Material).userData.stumpWood) weathered++; });
    expect(weathered).toBeGreaterThan(0);
    await prepareCpuDetail(root, new THREE.CubeTexture());
    expect((cap.material as THREE.MeshLambertMaterial).map).toBe(material.map);
    expect((cap.material as THREE.MeshStandardNodeMaterial).colorNode).toBe(material.colorNode);
    expect((cap.material as THREE.Material).userData.stumpMetal).toBe(true);
    root.traverse(object => {
      if (object instanceof THREE.Mesh && object.name.endsWith('_Grass')) {
        const material = object.material as THREE.Material;
        expect(material.polygonOffset).toBe(true); expect(material.polygonOffsetFactor).toBe(-1); expect(material.polygonOffsetUnits).toBe(-2);
      }
    });
  });

  it('supports the physical-size roots on one flat terrace with matching collision, clear of the river banks', () => {
    const { root, colliders } = placeStumpModel(source.clone(true), 0), terrace = root.getObjectByName('Matsu courtyard · lower floor') as THREE.Mesh;
    const geometry = terrace.geometry, p = geometry.getAttribute('position'), up = geometry.getAttribute('normal');
    const ray = new THREE.Raycaster(), direction = new THREE.Vector3(0, -1, 0);
    root.updateMatrixWorld(true);
    let woodVertices = 0;
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.name.startsWith('Giant_Wood_Stump')) return;
      const wood = object.geometry.getAttribute('position');
      for (let i = 0; i < wood.count; i += 29) {
        const vertex = new THREE.Vector3().fromBufferAttribute(wood, i).applyMatrix4(object.matrixWorld);
        ray.set(new THREE.Vector3(vertex.x, 5, vertex.z), direction);
        expect(ray.intersectObject(terrace)[0]?.point.y).toBeCloseTo(S.islandHeight, 5); woodVertices++;
      }
    });
    expect(woodVertices).toBeGreaterThan(100);
    for (let i = 0; i < p.count; i++) {
      if (up.getY(i) < .9) continue;
      expect(p.getY(i)).toBeCloseTo(S.islandHeight, 5);
      const world = courtyardWorld({ x: p.getX(i), z: p.getZ(i) });
      expect(stumpGround(world.x, world.z)).toBe(true); expect(grassAllowed(world.x, world.z, .1)).toBe(false);
    }
    expect(colliders.at(-1)?.type).toBe('mesh');
  });
});
