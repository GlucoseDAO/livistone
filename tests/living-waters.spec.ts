import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { GARDENS } from '../src/world/living-waters-layout';
interface Snapshot { mode: string; zone: string; journey: string | null; position: { x: number; y: number; z: number }; yaw: number; progress: { discovered: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0) => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });
for (const mobile of [false, true]) test(`integrated garden stories, walking and map preservation (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
    for (const id of ['station', 'city-hall', 'living-waters', 'mycelium-garden']) expect(await page.locator('#marker-' + id).evaluate(e => e.hasAttribute('hidden'))).toBe(false);
    await page.locator('#view-toggle').click();
    for (const [id, x, z, title] of [['living-vittoria', -16, -49, 'Vittoria’s water eyes'], ['living-dewdrop', -13, 1.5, 'Two stones, one pavilion'], ['living-mycelium', 70, -20, 'A crown that lets water go']] as const) {
      await teleport(page, GARDENS.x + x, GARDENS.z + z); await expect(page.locator('#interact')).toContainText(title); await page.locator('#interact').click(); await expect(page.locator('#lore-title')).toHaveText(title);
      if (id === 'living-dewdrop') await expect(page.locator('#lore-body')).toContainText('treated Swiss blue topaz'); await page.getByRole('button', { name: 'Continue exploring' }).click();
    }
    await teleport(page, GARDENS.x + 74, GARDENS.z - 28, Math.PI); await page.waitForTimeout(400); await page.screenshot({ path: `output/testing/gardens/mycelium-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#view-toggle').click(); await page.screenshot({ path: `output/testing/gardens/unified-map-${mobile ? 'mobile' : 'desktop'}.png` }); await page.locator('#view-toggle').click();
    const before = await snapshot(page); await page.locator('#view-toggle').click(); await page.locator('#start-exploring').click();
    const after = await snapshot(page); expect(after.zone).toBe('town'); expect(after.journey).toBeNull(); expect(after.position).toEqual(before.position); expect(after.yaw).toBe(before.yaw);
    await page.reload(); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); expect((await snapshot(page)).zone).toBe('town'); expect((await snapshot(page)).progress.discovered).toContain('living-dewdrop'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('walk from the civic gardens into the lake without travel or a scene switch', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#start-exploring').click();
  await teleport(page, -23, -54, -.18); await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(-78); await page.keyboard.up('KeyW');
  const arrived = await snapshot(page); expect(arrived.zone).toBe('town'); expect(arrived.journey).toBeNull(); expect(arrived.position.y).toBeGreaterThan(.55);
  await page.locator('#view-toggle').click(); for (const id of ['city-hall', 'station', 'living-waters', 'mycelium-garden']) expect(await page.locator('#marker-' + id).evaluate(e => e.hasAttribute('hidden'))).toBe(false);
  await page.locator('#view-toggle').click(); expect((await snapshot(page)).position.x).toBeCloseTo(arrived.position.x); expect((await snapshot(page)).position.z).toBeCloseTo(arrived.position.z);
});
