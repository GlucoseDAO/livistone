import { COLLECTION } from '../src/game/exhibits';
import { LANDMARKS } from '../src/game/content';
import { posterLayout } from '../src/world/poster-layout';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
interface Snapshot { ready: boolean; mode: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number; interaction: string | null; progress: { discovered: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0): Promise<void> => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });

async function facePiece(page: Page, id: string): Promise<void> {
  const piece = COLLECTION.find((p) => p.discovery === id)!, hall = piece.location!, pieces = COLLECTION.filter((p) => p.location === hall), site = posterLayout(hall, pieces.length)[pieces.indexOf(piece)], landmark = LANDMARKS.find((l) => l.id === hall)!;
  const x = (hall === 'station' ? 0 : landmark.x) + site.x + Math.sin(site.yaw) * 2.7, z = (hall === 'station' ? 0 : landmark.z) + site.z + Math.cos(site.yaw) * 2.7;
  await teleport(page, hall === 'station' ? -16 - x : x, hall === 'station' ? -z : z, site.yaw + (hall === 'station' ? Math.PI : 0)); await expect.poll(async () => (await snapshot(page)).interaction).toBe(id);
}

test('explore City Hall, preserve position through map mode, and retain discoveries', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'First person' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'First person' }).click();
  await page.waitForFunction(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot().mode === 'walking');
  // Entering and unpressed mouse movement must never capture or turn the camera.
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const initial = await snapshot(page);
  expect(initial.yaw).toBe(0); expect(initial.pitch).toBe(0);
  for (const key of ['ArrowUp', 'ArrowDown', 'KeyA', 'KeyD']) {
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
  await page.getByRole('button', { name: 'First person' }).click();
  await teleport(page, 0, -9);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(-18.2);
  await page.keyboard.up('KeyW');
  await expect(page.locator('#location')).toHaveText('City Hall');
  await facePiece(page, 'nut');
  await expect(page.locator('#interact')).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: 'The Nut of Power', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/testing/city-hall-discovery.png' });
  await page.getByRole('button', { name: 'Continue exploring' }).click();
  const before = await snapshot(page);
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map-panel')).toBeVisible();
  await page.screenshot({ path: 'output/testing/aerial-map-desktop.png' });
  await page.getByRole('button', { name: 'First person' }).click();
  const after = await snapshot(page);
  expect(after.position.x).toBeCloseTo(before.position.x, 1); expect(after.position.z).toBeCloseTo(before.position.z, 1); expect(after.yaw).toBeCloseTo(before.yaw, 4);
  await page.reload();
  await expect(page.getByRole('button', { name: 'First person' })).toBeEnabled({ timeout: 60000 });
  expect((await snapshot(page)).progress.discovered).toContain('nut');
  expect(errors).toEqual([]);
});

test('mobile layout, simultaneous touch look/movement, cancellation, and aerial map', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'First person' })).toBeEnabled({ timeout: 60000 });
  await page.screenshot({ path: 'output/testing/start-map-mobile.png' });
  await page.getByRole('button', { name: 'First person' }).tap();
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
  await page.getByRole('button', { name: 'Top view' }).tap();
  await expect(page.getByRole('heading', { name: 'Find your wonder.' })).toBeVisible();
  await page.screenshot({ path: 'output/testing/aerial-map-mobile.png' });
  await page.getByRole('button', { name: 'First person' }).tap();
  expect((await snapshot(page)).position.z).toBeCloseTo(stopped.position.z, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await facePiece(page, 'nanot'); await expect(page.locator('#interact')).toBeVisible(); await page.locator('#interact').tap();
  await expect(page.getByRole('table')).toContainText('Sterling silver');
  await expect.poll(() => page.locator('.exhibit-photos img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.locator('#lore').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.waitForTimeout(600); await page.screenshot({ path: 'output/testing/catalogue-mobile.png' });
  expect(errors).toEqual([]);
  await context.close();
});

test('movement keys preserve held-mouse rotation and never enable unpressed rotation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => { throw new Error('Livistone must never request pointer lock'); };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'First person' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'First person' }).click();
  const rotations: { yaw: number; pitch: number }[] = [];
  for (const keys of [[], ['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['ArrowUp'], ['ArrowDown'], ['ArrowUp', 'KeyD']]) {
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
  await page.getByRole('button', { name: 'First person' }).click();
  const resumed = await snapshot(page); await page.mouse.move(900, 350, { steps: 3 });
  expect((await snapshot(page)).yaw).toBe(resumed.yaw);
  expect(errors).toEqual([]);
});

test('both jewelry ministries have walkable entrances and reachable artifacts', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'First person' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'First person' }).click();
  for (const [x, z, location, heading] of [[-29, -9, 'Ministry of Energy', 'Mitoring'], [29, -11, 'Ministry of Science', 'The Nanot of Power']] as const) {
    await teleport(page, x, z + 16);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeLessThan(z + 3);
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#location')).toHaveText(location);
    await facePiece(page, x < 0 ? 'mitoring' : 'nanot');
    await expect(page.locator('#interact')).toBeVisible();
    await page.keyboard.press('KeyE');
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.getByRole('button', { name: 'Continue exploring' }).click();
    await teleport(page, x, z + 3, 0);
    // The same doorway works in the outward direction after leaving the lore panel.
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await snapshot(page)).position.z, { timeout: 30000 }).toBeGreaterThan(z + 11);
    await page.keyboard.up('ArrowDown');
  }
  expect(requests.filter((url) => /\.stl(?:$|\?)/i.test(url))).toEqual([]);
});

test('left/right arrows turn in place, A/D strafe, and keyboard turning preserves a held drag', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.click('#view-toggle');
  for (const [key, sign] of [['ArrowLeft', 1], ['ArrowRight', -1]] as const) {
    await teleport(page, 0, 44); const start = await snapshot(page);
    await page.keyboard.down(key); await expect.poll(async () => (await snapshot(page)).yaw * sign).toBeGreaterThan(.25); await page.keyboard.up(key);
    const turned = await snapshot(page);
    expect(turned.position.x).toBeCloseTo(start.position.x, 2); expect(turned.position.z).toBeCloseTo(start.position.z, 2); expect(turned.pitch).toBe(start.pitch);
    await page.mouse.move(800, 400, { steps: 4 }); expect((await snapshot(page)).yaw).toBe(turned.yaw);
  }
  for (const [key, sign] of [['KeyA', -1], ['KeyD', 1]] as const) {
    await teleport(page, 0, 44); await page.keyboard.down(key);
    await expect.poll(async () => (await snapshot(page)).position.x * sign).toBeGreaterThan(.4); await page.keyboard.up(key);
    expect((await snapshot(page)).yaw).toBe(0); expect((await snapshot(page)).position.z).toBeCloseTo(44, 2);
  }
  await teleport(page, 0, 44); await page.mouse.move(620, 350); await page.mouse.down();
  await page.keyboard.down('ArrowRight'); await expect.poll(async () => (await snapshot(page)).yaw).toBeLessThan(-.25); await page.keyboard.up('ArrowRight');
  const beforeDrag = await snapshot(page); await page.mouse.move(720, 350, { steps: 6 }); await page.mouse.up();
  expect((await snapshot(page)).yaw).toBeCloseTo(beforeDrag.yaw - 100 * .0028, 5);
  await page.keyboard.down('ArrowLeft'); await page.keyboard.press('KeyM'); await page.keyboard.up('ArrowLeft');
  const paused = await snapshot(page); await page.getByRole('button', { name: 'First person' }).click();
  await page.mouse.move(800, 400); expect((await snapshot(page)).yaw).toBe(paused.yaw);
});

test('curated collections keep permanent locations, full-photo controls, source facts and catalogue filters', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const fullRequests: string[] = []; page.on('request', (request) => { if (/catalogue\/.*(?<!-thumb)\.webp/.test(request.url())) fullRequests.push(request.url()); });
  await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.click('#view-toggle');
  expect(fullRequests).toEqual([]);
  for (const [anchor, material, count, supporting] of [['nut', 'Brass, walnut, amethyst', 8, 'ammonite'], ['mitoring', 'Amber, sterling silver', 8, 'amberbow'], ['nanot', 'Sterling silver', 9, 'beanut']] as const) {
    await facePiece(page, anchor); await page.keyboard.press('KeyE');
    await expect(page.getByRole('table')).toContainText(material); await expect(page.locator('.exhibit-photos img')).toHaveCount(2);
    await expect.poll(() => page.locator('.exhibit-photos img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.getByRole('button', { name: 'Continue exploring' }).click();
    await page.keyboard.press('Digit4'); await expect(page.locator('#lore-title')).toHaveText(anchor === 'nut' ? 'The Artifactor & the Herbalist' : anchor === 'mitoring' ? 'A garden for every season' : 'A world of connections'); await page.keyboard.press('Escape');
    await page.keyboard.press('Digit2'); await expect(page.locator('.piece-card')).toHaveCount(count);
    const selected = COLLECTION.find((p) => p.discovery === supporting)!;
    await page.locator('.piece-card').filter({ has: page.getByText(selected.title, { exact: true }) }).click();
    await expect(page.locator('#gallery-title')).toHaveText(selected.title); await expect.poll(() => page.locator('#viewer-image').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const before = await snapshot(page); await page.getByRole('button', { name: 'Zoom photograph in' }).click(); await expect(page.locator('#photo-zoom')).toHaveText('130%');
    await page.keyboard.press('+'); await expect(page.locator('#photo-zoom')).toHaveText('169%');
    await page.getByRole('button', { name: 'Fit image' }).click(); await expect(page.locator('#photo-zoom')).toHaveText('100%');
    await page.keyboard.press('ArrowRight'); await expect(page.locator('#photo-count')).toHaveText('2 / 2');
    await page.keyboard.press('Escape'); expect((await snapshot(page)).position.z).toBeCloseTo(before.position.z, 2); expect((await snapshot(page)).yaw).toBe(before.yaw);
  }
  await page.getByRole('button', { name: 'Open discovery journal' }).click(); await page.getByRole('button', { name: 'Browse the jewelry catalogue' }).click();
  await expect(page.locator('.piece-card')).toHaveCount(41); await page.getByRole('searchbox', { name: 'Search jewelry' }).fill('Mycelium'); await expect(page.locator('.piece-card')).toHaveCount(1); await page.getByRole('searchbox', { name: 'Search jewelry' }).fill(''); await page.getByLabel('Location', { exact: true }).selectOption('station'); await expect(page.locator('.piece-card')).toHaveCount(7);
  await page.getByLabel('Year', { exact: true }).selectOption('2022'); expect(await page.locator('.piece-card').count()).toBeGreaterThan(0);
  await page.screenshot({ path: 'output/testing/catalogue-filtered.png' }); expect(errors).toEqual([]);
});

test('touch poster inspection preserves look gestures and fits the screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(); await page.goto('/'); await expect(page.locator('#view-toggle')).toBeEnabled({ timeout: 60000 }); await page.locator('#view-toggle').tap();
    await facePiece(page, 'nanot'); await page.locator('#interact').tap(); await page.locator('.photo-open').first().tap();
    await expect(page.locator('#viewer-image')).toBeVisible(); await page.getByRole('button', { name: 'Zoom photograph in' }).tap(); await expect(page.locator('#photo-zoom')).toHaveText('130%');
    await page.getByRole('button', { name: 'Next photograph' }).tap(); await expect(page.locator('#photo-count')).toHaveText('2 / 2');
    expect(await page.locator('#gallery').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: 'output/testing/poster-viewer-mobile.png' }); await page.getByRole('button', { name: 'Close gallery' }).tap(); await page.getByRole('button', { name: 'Continue exploring' }).tap();
    const before = await snapshot(page); await page.touchscreen.tap(190, 350); const after = await snapshot(page); expect(after.yaw).toBe(before.yaw);
  } finally { await context.close(); }
});
