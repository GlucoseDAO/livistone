// Matching daylight views for each Mitoring revision; needs the dev server and Chrome.
// Usage: node scripts/screenshot-mitoring.mjs [outDir] [desktop|touch|software]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'output/testing/mitoring', profile = process.argv[3] ?? 'desktop';
if (!['desktop', 'touch', 'software'].includes(profile)) throw new Error('Choose desktop, touch or software.');
mkdirSync(out, { recursive: true });
const gpu = profile === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', ...gpu] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: profile === 'touch', hasTouch: profile === 'touch', reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
const views = [['front', -29, 12, 0, .16], ['side', -8, -9, Math.PI / 2, .14], ['interior', -29, -5, 0, .30]];
try {
  await page.goto('http://127.0.0.1:5173', { timeout: 90000 });
  await page.waitForFunction(() => window.__livistone?.snapshot().ready && window.__livistone.snapshot().mode === 'walking', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  const canvas = page.locator('#world'), captures = [];
  const renderer = await canvas.evaluate(canvas => { const gl = canvas.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'); return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
  console.log(`${profile}: ${renderer}`);
  for (const [name, x, z, yaw, pitch] of views) {
    await page.evaluate(([x, z, yaw]) => window.__livistone.teleport(x, z, yaw), [x, z, yaw]);
    await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 400 - pitch / .0028, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/${name}.png` });
    captures.push({ name, snapshot: await page.evaluate(() => window.__livistone.snapshot()) });
    console.log(`Saved ${profile}/${name}`);
  }
  writeFileSync(`${out}/captures.json`, JSON.stringify({ profile, renderer, viewport: { width: 1280, height: 800 }, lighting: 'day', errors, captures }, null, 2) + '\n');
  console.log(JSON.stringify({ out, profile, renderer, errors, captures: captures.map(({ name, snapshot }) => ({ name, reduced: snapshot.reducedGraphics, fps: snapshot.fps, calls: snapshot.calls, triangles: snapshot.triangles })) }));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
