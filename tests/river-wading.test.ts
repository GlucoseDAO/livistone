import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import { townTerrainGeometry } from '../src/world/terrain';
import { FALL_FLOOR } from '../src/world/town-layout';
import { riverCenter } from '../src/world/waterways';

describe('river wading', () => {
  it('crosses the deepest channel without counting as a fall and climbs the far bank', async () => {
    const ground = townTerrainGeometry(), physics = await Physics.create([{ type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }]); ground.dispose();
    for (const x of [-40, -20, 30]) {
      const centre = riverCenter(x); physics.teleport({ x, y: 2, z: centre + 14 });
      let lowest = Infinity; for (let i = 0; i < 400; i++) { physics.step(0, -4, 1 / 60); lowest = Math.min(lowest, physics.position().y); }
      expect(lowest).toBeLessThan(-1); expect(lowest).toBeGreaterThan(FALL_FLOOR + 3);
      expect(physics.position().z).toBeLessThan(centre - 10); expect(physics.position().y).toBeGreaterThan(.5);
    }
    physics.dispose();
  });
});
