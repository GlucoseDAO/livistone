import { describe, expect, it } from 'vitest';
import { ROTUNDA, rotundaGround } from '../src/world/concept-rotunda-layout';
import { terrainSurfaceHeight } from '../src/world/terrain';
import { plantingAllowed } from '../src/world/landscape';
import { winterBlueGeometry } from '../src/world/winter-gate';
import { WINTER } from '../src/world/winter-gate-layout';

describe('concept garden and polished topaz', () => {
  it('has a level approach all the way from the Eyelense forecourt into the rotunda', () => {
    for (let x = 116; x < ROTUNDA.x + 1; x += .5) {
      expect(rotundaGround(x, ROTUNDA.z)).toBe(true);
      expect(terrainSurfaceHeight(x, ROTUNDA.z)).toBeLessThan(.14);
      expect(plantingAllowed(x, ROTUNDA.z, .5)).toBe(false);
    }
  });
  it('keeps the full circular terrace free of random planting and emerging hillside', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += .2) {
      const x = ROTUNDA.x + Math.cos(angle) * 16, z = ROTUNDA.z + Math.sin(angle) * 16;
      expect(plantingAllowed(x, z, .5)).toBe(false); expect(terrainSurfaceHeight(x, z)).toBeLessThan(.14);
    }
  });
  it('faces the inner topaz facets outwards so refraction enters the correct side', () => {
    const g = winterBlueGeometry(), p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 - (WINTER.x - 1.8);
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 - WINTER.centreY;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 - WINTER.z;
      expect(x * n.getX(i) + y * n.getY(i) + z * n.getZ(i)).toBeGreaterThan(0);
    }
    g.dispose();
  });
});
