import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCityHallFacade, cityHallCrystalMaterial, setCityHallCrystalQuality } from '../src/world/city-hall';
import { prepareCpuDetail } from '../src/world/cpu-detail';

describe('Nut of Power facade', () => {
  it('keeps both quality tiers outside the entrance, within the established footprint, and bounded in cost', () => {
    const counts: number[] = [], door = new THREE.Box3(new THREE.Vector3(-2.2, .3, 7), new THREE.Vector3(2.2, 3, 12));
    for (const low of [false, true]) {
      const group = new THREE.Group(), facade = createCityHallFacade(group, low), triangle = new THREE.Triangle(); let count = 0;
      expect(group.children.length).toBe(5);
      for (const object of group.children as THREE.Mesh<THREE.BufferGeometry>[]) {
        const geometry = object.geometry, vertices = geometry.getAttribute('position'), index = geometry.index!;
        expect([...vertices.array, ...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
        geometry.computeBoundingBox(); expect(geometry.boundingBox!.min.y).toBeGreaterThan(-.3); expect(geometry.boundingBox!.max.y).toBeLessThan(18);
        expect(Math.max(Math.abs(geometry.boundingBox!.min.x), geometry.boundingBox!.max.x)).toBeLessThan(10.6);
        for (let i = 0; i < index.count; i += 3) {
          triangle.a.fromBufferAttribute(vertices, index.getX(i)); triangle.b.fromBufferAttribute(vertices, index.getX(i + 1)); triangle.c.fromBufferAttribute(vertices, index.getX(i + 2));
          if (door.intersectsTriangle(triangle)) throw new Error(`${object.name} blocks the entrance`);
        }
        count += index.count / 3;
      }
      expect(count).toBeLessThan(low ? 10000 : 21000); counts.push(count);
      expect(facade.colliders.length).toBe(3);
      facade.colliders.forEach(collider => { if (collider.type === 'mesh') { expect([...collider.vertices].every(Number.isFinite)).toBe(true); expect(collider.indices.length).toBeGreaterThan(0); } });
      const brass = group.getObjectByName('City Hall brass clasps') as THREE.Mesh;
      const collider = facade.colliders[0]; if (collider.type === 'mesh') expect([...collider.vertices]).toEqual([...brass.geometry.getAttribute('position').array]);
      group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    }
    expect(counts[1]).toBeLessThan(counts[0] * .5);
  });

  it('uses outward shell normals for reflections on both halves', () => {
    const group = new THREE.Group(); createCityHallFacade(group, false);
    for (const name of ['City Hall walnut shell', 'City Hall crystal shell']) {
      const geometry = (group.getObjectByName(name) as THREE.Mesh).geometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
      const radial = new THREE.Vector3(), normal = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) expect(normal.fromBufferAttribute(n, i).dot(radial.fromBufferAttribute(p, i).sub(new THREE.Vector3(0, 5.7, 0)).normalize())).toBeGreaterThan(.3);
    }
  });

  it('keeps absorption and night appearance when toggling the inexpensive crystal path', () => {
    const material = cityHallCrystalMaterial(false), attenuation = material.attenuationColor.getHex(), night = material.userData.nightEmission;
    setCityHallCrystalQuality(material, true);
    expect(material.transmission).toBe(0); expect(material.clearcoat).toBe(0); expect(material.forceSinglePass).toBe(true);
    expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false); expect(material.opacity).toBeGreaterThan(0);
    setCityHallCrystalQuality(material, false);
    expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true); expect(material.opacity).toBe(1);
    expect(material.attenuationColor.getHex()).toBe(attenuation); expect(material.userData.nightEmission).toEqual(night); expect(material.ior).toBe(1.54);
    material.dispose();
  });

  it('keeps the crystal reading as a smoky volume from afar on every tier', async () => {
    // Rich: transmission is unchanged and the smoky colour absorbs it; reduced: the opacity rises where the crystal reads solid.
    const material = cityHallCrystalMaterial(false); expect(material.colorNode).not.toBeNull(); expect(material.specularIntensityNode).not.toBeNull();
    expect(material.transmission).toBe(.78); expect(material.opacityNode).toBeNull();
    setCityHallCrystalQuality(material, true); expect(material.opacityNode).not.toBeNull();
    setCityHallCrystalQuality(material, false); expect(material.opacityNode).toBeNull();
    // The cpu tier's Lambert copy keeps the same colour and opacity nodes rather than a bare 14% opacity.
    const low = cityHallCrystalMaterial(true), root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 6), low); root.add(mesh);
    await prepareCpuDetail(root, new THREE.CubeTexture());
    const copy = mesh.material as unknown as THREE.MeshStandardNodeMaterial;
    expect(copy).toBeInstanceOf(THREE.MeshLambertMaterial); expect(copy.colorNode).toBe(low.colorNode); expect(copy.opacityNode).toBe(low.opacityNode);
    material.dispose(); low.dispose();
  });
});
