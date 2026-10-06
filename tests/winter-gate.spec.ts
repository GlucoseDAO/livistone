import { expect, test } from '@playwright/test';
import { WINTER, WINTER_ARRIVAL } from '../src/world/winter-gate-layout';
import { EXPECTED_BACKEND } from './gpu-errors';

test('arrives at Eye of Winter from the map and walks through its iris', async ({ page }) => {
  // With probes disabled, cold WebGL material preparation on Windows can exceed 90 seconds.
  const coldStart = process.env.LIVISTONE_BACKEND === 'webgl' ? 240000 : 90000;
  test.setTimeout(coldStart + 60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?graphics=mobile&probes=off' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: coldStart });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('#marker-winter-gate')).toBeInViewport();
  await page.locator('#marker-winter-gate').click();
  const state = () => page.evaluate(() => (window as any).__livistone.snapshot());
  // The arrival waits for the trail's distant parts to build ("Preparing …"), which a cold page may still be doing.
  await expect.poll(async () => (await state()).mode, { timeout: 60000 }).toBe('walking');
  await expect.poll(async () => (await state()).position.x).toBeCloseTo(WINTER_ARRIVAL.x, 1);
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await state()).position.x, { timeout: 15000 }).toBeLessThan(WINTER.quartzX + 1); }
  finally { await page.keyboard.up('w'); }
  const inside = await state();
  expect(inside.backend).toBe(EXPECTED_BACKEND);
  expect(inside.position.y).toBeGreaterThan(WINTER.floor + .7);
  expect(inside.position.y).toBeLessThan(WINTER.floor + 1.1);
  expect(errors).toEqual([]);
});
