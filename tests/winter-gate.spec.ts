import { expect, test } from '@playwright/test';
import { WINTER } from '../src/world/winter-gate-layout';

test('arrives at Eye of Winter from the map and walks through its iris', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?graphics=mobile&probes=off' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('.landmark-item[data-action="landmark:winter-gate"]').click();
  const state = () => page.evaluate(() => (window as any).__livistone.snapshot());
  await expect.poll(async () => (await state()).mode).toBe('walking');
  await expect.poll(async () => (await state()).position.x).toBeCloseTo(WINTER.arrivalX, 1);
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await state()).position.x, { timeout: 15000 }).toBeLessThan(WINTER.quartzX + 1); }
  finally { await page.keyboard.up('w'); }
  const inside = await state();
  expect(inside.position.y).toBeGreaterThan(WINTER.floor + .7);
  expect(inside.position.y).toBeLessThan(WINTER.floor + 1.1);
  expect(errors).toEqual([]);
});
