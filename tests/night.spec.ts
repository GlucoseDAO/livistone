import { expect, test } from '@playwright/test';

test('day and night override the clock, preserve the player and persist on reload', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('#start-exploring').click();
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  const snapshot = () => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { night: boolean; timeOfDay: string; position: { x: number; z: number } } } }).__livistone.snapshot());
  const before = await snapshot();
  await page.getByLabel('Time of day').selectOption('day'); expect((await snapshot()).night).toBe(false);
  await page.getByLabel('Time of day').selectOption('night'); expect((await snapshot()).night).toBe(true);
  expect((await snapshot()).position).toEqual(before.position);
  await page.getByLabel('Visual detail').selectOption('low'); expect((await snapshot()).night).toBe(true);
  await page.reload(); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  expect((await snapshot()).timeOfDay).toBe('night'); expect((await snapshot()).night).toBe(true);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByLabel('Time of day').selectOption('auto'); expect((await snapshot()).timeOfDay).toBe('auto');
});
