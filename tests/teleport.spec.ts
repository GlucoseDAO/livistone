import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LANDMARKS } from '../src/game/content';

interface Snapshot { mode: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());

for (const touch of [false, true]) test(`teleport dropdown preserves views and reaches every entrance (${touch ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  const page = await context.newPage(), emulation = touch ? await context.newCDPSession(page) : null, errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const activate = async (selector: string): Promise<void> => { await page.locator(selector)[touch ? 'tap' : 'click'](); };
  try {
    await page.goto('/'); await expect(page.locator('#hud-teleport')).toBeEnabled({ timeout: 90000 });
    const before = await snapshot(page);
    await activate('#hud-teleport'); await expect(page.locator('#teleport-menu')).toBeVisible();
    await expect(page.locator('#hud-teleport')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.teleport-item')).toHaveCount(LANDMARKS.length);
    await expect(page.locator('.teleport-item').first()).toBeFocused();
    const opened = await snapshot(page); expect(opened.mode).toBe('teleport');
    expect(opened.position.x).toBeCloseTo(before.position.x, 3); expect(opened.position.z).toBeCloseTo(before.position.z, 3); expect(opened.yaw).toBe(before.yaw);
    expect(await page.locator('#world').evaluate(el => (el as HTMLElement).inert)).toBe(true);
    await page.keyboard.press('w'); await page.keyboard.press('ArrowRight');
    const paused = await snapshot(page); expect(paused.position).toEqual(opened.position); expect(paused.yaw).toBe(opened.yaw);
    await page.keyboard.press('End'); await expect(page.locator('.teleport-item').last()).toBeFocused();
    await page.keyboard.press('ArrowDown'); await expect(page.locator('.teleport-item').first()).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.locator('#teleport-menu')).toBeHidden();
    await expect(page.locator('#hud-teleport')).toBeFocused(); expect((await snapshot(page)).mode).toBe('walking');
    await expect(page.locator('#hud-teleport')).toHaveAttribute('aria-expanded', 'false');

    for (const width of touch ? [360, 390, 440, 650] : [651, 760, 820, 1280]) {
      await page.setViewportSize({ width, height: touch ? 844 : 800 });
      if (emulation) await emulation.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      for (const view of ['walking', 'map']) {
        if ((await snapshot(page)).mode !== view) await activate('#view-toggle');
        const teleport = (await page.locator('#hud-teleport').boundingBox())!, sound = (await page.locator('#hud-sound').boundingBox())!;
        expect(teleport.width).toBeCloseTo(sound.width, 3); expect(teleport.height).toBeCloseTo(sound.height, 3); expect(teleport.height).toBeGreaterThanOrEqual(44);
        expect(teleport.y).toBeCloseTo(sound.y, 3);
        const boxes = await page.locator('#tools > button').evaluateAll(buttons => buttons.map(button => { const b = button.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right }; }));
        for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); expect(box.y).toBeCloseTo(teleport.y, 3); }
        await activate('#hud-teleport');
        const menu = (await page.locator('#teleport-menu').boundingBox())!;
        expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(width); expect(menu.y + menu.height).toBeLessThanOrEqual(touch ? 844 : 800);
        await page.screenshot({ path: `output/testing/teleport-${width}-${view}.png` });
        await activate('#hud-teleport'); expect((await snapshot(page)).mode).toBe(view);
      }
    }
    // Cancelling the dropdown from the map preserves its view and the walking position.
    const mapPosition = (await snapshot(page)).position;
    await activate('#hud-teleport'); await page.locator('#scrim')[touch ? 'tap' : 'click']({ position: { x: 5, y: 350 } });
    expect((await snapshot(page)).mode).toBe('map'); expect((await snapshot(page)).position).toEqual(mapPosition);
    // The same shortcut remains reachable while another panel is open.
    await activate('[data-action="journal"]'); await activate('#hud-teleport'); await expect(page.locator('#journal')).toBeHidden();
    for (const landmark of LANDMARKS) {
      if ((await snapshot(page)).mode !== 'teleport') await activate('#hud-teleport');
      await activate(`#teleport-menu [data-action="landmark:${landmark.id}"]`);
      const arrived = await snapshot(page);
      expect(arrived.mode).toBe('walking'); expect(arrived.position.x).toBeCloseTo(landmark.entrance.x, 2); expect(arrived.position.z).toBeCloseTo(landmark.entrance.z, 2);
      expect(arrived.yaw).toBeCloseTo(landmark.entrance.yaw, 12); expect(arrived.pitch).toBe(0);
      await expect(page.locator('#teleport-menu')).toBeHidden(); await expect(page.locator('#world')).toBeFocused();
    }
    for (const panel of ['pause', 'journal']) {
      await activate(`[data-action="${panel}"]`);
      const link = page.locator(`#${panel} a.artist-link`);
      await expect(link).toBeVisible(); await expect(link).toHaveAttribute('href', 'https://liviazaharia.com/'); await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer'); await activate(`#${panel} .close-button`);
    }
    await activate('[data-action="journal"]'); await activate('[data-discovery="about-livistone"]');
    await expect(page.locator('#lore .research-sources a')).toHaveAttribute('href', 'https://liviazaharia.com/');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
