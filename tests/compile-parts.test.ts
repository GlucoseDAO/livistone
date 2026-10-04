import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { compileParts } from '../src/render/compile-parts';

describe('shader preparation', () => {
  it('compiles one ordinary mesh for each shared material and vertex layout', () => {
    const material = new THREE.MeshStandardMaterial(), a = new THREE.Mesh(new THREE.BoxGeometry(), material), b = new THREE.Mesh(new THREE.SphereGeometry(), material);
    expect(compileParts([a, b])).toEqual([a]);
    b.geometry.deleteAttribute('uv'); expect(compileParts([a, b])).toEqual([a, b]);
  });
  it('keeps shadow, material, attribute format and winding variants', () => {
    const material = new THREE.MeshStandardMaterial(), a = new THREE.Mesh(new THREE.BoxGeometry(), material), variants = [a.clone(), a.clone(), a.clone(), a.clone()];
    variants[0].material = material.clone(); variants[1].receiveShadow = true; variants[2].scale.x = -1; variants[2].updateMatrixWorld();
    variants[3].geometry = a.geometry.clone(); variants[3].geometry.setAttribute('colour', new THREE.Uint8BufferAttribute(new Uint8Array(72), 3, true));
    expect(compileParts([a, ...variants])).toHaveLength(5);
  });
  it('keeps every instance, skin, morph and subtree, and respects hidden ancestors', () => {
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), a = new THREE.InstancedMesh(geometry, material, 1), b = new THREE.InstancedMesh(geometry, material, 1);
    expect(compileParts([a, b])).toEqual([a, b]);
    const morph = geometry.clone(); morph.morphAttributes.position = [geometry.attributes.position.clone()];
    const c = new THREE.Mesh(morph, material), d = new THREE.Mesh(morph, material); expect(compileParts([c, d])).toEqual([c, d]);
    const root = new THREE.Group(); root.add(a, b); root.visible = false; expect(compileParts([root])).toEqual([]);
    const parent = new THREE.Mesh(geometry, material); parent.add(c); expect(compileParts([parent])).toEqual([parent]);
    expect(compileParts([new THREE.SkinnedMesh(geometry, material), new THREE.SkinnedMesh(geometry, material)])).toHaveLength(2);
  });
});
