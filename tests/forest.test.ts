import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { positionLocal } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Forest, SHADOW_LAYER, forestLod, swayingTreeMaterial } from '../src/world/forest';
import { WIND_ROOT } from '../src/world/wind';
import { aerialFog, aerialParams } from '../src/render/aerial';
import { TREE_REACH, graphicsProfile } from '../src/game/graphics';

describe('forest distance detail', () => {
  it('keeps full cards nearby, thins them, then hides cells only once their nearest tree is in full fog', () => {
    expect(forestLod(20, 10, 150)).toBe('full');
    expect(forestLod(50, 30, 150)).toBe('reduced');
    // A cell whose centre is far but whose nearest tree is not stays drawn.
    expect(forestLod(170, 149, 150)).toBe('reduced');
    expect(forestLod(180, 150, 150)).toBe('hidden');
  });

  it('culls trees on gpu and mobile a little short of full fog, once the haze has taken most of them', () => {
    for (const tier of ['gpu', 'mobile'] as const) {
      const profile = graphicsProfile(tier), reach = Math.min(profile.fog, profile.forest);
      expect(reach).toBeCloseTo(profile.fog * TREE_REACH, 9); expect(reach).toBeLessThan(profile.fog);
      // Whatever the heights of eye and tree, under a quarter of a tree's own colour is left where trees stop (at the nearest
      // point of its bounds; the rest of it lies deeper in the haze), and that share fades toward what lies behind it.
      for (const [eye, y] of [[1.8, 0], [1.8, 45], [32, 2], [-1, 60]]) for (const channel of aerialFog(reach, eye, y, aerialParams(tier))) expect(channel).toBeGreaterThan(.75);
    }
    // The cpu tier keeps its shorter forest inside its own linear fog.
    expect(graphicsProfile('cpu').forest).toBeLessThan(graphicsProfile('cpu').fog);
  });
});

// Stand-ins for the two GLB models: a branch mesh and an alpha-tested foliage mesh, with the GLB parts' names and materials.
GLTFLoader.prototype.loadAsync = async function () {
  const scene = new THREE.Group(), branches = new THREE.CylinderGeometry(.2, .3, 12, 6).translate(0, 6, 0), foliage = new THREE.PlaneGeometry(4, 4, 6, 6).translate(0, 9, 0);
  scene.add(Object.assign(new THREE.Mesh(branches, new THREE.MeshStandardMaterial({ color: '#7a6a50', roughness: .9 })), { name: 'branches' }));
  scene.add(Object.assign(new THREE.Mesh(foliage, new THREE.MeshStandardMaterial({ color: '#8eaa5e', roughness: .9, alphaTest: .45, side: THREE.DoubleSide })), { name: 'foliage' }));
  return { scene } as unknown as Awaited<ReturnType<InstanceType<typeof GLTFLoader>['loadAsync']>>;
};
const sites = Array.from({ length: 40 }, (_, i) => new THREE.Vector3((i % 8) * 14 - 50, (i % 3) * .4, Math.floor(i / 8) * 15 - 40));
async function forest(mobile: boolean, wind: boolean): Promise<Forest> { const trees = new Forest(); trees.sites = sites; await trees.load(mobile, true, wind); return trees; }
const views = (trees: Forest): THREE.InstancedMesh[] => trees.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && !o.layers.isEnabled(SHADOW_LAYER));

describe('forest wind (sub-plan 17)', () => {
  it('copies the GLB material into a swaying node material whose shadow keeps the rest pose', () => {
    const leaves = new THREE.MeshStandardMaterial({ color: '#8eaa5e', map: new THREE.Texture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .9 });
    const smooth = swayingTreeMaterial(leaves, true, true), plain = swayingTreeMaterial(leaves, true, false), bark = swayingTreeMaterial(new THREE.MeshStandardMaterial({ roughness: .9 }), false, true);
    const far = swayingTreeMaterial(leaves, true, true, true);
    expect(far.alphaToCoverage).toBe(true); expect(far.positionNode).not.toBe(smooth.positionNode);
    for (const material of [smooth, plain, bark, far]) { expect(material).toBeInstanceOf(THREE.MeshStandardNodeMaterial); expect(material.positionNode).not.toBeNull(); expect(material.castShadowPositionNode).toBe(positionLocal); }
    expect(smooth.map).toBe(leaves.map); expect(smooth.alphaTest).toBe(.45); expect(smooth.side).toBe(THREE.DoubleSide); expect(smooth.color.getHexString()).toBe('8eaa5e');
    // Alpha-to-coverage only on alpha-tested cards, and only where the frame is multisampled.
    expect(smooth.alphaToCoverage).toBe(true); expect(smooth.alphaTestNode).not.toBeNull();
    expect(plain.alphaToCoverage).toBe(false); expect(plain.alphaTestNode).toBeNull(); expect(bark.alphaToCoverage).toBe(false);
  });
  for (const mobile of [false, true]) it(`gives every view mesh its own roots, matching its instances (${mobile ? 'mobile' : 'gpu'})`, async () => {
    const swaying = await forest(mobile, true), still = await forest(mobile, false);
    // The same meshes, so the same draws; the cpu tier and ?wind=off keep the GLB materials and geometry untouched.
    expect(swaying.children.length).toBe(still.children.length);
    for (const mesh of still.children as THREE.InstancedMesh[]) { expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial); expect(mesh.geometry.getAttribute(WIND_ROOT)).toBeUndefined(); }
    const meshes = views(swaying);
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(meshes.length);
    const camera = new THREE.PerspectiveCamera(70, 1, .1, 400); camera.position.set(0, 2, 20); camera.lookAt(0, 2, -40);
    swaying.update(camera, 130, false);
    expect(meshes.some(mesh => mesh.count > 0)).toBe(true);
    const matrix = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const mesh of meshes) {
      const roots = mesh.geometry.getAttribute(WIND_ROOT) as THREE.InstancedBufferAttribute;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); matrix.decompose(p, q, s);
        expect([roots.getX(i), roots.getY(i), roots.getZ(i)]).toEqual([p.x, p.y, p.z].map(v => Math.fround(v))); expect(roots.getW(i)).toBeCloseTo(s.x, 5);
      }
    }
  });
});
