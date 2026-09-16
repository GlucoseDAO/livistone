import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
const floor: ColliderSpec = { type: 'box', position: [0, -0.2, 0], size: [20, 0.2, 20] };

describe('walking physics', () => {
  it('stops at solid walls while remaining on the ground', async () => {
    const physics = await Physics.create([floor, { type: 'box', position: [0, 2, -2], size: [5, 2, 0.2] }]);
    physics.teleport({ x: 0, y: 1, z: 2 });
    for (let i = 0; i < 240; i++) physics.step(0, -4);
    expect(physics.position().z).toBeGreaterThan(-1.6);
    expect(physics.position().z).toBeLessThan(-1.3);
    expect(physics.position().y).toBeGreaterThan(0.79);
    physics.dispose();
  });
  it('passes through a doorway and steps onto a raised floor', async () => {
    const physics = await Physics.create([floor,
      { type: 'box', position: [-2.5, 2, -2], size: [1.2, 2, 0.2] },
      { type: 'box', position: [2.5, 2, -2], size: [1.2, 2, 0.2] },
      { type: 'box', position: [0, 0.09, -5], size: [4, 0.09, 3] },
    ]);
    physics.teleport({ x: 0, y: 1, z: 2 });
    for (let i = 0; i < 120; i++) physics.step(0, -4);
    expect(physics.position().z).toBeLessThan(-5);
    expect(physics.position().y).toBeGreaterThan(0.94);
    physics.dispose();
  });
});
