import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LANDMARKS, SPAWN } from '../src/game/content';
import { STUMP_OF_LIFE } from '../src/world/stump-of-life-layout';
import { COURTYARD_ARRIVAL, COURTYARD_STAIRS, MATSU_COURTYARD as C, courtyardWorld } from '../src/world/matsu-courtyard-layout';
import { GPU_ERROR } from './gpu-errors';

interface Snapshot {
  ready: boolean;
  mode: string;
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  interaction: string | null;
}
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
const backend = process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : '';
const recordErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) errors.push(message.text()); });
  return errors;
};
const expectArrival = async (page: Page, entrance: { x: number; z: number; yaw: number; y?: number }): Promise<void> => {
  const arrived = await snapshot(page);
  expect(arrived.ready).toBe(true);
  expect(arrived.mode).toBe('walking');
  expect(arrived.position.x).toBeCloseTo(entrance.x, 2);
  expect(arrived.position.z).toBeCloseTo(entrance.z, 2);
  expect(arrived.position.y).toBeGreaterThan(.55);
  if (entrance.y !== undefined) expect(Math.abs(arrived.position.y - entrance.y)).toBeLessThan(.25);
  expect(arrived.yaw).toBeCloseTo(entrance.yaw, 8);
  expect(arrived.pitch).toBe(0);
};

test('a cold Stump of Life link waits for its courtyard and artwork, then named travel updates the shareable address', async ({ page }) => {
  const errors = recordErrors(page);
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('**/models/jewelry/stump-of-life-livistone.glb', async route => {
    requested = true;
    await held;
    await route.continue();
  });
  try {
    await page.goto('/?place=stump-of-life&graphics=mobile&probes=off&proof=kept' + backend + '#artist-story');
    await expect.poll(() => requested, { timeout: 60000 }).toBe(true);
    await expect(page.locator('#view-toggle')).toBeDisabled();
    await expect(page.locator('#welcome')).toBeVisible();
    expect((await snapshot(page)).ready).toBe(false);
    release();
    await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
    await expectArrival(page, LANDMARKS.find(place => place.id === 'stump-of-life')!.entrance);
    await expect(page.locator('#welcome')).toBeHidden();
    expect((await snapshot(page)).position.y).toBeLessThan(C.floorY + 1.1);
    await expect.poll(async () => (await snapshot(page)).interaction).toBe('stump-of-life-story');
    await page.keyboard.press('e');
    await expect(page.locator('#lore-title')).toHaveText('Stump of Life');
    await page.keyboard.press('Escape');
    // Named arrival now reads the supported lower-court poster; explicitly start upstairs to retain cold-loaded stair coverage.
    await page.evaluate(arrival => (window as any).__livistone.teleport(arrival.x, arrival.z, arrival.yaw, arrival.y), COURTYARD_ARRIVAL);
    const targets = [...[3, 4, 6, 7].map(index => COURTYARD_STAIRS[index]).map(point => ({ ...courtyardWorld(point), y: point.y })), { ...courtyardWorld({ x: 1, z: 2.4 }), y: C.floorY }];
    for (const target of targets) {
      const at = (await snapshot(page)).position, yaw = Math.atan2(at.x - target.x, at.z - target.z);
      // Rotate at the current position; the cold-loaded stairs must already participate in the initial physics world.
      await page.evaluate(([x, z, yaw, y]) => (window as any).__livistone.teleport(x, z, yaw, y), [at.x, at.z, yaw, at.y]);
      const arrival = page.waitForFunction(([x, z, startX, startZ]) => {
        const p = (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot().position, dx = x - startX, dz = z - startZ, length = Math.hypot(dx, dz);
        const along = ((p.x - startX) * dx + (p.z - startZ) * dz) / length, across = Math.abs((p.x - startX) * dz - (p.z - startZ) * dx) / length;
        return Math.hypot(p.x - x, p.z - z) < .18 || (along >= length && along < length + .5 && across < .18);
      }, [target.x, target.z, at.x, at.z], { polling: 'raf', timeout: 15000 });
      await page.keyboard.down('w');
      try {
        await arrival;
        await page.keyboard.up('w');
      } finally { await page.keyboard.up('w'); }
      await expect.poll(async () => Math.abs((await snapshot(page)).position.y - target.y - .83)).toBeLessThan(.32);
    }
    const besideSeat = (await snapshot(page)).position;
    expect(Math.hypot(besideSeat.x - STUMP_OF_LIFE.x, besideSeat.z - STUMP_OF_LIFE.z)).toBeLessThan(1.7);
    expect(besideSeat.y).toBeGreaterThan(C.floorY + .65); expect(besideSeat.y).toBeLessThan(C.floorY + 1.1);
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await page.locator('.landmark-item[data-action="landmark:city-hall"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('place')).toBe('city-hall');
    await expectArrival(page, LANDMARKS.find(place => place.id === 'city-hall')!.entrance);
    const shared = new URL(page.url());
    expect(shared.searchParams.get('proof')).toBe('kept');
    expect(shared.searchParams.get('graphics')).toBe('mobile');
    expect(shared.searchParams.get('probes')).toBe('off');
    expect(shared.hash).toBe('#artist-story');
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('a second named place cold-starts at its own safe entrance', async ({ page }) => {
  const errors = recordErrors(page);
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?place=city-hall&graphics=mobile&probes=off' + backend);
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  await expectArrival(page, LANDMARKS.find(place => place.id === 'city-hall')!.entrance);
  expect(errors).toEqual([]);
});

test('an unknown place keeps the normal safe station arrival', async ({ page }) => {
  const errors = recordErrors(page);
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto('/?place=not-registered&graphics=mobile&probes=off' + backend);
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 });
  await expectArrival(page, SPAWN);
  expect(errors).toEqual([]);
});
