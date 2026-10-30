import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { STUMP_ISLAND as ISLAND, STUMP_OF_LIFE as STUMP, STUMP_BRIDGES, stumpWorld } from '../src/world/stump-of-life-layout';
import { GPU_ERROR } from '../tests/gpu-errors';
import { MATSU_COURTYARD as COURT, COURTYARD_CAMERAS, courtyardWorld } from '../src/world/matsu-courtyard-layout';

interface Hook {
  snapshot(): { ready: boolean; mode: string; frames: number; [key: string]: unknown };
  teleport(x: number, z: number, yaw?: number, y?: number, pitch?: number): void | Promise<void>;
  standingHeight(x: number, z: number): number | null;
}
type CaptureWindow = Window & { __livistone: Hook; __stumpPose?: number };
interface CaptureView { name: string; x: number; z: number; yaw: number; pitch: number; height?: number; hold?: boolean }
const out = process.argv[2] ?? 'output/testing/stump-of-life', base = process.env.LIVISTONE_BASE_URL ?? 'http://127.0.0.1:5173';
const backend = process.env.LIVISTONE_BACKEND === 'webgl' ? '&backend=webgl' : '';
const flags = backend ? ['--disable-features=WebGPU'] : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'];
mkdirSync(out, { recursive: true });
const offscreen = process.env.LIVISTONE_OFFSCREEN ? ['--window-position=-3000,0', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] : [];
const executablePath = process.env.LIVISTONE_CHROME_EXECUTABLE;
const browser = await chromium.launch({ channel: executablePath ? undefined : 'chrome', executablePath, headless: !process.env.PW_HEADED, args: [...process.env.PW_HEADED ? ['--ozone-platform=x11'] : [], ...offscreen, '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', ...flags] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }), errors: string[] = [];
page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
page.on('console', message => { if (message.type() === 'error' && GPU_ERROR.test(message.text())) { errors.push(message.text()); console.error(message.text()); } });
await page.addInitScript(() => { localStorage.setItem('livistone-time-of-day', 'day'); localStorage.setItem('livistone-radio-muted', 'true'); });
const target = new URL('/?graphics=gpu&capture=1' + backend, base);
target.searchParams.set('place', 'stump-of-life');
new URLSearchParams(process.env.LIVISTONE_PARAMS ?? '').forEach((value, key) => target.searchParams.set(key, value));
const url = target.href, captures: Record<string, unknown>[] = [];
try {
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => { const hook = (window as unknown as CaptureWindow).__livistone; return hook?.snapshot().ready && hook.snapshot().mode === 'walking'; }, null, { timeout: 180000 });
  console.log('Stump of Life ready; capturing native views.');
  await page.waitForFunction(() => !((window as unknown as CaptureWindow).__livistone.snapshot().probes as { baking?: string | null } | null)?.baking, null, { timeout: 240000 });
  const near = courtyardWorld({ x: COURT.stump.x - .9, z: COURT.stump.z + .9 }), onCap = courtyardWorld(COURT.stump);
  const cover = COURTYARD_CAMERAS.find(view => view.name === 'courtyard-external-overlook')!;
  const floor = courtyardWorld({ x: COURT.stump.x - 1.2, z: COURT.stump.z }), wood = courtyardWorld({ x: COURT.stump.x + .75, z: COURT.stump.z + .65 });
  const views: CaptureView[] = [
    { name: 'first-person-approach', x: STUMP.arrival.x, z: STUMP.arrival.z, yaw: STUMP.arrival.yaw, pitch: -.08 },
    { name: 'first-person-cap', ...near, yaw: Math.atan2(near.x - STUMP.x, near.z - STUMP.z), pitch: -.69, height: ISLAND.islandHeight + .85 },
    { name: 'first-person-dna-detail', ...onCap, yaw: COURT.yaw, pitch: -Math.PI / 2 + .001, height: ISLAND.capHeight + .15, hold: true },
    { name: 'project-poster', x: ISLAND.sign.x + Math.sin(ISLAND.sign.yaw) * 3.1, z: ISLAND.sign.z + Math.cos(ISLAND.sign.yaw) * 3.1, yaw: ISLAND.sign.yaw, pitch: .11 },
    { name: 'installation-oblique', x: ISLAND.x - 13, z: ISLAND.z - 15, yaw: -2.43, pitch: -.57, height: 13, hold: true },
    { ...cover, name: 'installation-cover' },
    { name: 'wood-low-oblique', ...wood, yaw: Math.atan2(wood.x - STUMP.x, wood.z - STUMP.z), pitch: -.19, height: ISLAND.islandHeight + .02, hold: true },
    { name: 'installation-above', x: ISLAND.x, z: ISLAND.z, yaw: ISLAND.yaw - 83.75 * Math.PI / 180, pitch: -Math.PI / 2 + .001, height: 27, hold: true },
    { name: 'floor-and-roots', ...floor, yaw: COURT.yaw, pitch: -Math.PI / 2 + .001, height: 2.5, hold: true },
    ...COURTYARD_CAMERAS,
  ];
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  const selected = new Set((process.env.LIVISTONE_VIEWS ?? '').split(',').filter(Boolean));
  for (const view of views.filter(view => !selected.size || selected.has(view.name))) {
    const y = view.height ?? await page.evaluate(([x, z]) => (window as unknown as CaptureWindow).__livistone.standingHeight(x, z) ?? 1.05, [view.x, view.z] as const);
    await page.evaluate(async ({ x, z, yaw, pitch, y, hold }) => {
      const w = window as unknown as CaptureWindow;
      if (w.__stumpPose !== undefined) cancelAnimationFrame(w.__stumpPose);
      await w.__livistone.teleport(x, z, yaw, y, pitch);
      if (hold) { const pin = (): void => { void w.__livistone.teleport(x, z, yaw, y, pitch); w.__stumpPose = requestAnimationFrame(pin); }; pin(); }
    }, { ...view, y, hold: !!view.hold });
    const frames = await page.evaluate(() => (window as unknown as CaptureWindow).__livistone.snapshot().frames);
    await page.waitForFunction(frames => (window as unknown as CaptureWindow).__livistone.snapshot().frames > frames + 12, frames, { timeout: 60000 });
    await page.screenshot({ path: `${out}/${view.name}.png` });
    captures.push({ ...view, capsuleY: y, snapshot: await page.evaluate(() => (window as unknown as CaptureWindow).__livistone.snapshot()) });
    console.log(`${out}/${view.name}.png`);
  }
  writeFileSync(`${out}/captures.json`, JSON.stringify({ url, capturedAt: new Date().toISOString(), browser: browser.version(), errors, captures }, null, 2) + '\n');
} catch (error) {
  const state = await page.evaluate(() => ({ snapshot: (window as unknown as CaptureWindow).__livistone?.snapshot(), loading: document.querySelector('#welcome')?.textContent })).catch(() => null);
  writeFileSync(`${out}/capture-failure.json`, JSON.stringify({ url, errors, state, error: String(error) }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
if (errors.length) throw new Error(errors.join('\n'));
