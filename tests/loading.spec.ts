import { expect, test } from '@playwright/test';
import { GPU_ERROR } from './gpu-errors';
const backend = process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : '';

test('saved reflections avoid startup baking and distant models wait for approach', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => { localStorage.setItem('livistone-time-of-day', 'day'); });
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/models/jewelry/*.glb', async route => {
    const name = route.request().url().split('/').at(-1)!;
    if (!['mycelium.glb', 'eye-of-winter-gate.glb'].includes(name)) { requests.push(name); await held; }
    await route.continue();
  });
  try {
    await page.goto('/?graphics=mobile' + backend);
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
    await expect(page.locator('#welcome')).toBeHidden();
    const initial = await page.evaluate(() => (window as any).__livistone.snapshot());
    expect(initial.probes.saved).toEqual(['day']); expect(initial.probes.day).toBeUndefined();
    expect(requests.filter(name => !['inline.glb', 'la-navette.glb'].includes(name))).toEqual([]);
    await page.evaluate(() => (window as any).__livistone.teleport(0, -21, 0));
    await expect.poll(() => requests.some(name => ['nucalong.glb', 'nocciola.glb'].includes(name))).toBe(true);
    release();
    await expect.poll(async () => page.evaluate(() => (window as any).__featured().find((entry: any) => entry.id === 'city-hall')?.piece), { timeout: 30000 }).toBeTruthy();
    // The other saved phase is loaded on demand as well, without baking a new set of cubes.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('combobox', { name: 'Time of day' }).selectOption('night');
    await expect.poll(async () => page.evaluate(() => (window as any).__livistone.snapshot().probes.saved), { timeout: 30000 }).toEqual(['day', 'night']);
    expect((await page.evaluate(() => (window as any).__livistone.snapshot())).probes.night).toBeUndefined();
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('missing saved reflections fall back to a playable town', async ({ page }) => {
  test.setTimeout(120000);
  await page.route('**/probes/manifest.json*', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/?graphics=mobile' + backend);
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
  const state = await page.evaluate(() => (window as any).__livistone.snapshot());
  expect(state.ready).toBe(true); expect(state.probes.saved).toEqual([]); await expect.poll(async () => page.evaluate(() => { const state = (window as any).__livistone.snapshot(); return state.probes[state.night ? 'night' : 'day']; }), { timeout: 90000 }).toBeGreaterThan(0);
});
