import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LANDMARKS } from '../src/game/content';

interface Snapshot { mode: string; zone: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number; journey: string | null; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());

for (const mobile of [false, true]) test(`map labels arrive outside walkable entrances (${mobile ? 'touch' : 'desktop'})`, async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1200, height: 800 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(), errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
    for (const id of ['glucose', 'city-hall', 'energy', 'science', 'station', 'living-waters', 'mycelium-garden', 'city-hall']) {
      const landmark = LANDMARKS.find((place) => place.id === id)!, arrival = landmark.entrance;
      const label = page.locator(!mobile && id === 'glucose' ? '#marker-glucose' : `.landmark-item[data-action="landmark:${id}"]`);
      if (mobile) await label.tap(); else await label.click();
      await expect.poll(async () => (await snapshot(page)).mode, { timeout: 30000 }).toBe('walking');
      const arrived = await snapshot(page);
      expect(arrived.zone).toBe(landmark.zone ?? 'town'); expect(arrived.journey).toBeNull();
      expect(arrived.position.x).toBeCloseTo(arrival.x, 2); expect(arrived.position.z).toBeCloseTo(arrival.z, 2);
      expect(arrived.yaw).toBe(arrival.yaw); expect(arrived.pitch).toBe(0);
      if (id === 'glucose') await page.screenshot({ path: `output/testing/arrival-glucose-${mobile ? 'mobile' : 'desktop'}.png` });
      // Walk forward from the actual arrival; catches points inside walls, plants or floors.
      const distance = async (): Promise<number> => { const state = await snapshot(page); return Math.hypot(state.position.x - arrival.x, state.position.z - arrival.z); };
      if (mobile) {
        const box = (await page.locator('#joystick').boundingBox())!, cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + 10, id: 0 }] });
        await expect.poll(distance, { timeout: 15000 }).toBeGreaterThan(6);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      } else {
        await page.keyboard.down('KeyW'); await expect.poll(distance, { timeout: 15000 }).toBeGreaterThan(6); await page.keyboard.up('KeyW');
      }
      expect((await snapshot(page)).position.y).toBeGreaterThan(.55);
      const before = await snapshot(page); await page.locator('#view-toggle').click();
      await expect(page.getByRole('button', { name: 'Resume exploring', exact: true })).toBeVisible();
      await page.locator('#start-exploring').click();
      const resumed = await snapshot(page); expect(resumed.position.x).toBeCloseTo(before.position.x, 2); expect(resumed.position.z).toBeCloseTo(before.position.z, 2); expect(resumed.yaw).toBe(before.yaw);
      await page.locator('#view-toggle').click();
    }
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  } finally { await context.close(); }
});

test('garden navigation uses the already loaded town even when later asset requests are blocked', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 });
  await page.route('**/models/trees/*.glb', route => route.abort());
  await page.locator('.landmark-item[data-action="landmark:living-waters"]').click();
  const arrived = await snapshot(page); expect(arrived.mode).toBe('walking'); expect(arrived.zone).toBe('town');
  expect(arrived.position.z).toBeCloseTo(LANDMARKS.find(l => l.id === 'living-waters')!.entrance.z);
});
