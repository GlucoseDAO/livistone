// Screenshots each civic building from outside and inside for visual review.
// Needs the dev server (bun run dev) and Google Chrome; uses the GPU when one is available (D3D11 on Windows).
// Usage: node scripts/screenshot-landmarks.mjs [outDir]   (default output/testing/landmarks)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'output/testing/landmarks'; mkdirSync(out, { recursive: true });
const views = [
  ['time-tower', 17, -15, 0, .4], ['west-tributary', -46, -12, Math.PI / 2], ['east-tributary', 67, -5, .8, .08],
  ['energy-front', -29, 12, 0], ['energy-side', -4, -9, Math.PI / 2], ['energy-inside', -29, -5, 0], ['energy-hall', -36.5, -9, -Math.PI / 2],
  ['science-front', 29, 14, 0], ['science-side', 6, -11, -Math.PI / 2], ['science-inside', 29, -7, 0],
  ['city-hall-front', 0, 4, 0], ['garden-overview', 0, 52, 0],
  ['gateway-front', 0, 52, 0, .18], ['gateway-side', 9, 47, .92, .26], ['gateway-reverse', 0, 33, Math.PI, .25],
  ['bridge-bank', 14, 36, 1.0], ['bridge-crossing', 0, 36, 0], ['garden-path', -14, 8, 1.2],
  ['city-hall-gallery', -2.4, -24, -.23], ['energy-gallery', -31.4, -10.5, -.28], ['science-gallery', 26.6, -12.2, -.28],
  ['embryo-station-front', 0, 43, Math.PI, .31], ['embryo-station-platform', 0, 73, Math.PI - 1.1],
  ['railway-east-portal', 130, 79, -Math.PI / 2, .13], ['railway-west-portal', -130, 79, Math.PI / 2, .13],
  ['railway-detail', 55, 76.6, -Math.PI / 2, -.22], ['railway-inside', 200, 79, -Math.PI / 2, .07],
  ['glucose-pavilion', 38, -23, 0, .23], ['glucose-interior', 38, -40, -Math.PI / 2, .22],
  ['vittoria-lake', -18, -64, 0, .08], ['mycelium-grove', 74, -138, Math.PI, .18],
  ['station-arrival', 0, 58, 0], ['arrival-meadow', 10, 52, -.9], ['north-meadow', 0, -42, 0],
  ['catalogue-poster', 2.51, -18.21, -2.409],
];
const gpu = process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', ...gpu] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultNavigationTimeout(90000); page.setDefaultTimeout(90000);
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto('http://127.0.0.1:5173');
await page.waitForFunction(() => window.__livistone?.snapshot().ready, null, { timeout: 60000 });
await page.waitForFunction(() => window.__livistone?.snapshot().mode === 'walking'); await page.waitForTimeout(300);
for (const [name, x, z, yaw, pitch = 0] of views) {
  await page.evaluate(([x, z, yaw]) => window.__livistone.teleport(x, z, yaw), [x, z, yaw]);
  if (pitch) { await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 400 - pitch / .0028, { steps: 4 }); await page.mouse.up(); }
  await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${name}.png` });
}
await page.waitForFunction(() => window.__livistone.snapshot().interaction === 'ammonite');
await page.keyboard.press('KeyE'); await page.waitForTimeout(600); await page.screenshot({ path: `${out}/catalogue-desktop.png` });
await page.getByRole('button', { name: 'Continue exploring' }).click();
await page.keyboard.press('KeyM');
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/town-aerial.png` });
await page.click('[data-action="zoom-in"]'); await page.click('[data-action="zoom-in"]');
await page.waitForTimeout(600); await page.screenshot({ path: `${out}/town-aerial-close.png` });
const s = await page.evaluate(() => window.__livistone.snapshot());
console.log(`saved ${views.length + 3} views to ${out}; fps ${s.fps}, draw calls ${s.calls}, triangles ${s.triangles}`);
await browser.close();
