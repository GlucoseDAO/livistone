import { test, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import { GARDENS } from '../src/world/living-waters-layout';
interface Snapshot { mode: string; zone: string; journey: string | null; position: { x: number; y: number; z: number }; yaw: number; progress: { discovered: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0) => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });
async function board(page: Page, context: BrowserContext, offset: number, mobile: boolean): Promise<void> {
  await teleport(page, offset - 14, -73);
  if (mobile) {
    const box = (await page.locator('#joystick').boundingBox())!, cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + 10, id: 0 }] });
    await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 15000 }).toBeLessThan(-78.6);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  } else {
    await page.keyboard.down('KeyW'); await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 15000 }).toBeLessThan(-78.6); await page.keyboard.up('KeyW');
  }
  await expect(page.locator('#interact')).toContainText(offset ? 'Return to Embryo Station' : 'Travel to Living Waters');
}
for (const mobile of [false, true]) test(`outbound and return journey, map pause, garden stories (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message)); page.on('console', (message) => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').click();
    await board(page, context, 0, mobile); const outboundCabin = await snapshot(page); await page.locator('#interact').click(); await expect.poll(async () => (await snapshot(page)).mode).toBe('travel');
    await page.locator('#view-toggle').click(); await expect.poll(async () => (await snapshot(page)).mode).toBe('map'); const frozen = await snapshot(page);
    await page.waitForTimeout(650); expect((await snapshot(page)).position).toEqual(frozen.position); expect((await snapshot(page)).yaw).toBe(frozen.yaw);
    await page.locator('#view-toggle').click(); await expect.poll(async () => (await snapshot(page)).zone, { timeout: 45000 }).toBe('gardens');
    await expect.poll(async () => (await snapshot(page)).mode, { timeout: 30000 }).toBe('walking');
    expect((await snapshot(page)).position.x).toBeCloseTo(GARDENS.x + outboundCabin.position.x, 1);
    for (const [id, x, z, title] of [['living-vittoria', -16, -45, 'Vittoria’s water eyes'], ['living-dewdrop', -13, 1.5, 'Two stones, one pavilion'], ['living-mycelium', 70, -20, 'A crown that lets water go']] as const) {
      await teleport(page, GARDENS.x + x, z); await expect(page.locator('#interact')).toContainText(title); await page.locator('#interact').click(); await expect(page.locator('#lore-title')).toHaveText(title);
      if (id === 'living-dewdrop') await expect(page.locator('#lore-body')).toContainText('treated Swiss blue topaz'); await page.getByRole('button', { name: 'Continue exploring' }).click();
    }
    await teleport(page, GARDENS.x - 10, -38, Math.PI); await page.waitForTimeout(650); await page.screenshot({ path: `output/testing/gardens/lake-${mobile ? 'mobile' : 'desktop'}.png` });
    await teleport(page, GARDENS.x + 74, -28, Math.PI); await page.waitForTimeout(650); await page.screenshot({ path: `output/testing/gardens/rain-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.locator('#view-toggle').click(); await page.waitForTimeout(650); await page.screenshot({ path: `output/testing/gardens/aerial-${mobile ? 'mobile' : 'desktop'}.png` }); await page.locator('#view-toggle').click();
    await board(page, context, GARDENS.x, mobile); const returnCabin = await snapshot(page); await page.locator('#interact').click();
    await expect.poll(async () => (await snapshot(page)).zone, { timeout: 35000 }).toBe('town'); await expect.poll(async () => (await snapshot(page)).mode, { timeout: 30000 }).toBe('walking');
    expect((await snapshot(page)).position.x).toBeCloseTo(returnCabin.position.x - GARDENS.x, 1); await page.reload(); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
    expect((await snapshot(page)).zone).toBe('town'); expect((await snapshot(page)).progress.discovered).toContain('living-dewdrop'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('failed destination assets leave the passenger safe and retryable at Embryo Station', async ({ page, context }) => {
  test.setTimeout(120000);
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').click();
  await board(page, context, 0, false); const before = await snapshot(page);
  await page.route('**/models/trees/*.glb', (route) => route.abort()); await page.locator('#interact').click();
  await expect(page.locator('#toast')).toContainText('could not load', { timeout: 30000 });
  const failed = await snapshot(page); expect(failed.zone).toBe('town'); expect(failed.mode).toBe('walking'); expect(failed.journey).toBeNull();
  expect(failed.position.x).toBeCloseTo(before.position.x, 1); expect(failed.position.z).toBeCloseTo(before.position.z, 1);
  await page.unroute('**/models/trees/*.glb'); await expect(page.locator('#interact')).toContainText('Travel to Living Waters'); await page.locator('#interact').click();
  await expect.poll(async () => (await snapshot(page)).zone, { timeout: 45000 }).toBe('gardens'); await expect.poll(async () => (await snapshot(page)).mode, { timeout: 30000 }).toBe('walking');
  await page.getByRole('button', { name: 'Open menu' }).click(); await page.locator('[data-action="reset-position"]').click();
  expect((await snapshot(page)).zone).toBe('town'); expect((await snapshot(page)).position.z).toBeGreaterThan(50);
});
