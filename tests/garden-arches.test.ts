import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { gardenArch } from '../src/world/garden-arch';
import type { ColliderSpec } from '../src/game/physics';
import { chosenTier, parseGraphicsChoice } from '../src/game/graphics-choice';
import { graphicsTier, legacyIntegratedRenderer } from '../src/game/graphics';

describe('planted garden arches', () => {
  it('curves above the suspended poster and gives flowers real depth within the arch footprint', () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = [], m = new THREE.MeshBasicMaterial();
    gardenArch(root, new THREE.Matrix4(), colliders, { metal: m, stone: m, green: m, ivory: m, pink: m, gold: m }, false, 0);
    const bounds = new THREE.Box3().setFromObject(root);
    expect(bounds.max.y).toBeGreaterThan(5.5); expect(bounds.max.x).toBeLessThan(3); expect(bounds.min.x).toBeGreaterThan(-3);
    const petals = root.children.find(o => o.name === 'Garden arch · ivory') as THREE.Mesh;
    petals.geometry.computeBoundingBox(); expect(petals.geometry.boundingBox!.max.z - petals.geometry.boundingBox!.min.z).toBeGreaterThan(.15);
    expect(colliders.length).toBe(4);
    for (const object of root.children as THREE.Mesh[]) { expect(object.geometry.getAttribute('position').count).toBeGreaterThan(0); object.geometry.dispose(); }
    m.dispose();
  });
});
describe('performance selection', () => {
  it('uses the measured lightweight path on older Intel HD while keeping current discrete GPUs rich', () => {
    for (const name of ['Intel(R) HD Graphics 630', 'ANGLE (Intel, Intel(R) UHD Graphics 620, D3D11)', 'intel gen-9']) {
      expect(legacyIntegratedRenderer(name)).toBe(true); expect(graphicsTier({ coarse: false, renderer: name })).toBe('cpu');
    }
    for (const name of ['NVIDIA GeForce GTX 1050', 'Intel(R) Arc(TM) A770', 'Apple M2']) expect(legacyIntegratedRenderer(name)).toBe(false);
  });
  it('keeps device detection for auto and lets the visitor explicitly choose a different scene', () => {
    expect(parseGraphicsChoice('unknown')).toBe('auto'); expect(chosenTier('auto', 'cpu')).toBe('cpu');
    expect(chosenTier('rich', 'cpu')).toBe('gpu'); expect(chosenTier('balanced', 'gpu')).toBe('mobile'); expect(chosenTier('light', 'gpu')).toBe('cpu');
  });
});
