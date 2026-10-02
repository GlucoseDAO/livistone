import { expect, test } from '@playwright/test';

for (const tier of ['gpu', 'mobile', 'cpu'] as const) test(`the ${tier} profile loads the same walkable world and changes its full rendering budget`, async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?graphics=' + tier);
  await page.waitForFunction(() => (window as any).__livistone?.snapshot().ready, null, { timeout: 120000 });
  const initial = await page.evaluate(() => (window as any).__livistone.snapshot());
  expect(initial.graphicsTier).toBe(tier); expect(initial.reducedGraphics).toBe(tier !== 'gpu');
  if (tier === 'cpu') {
    expect(initial.cpuGeometry.after).toBeLessThan(initial.cpuGeometry.before);
    expect(initial.renderScale).toBeLessThanOrEqual(.55);
  }
  await page.evaluate(() => (window as any).__livistone.teleport(0, -9, 0));
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__livistone.snapshot())).position.z, { timeout: 30000 }).toBeLessThan(-18);
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#graphics-profile')).toContainText(tier === 'gpu' ? 'GPU' : tier === 'mobile' ? 'Mobile' : 'CPU');
  await page.locator('#time-of-day').selectOption('night');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__livistone.snapshot())).night).toBe(true);
  await page.locator('#time-of-day').selectOption('day');
  await expect.poll(async () => (await page.evaluate(() => (window as any).__livistone.snapshot())).night).toBe(false);
  expect(errors).toEqual([]);
});
