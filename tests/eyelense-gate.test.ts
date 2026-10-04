import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEyelenseGate, eyelenseBeadGeometry, eyelenseLensGeometry, setEyelenseNight, setEyelenseQuality } from '../src/world/eyelense-gate';
import { EYELENSE as E, eyelenseClearing } from '../src/world/eyelense-gate-layout';
import { Physics } from '../src/game/physics';
import { grassAllowed, plantingAllowed, WALKING_NETWORK } from '../src/world/landscape';
import { terrainSurfaceHeight } from '../src/world/terrain';
import { kerbOpening } from '../src/world/walking-surface';
import { COLLECTION } from '../src/game/exhibits';
import { DISCOVERIES, LANDMARKS } from '../src/game/content';
let source: THREE.BufferGeometry;
beforeAll(async () => {
  const b = readFileSync('public/models/jewelry/eyelense-gate.glb');
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, '');
  source = (gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh).geometry;
});
function dispose(root: THREE.Group): void {
  const materials = new Set<THREE.Material>(); root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } }); materials.forEach(m => m.dispose());
}
describe('Eyelense E building', () => {
  it('keeps the source crescent topology under uniform scaling and rigid placement', () => {
    const gate = createEyelenseGate(source), a = source.getAttribute('position'), b = gate.crescent.geometry.getAttribute('position');
    try {
      expect(gate.crescent.geometry.index!.array).toEqual(source.index!.array); expect(b.count).toBe(a.count);
      for (let i = 1; i < a.count; i += 131) {
        expect(new THREE.Vector3().fromBufferAttribute(b, i).distanceTo(new THREE.Vector3().fromBufferAttribute(b, i - 1))).toBeCloseTo(new THREE.Vector3().fromBufferAttribute(a, i).distanceTo(new THREE.Vector3().fromBufferAttribute(a, i - 1)) * E.sourceScale, 4);
      }
      expect(gate.root.getObjectsByProperty('name', 'Eyelense · batched fittings and seats').length).toBeGreaterThan(0);
    } finally { dispose(gate.root); }
  });
  for (const reduced of [false, true]) {
    it(`has a sealed red volume around an actual aperture (${reduced ? 'reduced' : 'desktop'})`, () => {
      const g = eyelenseBeadGeometry(reduced), p = g.getAttribute('position'), ix = g.index!, edges = new Map<string, number>();
      // Every edge belongs to two faces: tunnel lining and soles close the bead, without capping the walking aperture.
      for (let i = 0; i < ix.count; i += 3) for (let k = 0; k < 3; k++) {
        const a = ix.getX(i + k), b = ix.getX(i + (k + 1) % 3), key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      expect([...edges.values()].every(n => n === 2)).toBe(true);
      let volume = 0;
      for (let i = 0; i < ix.count; i += 3) volume += new THREE.Vector3().fromBufferAttribute(p, ix.getX(i)).dot(new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 1)).cross(new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 2)))) / 6;
      expect(volume).toBeGreaterThan(80); // Outward winding, so refraction sees the exterior face first.
      g.computeBoundingBox(); expect(g.boundingBox!.max.y - E.floor).toBeGreaterThan(E.doorTop + 2);
      expect(g.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(4);
      expect(Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i)]).every(([x, y]) => y >= E.floor - 1e-6 && (y > E.floor + E.doorSpring || Math.abs(x) >= E.doorHalf - 1e-6))).toBe(true); g.dispose();
    });
    it(`walks both directions and blocks bead sides and seats (${reduced ? 'reduced' : 'desktop'})`, async () => {
      const gate = createEyelenseGate(source, reduced), physics = await Physics.create(gate.colliders);
      try {
        // Offset lanes also check that crescent tips and suspension never cut through the usable width.
        for (const direction of [-1, 1]) for (const lane of [-1.55, 0, 1.55]) {
          physics.teleport({ x: E.x - direction * 8, y: E.floor + .9, z: E.z + lane });
          for (let i = 0; i < 240; i++) { physics.step(direction * 4, 0); expect(physics.position().y).toBeGreaterThan(E.floor + .7); }
          expect((physics.position().x - E.x) * direction).toBeGreaterThan(7);
        }
        physics.teleport({ x: E.x, y: E.floor + .9, z: E.z });
        for (let i = 0; i < 180; i++) physics.step(0, 4);
        expect(physics.position().z).toBeLessThan(E.z + E.doorHalf); expect(physics.position().z).toBeGreaterThan(E.z + 1.6);
        const seat = E.seats[0]; physics.teleport({ x: E.x - seat.z, y: E.floor + .9, z: E.z + seat.x - 3 });
        for (let i = 0; i < 90; i++) physics.step(0, 4);
        expect(physics.position().z).toBeLessThan(E.z + seat.x - 1.8);
      } finally { physics.dispose(); dispose(gate.root); }
    });
  }
  it('joins Science paving, opens the kerbs and reserves every plant footprint on a level site', () => {
    for (let x = 80; x <= 97; x += .5) expect(WALKING_NETWORK.clearance(x, x < 92 ? -34 - (x - 80) / 6 : -36, 3)).toBeLessThan(.2);
    for (let x = 96; x <= 116; x += 2) for (let z = -44; z <= -28; z += 2) {
      expect(terrainSurfaceHeight(x, z)).toBeCloseTo(0, 6); expect(grassAllowed(x, z, .2)).toBe(false); expect(plantingAllowed(x, z, 3)).toBe(false);
    }
    expect(kerbOpening(95, E.z)).toBe(true); expect(eyelenseClearing(E.x - 15, E.z, 2)).toBe(true);
    expect(LANDMARKS.find(l => l.id === 'eyelense-gate')!.entrance).toEqual(E.arrival);
    expect(COLLECTION.find(p => p.discovery === 'eyelense')!.location).toBe('future-house');
    expect(DISCOVERIES.find(d => d.id === 'eyelense-gate-story')!.body).toContain('Livistone fiction');
  });
  it('winds the bounded lens outward on both faces', () => {
    const g = eyelenseLensGeometry(), p = g.getAttribute('position'), ix = g.index!; let volume = 0;
    for (let i = 0; i < ix.count; i += 3) volume += new THREE.Vector3().fromBufferAttribute(p, ix.getX(i)).dot(new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 1)).cross(new THREE.Vector3().fromBufferAttribute(p, ix.getX(i + 2)))) / 6;
    expect(volume).toBeGreaterThan(.9); g.dispose();
  });
  it('clears only the lens at night and retains opaque reduced fallbacks through menu changes', () => {
    const gate = createEyelenseGate(source, true), lens = gate.lens.material as THREE.MeshPhysicalMaterial, red = gate.bead.material as THREE.MeshPhysicalMaterial;
    try {
      const day = lens.color.getHex(), bead = red.color.getHex(); setEyelenseNight(lens, true); setEyelenseNight(red, true);
      expect(lens.color.getHex()).not.toBe(day); expect(red.color.getHex()).toBe(bead);
      setEyelenseNight(lens, false); expect(lens.color.getHex()).toBe(day);
      setEyelenseQuality(lens, false); expect(lens.transmission).toBe(0); expect(lens.transparent).toBe(false); expect(lens.opacity).toBe(1);
    } finally { dispose(gate.root); }
  });
});
