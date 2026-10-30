import { expect, test } from '@playwright/test';
import { STUMP_OF_LIFE as S } from '../src/world/stump-of-life-layout';
import { COURTYARD_ARRIVAL, COURTYARD_STAIRS, MATSU_COURTYARD as C, courtyardWorld } from '../src/world/matsu-courtyard-layout';
import { GPU_ERROR } from './gpu-errors';

test('Stump of Life is reachable down the reconstructed courtyard stairs at proposal seat scale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?place=stump-of-life&graphics=mobile&probes=off' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('.landmark-item[data-action="landmark:stump-of-life"]').click();
  const state = () => page.evaluate(() => (window as any).__livistone.snapshot());
  const walkTo = async (target: { x: number; z: number; y: number }, radius = .18): Promise<{ x: number; y: number; z: number }> => {
    const at = (await state()).position, yaw = Math.atan2(at.x - target.x, at.z - target.z);
    // Turn in place through the stable hook; all travel between waypoints still goes through keyboard input and collision.
    await page.evaluate(([x, z, yaw, y]) => (window as any).__livistone.teleport(x, z, yaw, y), [at.x, at.z, yaw, at.y]);
    // Arm the render-loop observer before movement: a short first waypoint can pass during keyboard-down IPC.
    const arrival = page.waitForFunction(([x, z, radius, startX, startZ]) => {
      const p = (window as any).__livistone.snapshot().position, dx = x - startX, dz = z - startZ, length = Math.hypot(dx, dz);
      const along = ((p.x - startX) * dx + (p.z - startZ) * dz) / length, across = Math.abs((p.x - startX) * dz - (p.z - startZ) * dx) / length;
      // One render frame can contain several physics steps and pass a waypoint between samples.
      return Math.hypot(p.x - x, p.z - z) < radius || (along >= length && along < length + .5 && across < radius) ? p : false;
    }, [target.x, target.z, radius, at.x, at.z], { polling: 'raf', timeout: 15000 });
    await page.keyboard.down('w');
    try {
      const reached = await arrival;
      await page.keyboard.up('w');
      return await reached.jsonValue();
    } finally { await page.keyboard.up('w'); }
  };
  await expect.poll(async () => (await state()).position.x).toBeCloseTo(S.arrival.x, 1);
  expect((await state()).mode).toBe('walking'); expect((await state()).yaw).toBeCloseTo(S.arrival.yaw, 5);
  await expect.poll(async () => (await state()).position.y).toBeLessThan(C.floorY + 1.1);
  expect((await state()).position.y).toBeGreaterThan(C.floorY + .65);
  await expect.poll(async () => (await state()).interaction).toBe('stump-of-life-story');
  await page.screenshot({ path: 'output/testing/stump-access-fixes/arrival-poster-with-hud.png' });
  await page.keyboard.press('e'); await expect(page.locator('#lore-title')).toHaveText('Stump of Life');
  await expect(page.locator('#lore')).toContainText('Stronghold 26');
  await page.locator('#lore [data-action="slide-next"]').click();
  await expect(page.locator('#lore')).toContainText('175 ordered variable alignment columns');
  await page.locator('#lore [data-action="slide-next"]').click();
  await expect(page.locator('#lore')).toContainText('417 km · Green Island');
  await expect(page.locator('#lore')).toContainText('not migration routes or walking paths');
  await page.locator('#lore [data-action="slide-next"]').click();
  await expect(page.locator('#lore')).toContainText('sixteen tracks and 294 observed substitution marks');
  await expect(page.locator('#lore-figure .source-image img')).toHaveAttribute('src', '/images/stump-of-life/exact-cap-texture.png');
  await page.keyboard.press('Escape');
  // Poster-facing named arrivals stay on the lower floor; explicitly start upstairs before checking both flights.
  await page.evaluate(arrival => (window as any).__livistone.teleport(arrival.x, arrival.z, arrival.yaw, arrival.y), COURTYARD_ARRIVAL);
  await expect.poll(async () => (await state()).position.y).toBeGreaterThan(C.upperFloorY + .65);
  // Continuous walking through both flights and every turn; tiny collinear tread transitions are covered by the physics test.
  for (const point of [3, 4, 6, 7].map(index => COURTYARD_STAIRS[index])) {
    const target = { ...courtyardWorld(point), y: point.y };
    await walkTo(target);
    await expect.poll(async () => Math.abs((await state()).position.y - target.y - .83)).toBeLessThan(.32);
  }
  const besideSeat = { ...courtyardWorld({ x: 1, z: 2.4 }), y: C.floorY };
  const lower = await walkTo(besideSeat, .22);
  expect(lower.y).toBeGreaterThan(C.floorY + .65); expect(lower.y).toBeLessThan(C.floorY + 1.1);
  expect(Math.hypot(lower.x - S.x, lower.z - S.z)).toBeLessThan(1.7);
  const beforeMap = await state();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'First person', exact: true }).click();
  const afterMap = await state();
  expect(afterMap.position.x).toBeCloseTo(beforeMap.position.x, 2); expect(afterMap.position.z).toBeCloseTo(beforeMap.position.z, 2);
  expect(afterMap.position.y).toBeCloseTo(beforeMap.position.y, 1); expect(afterMap.yaw).toBeCloseTo(beforeMap.yaw, 5);
  expect(errors).toEqual([]);
});
