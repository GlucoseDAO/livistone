import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`nearby ring and Nut stories have working buttons (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  try {
    await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    await expect(page.locator('#nearby-title')).toHaveText('King’s Chapel Double Ring');
    await expect(page.locator('#nearby-sentence')).toContainText('two-finger silver ring');
    await page.screenshot({ path: `output/testing/nearby/arrival-${mobile ? 'mobile' : 'desktop'}.png` });
    // The desktop E hint is now a genuine button, not decorative keyboard text.
    if (mobile) await page.locator('#nearby-read').tap(); else await page.locator('#discover-control kbd').click();
    await expect(page.locator('#lore-title')).toHaveText("King's Chapel Double Ring");
    await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
    await page.evaluate(() => (window as any).__livistone.teleport(0, 10, Math.PI));
    // Proximity works even when facing away from the building.
    await expect(page.locator('#nearby-title')).toHaveText('The Nut of Power');
    await expect(page.locator('#nearby-sentence')).toContainText('In Livia Lore');
    await page.locator('#nearby-read')[mobile ? 'tap' : 'click']();
    await expect(page.locator('#lore-title')).toHaveText('The Nut of Power');
    await expect(page.locator('#lore-body')).toContainText('supreme artifact');
    await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
    await page.keyboard.press('KeyE'); await expect(page.locator('#lore-title')).toHaveText('The Nut of Power');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
