import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { positionLocal } from 'three/tsl';
import { WIND_ROOT, windRoots } from '../src/world/wind';
import { createPlanting } from '../src/world/planting';
import { prepareCpuDetail } from '../src/world/cpu-detail';
import { LivingWaters } from '../src/world/living-waters';
import { terrainHeight } from '../src/world/terrain';
import { riverCenter } from '../src/world/waterways';

/** Each drawn instance's windRoot is its instance matrix's translation and scale, in the same slot. */
function expectRootsMatch(mesh: THREE.InstancedMesh, offset = new THREE.Vector3()): void {
  const roots = mesh.geometry.getAttribute(WIND_ROOT) as THREE.InstancedBufferAttribute, matrix = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  expect(roots).toBeInstanceOf(THREE.InstancedBufferAttribute); expect(roots.itemSize).toBe(4);
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); matrix.decompose(p, q, s); p.add(offset);
    expect(roots.getX(i)).toBeCloseTo(p.x, 4); expect(roots.getY(i)).toBeCloseTo(p.y, 4); expect(roots.getZ(i)).toBeCloseTo(p.z, 4); expect(roots.getW(i)).toBeCloseTo(s.x, 4);
  }
}
const sways = (material: THREE.Material): boolean => (material as THREE.MeshStandardNodeMaterial).positionNode != null && material.userData.wind === true;

describe('wind (sub-plan 17)', () => {
  it('reads each plant root and scale off its instance matrix', () => {
    const a = new THREE.Matrix4().compose(new THREE.Vector3(3, -1, 7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.1), new THREE.Vector3(.8, .9, .8));
    const b = new THREE.Matrix4().makeTranslation(-40, 2, 12), matrices = new Float32Array(32); a.toArray(matrices, 0); b.toArray(matrices, 16);
    const roots = windRoots(matrices);
    expect(roots).toHaveLength(8);
    expect(Array.from(roots.subarray(0, 4)).map(v => +v.toFixed(5))).toEqual([3, -1, 7, .8]);
    expect(Array.from(roots.subarray(4, 8))).toEqual([-40, 2, 12, 1]);
  });
  it('sways shrubs, flowers and tufts through shared materials, keeping shadow casters at rest and draws unchanged', () => {
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, 30);
    const swaying = createPlanting(new THREE.Group(), new THREE.Group(), false, terrainHeight, riverCenter, 'gpu', 22);
    const still = createPlanting(new THREE.Group(), new THREE.Group(), false, terrainHeight, riverCenter, 'gpu', 22, false);
    expect(swaying.meshes.map(mesh => mesh.name)).toEqual(still.meshes.map(mesh => mesh.name));
    swaying.update(camera, 38);
    for (const mesh of swaying.meshes) {
      const material = mesh.material as THREE.MeshStandardNodeMaterial;
      expect(sways(material), mesh.name).toBe(true);
      // The sun's shadow map is cached; casters draw it in their rest pose.
      expect(material.castShadowPositionNode).toBe(positionLocal);
      if (mesh.count) expectRootsMatch(mesh);
    }
    expect(swaying.meshes.some(mesh => mesh.count > 0)).toBe(true);
    // The three shrub kinds share one material rather than one per kind.
    expect(new Set(swaying.meshes.filter(mesh => mesh.name === 'Leafy shrubs').map(mesh => mesh.material)).size).toBe(1);
    for (const mesh of still.meshes) { expect(sways(mesh.material as THREE.Material)).toBe(false); expect(mesh.geometry.getAttribute(WIND_ROOT)).toBeUndefined(); }
  }, 30000);
  it('leaves the cpu tier without wind: its materials, geometry and Lambert copies are as before', async () => {
    const root = new THREE.Group(), cpu = createPlanting(root, new THREE.Group(), true, terrainHeight, riverCenter, 'cpu');
    for (const mesh of cpu.meshes) { expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial); expect(sways(mesh.material as THREE.Material)).toBe(false); expect(mesh.geometry.getAttribute(WIND_ROOT)).toBeUndefined(); }
    // Even a swaying material loses its sway in the cpu tier's Lambert copy.
    const swaying = createPlanting(new THREE.Group(), new THREE.Group(), true, terrainHeight, riverCenter, 'mobile').meshes.find(mesh => mesh.name === 'Leafy shrubs')!;
    const group = new THREE.Group(); group.add(swaying); await prepareCpuDetail(group, new THREE.CubeTexture());
    expect(swaying.material).toBeInstanceOf(THREE.MeshLambertMaterial); expect((swaying.material as unknown as { positionNode?: unknown }).positionNode ?? null).toBeNull();
  }, 30000);
  it('sways the lake reeds from roots in town coordinates, and only with wind', () => {
    const reeds = (gardens: LivingWaters): THREE.InstancedMesh => { let found: THREE.InstancedMesh | undefined; gardens.root.traverse(o => { if (o instanceof THREE.InstancedMesh && (o.material as THREE.MeshStandardMaterial).color?.getHexString() === '466347') found = o; }); return found!; };
    const swaying = new LivingWaters(false, undefined, true), still = new LivingWaters(false);
    const mesh = reeds(swaying); expect(sways(mesh.material as THREE.Material)).toBe(true);
    expectRootsMatch(mesh, swaying.root.position);
    expect(reeds(still).geometry.getAttribute(WIND_ROOT)).toBeUndefined(); expect(sways(reeds(still).material as THREE.Material)).toBe(false);
  }, 30000);
});
