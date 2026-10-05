import { test, expect } from '@playwright/test';

test('persistent navigation, stable map anchors and the connected concept rotunda', async ({ page }) => {
  // WebGL's first shader compilation can take over two minutes on Windows.
  test.setTimeout(process.env.LIVISTONE_BACKEND === 'webgl' ? 360000 : 240000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/');
  await expect(page.locator('#hud-graphics')).toBeEnabled({ timeout: process.env.LIVISTONE_BACKEND === 'webgl' ? 240000 : 120000 });
  await page.locator('#world').focus(); await page.mouse.move(500, 500);
  await expect(page.locator('#tools')).toHaveJSProperty('inert', false);
  await expect(page.locator('#navigation-tab')).toHaveCount(0);
  await page.locator('#view-toggle').click();
  const marker = page.locator('#marker-city-hall'); await expect(marker).toBeVisible();
  // The first map projection is written on the next rendered frame, after the buttons become visible.
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('.map-marker')].every(n => n.style.left !== ''));
  const positions = () => page.locator('.map-marker').evaluateAll(nodes => nodes.map(n => ({ left: (n as HTMLElement).style.left, top: (n as HTMLElement).style.top })));
  const before = await positions(); await marker.hover(); await page.waitForTimeout(700); expect(await positions()).toEqual(before);
  expect((await marker.boundingBox())!.width).toBeLessThanOrEqual(44);
  await page.screenshot({ path: 'output/testing/owner-map.png' });
  await page.locator('#view-toggle').click();
  await page.evaluate(() => {
    const hook = (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone;
    hook.teleport(115, -36, -Math.PI / 2);
  });
  await page.locator('#world').focus(); await page.keyboard.down('KeyW');
  try { await page.waitForFunction(() => (window as unknown as { __livistone: { snapshot(): { position: { x: number } } } }).__livistone.snapshot().position.x > 128, null, { timeout: 30000 }); }
  finally { await page.keyboard.up('KeyW'); }
  const position = await page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { position: { x: number; y: number } } } }).__livistone.snapshot().position);
  expect(position.x).toBeGreaterThan(125); expect(position.y).toBeGreaterThan(.9); expect(position.y).toBeLessThan(1.5);
  await page.screenshot({ path: 'output/testing/owner-rotunda-ui.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#performance')).toHaveValue('auto');
  await page.locator('#performance').selectOption('light');
  await expect(page.locator('#hud-graphics')).toBeEnabled({ timeout: 120000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#performance')).toHaveValue('light');
  await expect(page.locator('#graphics-profile')).toContainText('Lightweight');
  expect(errors).toEqual([]);
});
