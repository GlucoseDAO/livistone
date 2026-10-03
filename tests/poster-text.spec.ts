import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { COLLECTION } from '../src/game/exhibits';
import { LANDMARKS } from '../src/game/content';

type Panel = { width: number; height: number; lines: { text: string; left: number; right: number; top: number; bottom: number }[] };
type Posters = { resident: string[]; bytes: number; collections: Record<string, number>; gpu: { textures: number; bytes: number; programs: number; builds: number } };
const posters = (page: Page): Promise<Posters> => page.evaluate(() => (window as unknown as { __posters(): Posters }).__posters());
/** Walk to a collection's map entrance; its posters become resident (sub-plan 12) and their captions paint. */
async function visit(page: Page, id: string): Promise<void> {
  const { x, z, yaw, y } = LANDMARKS.find((landmark) => landmark.id === id)!.entrance;
  await page.evaluate(([x, z, yaw, y]) => (window as unknown as { __livistone: { teleport(x: number, z: number, yaw: number, y: number): void } }).__livistone.teleport(x, z, yaw, y), [x, z, yaw, y]);
  await expect.poll(async () => (await posters(page)).resident, { timeout: 30000 }).toContain(id);
}
const HALLS = ['city-hall', 'energy', 'science', 'timeface', 'future-house', 'station'];

// The default headless profile is the mobile tier here (640 px captions); ?graphics=gpu paints them 960 px wide.
for (const query of ['', '?graphics=gpu']) test(`poster descriptions fit above their footers at the enlarged type sizes${query}`, async ({ page }) => {
  await page.addInitScript(() => {
    const panels: Panel[] = [];
    const tracked = new WeakMap<HTMLCanvasElement, Panel>(), original = CanvasRenderingContext2D.prototype.fillText;
    (window as unknown as { __posterText: Panel[] }).__posterText = panels;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const canvas = this.canvas;
      // Poster captions are 960 px wide on the gpu tier and 640 px on mobile and cpu, painted through a scale.
      if ((canvas.width === 1500 && canvas.height === 1000) || canvas.width === 960 || canvas.width === 640 || (canvas.width === 1024 && canvas.height === 540) || (canvas.width === 1000 && canvas.height === 1200)) {
        let panel = tracked.get(canvas); if (!panel) { panel = { width: canvas.width, height: canvas.height, lines: [] }; tracked.set(canvas, panel); panels.push(panel); }
        // Bounds in canvas pixels, through the context's transform (a uniform scale and a translation).
        const bounds = this.measureText(text), m = this.getTransform();
        if (bounds.width > 0) panel.lines.push({ text, left: m.a * (x - bounds.actualBoundingBoxLeft) + m.e, right: m.a * (x + bounds.actualBoundingBoxRight) + m.e, top: m.d * (y - bounds.actualBoundingBoxAscent) + m.f, bottom: m.d * (y + bounds.actualBoundingBoxDescent) + m.f });
      }
      if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto('/' + query); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
  // Full captions exist only for collections the visitor is in or approaching, so walk to each; the first line is the title.
  const titles = (): Promise<string[]> => page.evaluate(() => (window as unknown as { __posterText: Panel[] }).__posterText.filter((panel) => panel.width === 960 || panel.width === 640).map((panel) => panel.lines[0]?.text ?? ''));
  for (const hall of HALLS) {
    await visit(page, hall);
    const expected = COLLECTION.filter((piece) => piece.location === hall).map((piece) => piece.title);
    await expect.poll(async () => { const painted = await titles(); return expected.filter((title) => !painted.includes(title)); }, { timeout: 30000 }).toEqual([]);
  }
  const panels = await page.evaluate(() => (window as unknown as { __posterText: Panel[] }).__posterText);
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

test('full poster textures stay with the two collections last approached and swap without building shaders', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 });
  await expect.poll(async () => (await posters(page)).resident).toEqual(['station']);
  const distant = (await posters(page)).collections['city-hall'];
  await visit(page, 'city-hall'); await visit(page, 'energy');
  // Energy's entrance is in range of City Hall too, so those two stay and the station falls back to its distant copies.
  await expect.poll(async () => [...(await posters(page)).resident].sort()).toEqual(['city-hall', 'energy']);
  await expect.poll(async () => (await posters(page)).collections.station, { timeout: 30000 }).toBeLessThan(distant * 1.5);
  expect((await posters(page)).collections['city-hall']).toBeGreaterThan(distant * 10);
  // Every hall seen once builds whatever its first view needs; after that, coming back only swaps poster maps.
  for (const hall of ['science', 'timeface', 'future-house', 'station']) await visit(page, hall);
  // The reflection probes bake after ready in the background (sub-plan 07) and build their own shaders: count after them.
  await page.waitForFunction(() => !(window as unknown as { __livistone: { snapshot(): { probes: { baking: string | null } | null } } }).__livistone.snapshot().probes?.baking, null, { timeout: 240000, polling: 250 });
  const settled = (await posters(page)).gpu;
  for (const hall of ['city-hall', 'energy', 'science', 'station', 'city-hall']) await visit(page, hall);
  await expect.poll(async () => (await posters(page)).resident.length).toBe(2);
  // The maps swapped on the same materials with the same samplers: no node build and no new shader program.
  const after = (await posters(page)).gpu;
  expect(after.builds).toBe(settled.builds); expect(after.programs).toBe(settled.programs);
});
