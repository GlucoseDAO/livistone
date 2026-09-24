import { expect, test } from '@playwright/test';
import { SPAWN } from '../src/game/content';
import { GATEWAY_POSTER } from '../src/world/gateway-layout';

for (const touch of [false, true]) test(`walk beneath the gateway and render its materials (${touch ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: touch, hasTouch: touch });
  try {
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && /Shader|WebGLProgram/.test(m.text())) errors.push(m.text()); });
    await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.locator('#view-toggle').click();
    const snapshot = () => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { mode: string; position: { x: number; y: number; z: number } } } }).__livistone.snapshot());
    await expect.poll(async () => (await snapshot()).mode).toBe('walking'); expect((await snapshot()).position.z).toBeCloseTo(SPAWN.z);
    await page.waitForTimeout(400); await page.screenshot({ path: `output/testing/gateway/arrival-${touch ? 'mobile' : 'desktop'}.png` });
    if (!touch) {
      for (const quality of ['low', 'high']) {
        await page.keyboard.press('Escape'); await page.locator('#quality').selectOption(quality); await page.getByRole('button', { name: 'Continue exploring' }).click();
        await page.waitForTimeout(400); await page.screenshot({ path: `output/testing/gateway/quality-${quality}.png` });
      }
      await page.keyboard.down('KeyW');
      await expect.poll(async () => (await snapshot()).position.z, { timeout: 25000 }).toBeLessThan(38); await page.keyboard.up('KeyW');
    } else {
      const box = (await page.locator('#joystick').boundingBox())!, cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + 15, id: 0 }] });
      await expect.poll(async () => (await snapshot()).position.z, { timeout: 30000 }).toBeLessThan(38);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    expect(Math.abs((await snapshot()).position.x - SPAWN.x)).toBeLessThan(.5); expect((await snapshot()).position.y).toBeGreaterThan(.8); expect(errors).toEqual([]);
    await page.evaluate(({ x, z }) => (window as any).__livistone.teleport(x, z + 3, 0), GATEWAY_POSTER);
    await expect(page.locator('#interact')).toContainText("King's Chapel Double Ring");
    await page.screenshot({ path: `output/testing/gateway/poster-${touch ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('KeyE'); await expect(page.locator('#lore-title')).toHaveText("King's Chapel Double Ring");
    await expect(page.locator('#exhibit-catalogue')).toContainText('Silver, enhanced tourmaline');
    await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
    if (touch) await page.touchscreen.tap(195, 250); else await page.mouse.click(700, 260);
    await expect(page.locator('#viewer-image')).toBeVisible();
  } finally { await context.close(); }
});
