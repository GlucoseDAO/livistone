import { expect, test } from '@playwright/test';

for (const touch of [false, true]) test(`walk beneath the gateway and render its materials (${touch ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 }, isMobile: touch, hasTouch: touch });
  try {
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && /Shader|WebGLProgram/.test(m.text())) errors.push(m.text()); });
    await page.goto('/'); await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 }); await page.locator('#enter').click();
    const snapshot = () => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { mode: string; position: { x: number; y: number; z: number } } } }).__livistone.snapshot());
    await expect.poll(async () => (await snapshot()).mode).toBe('walking'); expect((await snapshot()).position.z).toBeCloseTo(52);
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
    expect(Math.abs((await snapshot()).position.x)).toBeLessThan(.2); expect((await snapshot()).position.y).toBeGreaterThan(.8); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
