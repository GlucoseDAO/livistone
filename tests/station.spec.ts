import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Snapshot { ready: boolean; mode: string; position: { x: number; y: number; z: number }; yaw: number; progress: { discovered: string[]; visited: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number): Promise<void> => page.evaluate(({ x, z }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(-16 - x, -z, Math.PI), { x, z });

test('enter the Embryo ring, explore the station, discover its story, and resume from its map card', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.click('#view-toggle');
  await teleport(page, -16, -56); await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 20000 }).toBeGreaterThan(67); await page.keyboard.up('KeyW');
  await expect(page.locator('#location')).toHaveText('Embryo Station');
  expect((await snapshot(page)).position.y).toBeGreaterThan(.9);
  await page.keyboard.press('Digit1'); await expect(page.locator('#lore-title')).toHaveText('Embryo Ring');
  await page.keyboard.press('Escape'); await expect(page.locator('#lore')).toBeHidden();
  await teleport(page, -8.5, -63.4); await expect(page.locator('#interact')).toContainText('A departure, a beginning');
  await page.keyboard.press('KeyE'); await expect(page.locator('#lore-title')).toHaveText('A departure, a beginning');
  await expect(page.locator('#lore-body')).toContainText('new Livistone fiction');
  await page.getByRole('button', { name: 'Continue exploring' }).click();
  await page.keyboard.press('KeyM');
  await page.locator('.landmark-item[data-action="landmark:station"]').click(); const after = await snapshot(page);
  expect(after.mode).toBe('walking'); expect(after.position.x).toBeCloseTo(0, 2); expect(after.position.z).toBeCloseTo(56, 2); expect(after.yaw).toBe(Math.PI);
  await page.reload(); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
  expect((await snapshot(page)).progress.discovered).toContain('embryo-station'); expect((await snapshot(page)).progress.visited).toContain('station'); expect(errors).toEqual([]);
});

test('station map and discovery are usable on a touch viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').tap();
    await teleport(page, -8.5, -63.4); await expect(page.locator('#interact')).toBeVisible(); await page.locator('#interact').tap();
    await expect(page.locator('#lore-title')).toHaveText('A departure, a beginning'); await page.getByRole('button', { name: 'Continue exploring' }).tap();
    await page.getByRole('button', { name: 'Top view' }).tap();
    expect(await page.locator('#map-panel').evaluate((panel) => panel.scrollWidth <= panel.clientWidth)).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'output/testing/station/map-mobile.png' });
    await page.locator('.landmark-item[data-action="landmark:station"]').tap(); await expect(page.locator('#joystick')).toBeVisible();
    expect((await snapshot(page)).position.x).toBeCloseTo(0, 2); expect((await snapshot(page)).position.z).toBeCloseTo(56, 2); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
