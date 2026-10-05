import { expect, test } from '@playwright/test';
import { EXPECTED_BACKEND, GPU_ERROR } from './gpu-errors';

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) errors.push(message.text()); });
});
test.afterEach(() => expect(errors).toEqual([]));

const ready = async (page: import('@playwright/test').Page): Promise<void> => {
  await expect(page.locator('#hud-graphics')).toBeEnabled({ timeout: 90000 });
  expect(await page.evaluate(() => (window as unknown as { __livistone: { snapshot(): { backend: string } } }).__livistone.snapshot().backend)).toBe(EXPECTED_BACKEND);
};

test('toolbar stays visible while default hints fold and can be reopened', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await expect(page.locator('#controls-details')).toBeVisible();
  await page.locator('#world').focus(); await page.mouse.move(500, 400);
  await expect(page.locator('#controls-details')).toBeHidden({ timeout: 12000 });
  await expect(page.locator('#controls-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.waitForTimeout(2500); // Also pass the former eight-second navigation timeout.
  await expect(page.locator('#navigation-tab')).toHaveCount(0);
  for (const id of ['hud-sound', 'hud-teleport', 'hud-graphics', 'view-toggle']) await expect(page.locator('#' + id)).toBeVisible();
  await expect(page.locator('#tools')).toHaveJSProperty('inert', false);
  await page.screenshot({ animations: 'disabled', path: 'output/testing/quick-tools-folded.png' });
  await page.locator('#controls-toggle').click(); await expect(page.locator('#controls-details')).toBeVisible();
  await page.locator('#world').focus(); await page.waitForTimeout(6500);
  await expect(page.locator('#controls-details')).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: 'output/testing/quick-tools-desktop.png' });
});

test('hints defer folding while their controls hold keyboard focus', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.locator('#controls-toggle').focus(); await page.waitForTimeout(6500);
  await expect(page.locator('#controls-details')).toBeVisible();
  await page.locator('#world').focus();
  await expect(page.locator('#controls-details')).toBeHidden({ timeout: 8000 });
});

for (const [tier, label] of [['gpu', 'Rich'], ['mobile', 'Balanced'], ['cpu', 'Lightweight']] as const) test(`graphics Auto names its actual ${label} preset and preserves map view`, async ({ page }) => {
  await page.goto(`/?graphics=${tier}`); await ready(page);
  const button = page.locator('#hud-graphics');
  await expect(button).toHaveAttribute('title', `Graphics: Auto (${label})`);
  await expect(button).toHaveAttribute('aria-label', `Graphics: Auto (${label})`);
  await page.locator('#view-toggle').click();
  await button.click(); await expect(page.locator('#graphics-menu')).toBeVisible();
  await expect(page.locator('#world')).toHaveJSProperty('inert', true);
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const automatic = page.locator('.graphics-option[data-action="performance:auto"]');
  await expect(automatic).toHaveText(`Auto (${label})Suit this device`); await expect(automatic).toHaveAttribute('aria-pressed', 'true');
  await expect(automatic).toBeFocused();
  await page.keyboard.press('End'); await expect(page.locator('.graphics-option[data-action="performance:rich"]')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#graphics-menu')).toBeHidden(); await expect(button).toBeFocused();
  await expect(page.locator('#map-panel')).toBeVisible();
  await button.click(); await button.click(); await expect(page.locator('#graphics-menu')).toBeHidden();
});

test('quick graphics choice reloads, persists and matches the menu; seven tools fit narrow screens', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/'); await ready(page);
  await page.locator('#hud-graphics').click(); await page.locator('.graphics-option[data-action="performance:light"]').click(); await ready(page);
  await expect(page.locator('#hud-graphics')).toHaveAttribute('title', 'Graphics: Lightweight');
  expect(await page.evaluate(() => localStorage.getItem('livistone-graphics-choice'))).toBe('light');
  await page.locator('[data-action="pause"]').click(); await expect(page.locator('#performance')).toHaveValue('light');
  await page.locator('#performance').selectOption('auto'); await ready(page);
  await expect(page.locator('#hud-graphics')).toHaveAttribute('title', /^Graphics: Auto \((Rich|Balanced|Lightweight)\)$/);
  for (const width of [360, 390, 440, 650, 651, 700, 740, 820, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await page.locator('#tools > button').evaluateAll(buttons => buttons.map(b => {
      const { x, y, width, height } = b.getBoundingClientRect(); return { x, y, width, height };
    }));
    expect(boxes).toHaveLength(7);
    for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.height).toBeGreaterThanOrEqual(44); }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 360) {
      await page.locator('#hud-graphics').click(); await expect(page.locator('#graphics-menu')).toBeVisible();
      await expect(page.locator('#graphics-menu')).toHaveCSS('opacity', '1');
      await page.screenshot({ animations: 'disabled', path: 'output/testing/quick-tools-phone.png' });
      await page.keyboard.press('Escape');
    }
  }
});
