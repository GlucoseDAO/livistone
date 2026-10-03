import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EXPECTED_BACKEND, GPU_ERROR } from './gpu-errors';

interface Snapshot { night: boolean; timeOfDay: string; mode: string; position: { x: number; y: number; z: number }; backend: string }
interface Change { busy: boolean; night: boolean; label: string }
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __livistone: { snapshot(): Snapshot } }).__livistone.snapshot());
/** The phase a button label promises: night for the night mode and for your time while the clock says night. */
const promisesNight = (label: string): boolean => label.replace('Time of day: ', '').includes('night');

// The top-bar time button (sub-plan r3-1): one click cycles your time → day → night, the scene follows without moving the
// player, the choice persists, and the menu's select and the button stay in step both ways.
for (const touch of [false, true]) test(`the top-bar time button cycles your time, day and night (${touch ? 'touch' : 'desktop'})`, async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext(touch ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && GPU_ERROR.test(m.text())) errors.push(m.text()); });
  const button = page.locator('#hud-time'), select = page.locator('#time-of-day');
  const press = async (): Promise<void> => { if (touch) await button.tap(); else await button.click(); };
  const ready = async (): Promise<void> => { await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 90000 }); };
  // Every switch ends with the scene in the promised phase and the button no longer pending.
  const settled = async (label: string | RegExp): Promise<void> => {
    await expect(button).toHaveAttribute('aria-label', label); label = (await button.getAttribute('aria-label'))!;
    await expect.poll(async () => (await snapshot(page)).night, { timeout: 60000 }).toBe(promisesNight(label));
    await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 60000 });
  };
  try {
    await page.goto('/'); await ready();
    expect((await snapshot(page)).backend).toBe(EXPECTED_BACKEND);
    await expect(button).toBeVisible(); await expect(button).toBeEnabled(); await expect(button).toHaveAttribute('aria-keyshortcuts', 'T');
    // Beside the sound button, on the top bar's one row, inside the viewport and big enough to tap.
    await expect(page.locator('#tools > #hud-time + #hud-sound')).toHaveCount(1);
    const box = (await button.boundingBox())!, sound = (await page.locator('#hud-sound').boundingBox())!, brand = (await page.locator('.brand').boundingBox())!;
    expect(Math.abs(box.y - sound.y)).toBeLessThan(1); expect(box.height).toBe(sound.height); expect(box.width).toBeGreaterThanOrEqual(38); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width); expect(box.y).toBeLessThan(brand.y + brand.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // A fresh visitor starts on your time, named with what the local clock gives now.
    const first = await snapshot(page), start = first.position, local = first.night ? 'night' : 'day';
    expect(first.timeOfDay).toBe('auto');
    await expect(button).toHaveAttribute('aria-label', `Time of day: your time (${local} now)`); await expect(button).toHaveAttribute('title', `Time of day: your time (${local} now)`);
    await expect(select).toHaveValue('auto'); await expect(select.locator('option[value="auto"]')).toHaveText('Your time — local clock');
    const icons = new Set([await button.innerHTML()]);
    // Records each pending change of the button with the scene's phase at that moment.
    await page.evaluate(() => {
      const w = window as unknown as { __timeLog: Change[]; __livistone: { snapshot(): { night: boolean } } }, b = document.querySelector('#hud-time')!; w.__timeLog = [];
      new MutationObserver(() => w.__timeLog.push({ busy: b.getAttribute('aria-busy') === 'true', night: w.__livistone.snapshot().night, label: b.getAttribute('aria-label')! })).observe(b, { attributes: true, attributeFilter: ['aria-busy'] });
    });

    await press(); await settled('Time of day: day');
    expect((await snapshot(page)).timeOfDay).toBe('day'); await expect(select).toHaveValue('day'); icons.add(await button.innerHTML());
    await press(); await settled('Time of day: night');
    expect((await snapshot(page)).timeOfDay).toBe('night'); await expect(select).toHaveValue('night'); icons.add(await button.innerHTML());
    expect(icons.size).toBe(3);
    // One of the two switches changed the phase (both, at night): it showed as pending before the scene changed, and the
    // pending state cleared only with the scene already in the new phase.
    const log = await page.evaluate(() => (window as unknown as { __timeLog: Change[] }).__timeLog);
    expect(log.filter(c => c.busy).length).toBeGreaterThanOrEqual(1);
    for (const change of log) expect(change.night).toBe(change.busy ? !promisesNight(change.label) : promisesNight(change.label));
    const moved = (await snapshot(page)).position; expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeLessThan(.01);

    // The choice survives a reload.
    await page.reload(); await ready();
    expect((await snapshot(page)).timeOfDay).toBe('night'); expect((await snapshot(page)).night).toBe(true);
    await expect(button).toHaveAttribute('aria-label', 'Time of day: night'); await expect(select).toHaveValue('night');
    // Your time names what the local clock gives now; the scene follows the clock.
    await press(); await settled(/^Time of day: your time \((day|night) now\)$/); expect((await snapshot(page)).timeOfDay).toBe('auto'); await expect(select).toHaveValue('auto');

    // The menu's select and the button follow each other, and the button still works over the open menu.
    if (touch) await page.getByRole('button', { name: 'Open menu' }).tap(); else await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('#pause')).toBeVisible();
    await select.selectOption('day'); await settled('Time of day: day'); expect((await snapshot(page)).timeOfDay).toBe('day');
    await press(); await settled('Time of day: night'); await expect(select).toHaveValue('night'); expect((await snapshot(page)).mode).toBe('paused');
    await page.keyboard.press('Escape'); await expect.poll(async () => (await snapshot(page)).mode).toBe('walking');

    if (!touch) {
      // T cycles too, also with a toolbar button focused, as M does; browser shortcuts such as Ctrl+T stay the browser's.
      await page.locator('#world').focus(); await page.keyboard.press('t'); await settled(/^Time of day: your time/);
      await page.locator('#hud-sound').focus(); await page.keyboard.press('t'); await settled('Time of day: day');
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT', key: 't', ctrlKey: true })));
      await page.waitForTimeout(300); await expect(button).toHaveAttribute('aria-label', 'Time of day: day');
      // The pending pulse stops under reduced motion and leaves a still, dimmed icon.
      const pending = () => button.evaluate((b) => { b.setAttribute('aria-busy', 'true'); const s = getComputedStyle(b.querySelector('svg')!), style = { animation: s.animationName, opacity: Number(s.opacity) }; b.removeAttribute('aria-busy'); return style; });
      expect((await pending()).animation).toBe('time-pending');
      await page.emulateMedia({ reducedMotion: 'reduce' }); const still = await pending(); expect(still.animation).toBe('none'); expect(still.opacity).toBeLessThan(1);
      await page.emulateMedia({ reducedMotion: null });
    }
    await page.screenshot({ path: `output/testing/time-of-day-${touch ? 'touch' : 'desktop'}.png` });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
