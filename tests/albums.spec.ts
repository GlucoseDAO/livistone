import { test, expect } from '@playwright/test';

test('rotunda slideshow and building content/image albums preserve their context', async ({ page }) => {
  test.setTimeout(240000); page.setDefaultTimeout(15000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?capture=1&graphics=cpu' + (process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : ''));
  await expect(page.locator('#poster-info')).toBeVisible({ timeout: 120000 });
  await page.locator('#poster-info').press('Enter');
  await expect(page.locator('#panel-controls')).toBeVisible();
  const firstPanel = await page.locator('#lore-title').innerText();
  await page.getByRole('button', { name: 'Next panel', exact: true }).click();
  await expect(page.locator('#lore-title')).not.toHaveText(firstPanel);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lore-title')).toHaveText(firstPanel);
  await page.getByRole('button', { name: 'Enlarge photograph 1', exact: true }).click();
  await expect(page.locator('#gallery')).toBeVisible();
  const firstPhoto = await page.locator('#viewer-image').getAttribute('src');
  await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
  await expect(page.locator('#viewer-image')).not.toHaveAttribute('src', firstPhoto!);
  // Continue across the piece boundary, not just the original piece's photos.
  for (let i = 0; i < 10 && await page.locator('#gallery-title').innerText() === firstPanel; i++)
    await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
  const photoPiece = await page.locator('#gallery-title').innerText();
  expect(photoPiece).not.toBe(firstPanel);
  await page.getByRole('button', { name: 'Back to panel content', exact: true }).click();
  await expect(page.locator('#lore-title')).toHaveText(photoPiece);
  await page.keyboard.press('Escape');
  // Stand five metres in front of the first real rotunda poster and click its face.
  await page.evaluate(() => {
    const a = -Math.PI + .4;
    (window as any).__livistone.teleport(137 + Math.cos(a) * 9.5, -36 + Math.sin(a) * 9.5, Math.atan2(-Math.cos(a), -Math.sin(a)), 2.63);
  });
  await page.waitForTimeout(300);
  await page.mouse.click(600, 400);
  await expect(page.locator('#gallery')).toBeVisible();
  await expect(page.locator('#gallery-title')).toHaveText('A living world');
  await expect(page.locator('#photo-count')).toHaveText('1 / 15');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#photo-count')).toHaveText('15 / 15');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#photo-count')).toHaveText('1 / 15');
  await expect.poll(() => page.locator('#viewer-image').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'output/testing/albums/rotunda-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Next photograph', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
  await expect(page.locator('#photo-count')).toHaveText('2 / 15');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'output/testing/albums/rotunda-phone-layout.png' });
  await page.getByRole('button', { name: 'Back to the garden', exact: true }).click();
  await expect(page.locator('#gallery')).toBeHidden();
  await page.setViewportSize({ width: 1200, height: 800 });
  if (await page.locator('#app').getAttribute('data-navigation') === 'folded') await page.locator('#navigation-tab').click();
  await page.locator('#tools [data-action=journal]').click();
  await page.locator('[data-discovery="glucose-format"]').click();
  await expect(page.locator('#lore-title')).toHaveText('How glucose is measured');
  const sourceImage = await page.locator('.source-image img').getAttribute('src');
  await page.locator('.source-image').click();
  await expect(page.locator('#viewer-image')).toHaveAttribute('src', sourceImage!);
  await page.getByRole('button', { name: 'Back to panel content', exact: true }).click();
  await expect(page.locator('#lore-title')).toHaveText('How glucose is measured');
  await page.locator('.source-image').click();
  await page.getByRole('button', { name: 'Next photograph', exact: true }).click();
  const slideTitle = await page.locator('#gallery-title').innerText();
  await page.getByRole('button', { name: 'Back to panel content', exact: true }).click();
  await expect(page.locator('#lore-slide-title')).toHaveText(slideTitle);
  await page.screenshot({ path: 'output/testing/albums/building-content.png' });
  expect(errors).toEqual([]);
});
