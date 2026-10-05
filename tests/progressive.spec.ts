import { expect, test } from '@playwright/test';
import { GPU_ERROR } from './gpu-errors';
const backend = process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : '';

// Progressive loading (src/world/town-parts.ts): the distant parts build after the first view. A walk from the arrival and a
// teleport into a distant place go on while they stream in; every part then arrives, none fails, and none was drawn nearer the
// arrival point than its footprint allowed (the dev warning world.ts gives).
test('distant parts stream in while a visitor walks from the arrival and teleports away', async ({ page }) => {
  test.setTimeout(300000);
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && GPU_ERROR.test(message.text())) problems.push(message.text());
    if (message.type() === 'error' && /distant part/.test(message.text())) problems.push(message.text());
    if (message.type() === 'warning' && /Livistone: part/.test(message.text())) problems.push(message.text());
  });
  await page.addInitScript(() => { localStorage.setItem('livistone-time-of-day', 'day'); });
  await page.goto('/?graphics=mobile' + backend);
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  const snapshot = () => page.evaluate(() => (window as any).__livistone.snapshot());
  const first = await snapshot();
  expect(first.parts.waiting + first.parts.built - first.parts.shown, 'parts still to come after the first view').toBeGreaterThan(0);

  // Straight ahead from the spawn the station ring's base stops a walker, so the walk starts just past the ring, toward the gate.
  await page.evaluate(() => (window as any).__livistone.teleport(0, 58, 0));
  await page.locator('#world').focus();
  await page.keyboard.down('w'); await page.waitForTimeout(8000); await page.keyboard.up('w');
  const walked = await snapshot();
  expect(walked.position.z, 'walked north over the bridge').toBeLessThan(40);
  expect(walked.position.y, 'stayed on the ground').toBeGreaterThan(0);

  // The teleport menu waits for what stands round a distant arrival, then arrives there.
  await page.locator('#hud-teleport').click();
  await page.getByRole('button', { name: /Teleport to Eye of Winter/ }).click();
  await expect.poll(async () => (await snapshot()).position.z, { timeout: 120000 }).toBeLessThan(-250);
  await page.waitForTimeout(1500);
  const arrived = await snapshot();
  expect(arrived.position.y, 'stands on the snow shelf').toBeGreaterThan(40);
  expect(arrived.mode).toBe('walking');

  await expect.poll(async () => { const { parts } = await snapshot(); return parts.waiting === 0 && parts.built === parts.shown; }, { timeout: 180000 }).toBe(true);
  expect((await snapshot()).parts.order.filter((name: string) => name.includes('failed'))).toEqual([]);
  expect(problems).toEqual([]);
});
