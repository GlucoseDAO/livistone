import { describe, expect, it } from 'vitest';
import { meadowRelief } from '../src/world/meadow-relief';
import { PATH_CURVES, PATH_WIDTH, plantingAllowed } from '../src/world/landscape';
import { terrainHeight, townTerrainGeometry } from '../src/world/terrain';
import { Physics } from '../src/game/physics';

describe('rolling meadow contours', () => {
  it('keeps authored footprints level while giving open arrival lawns visible relief', () => {
    expect(meadowRelief(18, 48)).toBeGreaterThan(1.3);
    expect(meadowRelief(-14, 42)).toBeGreaterThan(1.5);
    for (let z = -68; z <= 60; z += 2) for (let x = -110; x <= 110; x += 2) {
      if (!plantingAllowed(x, z, 2.5)) expect(meadowRelief(x, z)).toBe(0);
      expect(meadowRelief(x, z)).toBeLessThan(2.6);
    }
    for (const curve of PATH_CURVES) for (let i = 0; i <= 160; i++) {
      const p = curve.getPoint(i / 160), t = curve.getTangent(i / 160);
      for (const side of [-1, 0, 1]) expect(meadowRelief(p.x - t.z * side * PATH_WIDTH / 2, p.z + t.x * side * PATH_WIDTH / 2)).toBe(0);
    }
  });
  it('walks across rolling ground on the shared terrain collision mesh', async () => {
    const geometry = townTerrainGeometry(), positions = geometry.getAttribute('position');
    const physics = await Physics.create([{ type: 'mesh', vertices: new Float32Array(positions.array), indices: new Uint32Array(geometry.index!.array) }]);
    try {
      physics.teleport({ x: 10, y: terrainHeight(10, 48) + 1, z: 48 });
      let highest = 0;
      for (let i = 0; i < 330; i++) {
        physics.step(4, 0); const p = physics.position(); highest = Math.max(highest, p.y);
        if (i > 30) expect(Math.abs(p.y - terrainHeight(p.x, p.z) - .845)).toBeLessThan(.22);
      }
      expect(highest).toBeGreaterThan(2.1); expect(physics.position().x).toBeGreaterThan(30);
    } finally { physics.dispose(); geometry.dispose(); }
  });
});
