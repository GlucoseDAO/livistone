// Screenshots each civic building from outside and inside for visual review.
// Needs the dev server (bun run dev) and Google Chrome; uses the GPU when one is available.
// Usage: node scripts/screenshot-landmarks.mjs [outDir]   (default output/testing/landmarks)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'output/testing/landmarks'; mkdirSync(out, { recursive: true });
const views = [
  ['energy-front', -29, 16, 0], ['energy-side', -4, -9, Math.PI / 2], ['energy-inside', -29, -5, 0], ['energy-hall', -36.5, -9, -Math.PI / 2],
  ['science-front', 29, 14, 0], ['science-side', 6, -11, -Math.PI / 2], ['science-inside', 29, -7, 0],
  ['city-hall-front', 0, 4, 0], ['garden-overview', 0, 44, 0],
];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto('http://127.0.0.1:5173');
await page.waitForFunction(() => window.__livistone?.snapshot().ready, null, { timeout: 60000 });
await page.click('#enter'); await page.waitForTimeout(300);
for (const [name, x, z, yaw] of views) {
  await page.evaluate(([x, z, yaw]) => window.__livistone.teleport(x, z, yaw), [x, z, yaw]);
  await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${name}.png` });
}
await page.keyboard.press('KeyM');
await page.click('#marker-energy'); await page.click('[data-action="zoom-in"]'); await page.click('[data-action="zoom-in"]');
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/energy-aerial.png` });
const s = await page.evaluate(() => window.__livistone.snapshot());
console.log(`saved ${views.length + 1} views to ${out}; fps ${s.fps}, draw calls ${s.calls}, triangles ${s.triangles}`);
await browser.close();
