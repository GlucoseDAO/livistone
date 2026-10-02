// Fixed, reproducible captures for realism before/after reviews (docs/realism/00-harness.md).
// Needs a dev server: the ?capture=1 freeze and the __livistone hook exist only in dev builds.
// Usage: bun scripts/screenshot-realism.ts <outDir> <desktop|touch|software> [viewSet] [day|golden|night]
// Writes <outDir>/<profile>/<time>/<view>.png and captures.json. LIVISTONE_BENCHMARK_URL selects the server.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

type View = readonly [name: string, x: number, z: number, yaw: number, pitch?: number];
type Profile = 'desktop' | 'touch' | 'software';
interface Hook { snapshot(): Record<string, unknown> & { ready: boolean; mode: string; frames: number; capture: boolean }; teleport(x: number, z: number, yaw?: number, y?: number, pitch?: number): void }

// Coordinates follow scripts/screenshot-landmarks.mjs; pitch is radians, positive looks up.
const VIEWS: Record<string, View> = Object.fromEntries(([
  ['station-arrival', 0, 58, 0], ['arrival-meadow', 10, 52, -.9], ['garden-overview', 0, 52, 0], ['gateway-front', 0, 52, 0, .18],
  ['gateway-side', 9, 47, .92, .26], ['bridge-crossing', 0, 36, 0], ['garden-path', -14, 8, 1.2],
  ['city-hall-front', 0, 4, 0], ['energy-front', -29, 12, 0], ['energy-side', -4, -9, Math.PI / 2], ['science-front', 29, 14, 0], ['science-side', 6, -11, -Math.PI / 2],
  ['time-tower', 17, -15, 0, .4], ['embryo-station-front', 0, 43, Math.PI, .31], ['glucose-pavilion', 38, -23, 0, .23], ['railway-east-portal', 130, 79, -Math.PI / 2, .13],
  ['north-meadow', 0, -42, 0], ['meadow-ground', 10, 52, -.9, -.38], ['path-edge', -14, 8, 1.2, -.42], ['woodland-edge', -46, -12, Math.PI / 2, .12],
  ['bridge-bank', 14, 36, 1.0], ['shore-closeup', 14, 36, 1.0, -.34], ['east-tributary', 67, -5, .8, .08], ['west-tributary', -46, -12, Math.PI / 2],
  ['vittoria-lake', -18, -64, 0, .08], ['mycelium-grove', 74, -138, Math.PI, .18],
  ['city-hall-gallery', -2.4, -24, -.23], ['energy-gallery', -31.4, -10.5, -.28], ['science-gallery', 26.6, -12.2, -.28], ['energy-inside', -29, -5, 0], ['science-inside', 29, -7, 0],
  ['catalogue-poster', 2.51, -18.21, -2.409], ['embryo-station-platform', 0, 73, Math.PI - 1.1],
] as View[]).map(view => [view[0], view]));
const SETS: Record<string, string[]> = {
  quick: ['arrival-meadow', 'city-hall-front', 'energy-front', 'bridge-bank', 'east-tributary', 'meadow-ground', 'city-hall-gallery', 'vittoria-lake'],
  exteriors: ['station-arrival', 'garden-overview', 'gateway-front', 'gateway-side', 'bridge-crossing', 'city-hall-front', 'energy-front', 'energy-side', 'science-front', 'science-side', 'time-tower', 'embryo-station-front', 'glucose-pavilion', 'railway-east-portal'],
  ground: ['arrival-meadow', 'north-meadow', 'meadow-ground', 'path-edge', 'garden-path', 'woodland-edge'],
  water: ['bridge-bank', 'shore-closeup', 'east-tributary', 'west-tributary', 'vittoria-lake', 'mycelium-grove'],
  galleries: ['city-hall-gallery', 'energy-gallery', 'science-gallery', 'energy-inside', 'science-inside', 'catalogue-poster', 'embryo-station-platform'],
};
SETS.all = [...new Set(Object.values(SETS).flat())];

const [outDir, profileArg = 'desktop', setArg = 'quick', time = 'day'] = process.argv.slice(2);
if (!outDir) throw new Error('Usage: bun scripts/screenshot-realism.ts <outDir> <desktop|touch|software> [viewSet] [day|golden|night]');
if (!['desktop', 'touch', 'software'].includes(profileArg)) throw new Error('Choose desktop, touch or software.');
if (!['day', 'golden', 'night'].includes(time)) throw new Error('Choose day, golden or night.');
const profile = profileArg as Profile;
const names = SETS[setArg] ?? setArg.split(',');
for (const name of names) if (!VIEWS[name]) throw new Error(`Unknown view or set: ${name}. Sets: ${Object.keys(SETS).join(', ')}`);
const dir = `${outDir}/${profile}/${time}`; mkdirSync(dir, { recursive: true });

const base = process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5173';
const url = new URL(base); url.searchParams.set('capture', '1');
if (process.env.LIVISTONE_LOOK) url.searchParams.set('look', process.env.LIVISTONE_LOOK);
const software = profile === 'software', frameTimeout = software ? 240_000 : 60_000;
const gpu = software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', ...gpu] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: profile === 'touch', hasTouch: profile === 'touch', reducedMotion: 'reduce' });
const errors: string[] = [], captures: { name: string; view: View; snapshot: Record<string, unknown> }[] = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript((mode: string) => { try { localStorage.setItem('livistone-time-of-day', mode); } catch { /* capture still runs */ } }, time);
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
// Wait for real rendered frames, not wall time, so SwiftShader captures settle as GPU ones do.
const settle = async (count: number) => {
  const start = await page.evaluate(() => ((window as unknown as { __livistone: Hook }).__livistone.snapshot().frames));
  await page.waitForFunction(([from, n]) => (window as unknown as { __livistone: Hook }).__livistone.snapshot().frames >= from + n, [start, count], { timeout: frameTimeout, polling: 100 });
};
try {
  await page.goto(url.href, { timeout: 120_000 });
  await page.waitForFunction(() => { const hook = (window as unknown as { __livistone?: Hook }).__livistone; return !!hook && hook.snapshot().ready && hook.snapshot().mode === 'walking'; }, null, { timeout: software ? 600_000 : 180_000 });
  if (!(await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().capture))) errors.push('Server ignored ?capture=1; captures are not frozen (is this a dev server with the 00 harness?).');
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  for (const name of names) {
    const view = VIEWS[name]!; const [, x, z, yaw, pitch = 0] = view;
    await page.evaluate(([x, z, yaw, pitch]) => (window as unknown as { __livistone: Hook }).__livistone.teleport(x, z, yaw, 1.05, pitch), [x, z, yaw, pitch] as const);
    await settle(software ? 3 : 8);
    // Thumbnails and lazily built galleries finish asynchronously; give the network a moment, then settle again.
    await page.waitForLoadState('networkidle').catch(() => undefined); await settle(software ? 2 : 6);
    await page.screenshot({ path: `${dir}/${name}.png` });
    captures.push({ name, view, snapshot: await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot()) });
    console.log(`  ${profile}/${time}/${name}`);
  }
} finally {
  writeFileSync(`${dir}/captures.json`, JSON.stringify({ profile, time, set: setArg, url: url.href, commit, browser: browser.version(), viewport: { width: 1280, height: 800 }, capturedAt: new Date().toISOString(), errors, captures }, null, 2) + '\n');
  await browser.close();
}
console.log(`${dir}: ${captures.length}/${names.length} captures; errors: ${errors.length ? JSON.stringify(errors) : 'none'}`);
if (errors.length) process.exitCode = 1;
