import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EXPECTED_BACKEND, GPU_ERROR } from './gpu-errors';

// Share of the frame that is exactly the cream poster paper (#f4f0e5). The screenshot is decoded by the page's own 2D canvas:
// both are sRGB, so the bytes are compared as the visitor sees them.
const paperShare = async (page: Page): Promise<number> => page.evaluate(async (png) => {
  const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data; let paper = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] === 244 && data[i + 1] === 240 && data[i + 2] === 229) paper++;
  return paper / (data.length / 4);
}, (await page.screenshot()).toString('base64'));

// Ambient occlusion and bloom (render/post.ts) act before tone mapping and skip display pixels: the catalogue poster's paper
// covers about 26% of this view and keeps its exact colour by day and by night. Occlusion leaking onto the paper, even by a
// level, halved that share (13%) when tried, so 20% is the gate.
test('poster paper stays exactly #f4f0e5 under ambient occlusion and bloom, day and night', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && GPU_ERROR.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('livistone-time-of-day', 'day'); } catch { /* the default is still day or night */ } });
  await page.goto('/?graphics=gpu&capture=1');
  await page.waitForFunction(() => { const s = (window as any).__livistone?.snapshot(); return s?.ready && s.mode === 'walking'; }, null, { timeout: 120000 });
  const snapshot = () => page.evaluate(() => (window as any).__livistone.snapshot());
  expect((await snapshot()).post).toBe('ao'); expect((await snapshot()).backend).toBe(EXPECTED_BACKEND);
  const frames = async (count: number) => { const start = (await snapshot()).frames; await page.waitForFunction(([from, n]) => (window as any).__livistone.snapshot().frames >= from + n, [start, count], { timeout: 60000 }); };
  const look = async () => {
    await page.evaluate(() => (window as any).__livistone.teleport(2.51, -18.21, -2.409));
    await frames(6); await page.waitForLoadState('networkidle').catch(() => undefined); await frames(6);
    const hide = await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' }); await frames(2);
    const share = await paperShare(page); await hide.evaluate((style) => (style as Element).remove()); return share;
  };
  expect(await look()).toBeGreaterThan(.2);
  await page.getByRole('button', { name: 'Open menu' }).click(); await page.locator('#time-of-day').selectOption('night');
  await expect.poll(async () => (await snapshot()).night).toBe(true);
  await page.keyboard.press('Escape'); await expect.poll(async () => (await snapshot()).mode).toBe('walking');
  expect(await look()).toBeGreaterThan(.2);
  expect(errors).toEqual([]);
});
