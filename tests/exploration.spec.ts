import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
interface Snapshot { ready: boolean; mode: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number; interaction: string | null; progress: { discovered: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0): Promise<void> => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });

test('explore City Hall, preserve position through map mode, and retain discoveries', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Enter Livistone' }).click();
  await page.waitForFunction(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot().mode === 'walking');
  // Entering and unpressed mouse movement must never capture or turn the camera.
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const initial = await snapshot(page);
  expect(initial.yaw).toBe(0); expect(initial.pitch).toBe(0);
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.down(key); await page.keyboard.up(key);
    expect((await snapshot(page)).yaw).toBe(initial.yaw);
    expect((await snapshot(page)).pitch).toBe(initial.pitch);
  }
  await page.mouse.move(650, 350); await page.mouse.move(750, 350, { steps: 4 });
  expect((await snapshot(page)).yaw).toBe(initial.yaw); expect((await snapshot(page)).pitch).toBe(initial.pitch);
  // Walking and turning at the same time must both take effect.
  await teleport(page, 0, -9);
  const start = await snapshot(page);
  await page.keyboard.down('ArrowUp'); await page.mouse.move(650, 350); await page.mouse.down(); await page.mouse.move(800, 350, { steps: 10 });
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(start.position.z - 0.8);
  await page.mouse.up(); await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).yaw).not.toBe(start.yaw);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  await page.getByRole('button', { name: 'Continue exploring' }).click();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Return to walking' }).click();
  await teleport(page, 0, -9);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(-18.2);
  await page.keyboard.up('KeyW');
  await expect(page.locator('#location')).toHaveText('City Hall');
  await expect(page.locator('#interact')).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: 'One Nut to connect them all' })).toBeVisible();
  await page.screenshot({ path: 'output/testing/city-hall-discovery.png' });
  await page.getByRole('button', { name: 'Continue exploring' }).click();
  const before = await snapshot(page);
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map-panel')).toBeVisible();
  await page.getByRole('button', { name: 'View Ministry of Science' }).click();
  await expect(page.locator('#map-description')).toContainText('intricate silver lattice');
  await page.screenshot({ path: 'output/testing/aerial-map-desktop.png' });
  await page.getByRole('button', { name: 'Return to walking' }).click();
  const after = await snapshot(page);
  expect(after.position.x).toBeCloseTo(before.position.x, 1); expect(after.position.z).toBeCloseTo(before.position.z, 1); expect(after.yaw).toBeCloseTo(before.yaw, 4);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  expect((await snapshot(page)).progress.discovered).toContain('nut');
  expect(errors).toEqual([]);
});

test('mobile layout, simultaneous touch look/movement, cancellation, and aerial map', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  await page.screenshot({ path: 'output/testing/welcome-mobile.png' });
  await page.getByRole('button', { name: 'Enter Livistone' }).tap();
  await expect(page.locator('#joystick')).toBeVisible();
  const before = await snapshot(page); const box = (await page.locator('#joystick').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const left = { x: box.x + box.width / 2, y: box.y + 15, id: 0 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, { x: 300, y: 350, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [left, { x: 330, y: 350, id: 1 }] });
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 6000 }).toBeLessThan(before.position.z - 0.3);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const stopped = await snapshot(page);
  expect(stopped.yaw).not.toBe(before.yaw);
  await page.getByRole('button', { name: 'City map' }).tap();
  await expect(page.getByRole('heading', { name: 'Find your wonder.' })).toBeVisible();
  await page.screenshot({ path: 'output/testing/aerial-map-mobile.png' });
  await page.getByRole('button', { name: 'Return to walking' }).tap();
  expect((await snapshot(page)).position.z).toBeCloseTo(stopped.position.z, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('WASD and arrows never change held-mouse rotation or enable unpressed rotation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => { throw new Error('Livistone must never request pointer lock'); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Enter Livistone' }).click();
  const rotations: { yaw: number; pitch: number }[] = [];
  for (const keys of [[], ['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['ArrowUp'], ['ArrowDown'], ['ArrowLeft'], ['ArrowRight'], ['ArrowUp', 'ArrowRight']]) {
    await teleport(page, 0, 44);
    await page.mouse.move(620, 350);
    const before = await snapshot(page);
    // Start the drag first: pressing a movement key must not forget a held button.
    await page.mouse.down(); await page.mouse.move(660, 340, { steps: 3 });
    for (const key of keys) await page.keyboard.down(key);
    await page.mouse.move(740, 320, { steps: 6 });
    if (keys.length) await expect.poll(async () => {
      const after = await snapshot(page); return Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z);
    }).toBeGreaterThan(.3);
    for (const key of keys) await page.keyboard.up(key);
    await page.mouse.move(780, 310, { steps: 3 }); await page.mouse.up();
    const turned = await snapshot(page); rotations.push({ yaw: turned.yaw, pitch: turned.pitch });
    expect(turned.yaw).toBeCloseTo(-160 * .0028, 5); expect(turned.pitch).toBeCloseTo(40 * .0028, 5);
    await page.keyboard.down('ArrowUp');
    await page.mouse.move(900, 380, { steps: 3 });
    await page.keyboard.up('ArrowUp');
    expect((await snapshot(page)).yaw).toBe(turned.yaw);
    expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  }
  for (const rotation of rotations) expect(rotation).toEqual(rotations[0]);
  // Losing browser pointer capture while the button is held must not lose the drag.
  await teleport(page, 0, 44); await page.mouse.move(620, 350);
  await page.evaluate(() => document.querySelector<HTMLCanvasElement>('#world')!.addEventListener('pointerdown', (e) => {
    document.querySelector<HTMLCanvasElement>('#world')!.dataset.testPointer = String(e.pointerId);
  }, { once: true }));
  await page.mouse.down(); await page.mouse.move(660, 350, { steps: 3 });
  await page.evaluate(() => { const canvas = document.querySelector<HTMLCanvasElement>('#world')!; canvas.releasePointerCapture(Number(canvas.dataset.testPointer)); });
  await page.keyboard.down('KeyW'); await page.mouse.move(780, 350, { steps: 6 });
  await page.mouse.up(); await page.keyboard.up('KeyW');
  expect((await snapshot(page)).yaw).toBeCloseTo(-160 * .0028, 5);
  // A mode change during a held drag releases both inputs and does not resume a stale drag.
  await page.mouse.move(620, 350); await page.mouse.down(); await page.keyboard.down('ArrowUp');
  await page.keyboard.press('KeyM'); await page.keyboard.up('ArrowUp'); await page.mouse.up();
  await expect(page.locator('#map-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Return to walking' }).click();
  const resumed = await snapshot(page); await page.mouse.move(900, 350, { steps: 3 });
  expect((await snapshot(page)).yaw).toBe(resumed.yaw);
  expect(errors).toEqual([]);
});

test('both jewelry ministries have walkable entrances and reachable artifacts', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Enter Livistone' }).click();
  for (const [x, z, location, heading] of [[-29, -9, 'Ministry of Energy', 'A little powerhouse'], [29, -11, 'Ministry of Science', 'The smallest possibilities']] as const) {
    await teleport(page, x, z + 16);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(z + 3);
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#location')).toHaveText(location);
    await expect(page.locator('#interact')).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.getByRole('button', { name: 'Continue exploring' }).click();
    // The same doorway works in the outward direction after leaving the lore panel.
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeGreaterThan(z + 11);
    await page.keyboard.up('ArrowDown');
  }
  expect(requests.filter((url) => /\.stl(?:$|\?)/i.test(url))).toEqual([]);
});
