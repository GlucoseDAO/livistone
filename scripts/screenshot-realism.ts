// Fixed, reproducible captures for realism before/after reviews (docs/realism/00-harness.md).
// Needs a dev server: the ?capture=1 freeze and the __livistone hook exist only in dev builds.
// Usage: bun scripts/screenshot-realism.ts <outDir> <desktop|touch|software> [viewSet] [day|golden|night]
// Writes <outDir>/<profile>/<time>/<view>.png and captures.json. LIVISTONE_BENCHMARK_URL selects the server.
// WebGPURenderer captures (docs/realism/20-webgpu-spike.md): desktop and touch get the flags that expose WebGPU to headless Chrome
// on Linux; LIVISTONE_PARAMS=backend=webgl forces its WebGL 2 fallback. captures.json records the backend and the time to ready.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

type View = readonly [name: string, x: number, z: number, yaw: number, pitch?: number, y?: number];
type Profile = 'desktop' | 'touch' | 'software';
interface Hook { snapshot(): Record<string, unknown> & { ready: boolean; mode: string; frames: number; capture: boolean }; teleport(x: number, z: number, yaw?: number, y?: number, pitch?: number): void; standingHeight?(x: number, z: number): number | null }

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
  // October 2026 owner reports: distant City Hall glass, Nanot arch, Future House entry, path joins, grass in the gardens, sky and ridges.
  ['city-hall-far', 25, 15, .607, .08], ['city-hall-north', 12, -48, 2.723, .08], ['nanot-arch', 29, 6, 0, .12],
  ['future-house-entry', -30, -105, Math.PI / 2, .1], ['future-house-neck', -36, -105.25, 1.3258, .15],
  ['junction-garden', 6, 12, .876, -.5], ['junction-glucose', 22, -30, -.876, -.5], ['junction-station', 6, 53, .98, -.5],
  ['enhancement-front', 100, -154.6, .575, .05], ['grove-floor', 78, -118, Math.PI, -.3], ['sky-up', 0, 58, .5, .6], ['ridge-northwest', -30, -105, Math.PI / 4, .12],
  // Sub-plan 26: the skyline down the river valley, from the Enhancement summit (dropped from 24 m onto the hill) and below the north ridges.
  // October 2026 owner report: lake water-cell kerbs crossing the garden paving, and the lake jewel stands seen from behind.
  ['lake-path', -10, -122, 0, -.1], ['lake-path-down', -10, -134, 0, -.55], ['lake-crossing', 3, -112, -1.45, -.4], ['vittoria-back', -16, -169, Math.PI, .05], ['dewdrop-back', -12, -118, Math.PI, .02],
  ['lake-west-pools', -27, -101, Math.PI / 2 + .15, -.35], ['lake-east-pool', 2.5, -106, 2.55, -.45],
  // October 2026 owner report: the opal rill lying on the Mycelium paths.
  ['rill-crossing', 68, -86, 1.25, -.22], ['rill-culvert', 65, -105, Math.PI / 2 + .25, -.25], ['rill-culvert-down', 57, -104, 0, -.5], ['rill-culvert-mouth', 62.8, -105.9, Math.PI / 4, -.55],
  ['valley-east', 16, 42, -Math.PI / 2, .06], ['summit-northwest', 80, -174, 1, .02, 24], ['summit-southwest', 80, -174, 2.4, -.05, 24], ['ridge-north', 0, -150, 0, .1],
  // Sub-plans 07/08: each building-piece's metal, stone and amber at arm's length, beside the existing front and side views.
  ['nanot-close', 36, -1, .611, .25], ['station-ring-close', 5, 52, 2.583, .3], ['time-tower-close', 24, -30, .661, .35],
  ['future-house-legs', -50, -96, Math.PI / 4, .3], ['gateway-gem', 3, 46, .477, .55],
] as View[]).map(view => [view[0], view]));
const SETS: Record<string, string[]> = {
  quick: ['arrival-meadow', 'city-hall-front', 'energy-front', 'bridge-bank', 'east-tributary', 'meadow-ground', 'city-hall-gallery', 'vittoria-lake'],
  exteriors: ['station-arrival', 'garden-overview', 'gateway-front', 'gateway-side', 'bridge-crossing', 'city-hall-front', 'energy-front', 'energy-side', 'science-front', 'science-side', 'time-tower', 'embryo-station-front', 'glucose-pavilion', 'railway-east-portal'],
  ground: ['arrival-meadow', 'north-meadow', 'meadow-ground', 'path-edge', 'garden-path', 'woodland-edge'],
  water: ['bridge-bank', 'shore-closeup', 'east-tributary', 'west-tributary', 'vittoria-lake', 'mycelium-grove'],
  galleries: ['city-hall-gallery', 'energy-gallery', 'science-gallery', 'energy-inside', 'science-inside', 'catalogue-poster', 'embryo-station-platform'],
  lake: ['lake-path', 'lake-path-down', 'lake-crossing', 'lake-west-pools', 'lake-east-pool', 'vittoria-lake', 'vittoria-back', 'dewdrop-back'],
  intersections: ['rill-crossing', 'rill-culvert', 'rill-culvert-down', 'rill-culvert-mouth'],
  skyline: ['valley-east', 'summit-northwest', 'summit-southwest', 'ridge-north'],
  // Sub-plan 08: front, side and close views of the five building-pieces (Science, Station, Time Tower, Future House, Gateway).
  materials: ['science-front', 'science-side', 'nanot-arch', 'nanot-close', 'science-inside', 'embryo-station-front', 'station-ring-close', 'embryo-station-platform', 'time-tower', 'time-tower-close', 'future-house-entry', 'future-house-legs', 'future-house-neck', 'gateway-front', 'gateway-side', 'gateway-gem'],
  fixes: ['city-hall-far', 'city-hall-north', 'nanot-arch', 'future-house-entry', 'future-house-neck', 'junction-garden', 'junction-glucose', 'junction-station', 'enhancement-front', 'grove-floor', 'mycelium-grove', 'sky-up', 'ridge-northwest', 'railway-east-portal'],
};
// `all` keeps the 33 realism views; these sets are reviewed on their own.
const REVIEWED_ALONE = ['fixes', 'skyline', 'lake', 'intersections', 'materials'];
SETS.all = [...new Set(Object.entries(SETS).filter(([set]) => !REVIEWED_ALONE.includes(set)).flatMap(([, views]) => views))];

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
// Several sub-plans keep their own dev switches (?ground=b, ?look=a…); LIVISTONE_PARAMS adds any of them.
// Desktop captures review the full gpu tier even on an iGPU laptop that would now probe as mobile (sub-plan 22).
if (profileArg === 'desktop') url.searchParams.set('graphics', 'gpu');
for (const [key, value] of new URLSearchParams(process.env.LIVISTONE_PARAMS ?? '')) url.searchParams.set(key, value);
const software = profile === 'software', frameTimeout = software ? 240_000 : 60_000;
const gpu = software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
// Vulkan gives headless Chrome a hardware WebGPU adapter; WebGL keeps its flags above. The low-power (integrated) adapter is
// forced because headless canvas presentation fails on the NVIDIA dGPU here, and it is the GPU the WebGL captures use anyway.
// Software gets no WebGPU adapter, as on a machine without a GPU, so it renders through the automatic WebGL 2 fallback.
const webgpu = software || process.platform !== 'linux' ? [] : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', ...gpu, ...webgpu] });
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
// A teleported capsule drops or steps onto the ground over several physics steps (one per frame under ?capture=1). Wait until
// it has held its position for a few frames, so no view depends on how long the network took (bridge-bank was caught mid-drop).
const still = async (frames: number) => {
  await page.evaluate(() => { delete (window as unknown as { __still?: unknown }).__still; });
  await page.waitForFunction((n) => {
    const w = window as unknown as { __livistone: Hook; __still?: { at: string; since: number } };
    const s = w.__livistone.snapshot(), p = s.position as { x: number; y: number; z: number } | undefined;
    if (!p) return false;
    const at = [p.x, p.y, p.z].map((v) => v.toFixed(3)).join();
    if (w.__still?.at !== at) { w.__still = { at, since: s.frames }; return false; }
    return s.frames - w.__still.since >= n;
  }, frames, { timeout: frameTimeout, polling: 100 });
};
let readyMs: number | null = null, standing = false;
try {
  const loadStart = performance.now();
  await page.goto(url.href, { timeout: 120_000 });
  await page.waitForFunction(() => { const hook = (window as unknown as { __livistone?: Hook }).__livistone; return !!hook && hook.snapshot().ready && hook.snapshot().mode === 'walking'; }, null, { timeout: software ? 600_000 : 180_000 });
  readyMs = Math.round(performance.now() - loadStart);
  if (!(await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot().capture))) errors.push('Server ignored ?capture=1; captures are not frozen (is this a dev server with the 00 harness?).');
  await page.addStyleTag({ content: '#app > :not(canvas) { visibility: hidden !important; }' });
  // Each view stands on whatever lies under it (ground, bridge deck or floor) through the hook's standingHeight. The fixed
  // y = 1.05 of earlier captures sank the capsule into raised meadow (north-meadow's eye stood about 1.1 m up); a server
  // without the hook still gets that fixed height, and captures.json records which one ran.
  standing = await page.evaluate(() => typeof (window as unknown as { __livistone: Hook }).__livistone.standingHeight === 'function');
  for (const name of names) {
    // A view with its own height (the Enhancement summit) drops from there; the others stand on what lies under them.
    const view = VIEWS[name]!; const [, x, z, yaw, pitch = 0, height] = view;
    const y = height ?? await page.evaluate(([x, z]) => (window as unknown as { __livistone: Hook }).__livistone.standingHeight?.(x, z) ?? 1.05, [x, z] as const);
    await page.evaluate(([x, z, yaw, y, pitch]) => (window as unknown as { __livistone: Hook }).__livistone.teleport(x, z, yaw, y, pitch), [x, z, yaw, y, pitch] as const);
    await settle(software ? 3 : 8);
    // Thumbnails and lazily built galleries finish asynchronously; give the network a moment, then settle again.
    await page.waitForLoadState('networkidle').catch(() => undefined); await still(software ? 2 : 4); await settle(software ? 2 : 6);
    await page.screenshot({ path: `${dir}/${name}.png` });
    captures.push({ name, view, snapshot: await page.evaluate(() => (window as unknown as { __livistone: Hook }).__livistone.snapshot()) });
    // Sub-plan 25: the frame's draws by town group (all passes), heaviest first, so the budget reads off the log.
    const budget = Object.entries((captures.at(-1)!.snapshot.budget ?? {}) as Record<string, { calls: number; triangles: number }>).sort((a, b) => b[1].triangles - a[1].triangles).slice(0, 5);
    if (budget.length) console.log(`    ${captures.at(-1)!.snapshot.calls} calls, ${captures.at(-1)!.snapshot.triangles} triangles; ` + budget.map(([group, cost]) => `${group} ${cost.calls}/${Math.round(cost.triangles / 1000)}k`).join(' · '));
    console.log(`  ${profile}/${time}/${name}`);
  }
} finally {
  writeFileSync(`${dir}/captures.json`, JSON.stringify({ profile, time, set: setArg, url: url.href, commit, backend: captures[0]?.snapshot.backend ?? null, webgpuFlags: !!webgpu.length, readyMs, teleport: standing ? 'standing' : 'fixed y 1.05', browser: browser.version(), viewport: { width: 1280, height: 800 }, capturedAt: new Date().toISOString(), errors, captures }, null, 2) + '\n');
  await browser.close();
}
console.log(`${dir}: ${captures.length}/${names.length} captures; errors: ${errors.length ? JSON.stringify(errors) : 'none'}`);
if (errors.length) process.exitCode = 1;
