/** Local same-machine frame samples; no capture mode, so adaptive resolution remains active. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'output/testing/garden-performance.json';
const browser = await chromium.launch({ channel: 'chrome', args: process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors: string[] = [], samples: unknown[] = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.addInitScript(() => localStorage.setItem('livistone-time-of-day', 'day'));
  const start = Date.now();
  await page.goto(process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5181/');
  await page.waitForFunction(() => (window as any).__livistone?.snapshot().ready, null, { timeout: 240000 });
  const readyMs = Date.now() - start;
  const adapter = await page.evaluate(async () => {
    const a = await (navigator as any).gpu?.requestAdapter({ powerPreference: 'high-performance' });
    return a ? { vendor: a.info.vendor, architecture: a.info.architecture, device: a.info.device, description: a.info.description } : null;
  });
  console.log(JSON.stringify({ readyMs, adapter }));
  await page.waitForFunction(() => !(window as any).__livistone.snapshot().probes?.baking, null, { timeout: 240000 });
  for (const [name, x, z, yaw] of [['station', 0, 44, 0], ['rotunda', 128, -36, -Math.PI / 2], ['lake', -10, -130, Math.PI]] as const) {
    await page.evaluate(([x, z, yaw]) => (window as any).__livistone.teleport(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(5000);
    const readings: any[] = [];
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(1000); readings.push(await page.evaluate(() => (window as any).__livistone.snapshot())); }
    const sorted = readings.map(r => r.fps).sort((a, b) => a - b);
    const result = { name, medianFps: (sorted[4] + sorted[5]) / 2, minFps: sorted[0], maxFps: sorted[9], snapshot: readings.at(-1) };
    samples.push(result); console.log(JSON.stringify({ name, medianFps: result.medianFps, minFps: result.minFps, scale: result.snapshot.renderScale, triangles: result.snapshot.triangles, calls: result.snapshot.calls, tier: result.snapshot.graphicsTier }));
  }
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ viewport: { width: 1600, height: 900 }, readyMs, adapter, samples, errors }, null, 2));
} finally { await browser.close(); }
if (errors.length) throw new Error(errors.join('\n'));
