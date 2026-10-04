// Actual Winter plateau captures: node scripts/screenshot-winter-plateau.mjs [outDir]. Requires the dev server.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const outDir = process.argv[2] ?? 'output/testing/winter-plateau';
mkdirSync(outDir, { recursive: true });
const views = [
  ['winter-plateau-overview', -25, -235, .88, 110, -.78],
  ['winter-plateau-front', -57, -283, Math.PI / 2, 49, .22],
  ['winter-plateau-angle', -54, -268, 1.03, 54, .1],
  ['winter-chimney-head', -53.5, -274.4, 1.18, 45.3, .33],
  ['winter-plateau-inside', -74.8, -283, Math.PI / 2, 49.45, .3],
];
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--headless=new', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl',
  '--ignore-gpu-blocklist', '--disable-features=WebGPU',
] });
const probes = process.env.LIVISTONE_PROBES ?? 'off';
const captures = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  await page.goto(`${process.env.LIVISTONE_BASE_URL ?? 'http://localhost:5173'}/?capture=1&graphics=gpu&backend=webgl&probes=${probes}`, { waitUntil: 'commit', timeout: 15000 });
  for (const [name, x, z, yaw, y, pitch] of views) {
    let captured = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        // A shared workspace can hot-reload mid-capture. Wait for a complete scene again before saving that view.
        await page.waitForFunction(() => window.__livistone?.snapshot().ready, {}, { timeout: 180000 });
        await page.addStyleTag({ content: '#app > :not(canvas){visibility:hidden!important}' });
        await page.evaluate(pose => {
          clearInterval(window.captureHold);
          // Pin aerial cameras above the terrain while the simulation advances the operable iris normally.
          window.captureHold = setInterval(() => window.__livistone.teleport(...pose), 16);
          window.__livistone.teleport(...pose);
        }, [x, z, yaw, y, pitch]);
        await page.waitForTimeout(3000);
        if (!await page.evaluate(() => window.__livistone?.snapshot().ready)) continue;
        await page.screenshot({ path: `${outDir}/${name}.png` });
        if (!await page.evaluate(() => window.__livistone?.snapshot().ready)) continue;
        captures.push({ name, view: [x, z, yaw, y, pitch], snapshot: await page.evaluate(() => window.__livistone.snapshot()) });
        console.log(name); captured = true; break;
      } catch (error) { if (attempt === 7) throw error; }
    }
    if (!captured) throw new Error(`Scene kept reloading during ${name}`);
  }
  writeFileSync(`${outDir}/captures.json`, JSON.stringify({
    viewport: { width: 1536, height: 1024 }, renderer: 'Three.js WebGPURenderer, WebGL fallback',
    probes: probes === 'off' ? 'off (sky reflections)' : 'saved local reflections', camera: 'Held at each requested pose; simulation still advances the iris',
    capturedAt: new Date().toISOString(), errors, captures,
  }, null, 2) + '\n');
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
