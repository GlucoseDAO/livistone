import { expect, test } from '@playwright/test';
import { WINTER_POSTER } from '../src/world/winter-gate-layout';
import { EYELENSE_POSTER } from '../src/world/eyelense-gate-layout';
import { GPU_ERROR, EXPECTED_BACKEND } from './gpu-errors';

test('source photographs at both eye gates open the full viewer and building captions', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && GPU_ERROR.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?graphics=mobile&probes=off' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.locator('#hud-teleport')).toBeEnabled({ timeout: 90000 });
  // Both gates are distant parts built after the first view: their floors and boards must exist before standingHeight and clicks.
  await expect.poll(() => page.evaluate(() => { const { parts } = (window as any).__livistone.snapshot(); return parts.waiting === 0 && parts.built === parts.shown; }), { timeout: 120000 }).toBe(true);
  for (const [p, piece, story] of [[WINTER_POSTER, 'eye-of-winter', 'Inside the Eye of Winter'], [EYELENSE_POSTER, 'eyelense', 'Through the broken lens']] as const) {
    const frames = await page.evaluate(() => (window as any).__livistone.snapshot().frames);
    await page.evaluate(p => {
      const h = (window as any).__livistone, x = p.x + Math.sin(p.yaw) * 4.5, z = p.z + Math.cos(p.yaw) * 4.5;
      h.teleport(x, z, p.yaw, h.standingHeight(x, z), .08);
    }, p);
    await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().frames)).toBeGreaterThan(frames + 3);
    // The source photograph occupies the upper half of the board centred ahead of this fixed camera.
    await page.mouse.click(600, 190);
    await expect(page.locator('#photo-viewer')).toBeVisible();
    await expect(page.locator('#viewer-image')).toHaveAttribute('src', new RegExp(piece));
    await expect.poll(() => page.locator('#viewer-image').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.getByRole('button', { name: 'Close gallery', exact: true }).click();
    await page.mouse.click(600, 410);
    await expect(page.getByRole('heading', { name: story, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().mode)).toBe('walking');
  }
  expect(await page.evaluate(() => (window as any).__livistone.snapshot().backend)).toBe(EXPECTED_BACKEND);
  expect(errors).toEqual([]);
});
