import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groundNodes } from '../src/world/ground-material';
import { rockShore, shoreTextureFiles, shoreTime } from '../src/world/shore-nodes';
import { ROCK_DETAIL, createRiverRocks, rockGeometry } from '../src/world/river-rocks';
import { riverRockSites } from '../src/world/stone';
import { uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';

const texture = (): THREE.Texture => new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);

describe('river shore shading', () => {
  it('loads the shore gravel scan on gpu and mobile only, from files that exist', () => {
    expect(shoreTextureFiles('cpu')).toEqual([]);
    for (const tier of ['gpu', 'mobile'] as const) {
      const files = shoreTextureFiles(tier); expect(files).toHaveLength(2);
      for (const file of files) expect(existsSync(`public/textures/ground/${file}`)).toBe(true);
    }
  });
  it('builds the ground nodes on every tier with and without the gravel, keeping roughness free to drop for the wet band', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) for (const shore of [null, { albedo: texture(), nrh: texture() }]) {
      const maps = { albedo: [texture(), texture(), texture()], nrh: [texture(), texture(), texture()], rock: texture(), rockNormal: tier === 'gpu' ? texture() : null, shore };
      const nodes = groundNodes(tier, 'a', maps, new THREE.Color('#c5c5a4'));
      expect(nodes.colorNode.isNode).toBe(true);
      expect(nodes.roughnessNode?.isNode ?? false).toBe(tier !== 'cpu'); expect(nodes.normalNode?.isNode ?? false).toBe(tier === 'gpu');
    }
    // Caustics share the game clock with the river, so a frozen capture freezes them.
    expect(shoreTime.isNode).toBe(true); expect(shoreTime.value).toBe(0);
  });
  it('gives river rocks moss and a wet band through nodes, and bakes lichen only for the cpu tier, which drops node shading', () => {
    const nodes = rockShore(uniform(new THREE.Color('#ffffff')) as unknown as Node<'vec3'>);
    expect(nodes.colorNode.isNode).toBe(true); expect(nodes.roughnessNode.isNode).toBe(true);
    const plain = rockGeometry(ROCK_DETAIL.gpu, false), baked = rockGeometry(ROCK_DETAIL.gpu, true), moss = plain.getAttribute('moss');
    const a = plain.getAttribute('color'), b = baked.getAttribute('color');
    let greener = 0, mossy = 0, bare = 0;
    for (let i = 0; i < moss.count; i++) {
      if (moss.getX(i) === 0) { bare++; expect(b.getX(i)).toBeCloseTo(a.getX(i), 6); expect(b.getY(i)).toBeCloseTo(a.getY(i), 6); }
      else if (moss.getX(i) > .4) { mossy++; if (b.getY(i) / b.getX(i) > a.getY(i) / a.getX(i) + .02) greener++; }
    }
    expect(bare).toBeGreaterThan(20); expect(mossy).toBeGreaterThan(5); expect(greener).toBe(mossy);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true }), sites = riverRockSites(true);
    const colours = (tier: 'gpu' | 'cpu'): THREE.BufferAttribute => createRiverRocks(sites, material, tier).geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(Array.from(colours('gpu').array)).toEqual(Array.from(rockGeometry(ROCK_DETAIL.gpu, false).getAttribute('color').array));
    expect(Array.from(colours('cpu').array)).toEqual(Array.from(rockGeometry(ROCK_DETAIL.cpu, true).getAttribute('color').array));
  });
});
