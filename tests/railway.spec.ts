import { expect, test } from '@playwright/test';

for (const mobile of [false, true]) test(`textured railway and mountain passage render and remain traversable on ${mobile ? 'touch' : 'desktop'}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage(), errors: string[] = [], textures = new Set<string>();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    page.on('response', (response) => { if (response.url().includes('/textures/railway/') && response.ok()) textures.add(response.url().split('/').at(-1)!); });
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').click();
    for (const name of ['ballast', 'rail']) for (const suffix of mobile ? ['color', 'roughness'] : ['color', 'normal', 'roughness']) expect(textures.has(`${name}-${suffix}.jpg`)).toBe(true);
    await page.evaluate(() => (window as any).__livistone.teleport(99, -79, -Math.PI / 2));
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
    await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().position.x), { timeout: 15000 }).toBeGreaterThan(124);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await expect(page.locator('#location')).toHaveText('Dark Nut Mountain Passage');
    const before = await page.evaluate(() => (window as any).__livistone.snapshot()); expect(before.position.y).toBeGreaterThan(.8);
    await page.screenshot({ path: `output/testing/railway/passage-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.getByRole('button', { name: 'Top view' }).click(); await page.getByRole('button', { name: 'First person' }).click();
    const after = await page.evaluate(() => (window as any).__livistone.snapshot()); expect(after.position.x).toBeCloseTo(before.position.x, 2); expect(after.position.z).toBeCloseTo(before.position.z, 2);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('missing railway maps preserve a playable passage', async ({ page }) => {
  await page.route('**/textures/railway/**', (route) => route.abort());
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.click('#view-toggle');
  await page.evaluate(() => (window as any).__livistone.teleport(-180, -79, Math.PI / 2));
  await expect(page.locator('#location')).toHaveText('Dark Nut Mountain Passage');
  await page.keyboard.down('KeyW'); await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().position.x)).toBeLessThan(-182); await page.keyboard.up('KeyW');
});

for (const mobile of [false, true]) test(`boards the parked maglev and returns to the concourse (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile });
  try {
    const page = await context.newPage(); await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.click('#view-toggle');
    await page.evaluate(() => (window as any).__livistone.teleport(-14, -72.7, 0));
    await page.keyboard.down('KeyW');
    await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().position.z)).toBeLessThan(-78.2);
    await page.keyboard.up('KeyW'); await page.screenshot({ path: `output/testing/railway/boarding-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.down('KeyS');
    await expect.poll(() => page.evaluate(() => (window as any).__livistone.snapshot().position.z)).toBeGreaterThan(-73);
    await page.keyboard.up('KeyS');
  } finally { await context.close(); }
});
