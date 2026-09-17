import * as THREE from 'three';
import { INFORMATION_COLUMN } from '../src/world/exhibition';
import { TEXT_ACTIONS, TEXT_WIDTH, TEXT_HEIGHT } from '../src/world/exhibition-text';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
interface Snapshot { ready: boolean; mode: string; position: { x: number; y: number; z: number }; yaw: number; pitch: number; interaction: string | null; progress: { discovered: string[] }; }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const teleport = (page: Page, x: number, z: number, yaw = 0): Promise<void> => page.evaluate(({ x, z, yaw }) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number): void } }).__livistone.teleport(x, z, yaw), { x, z, yaw });

async function clickColumn(page: Page, x: number, z: number, action: string, touch = false): Promise<void> {
  const info = INFORMATION_COLUMN, target = TEXT_ACTIONS.find((r) => r.action === action)!;
  await teleport(page, x + 3.5, z + 4.1, -Math.atan2(info.x - 3.5, 4.1 - info.z)); await page.waitForTimeout(250);
  const state = await snapshot(page), viewport = page.viewportSize()!;
  const camera = new THREE.PerspectiveCamera(66, viewport.width / viewport.height, .08, 700);
  camera.position.set(state.position.x, state.position.y + .78, state.position.z); camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); camera.updateMatrixWorld();
  const u = (target.x + target.width / 2) / TEXT_WIDTH, v = (target.y + target.height / 2) / TEXT_HEIGHT, angle = (u - .5) * info.arcWidth / info.radius;
  const point = new THREE.Vector3(x + info.x + Math.sin(angle) * info.radius, .16 + info.y + (.5 - v) * info.height, z + info.z + Math.cos(angle) * info.radius).project(camera);
  const px = (point.x * .5 + .5) * viewport.width, py = (.5 - point.y * .5) * viewport.height;
  if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
}

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
  await teleport(page, 32.5, -6.7); await expect(page.locator('#interact')).toBeVisible(); await page.locator('#interact').tap();
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
  await expect(page.getByRole('button', { name: 'Enter Livistone' })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Enter Livistone' }).click();
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

test('left/right arrows turn in place, A/D strafe, and keyboard turning preserves a held drag', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 }); await page.click('#enter');
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
  const paused = await snapshot(page); await page.getByRole('button', { name: 'Return to walking' }).click();
  await page.mouse.move(800, 400); expect((await snapshot(page)).yaw).toBe(paused.yaw);
});

test('every civic exhibition displays real local photos and readable catalogue facts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const failed: string[] = []; page.on('requestfailed', (request) => { if (/images\/jewelry|textures\/mountains/.test(request.url())) failed.push(request.url()); });
  page.on('console', (message) => { if (message.type() === 'error' && /Shader|WebGLProgram/.test(message.text())) failed.push(message.text()); });
  await page.goto('/'); await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 }); await page.click('#enter');
  for (const [x, z, material, dimensions] of [[0, -21, 'Brass, walnut, amethyst', '3.4 × 3.4 cm'], [-29, -9, 'Amber, sterling silver', '3.2 × 2.2 cm'], [29, -11, 'Sterling silver', '3.2 × 3.2 cm']] as const) {
    // Wait for interaction refresh after teleporting to another hall.
    await teleport(page, x + 3.5, z + 4.3);
    await expect.poll(async () => (await snapshot(page)).interaction).toBe(x === 0 ? 'nut' : x < 0 ? 'mitoring' : 'nanot');
    await expect(page.locator('#interact')).toBeVisible(); await page.keyboard.press('KeyE');
    await expect(page.getByRole('table')).toContainText(material); await expect(page.getByRole('table')).toContainText(dimensions);
    await expect(page.getByRole('heading', { name: 'The original jewelry', exact: true })).toBeVisible();
    await expect(page.locator('.exhibit-photos img')).toHaveCount(2);
    await expect.poll(() => page.locator('.exhibit-photos img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(page.getByRole('link', { name: /View Livia/ })).toHaveAttribute('href', 'https://livia.glucosedao.org/pieces/');
    await page.getByRole('button', { name: 'Continue exploring' }).click();
    await clickColumn(page, x, z, 'lore');
    await expect(page.locator('#lore-title')).toHaveText(x === 0 ? 'The Artifactor & the Herbalist' : x < 0 ? 'A garden for every season' : 'A world of connections');
    await page.getByRole('button', { name: 'Continue exploring' }).click();
  }
  expect(failed).toEqual([]);
});

test('photo cylinders switch pieces, pause, open curved photos, zoom and return without moving the player', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 }); await page.click('#enter');
  await teleport(page, 0, -17.5); await expect(page.locator('#exhibition-controls')).toBeVisible();
  const before = await snapshot(page);
  await page.keyboard.press('KeyP');
  await expect(page.locator('#cylinder-pause')).toHaveText('Resume rotation');
  // The central photograph itself is clickable, without a modal being triggered by a look drag.
  await page.mouse.click(640, 390); await expect(page.locator('#gallery')).toBeVisible();
  await expect(page.locator('#viewer-image')).toHaveAttribute('src', /IMG_349/);
  await page.getByRole('button', { name: 'Zoom photograph in' }).click(); await expect(page.locator('#photo-zoom')).toHaveText('130%');
  await page.keyboard.press('+'); await expect(page.locator('#photo-zoom')).toHaveText('169%');
  await page.mouse.move(520, 420); await page.mouse.down(); await page.mouse.move(620, 470); await page.mouse.up();
  await expect(page.locator('#viewer-image')).not.toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Fit image' }).click(); await expect(page.locator('#photo-zoom')).toHaveText('100%');
  const first = await page.locator('#viewer-image').getAttribute('src'); await page.keyboard.press('ArrowRight');
  expect(await page.locator('#viewer-image').getAttribute('src')).not.toBe(first);
  await page.keyboard.press('Escape'); await expect(page.locator('#gallery')).toBeHidden();
  expect((await snapshot(page)).position.z).toBeCloseTo(before.position.z, 2); expect((await snapshot(page)).yaw).toBe(before.yaw);
  for (const [x, z, piece] of [[0, -17.5, 'Amberbow Ring'], [-29, -5.5, 'Ammonite Ring'], [29, -7.5, 'Beanut (Fasolaluna)']] as const) {
    await teleport(page, x, z); await expect(page.locator('#exhibition-controls')).toBeVisible();
    await page.keyboard.press('Digit2');
    await expect(page.locator('.piece-card')).toHaveCount(6);
    await page.locator('.piece-card').filter({ has: page.getByText(piece, { exact: true }) }).click();
    await expect(page.locator('#gallery')).toBeHidden(); await expect(page.locator('#cylinder-title')).toHaveText(piece);
    await page.keyboard.press('Digit3');
    await expect(page.locator('#gallery-title')).toHaveText(piece);
    await expect.poll(() => page.locator('#viewer-image').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Digit1');
    await expect(page.getByRole('table')).toContainText(piece.startsWith('Amber') ? '2023' : piece.startsWith('Ammonite') ? 'agate' : 'prehnite');
    await page.keyboard.press('Escape');
  }
  // The first hall keeps its selection when another hall changes.
  await teleport(page, 0, -17.5); await expect(page.locator('#cylinder-title')).toHaveText('Amberbow Ring');
  await page.screenshot({ path: 'output/testing/cylinder-selected.png' });
  expect(errors).toEqual([]);
});

test('phone photo viewer supports touch, zoom controls and switching the cylinder', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto('/'); await expect(page.locator('#enter')).toBeEnabled({ timeout: 60000 }); await page.locator('#enter').tap();
  await teleport(page, 29, -7.5); await expect(page.locator('#exhibition-controls')).toBeVisible();
  await clickColumn(page, 29, -11, 'browse', true); await expect(page.locator('#gallery')).toBeVisible();
  await page.locator('.piece-card').filter({ has: page.getByText('Beanut (Fasolaluna)', { exact: true }) }).tap();
  await expect(page.locator('#cylinder-title')).toHaveText('Beanut (Fasolaluna)');
  await clickColumn(page, 29, -11, 'photo', true);
  await page.getByRole('button', { name: 'Zoom photograph in' }).tap(); await expect(page.locator('#photo-zoom')).toHaveText('130%');
  await page.getByRole('button', { name: 'Next photograph' }).tap(); await expect(page.locator('#photo-count')).toHaveText('2 / 2');
  expect(await page.locator('#gallery').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.waitForTimeout(500); await page.screenshot({ path: 'output/testing/cylinder-photo-mobile.png' });
  await page.getByRole('button', { name: 'Close gallery' }).tap(); await expect(page.locator('#joystick')).toBeVisible();
  await context.close();
});
