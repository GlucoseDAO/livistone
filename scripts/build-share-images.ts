// Renders the link-preview card (og:image) and the loading-screen backdrops from the running game.
// Needs a dev server: ?capture=1 freezes animation, render scale and physics so reruns are pixel-close.
// Usage: bun scripts/build-share-images.ts [outDir] [--readme]   (LIVISTONE_BENCHMARK_URL selects the server)
// The default set writes public/images/share; --readme writes the README's screenshots into docs/images (outside the build).
// Each pose renders once at twice the output density and is downsampled in Chrome, which also encodes the JPEG and WebP files,
// so no image library is needed. Rerun after changing anything visible from the arrival path, then review the files.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

interface Hook { snapshot(): { ready: boolean; mode: string; frames: number; capture: boolean; backend: string}; teleport(x: number, z: number, yaw?: number, y?: number, pitch?: number): void }
interface Output { file: string; width: number; height: number; type: 'image/jpeg' | 'image/webp'; quality: number }
interface Shot { name: string; viewport: [number, number]; pose: [x: number, z: number, yaw: number, pitch: number]; outputs: Output[]; map?: boolean }

// The gateway seen from the arrival path: LIVISTONE above the ring, City Hall framed in it, the ministries either side. The eye
// rises to 3.2 m (?eye) so the letters clear the tourmaline, which hides their feet from walking height this close, and the
// card stands close enough to leave the welcome board, 2.5 m ahead, out of frame. The wide backdrop turns left so the gate
// sits right of the loading text on desktop; phones show the centred card composition above the text.
const SHARE: Shot[] = [
  { name: 'gateway-card', viewport: [1200, 630], pose: [0, 48.6, 0, .1], outputs: [
    { file: 'livistone-gateway.jpg', width: 1200, height: 630, type: 'image/jpeg', quality: .84 },
    { file: 'loading-narrow.webp', width: 1200, height: 630, type: 'image/webp', quality: .8 },
  ] },
  { name: 'gateway-wide', viewport: [1600, 900], pose: [-1.5, 50, .3, .13], outputs: [
    { file: 'loading-wide.webp', width: 1920, height: 1080, type: 'image/webp', quality: .8 },
  ] },
];
// The README opens on the gate, then the civic centre (City Hall with the Ministry of Science and Timeface Tower beside it, the
// Ministry of Energy behind) and the aerial map with its labels, the one view that keeps the interface visible.
const README: Shot[] = [
  { name: 'readme-gateway', viewport: [1600, 900], pose: [0, 48.6, 0, .1], outputs: [{ file: 'livistone-gateway.jpg', width: 1600, height: 900, type: 'image/jpeg', quality: .84 }] },
  { name: 'readme-centre', viewport: [1600, 900], pose: [25, 15, .607, .08], outputs: [{ file: 'livistone-centre.jpg', width: 1600, height: 900, type: 'image/jpeg', quality: .84 }] },
  { name: 'readme-map', viewport: [1600, 900], pose: [0, 49.6, 0, .1], map: true, outputs: [{ file: 'livistone-map.jpg', width: 1600, height: 900, type: 'image/jpeg', quality: .84 }] },
];

const readme = process.argv.includes('--readme'), SHOTS = readme ? README : SHARE;
const out = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? (readme ? 'docs/images' : 'public/images/share'); mkdirSync(out, { recursive: true });
const url = new URL(process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5173');
url.searchParams.set('capture', '1'); url.searchParams.set('graphics', 'gpu'); url.searchParams.set('eye', '3.2');
const gpu = process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const webgpu = process.platform === 'linux' ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'] : [];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', ...gpu, ...webgpu] });
const context = await browser.newContext({ viewport: { width: SHOTS[0]!.viewport[0], height: SHOTS[0]!.viewport[1] }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage(), encoder = await context.newPage(), errors: string[] = [], written: string[] = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { try { localStorage.setItem('livistone-time-of-day', 'day'); } catch { /* the capture still runs */ } });
const settle = async (count: number) => {
  const start = await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().frames);
  await page.waitForFunction(([from, n]) => (window as unknown as { __livistone: Hook }).__livistone.snapshot().frames >= from + n, [start, count], { timeout: 60_000, polling: 100 });
};
try {
  await page.goto(url.href, { timeout: 120_000 });
  await page.waitForFunction(() => { const h = (window as unknown as { __livistone?: Hook }).__livistone; return !!h && h.snapshot().ready && h.snapshot().mode === 'walking'; }, null, { timeout: 180_000 });
  if (!(await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().capture))) throw new Error('Server ignored ?capture=1; use a dev server.');
  await page.addStyleTag({ content: 'html:not(.capture-ui) #app > :not(canvas) { visibility: hidden !important; }' });
  for (const shot of SHOTS) {
    await page.setViewportSize({ width: shot.viewport[0], height: shot.viewport[1] });
    await page.evaluate(([x, z, yaw, pitch]) => (window as unknown as { __livistone: Hook }).__livistone.teleport(x, z, yaw, 1.05, pitch), shot.pose);
    if (shot.map) { await page.evaluate(() => document.documentElement.classList.add('capture-ui')); await page.keyboard.press('m'); await page.waitForFunction(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().mode === 'map'); }
    // A teleported capsule settles over several frames and the nearby galleries load their photographs asynchronously.
    await settle(12); await page.waitForLoadState('networkidle').catch(() => undefined); await page.waitForTimeout(800); await settle(12);
    const png = `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;
    for (const output of shot.outputs) {
      const encoded = await encoder.evaluate(async ({ png, output }) => {
        const image = await createImageBitmap(await (await fetch(png)).blob(), { resizeWidth: output.width, resizeHeight: output.height, resizeQuality: 'high' });
        const canvas = new OffscreenCanvas(output.width, output.height); canvas.getContext('2d')!.drawImage(image, 0, 0);
        const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: output.type, quality: output.quality })).arrayBuffer());
        let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(binary);
      }, { png, output });
      const bytes = Buffer.from(encoded, 'base64'); writeFileSync(`${out}/${output.file}`, bytes);
      written.push(`${output.file} ${output.width}×${output.height} ${Math.round(bytes.length / 1024)} KB`);
    }
    if (shot.map) { await page.keyboard.press('m'); await page.evaluate(() => document.documentElement.classList.remove('capture-ui')); }
    console.log(`  ${shot.name}`);
  }
  const backend = await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().backend);
  const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
  writeFileSync(`${out}/captures.json`, JSON.stringify({ commit, backend, browser: browser.version(), capturedAt: new Date().toISOString(), shots: SHOTS, errors }, null, 2) + '\n');
} finally { await browser.close(); }
console.log(written.map(line => `${out}/${line}`).join('\n'));
if (errors.length) { console.error('page errors:', errors); process.exitCode = 1; }
