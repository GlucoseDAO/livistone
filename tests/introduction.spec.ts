import { test, expect } from '@playwright/test';
import { SPAWN } from '../src/game/content';
import { TOWN_INTRO } from '../src/game/introduction';
import { INTRODUCTION_SITE } from '../src/world/introduction-layout';

for (const mobile of [false, true]) test(`loading introduction and first-person arrival (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  // Hold the game module to verify that the introduction is visible before the heavy startup.
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/src/main.ts', async route => { await held; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#loading-title')).toHaveText(TOWN_INTRO.title);
    await expect(page.locator('.loading-story')).toContainText(TOWN_INTRO.body);
    await expect(page.locator('.loading-story')).toContainText(TOWN_INTRO.music);
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.locator('.loading-portrait img')).toBeVisible();
    const portrait = (await page.locator('.loading-portrait img').boundingBox())!, bar = (await page.getByRole('progressbar').boundingBox())!;
    expect(portrait.width).toBeCloseTo(bar.width); expect(portrait.y).toBeGreaterThan(bar.y + bar.height);
    await expect(page.locator('.loading-portrait img')).toHaveJSProperty('naturalWidth', 1536, { timeout: 15000 });
    await page.screenshot({ path: `output/testing/introduction/loading-${mobile ? 'mobile' : 'desktop'}.png` });
    release();
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    const state = await page.evaluate(() => (window as any).__livistone.snapshot());
    expect(state.mode).toBe('walking'); expect(state.position.x).toBeCloseTo(SPAWN.x); expect(state.position.z).toBeCloseTo(SPAWN.z); expect(state.yaw).toBe(SPAWN.yaw);
    await expect(page.locator('#welcome')).toBeHidden();
    await page.screenshot({ path: `output/testing/introduction/arrival-${mobile ? 'mobile' : 'desktop'}.png` });
    const site = INTRODUCTION_SITE;
    await page.evaluate(({ x, z, yaw }) => (window as any).__livistone.teleport(x + Math.sin(yaw) * 3, z + Math.cos(yaw) * 3, yaw), site);
    await expect(page.locator('#interact')).toContainText('Livia & Livistone');
    await page.screenshot({ path: `output/testing/introduction/poster-${mobile ? 'mobile' : 'desktop'}.png` });
    // The poster itself, including its lower area at eye height, opens the readable story.
    if (mobile) await page.touchscreen.tap(195, 422); else await page.mouse.click(640, 400);
    await expect(page.locator('#lore-title')).toHaveText('Livia & Livistone');
    await expect(page.locator('#lore-body')).toContainText(TOWN_INTRO.music);
    await page.getByRole('button', { name: 'Map', exact: true }).click(); await expect(page.locator('#map-panel')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { release(); await context.close(); }
});
