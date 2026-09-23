import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Snapshot { mode: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number; progress: { discovered: string[]; visited: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());

for (const mobile of [false, true]) test(`navigation stays clickable across views, menus and unread stories (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1200, height: 800 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const activate = async (selector: string): Promise<void> => { const button = page.locator(selector); if (mobile) await button.tap(); else await button.click(); };
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  expect((await snapshot(page)).mode).toBe('map'); await expect(page.locator('#welcome')).toBeHidden();
  await page.screenshot({ path: `output/testing/navigation-map-${mobile ? 'mobile' : 'desktop'}.png` });
  await expect(page.getByRole('button', { name: 'Resume exploring', exact: true })).toBeVisible();
  const startButton = (await page.locator('#start-exploring').boundingBox())!;
  expect(startButton.height).toBeGreaterThanOrEqual(60); expect(startButton.y + startButton.height).toBeLessThan(mobile ? 844 : 800);
  await activate('#start-exploring'); expect((await snapshot(page)).mode).toBe('walking');
  await page.evaluate(() => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(0, 44, .6));
  const before = await snapshot(page);
  await activate('[data-action="journal"]'); await expect(page.locator('#journal')).toBeVisible();
  await expect(page.locator('.journal-item:disabled')).toHaveCount(0);
  await activate('[data-discovery="artifactor"]'); await expect(page.locator('#lore-title')).toHaveText('The Artifactor & the Herbalist');
  expect((await snapshot(page)).progress.discovered).toContain('artifactor'); expect((await snapshot(page)).progress.visited).not.toContain('city-hall');
  await activate('#lore .close-button'); await expect(page.locator('#journal')).toBeVisible();
  await activate('[data-action="pause"]'); await expect(page.locator('#pause')).toBeVisible(); await expect(page.locator('#journal')).toBeHidden();
  await page.locator('#quality').selectOption('low');
  await page.screenshot({ path: `output/testing/navigation-menu-${mobile ? 'mobile' : 'desktop'}.png` });
  await activate('#view-toggle'); await expect(page.locator('#pause')).toBeHidden(); expect((await snapshot(page)).mode).toBe('map');
  await activate('[data-action="journal"]'); await activate('[data-action="catalogue"]');
  await expect(page.locator('#gallery')).toBeVisible(); await page.locator('.piece-card').first()[mobile ? 'tap' : 'click']();
  await expect(page.locator('#photo-viewer')).toBeVisible();
  await activate('[data-action="pause"]'); await expect(page.locator('#gallery')).toBeHidden();
  await activate('[data-action="open-map"]'); expect((await snapshot(page)).mode).toBe('map');
  await activate('[data-action="journal"]'); await activate('[data-action="catalogue"]');
  await activate('#view-toggle'); expect((await snapshot(page)).mode).toBe('walking'); await expect(page.locator('#gallery')).toBeHidden();
  const after = await snapshot(page);
  expect(after.position.x).toBeCloseTo(before.position.x, 3); expect(after.position.z).toBeCloseTo(before.position.z, 3); expect(after.yaw).toBe(before.yaw); expect(after.pitch).toBe(before.pitch);
  await activate('[data-action="pause"]'); await activate('[data-action="pause"]'); await expect(page.locator('#pause')).toBeHidden();
  await activate('[data-action="pause"]');
  if (mobile) await page.touchscreen.tap(5, 350); else await page.mouse.click(5, 350);
  await expect(page.locator('#pause')).toBeHidden(); expect((await snapshot(page)).mode).toBe('walking');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull(); expect(errors).toEqual([]);
  await context.close();
});

test('keyboard can activate navigation and leave a gallery without a close-first step', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('#view-toggle').focus(); await page.keyboard.press('Space'); expect((await snapshot(page)).mode).toBe('walking');
  await page.keyboard.press('Tab'); await expect(page.locator('#view-toggle')).toBeFocused();
  await page.keyboard.press('Space'); expect((await snapshot(page)).mode).toBe('map');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(page.locator('#journal')).toBeVisible();
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('[data-action="pause"]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#pause')).toBeVisible();
  await page.keyboard.press('Escape'); expect((await snapshot(page)).mode).toBe('map');
  await page.getByRole('button', { name: 'Open discovery journal' }).click(); await page.getByRole('button', { name: 'Browse the jewelry catalogue' }).click();
  await page.keyboard.press('KeyM'); expect((await snapshot(page)).mode).toBe('walking');
  await page.keyboard.press('KeyM'); expect((await snapshot(page)).mode).toBe('map');
});
