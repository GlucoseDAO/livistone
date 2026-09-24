import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`nearby ring and Nut stories have working buttons (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  try {
    await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    await expect(page.locator('#nearby-title')).toHaveText('Embryo Ring');
    await expect(page.locator('#nearby-sentence')).toContainText('raw amber and silver');
    if (mobile) {
      await expect(page.locator('#place-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#nearby-story')).toBeHidden();
      expect((await page.locator('.place-card').boundingBox())!.height).toBeLessThan(90);
      expect((await page.locator('.place-card').boundingBox())!.width).toBeLessThan(250);
      await expect(page.locator('#place-toggle')).toHaveAttribute('aria-label', 'Expand nearby panel');
      await expect(page.locator('#place-toggle svg')).toBeVisible();
      await page.screenshot({ path: 'output/testing/nearby/arrival-mobile-folded.png' });
      await page.locator('#place-toggle').tap();
      await expect(page.locator('#nearby-story')).toBeVisible();
      expect((await page.locator('.place-card').boundingBox())!.height).toBeLessThanOrEqual(844 * .32 + 1);
      await page.locator('#place-toggle').tap();
      await expect(page.locator('#nearby-story')).toBeHidden();
      await page.locator('#place-toggle').tap();
    } else {
      await expect(page.locator('#place-toggle')).toHaveAttribute('aria-expanded', 'true');
      await page.locator('#place-toggle').click(); await expect(page.locator('#nearby-story')).toBeHidden();
      expect((await page.locator('.place-card').boundingBox())!.height).toBeLessThan(110);
      expect((await page.locator('.place-card').boundingBox())!.width).toBeLessThan(250);
      await page.locator('#controls-toggle').click(); await expect(page.locator('#controls-details')).toBeHidden();
      expect((await page.locator('.controls-hint').boundingBox())!.width).toBeLessThan(60);
      await expect(page.locator('#controls-toggle')).toHaveAttribute('aria-label', 'Expand controls panel');
      await expect(page.locator('#controls-toggle svg')).toBeVisible();
      await page.locator('#controls-toggle').click(); await expect(page.locator('#controls-details')).toBeVisible();
      await page.locator('#place-toggle').click();
    }
    await page.screenshot({ path: `output/testing/nearby/arrival-${mobile ? 'mobile' : 'desktop'}.png` });
    // The desktop E hint is now a genuine button, not decorative keyboard text.
    if (mobile) await page.locator('#nearby-read').tap(); else await page.locator('#discover-control kbd').click();
    await expect(page.locator('#lore-title')).toHaveText('A departure, a beginning');
    await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
    if (mobile) await page.locator('#place-toggle').tap();
    await page.evaluate(() => (window as any).__livistone.teleport(0, 10, Math.PI));
    // Proximity works even when facing away from the building.
    await expect(page.locator('#nearby-title')).toHaveText('The Nut of Power');
    await expect(page.locator('#nearby-sentence')).toContainText('In Livia Lore');
    await page.screenshot({ path: `output/testing/nearby/nut-${mobile ? 'mobile-folded' : 'desktop-expanded'}.png` });
    if (mobile) { await expect(page.locator('#nearby-story')).toBeHidden(); await expect(page.locator('#nearby-preview')).toHaveText('The Nut of Power'); await page.locator('#place-toggle').tap(); }
    else { await page.locator('#place-toggle').click(); await expect(page.locator('#nearby-preview')).toHaveText('The Nut of Power'); await page.locator('#place-toggle').click(); }
    await page.locator('#nearby-read')[mobile ? 'tap' : 'click']();
    await expect(page.locator('#lore-title')).toHaveText('The Nut of Power');
    await expect(page.locator('#lore-body')).toContainText('supreme artifact');
    await page.getByRole('button', { name: 'Continue exploring', exact: true }).click();
    await page.keyboard.press('KeyE'); await expect(page.locator('#lore-title')).toHaveText('The Nut of Power');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test('short phone keeps Nut and controls clear of the scene', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    await page.evaluate(() => (window as any).__livistone.teleport(0, 10, Math.PI));
    await expect(page.locator('#nearby-preview')).toHaveText('The Nut of Power');
    const card = (await page.locator('.place-card').boundingBox())!;
    expect(card.y).toBeGreaterThan(568 * .5); expect(card.height).toBeLessThan(100);
    await expect(page.locator('.controls-hint')).toBeHidden();
    await expect(page.locator('.touch-jump')).toBeVisible();
    expect((await page.locator('#hud-sound').boundingBox())!.width).toBeLessThanOrEqual(44);
    await page.screenshot({ path: 'output/testing/nearby/nut-short-folded.png' });
    await page.locator('#place-toggle').tap();
    expect((await page.locator('.place-card').boundingBox())!.height).toBeLessThanOrEqual(568 * .32 + 1);
    await page.locator('#nearby-read').tap(); await expect(page.locator('#lore-title')).toHaveText('The Nut of Power');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
