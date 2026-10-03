import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { prepareCpuDetail } from '../src/world/cpu-detail';
import { createContactShadows } from '../src/world/contact-shadows';

describe('CPU world detail', () => {
  it('reduces architecture without filling apertures or mutating source geometry', async () => {
    const root = new THREE.Group(), original = new THREE.TorusGeometry(5, 1, 16, 100), count = original.index!.count;
    const source = new THREE.MeshPhysicalMaterial({ color: '#c8baa0', metalness: .7, transmission: .4, side: THREE.DoubleSide });
    source.userData.nightEmission = { color: '#ffbb66', intensity: .3 };
    const ring = new THREE.Mesh(original, source); root.add(ring, new THREE.PointLight('#ffffff', 5));
    const stats = await prepareCpuDetail(root, new THREE.CubeTexture()); root.updateMatrixWorld(true);
    expect(stats.after).toBeLessThan(stats.before); expect(original.index!.count).toBe(count);
    expect(ring.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(ring.material.userData.nightEmission).toEqual(source.userData.nightEmission);
    expect(root.children[1].visible).toBe(false);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(ring)).toHaveLength(0);
    ray.set(new THREE.Vector3(5, 0, 10), new THREE.Vector3(0, 0, -1)); expect(ray.intersectObject(ring).length).toBeGreaterThan(0);
  });
  it('leaves meshes that opt out with userData.keepGeometry whole, such as the contact shadows the CPU tier relies on', async () => {
    const root = new THREE.Group(), sites = Array.from({ length: 300 }, (_, i) => ({ x: (i % 20) * 9 - 90, z: Math.floor(i / 20) * 9 - 70, rx: 4, rz: 4, strength: .4 }));
    const { mesh } = createContactShadows(sites), geometry = mesh.geometry, material = mesh.material, count = geometry.index!.count;
    expect(count).toBeGreaterThan(3600); root.add(mesh);
    await prepareCpuDetail(root, new THREE.CubeTexture());
    expect(mesh.geometry).toBe(geometry); expect(mesh.geometry.index!.count).toBe(count);
    expect(mesh.material).toBe(material); expect(mesh.visible).toBe(true); expect(root.children).toEqual([mesh]);
  });
});
