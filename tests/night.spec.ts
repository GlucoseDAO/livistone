import { expect, test } from '@playwright/test';
import { EXPECTED_BACKEND } from './gpu-errors';

test('day and night override the clock, preserve the player and persist on reload', async ({ page }) => {
  // The WebGL 2 fallback builds every shader synchronously at each load and first night switch. This test loads three times and switches phase three times; on a loaded development
  // laptop (load average 8–11, 4 October 2026) that took 1.2–1.3 minutes interleaved with other runs against the 120 s default, with no assertion failing.
  if (EXPECTED_BACKEND === 'webgl2-fallback') test.setTimeout(240000);
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('#start-exploring').click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { night: boolean; timeOfDay: string; position: { x: number; z: number } } } }).__livistone.snapshot());
  const before = await snapshot();
  await page.getByRole('combobox', { name: 'Time of day' }).selectOption('day'); expect((await snapshot()).night).toBe(false);
  await page.getByRole('combobox', { name: 'Time of day' }).selectOption('night'); expect((await snapshot()).night).toBe(true);
  expect((await snapshot()).position).toEqual(before.position);
  await page.getByLabel('Visual detail').selectOption('low'); expect((await snapshot()).night).toBe(true);
  await page.reload(); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  expect((await snapshot()).timeOfDay).toBe('night'); expect((await snapshot()).night).toBe(true);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('combobox', { name: 'Time of day' }).selectOption('auto'); expect((await snapshot()).timeOfDay).toBe('auto');
});
