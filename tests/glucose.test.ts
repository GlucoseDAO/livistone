import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { CIVIC_LANDMARKS, parseProgress } from '../src/game/content';
import { RESEARCH_POSTERS } from '../src/game/research';
import { GLUCOSE_PAVILION as SITE, GLUCOSE_POSTERS } from '../src/world/glucose-layout';
import { createGlucoseStructure, insulinPoint } from '../src/world/glucose-pavilion';
import { plantingAllowed } from '../src/world/landscape';
import insulin from '../src/world/molecules/insulin.json';
import glucose from '../src/world/molecules/glucose.json';

describe('Glucose Commons', () => {
  it('preserves the selected molecular records and separates research from jewelry galleries', () => {
    for (const [name, source] of [['1TRZ.pdb', insulin], ['GLC_ideal.sdf', glucose]] as const) expect(source.sourceSha256).toBe(createHash('sha256').update(readFileSync(`data/molecules/${name}`)).digest('hex'));
    expect(insulin.chains.map((c) => c.residues.length)).toEqual([21, 30]); expect(insulin.disulfides).toHaveLength(3);
    expect(glucose.atoms.filter((a) => a.element === 'C')).toHaveLength(6); expect(glucose.atoms.filter((a) => a.element === 'O')).toHaveLength(6);
    for (const chain of insulin.chains) for (let i = 1; i < chain.residues.length; i++) {
      const a = chain.residues[i - 1].position, b = chain.residues[i].position;
      const sourceDistance = Math.hypot(...a.map((v, j) => v - b[j]));
      expect(insulinPoint(a).distanceTo(insulinPoint(b))).toBeCloseTo(sourceDistance * .53, 8);
      expect(insulinPoint(b).y).toBeGreaterThanOrEqual(SITE.canopyY);
    }
    expect(CIVIC_LANDMARKS.map((l) => l.id)).toEqual(['city-hall', 'energy', 'science']);
    expect(RESEARCH_POSTERS).toHaveLength(GLUCOSE_POSTERS.length);
    expect(RESEARCH_POSTERS.map((p) => p.id)).toEqual(['glucose-livia', 'glucose-format', 'glucose-service', 'glucose-game', 'glucose-models', 'glucose-molecule']);
    for (const poster of RESEARCH_POSTERS) { expect(poster.slides.length).toBeGreaterThan(1); expect(poster.slides[0].title.length).toBeGreaterThan(0); }
    expect(parseProgress(JSON.stringify({ version: 1, discovered: ['nut', 'glucose-models'], visited: ['city-hall', 'glucose'] }))).toEqual({ version: 1, discovered: ['nut', 'glucose-models'], visited: ['city-hall', 'glucose'] });
    for (const poster of RESEARCH_POSTERS) for (const link of poster.links!) expect(new URL(link.url).protocol).toBe('https:');
  });
  for (const mobile of [false, true]) it(`keeps a two-way passage and every poster accessible (${mobile ? 'mobile' : 'desktop'})`, async () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = [{ type: 'box', position: [SITE.x, -.3, SITE.z], size: [20, .3, 20] }];
    createGlucoseStructure(root, colliders, mobile, new THREE.MeshStandardMaterial());
    const physics = await Physics.create(colliders);
    try {
      for (const direction of [-1, 1]) {
        physics.teleport({ x: SITE.x, y: 1.05, z: SITE.z - direction * 12 });
        for (let i = 0; i < 370; i++) { physics.step(0, direction * 4); expect(physics.position().y).toBeGreaterThan(.8); expect(physics.position().y).toBeLessThan(1.2); }
        expect((physics.position().z - SITE.z) * direction).toBeGreaterThan(11);
      }
      for (const panel of GLUCOSE_POSTERS) {
        const dx = panel.x - SITE.x, dz = panel.z - SITE.z, length = Math.hypot(dx, dz);
        physics.teleport({ x: SITE.x, y: 1.05, z: SITE.z });
        for (let i = 0; i < 85; i++) physics.step(dx / length * 4, dz / length * 4);
        expect(Math.hypot(physics.position().x - panel.x, physics.position().z - panel.z)).toBeLessThan(2.5);
        for (let i = 0; i < 90; i++) physics.step(dx / length * 4, dz / length * 4);
        expect(Math.hypot(physics.position().x - SITE.x, physics.position().z - SITE.z)).toBeLessThan(7.6);
        expect(plantingAllowed(panel.x, panel.z, 3)).toBe(false);
      }
    } finally { physics.dispose(); root.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((m) => m.dispose()); } }); }
  });
});
