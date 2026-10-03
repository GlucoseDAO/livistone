// Load and day/night switch timings with and without the reflection probes (realism 07), in interleaved pairs.
// Needs a dev server: the __livistone hook and its load marks and shader counts exist only in dev builds.
// Usage: bun scripts/probe-timings.ts <out.json> [desktop|touch] [pairs] — LIVISTONE_BENCHMARK_URL selects the server,
// LIVISTONE_PARAMS adds switches to both runs of a pair (e.g. backend=webgl), LIVISTONE_COMPARE the switches of the
// second run (default probes=off). Desktop forces the gpu tier as the realism captures do; touch emulates a phone and
// probes as mobile. Every run starts a fresh browser, so no shader or pipeline cache carries over. Headless timings on a
// shared GPU are not device benchmarks: compare pairs, not single numbers.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [out, profile = 'desktop', pairsArg = '3'] = process.argv.slice(2);
if (!out || !['desktop', 'touch'].includes(profile)) throw new Error('Usage: bun scripts/probe-timings.ts <out.json> [desktop|touch] [pairs]');
const base = process.env.LIVISTONE_BENCHMARK_URL ?? 'http://127.0.0.1:5173', pairs = Number(pairsArg);
const compare = new URLSearchParams(process.env.LIVISTONE_COMPARE ?? 'probes=off');
const webgl = new URLSearchParams(process.env.LIVISTONE_PARAMS ?? '').get('backend') === 'webgl';
const gpu = process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'];
const webgpu = process.platform !== 'linux' || webgl ? [] : ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'];

interface Snapshot { ready: boolean; mode: string; night: boolean; frames: number; backend: string; graphicsTier: string; probes: (Record<string, number> & { baking?: string | null }) | null; load: Record<string, number>; shaders: { builds: number; programs: number; pipelines: number } }
type Hooked = Window & { __livistone?: { snapshot(): Snapshot }; __frames: number[]; __long: [number, number][] };

/** Frames from `from` for `span` ms: the tenth frame, the median, 95th percentile and longest gaps, and every gap over 100 ms. */
function frames(times: number[], from: number, span: number) {
  const after = times.filter(t => t >= from && t <= from + span), gaps = after.slice(1).map((t, i) => t - after[i]), sorted = [...gaps].sort((a, b) => a - b);
  const at = (q: number) => sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]) : null;
  return { tenth: after.length >= 10 ? Math.round(after[9] - from) : null, count: after.length, median: at(.5), p95: at(.95), longest: Math.round(Math.max(0, ...gaps)), hitches: gaps.filter(g => g > 100).map(Math.round) };
}
/** Until the probe bake in progress (snapshot().probes.baking) has finished, then two more seconds; ten seconds without one. */
const settleBake = (page: import('playwright').Page) => page.evaluate(async () => {
  const hook = (window as unknown as Hooked).__livistone!, start = performance.now();
  while (hook.snapshot().probes?.baking && performance.now() - start < 240_000) await new Promise(resolve => setTimeout(resolve, 100));
  const end = performance.now(); await new Promise(resolve => setTimeout(resolve, Math.max(2000, 10_000 - (end - start)))); return Math.round(end - start);
});

async function run(extra: URLSearchParams) {
  const url = new URL(base);
  if (profile === 'desktop') url.searchParams.set('graphics', 'gpu');
  for (const [key, value] of new URLSearchParams(process.env.LIVISTONE_PARAMS ?? '')) url.searchParams.set(key, value);
  for (const [key, value] of extra) url.searchParams.set(key, value);
  const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-dev-shm-usage', '--headless=new', ...gpu, ...webgpu, ...(webgl ? ['--disable-features=WebGPU'] : [])] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: profile === 'touch', hasTouch: profile === 'touch' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      try { localStorage.setItem('livistone-time-of-day', 'day'); } catch { /* still day or night */ }
      const w = window as unknown as Hooked; w.__frames = []; w.__long = [];
      const tick = (t: number) => { w.__frames.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) w.__long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* no long tasks */ }
    });
    const start = performance.now();
    await page.goto(url.href, { timeout: 120_000 });
    await page.waitForFunction(() => { const s = (window as unknown as Hooked).__livistone?.snapshot(); return !!s?.ready && s.mode === 'walking'; }, null, { timeout: 240_000 });
    const readyMs = Math.round(performance.now() - start);
    // Walking frames after ready until the probes have baked and two seconds more (ten seconds at least): background work
    // (the after-ready bake) shows as long frames here.
    const baking = await settleBake(page);
    const loaded = await page.evaluate(() => { const w = window as unknown as Hooked; return { snapshot: w.__livistone!.snapshot(), frames: w.__frames.slice(), long: w.__long.slice(), now: performance.now() }; });
    const ready = loaded.snapshot.load.ready;
    // The first switch to night, through the menu's select: its handler runs the switch synchronously; then three game frames.
    const night = await page.evaluate(async () => {
      const w = window as unknown as Hooked, hook = w.__livistone!, select = document.querySelector<HTMLSelectElement>('#time-of-day')!;
      const before = hook.snapshot().shaders, t0 = performance.now(); select.value = 'night'; select.dispatchEvent(new Event('change', { bubbles: true }));
      const sync = performance.now() - t0, frame = hook.snapshot().frames;
      await new Promise<void>(resolve => { const wait = () => hook.snapshot().frames >= frame + 3 ? resolve() : requestAnimationFrame(wait); requestAnimationFrame(wait); });
      const settled = performance.now() - t0, start = performance.now();
      while (hook.snapshot().probes?.baking && performance.now() - start < 240_000) await new Promise(resolve => setTimeout(resolve, 100));
      const baked = performance.now() - t0; await new Promise(resolve => setTimeout(resolve, Math.max(2000, 8000 - baked)));
      const after = hook.snapshot(); return { t0, sync: Math.round(sync), settled: Math.round(settled), baked: Math.round(baked), span: performance.now() - t0, night: after.night, probes: after.probes, builds: after.shaders.builds - before.builds, pipelines: after.shaders.pipelines - before.pipelines, frames: w.__frames.slice(), long: w.__long.slice() };
    });
    const memory = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);
    return {
      url: url.search, readyMs, backend: loaded.snapshot.backend, tier: loaded.snapshot.graphicsTier, load: loaded.snapshot.load, probes: loaded.snapshot.probes, shaders: loaded.snapshot.shaders,
      baking, afterReady: frames(loaded.frames, ready, loaded.now - ready), longAfterReady: loaded.long.filter(([t]) => t >= ready).map(([t, d]) => [Math.round(t - ready), Math.round(d)]),
      night: { sync: night.sync, settled: night.settled, baked: night.baked, isNight: night.night, probes: night.probes, builds: night.builds, pipelines: night.pipelines, frames: frames(night.frames, night.t0, night.span), long: night.long.filter(([t]) => t >= night.t0).map(([t, d]) => [Math.round(t - night.t0), Math.round(d)]) },
      heap: memory, errors,
    };
  } finally { await browser.close(); }
}

const results: { pair: number; variant: string; result: Awaited<ReturnType<typeof run>> }[] = [];
for (let pair = 0; pair < pairs; pair++) {
  // Alternate which run goes first, so a machine that warms up or gets busier does not favour one side.
  const order: [string, URLSearchParams][] = [['probes', new URLSearchParams()], [compare.toString(), compare]];
  for (const [variant, params] of pair % 2 ? order.reverse() : order) {
    const result = await run(params); results.push({ pair, variant, result });
    const l = result.load, n = result.night;
    const a = result.afterReady, p = result.probes;
    console.log(`${pair} ${variant.padEnd(12)} ready ${result.readyMs} ms (page ${l.ready}; compiled ${l.compiled - l.prepared}, shadowed ${l.shadowed - l.compiled}, baked ${l.baked - l.shadowed}, bakedGpu ${l.bakedGpu ? l.bakedGpu - l.shadowed : '-'}, stage ${l.ready - l.baked}) builds ${result.shaders.builds} pipelines ${result.shaders.pipelines} · after ready ${a.count} frames: 10th ${a.tenth} ms, median ${a.median}, p95 ${a.p95}, longest ${a.longest} ms${p && p.dayEnd ? `, bake ${p.dayEnd - p.dayStart} ms over ${p.daySteps} steps (${p.day} ms main), GPU done +${(p.dayGpu ?? p.dayEnd) - p.dayEnd} ms` : ''} · night: sync ${n.sync} ms, settled ${n.settled} ms, baked ${n.baked} ms, median ${n.frames.median}, p95 ${n.frames.p95}, longest ${n.frames.longest} ms, builds +${n.builds}, pipelines +${n.pipelines}${result.errors.length ? ' · errors ' + JSON.stringify(result.errors) : ''}`);
    writeFileSync(out, JSON.stringify({ base, profile, params: process.env.LIVISTONE_PARAMS ?? '', compare: compare.toString(), capturedAt: new Date().toISOString(), results }, null, 2) + '\n');
  }
}
