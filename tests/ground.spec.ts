import { test, expect } from '@playwright/test';
import { GPU_ERROR } from './gpu-errors';

for (const mobile of [false, true]) test(`textured ground loads (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage(), errors: string[] = [], assets: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && GPU_ERROR.test(m.text())) errors.push(m.text()); });
  page.on('response', r => { if (r.url().includes('/textures/ground/')) { assets.push(r.url()); expect(r.ok()).toBe(true); } });
  try {
    await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    const reduced = await page.evaluate(() => (window as any).__livistone.snapshot().reducedGraphics);
    // Three layers, each an albedo plus a packed normal/roughness/height map (gpu 1024 + 512, reduced 512 + 256).
    const layers = assets.filter(url => !url.includes('/gravel-'));
    expect(layers.filter(url => url.includes(`-albedo-${reduced ? 512 : 1024}.webp`))).toHaveLength(3);
    expect(layers.filter(url => url.includes(`-nrh-${reduced ? 256 : 512}.webp`))).toHaveLength(3);
    // Sub-plan 14's shore layer adds the gravel scan at one size on gpu and mobile.
    expect(assets.filter(url => url.includes('/gravel-')).map(url => url.slice(url.lastIndexOf('/') + 1)).sort()).toEqual(['gravel-albedo-512.webp', 'gravel-nrh-256.webp']);
    await page.evaluate(() => (window as any).__livistone.teleport(10, 52, -.9));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `output/testing/ground-${mobile ? 'mobile' : 'desktop'}.png` });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
