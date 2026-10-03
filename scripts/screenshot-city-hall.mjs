// Actual game captures from fixed cameras; supports the isolated preview through LIVISTONE_BENCHMARK_URL.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'output/testing/city-hall', profile = process.argv[3] ?? 'desktop';
if (!['desktop', 'touch', 'software'].includes(profile)) throw new Error('Choose desktop, touch or software.');
mkdirSync(out, { recursive: true });
const gpu = profile === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
// Headless Linux Chrome offers a hardware WebGPU adapter only with these flags (the integrated GPU; see playwright.config.ts);
// software runs keep no adapter and render through the WebGL 2 fallback, as the realism harness does.
const webgpu = profile === 'software' || process.platform !== 'linux' ? [] : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', ...gpu, ...webgpu] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: profile === 'touch', hasTouch: profile === 'touch', reducedMotion: 'reduce' });
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
try {
  await page.goto(process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5173', { timeout: 90000 });
  await page.waitForFunction(() => window.__livistone?.snapshot().ready && window.__livistone.snapshot().mode === 'walking', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  for (const [name, x, z, yaw, pitch] of [['front', 0, 10, 0, .252], ['walnut-side', 18, -16, Math.atan2(18, 5), .25], ['interior', 0, -21, Math.PI, .12]]) {
    await page.evaluate(([x, z, yaw]) => window.__livistone.teleport(x, z, yaw), [x, z, yaw]);
    await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 400 - pitch / .0028, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(1800); await page.screenshot({ path: `${out}/${name}.png` });
    captures.push({ name, snapshot: await page.evaluate(() => window.__livistone.snapshot()) });
  }
  writeFileSync(`${out}/captures.json`, JSON.stringify({ profile, browser: browser.version(), viewport: { width: 1280, height: 800 }, lighting: 'day', errors, captures }, null, 2) + '\n');
  console.log(`${out}: ${captures.length} actual screenshots; errors: ${JSON.stringify(errors)}`);
} finally { await browser.close(); }
if (errors.length) throw new Error(errors.join('\n'));
