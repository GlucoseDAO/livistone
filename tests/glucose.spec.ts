import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { GLUCOSE_PAVILION as SITE, GLUCOSE_POSTERS } from '../src/world/glucose-layout';
import { RESEARCH_POSTERS } from '../src/game/research';
interface Snapshot { mode: string; position: { x: number; y: number; z: number }; yaw: number; progress: { discovered: string[]; visited: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0): Promise<void> => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });
for (const mobile of [false, true]) test(`Glucose Commons posters, sources, map and persistence (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').click();
    await teleport(page, SITE.x, SITE.z + 17); await page.waitForTimeout(700);
    if (!mobile) { await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 300); await page.mouse.up(); await page.screenshot({ path: 'output/testing/glucose/exterior.png' }); }
    for (let i = 0; i < GLUCOSE_POSTERS.length; i++) {
      const panel = GLUCOSE_POSTERS[i], x = SITE.x + (panel.x - SITE.x) * .67, z = SITE.z + (panel.z - SITE.z) * .67;
      await teleport(page, x, z, panel.yaw); await expect(page.locator('#interact')).toContainText(RESEARCH_POSTERS[i].title);
      if (!mobile && i === 0) await page.screenshot({ path: 'output/testing/glucose/poster.png' });
      if (mobile) await page.locator('#interact').tap(); else if (i === 1) await page.mouse.click(640, 400); else await page.keyboard.press('KeyE');
      await expect(page.locator('#lore-title')).toHaveText(RESEARCH_POSTERS[i].title);
      for (const link of RESEARCH_POSTERS[i].links!) { const anchor = page.locator('#research-sources').getByRole('link', { name: link.label }); await expect(anchor).toHaveAttribute('href', link.url); await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer'); }
      expect(await page.locator('#lore').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (i === 0) { await page.waitForTimeout(550); await page.screenshot({ path: `output/testing/glucose/sources-${mobile ? 'mobile' : 'desktop'}.png` }); }
      await page.getByRole('button', { name: 'Continue exploring' }).click();
    }
    const before = await snapshot(page); await page.getByRole('button', { name: 'Top view' }).click();
    await page.screenshot({ path: `output/testing/glucose/map-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.getByRole('button', { name: 'First person' }).click(); const after = await snapshot(page);
    expect(after.position.x).toBeCloseTo(before.position.x, 2); expect(after.position.z).toBeCloseTo(before.position.z, 2); expect(after.yaw).toBe(before.yaw);
    await page.reload(); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
    expect((await snapshot(page)).progress.discovered).toEqual(expect.arrayContaining(RESEARCH_POSTERS.map((p) => p.id)));
    expect((await snapshot(page)).progress.visited).toContain('glucose'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
