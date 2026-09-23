import { test, expect } from '@playwright/test';

test('poster descriptions fit above their footers at the enlarged type sizes', async ({ page }) => {
  await page.addInitScript(() => {
    const panels: { width: number; height: number; lines: { text: string; left: number; right: number; top: number; bottom: number }[] }[] = [];
    const tracked = new WeakMap<HTMLCanvasElement, typeof panels[number]>(), original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).__posterText = panels;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const canvas = this.canvas;
      if ((canvas.width === 1500 && canvas.height === 1000) || canvas.width === 960 || (canvas.width === 1024 && canvas.height === 540) || (canvas.width === 1000 && canvas.height === 1200)) {
        let panel = tracked.get(canvas); if (!panel) { panel = { width: canvas.width, height: canvas.height, lines: [] }; tracked.set(canvas, panel); panels.push(panel); }
        const bounds = this.measureText(text);
        if (bounds.width > 0) panel.lines.push({ text, left: x - bounds.actualBoundingBoxLeft, right: x + bounds.actualBoundingBoxRight, top: y - bounds.actualBoundingBoxAscent, bottom: y + bounds.actualBoundingBoxDescent });
      }
      if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
  const panels = await page.evaluate(() => (window as any).__posterText) as { width: number; height: number; lines: { text: string; left: number; right: number; top: number; bottom: number }[] }[];
  expect(panels.length).toBeGreaterThanOrEqual(50);
  for (const panel of panels) for (const [index, line] of panel.lines.entries()) {
    expect(line.left, line.text).toBeGreaterThanOrEqual(0); expect(line.right, line.text).toBeLessThanOrEqual(panel.width);
    expect(line.top, line.text).toBeGreaterThanOrEqual(0); expect(line.bottom, line.text).toBeLessThanOrEqual(panel.height);
    for (const other of panel.lines.slice(index + 1)) {
      const overlap = line.left < other.right && line.right > other.left && line.top < other.bottom && line.bottom > other.top;
      expect(overlap, `${line.text} overlaps ${other.text}`).toBe(false);
    }
  }
});
