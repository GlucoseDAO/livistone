// Paired daylight measurements; touch emulation and actual software WebGL are separate profiles.
// Usage: node scripts/benchmark-city-hall.mjs [outDir] [desktop|touch|software] [repeats]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';

const out = process.argv[2] ?? 'output/testing/city-hall', profile = process.argv[3] ?? 'desktop', repeats = Number(process.argv[4] ?? 2);
if (!['desktop', 'touch', 'software'].includes(profile) || !Number.isInteger(repeats) || repeats < 1) throw new Error('Choose desktop, touch or software, and a positive repeat count.');
mkdirSync(out, { recursive: true });
const viewport = profile === 'touch' ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const gpu = profile === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', ...gpu] });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: profile === 'touch', hasTouch: profile === 'touch', reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], failedRequests = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
await page.addInitScript(() => {
  localStorage.setItem('livistone-time-of-day', 'day');
  localStorage.setItem('livistone-audio-enabled', 'false');
  const timing = window.__cityHallTiming = { enabled: false, frames: [], last: 0, current: null };
  // One cheap clear interception identifies rendered frames, excluding Gentle's skipped RAFs.
  const clear = WebGL2RenderingContext.prototype.clear;
  WebGL2RenderingContext.prototype.clear = function (...args) { if (timing.current) timing.current.rendered = true; return clear.apply(this, args); };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(timestamp => {
    if (!timing.enabled) { callback(timestamp); return; }
    const previous = timing.current, frame = { rendered: false }, start = performance.now(); timing.current = frame;
    callback(timestamp); timing.current = previous;
    if (frame.rendered) { if (timing.last) timing.frames.push({ interval: timestamp - timing.last, cpu: performance.now() - start }); timing.last = timestamp; }
  });
});
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const views = [['front', 0, 10, 0, .252], ['walnut-side', 18, -16, Math.atan2(18, 5), .25], ['interior', 0, -21, Math.PI, .12], ['map', 0, 10, 0, .252]];
let renderer, startupMs;
try {
  const start = Date.now();
  await page.goto(process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5173', { timeout: 90000 });
  await page.waitForFunction(() => window.__livistone?.snapshot().ready && window.__livistone.snapshot().mode === 'walking', null, { timeout: 180000 });
  startupMs = Date.now() - start;
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  renderer = await page.locator('#world').evaluate(canvas => { const gl = canvas.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'); return { name: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, userAgent: navigator.userAgent }; });
  console.log(`${profile}: ${renderer.name}; startup ${startupMs} ms`);
  for (const [name, x, z, yaw, pitch] of views) {
    await page.evaluate(([x, z, yaw]) => window.__livistone.teleport(x, z, yaw), [x, z, yaw]);
    await page.mouse.move(viewport.width / 2, viewport.height / 2); await page.mouse.down(); await page.mouse.move(viewport.width / 2, viewport.height / 2 - pitch / .0028, { steps: 4 }); await page.mouse.up();
    if (name === 'map') await page.keyboard.press('KeyM');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${name}.png` });
    for (let repeat = 0; repeat < repeats; repeat++) {
      const sample = await page.evaluate(async () => {
        const timing = window.__cityHallTiming; timing.frames = []; timing.last = 0; timing.enabled = true;
        const start = performance.now(); await new Promise(resolve => setTimeout(resolve, 6000));
        timing.enabled = false;
        return { durationMs: performance.now() - start, frames: timing.frames, snapshot: window.__livistone.snapshot(), heapBytes: performance.memory?.usedJSHeapSize ?? null };
      });
      const intervals = sample.frames.map(frame => frame.interval), cpu = sample.frames.map(frame => frame.cpu);
      const measurement = { name, repeat, frames: sample.frames.length, durationMs: sample.durationMs, fps: intervals.length ? 1000 * intervals.length / intervals.reduce((sum, value) => sum + value, 0) : 0, frameMsP50: quantile(intervals, .5), frameMsP95: quantile(intervals, .95), cpuMsP95: quantile(cpu, .95), heapBytes: sample.heapBytes, snapshot: sample.snapshot };
      captures.push(measurement); console.log(JSON.stringify(measurement));
    }
    if (name === 'map') await page.keyboard.press('KeyM');
  }
} finally {
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ profile, browser: browser.version(), machine: { cpu: cpus()[0]?.model, platform: platform(), release: release() }, viewport, renderer, startupMs, repeats, secondsPerSample: 6, lighting: 'day', instrumentation: 'RAF intervals for actual cleared/rendered frames; CPU wall time includes updates and submission, not GPU execution time.', errors, failedRequests, captures }, null, 2) + '\n');
  await browser.close();
}
if (errors.length) throw new Error(errors.join('\n'));
