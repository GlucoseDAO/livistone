import { expect, test } from '@playwright/test';
import { EYELENSE as E } from '../src/world/eyelense-gate-layout';
import { EXPECTED_BACKEND, GPU_ERROR } from './gpu-errors';

test('Eyelense map arrival, both complete passages, journal and daylight controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?graphics=mobile&probes=off' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('.landmark-item[data-action="landmark:eyelense-gate"]').click();
  const state = () => page.evaluate(() => (window as any).__livistone.snapshot());
  await expect.poll(async () => (await state()).position.x).toBeCloseTo(E.arrival.x, 1);
  expect((await state()).yaw).toBeCloseTo(E.arrival.yaw, 5);
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await state()).position.x, { timeout: 15000 }).toBeGreaterThan(E.x + 6); } finally { await page.keyboard.up('w'); }
  await page.keyboard.down('s');
  try { await expect.poll(async () => (await state()).position.x, { timeout: 15000 }).toBeLessThan(E.x - 6); } finally { await page.keyboard.up('s'); }
  expect((await state()).position.y).toBeGreaterThan(E.floor + .7);
  await page.keyboard.press('e');
  await expect(page.locator('#lore-title')).toHaveText('Through the broken lens');
  await page.keyboard.press('Escape');
  await page.locator('#hud-time').click(); await expect.poll(async () => (await state()).night, { timeout: 30000 }).toBe(true);
  await page.locator('#hud-time').click(); await expect.poll(async () => (await state()).timeOfDay).toBe('auto');
  expect((await state()).backend).toBe(EXPECTED_BACKEND); expect(errors).toEqual([]);
});
