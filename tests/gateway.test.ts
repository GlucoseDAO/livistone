import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGateway, gatewayGemGeometry } from '../src/world/gateway';
import { gatewayMaterials, setGatewayQuality } from '../src/world/gateway-materials';
import { GATEWAY } from '../src/world/gateway-layout';
import { createBridge } from '../src/world/bridge';
import { plantingAllowed } from '../src/world/landscape';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';

function dispose(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  materials.forEach((m) => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); }); textures.forEach((t) => t.dispose());
}

describe('King’s Chapel bridge gateway', () => {
  for (const mobile of [false, true]) it(`keeps three walking lanes open and blocks its side abutments (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const root = new THREE.Group(), paving = new THREE.MeshStandardMaterial();
    const colliders: ColliderSpec[] = [{ type: 'box', position: [0, -.2, 46], size: [12, .2, 10] }];
    createBridge(root, colliders, paving, paving, paving); createGateway(root, colliders, mobile, paving);
    const physics = await Physics.create(colliders);
    try {
      for (const x of [-1.6, 0, 1.6]) for (const direction of [-1, 1]) {
        physics.teleport({ x, y: 1.05, z: direction < 0 ? 52 : 38 });
        for (let i = 0; i < 230; i++) { physics.step(0, direction * 4); expect(physics.position().y).toBeGreaterThan(.8); }
        expect(direction * physics.position().z).toBeGreaterThan(direction < 0 ? -38 : 52);
        expect(physics.position().x).toBeCloseTo(x, 1);
      }
      for (const x of [-3.15, 3.15]) {
        physics.teleport({ x, y: 1.05, z: 45 }); for (let i = 0; i < 120; i++) physics.step(0, -4);
        expect(physics.position().z).toBeGreaterThan(GATEWAY.z + 1.1); expect(physics.position().z).toBeLessThan(GATEWAY.z + 1.5);
        expect(plantingAllowed(x, GATEWAY.z, .6)).toBe(false);
      }
      for (let z = 40; z <= 53; z++) expect(plantingAllowed(0, z, .6)).toBe(false);
    } finally { physics.dispose(); dispose(root); }
  });
  it('keeps the gem closed with outward-facing tables and distinct facets', () => {
    const g = gatewayGemGeometry(), n = g.getAttribute('normal'), normals = new Set<string>();
    for (let i = 0; i < n.count; i++) normals.add([n.getX(i), n.getY(i), n.getZ(i)].map((v) => v.toFixed(3)).join(','));
    expect(normals.size).toBeGreaterThan(12);
    const gem = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); gem.updateMatrixWorld();
    for (const side of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(0, GATEWAY.stoneY, GATEWAY.z + side * 2), new THREE.Vector3(0, 0, -side));
      expect(ray.intersectObject(gem).length).toBeGreaterThan(0);
    }
    g.dispose(); gem.material.dispose();
  });
  it('retains the tourmaline identity and colour-space settings across quality changes', () => {
    const { gem, silver, limestone } = gatewayMaterials(false);
    expect(gem.map?.colorSpace).toBe(THREE.SRGBColorSpace); expect(limestone.bumpMap?.colorSpace).toBe(THREE.NoColorSpace); expect(silver.metalness).toBe(1);
    for (const low of [true, false, true, false]) {
      setGatewayQuality(gem, low); expect(gem.transmission).toBe(low ? 0 : .82); expect(gem.opacity).toBe(1); expect(gem.ior).toBe(1.62);
    }
    for (const m of [gem, silver, limestone]) { for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose(); m.dispose(); }
  });
});
