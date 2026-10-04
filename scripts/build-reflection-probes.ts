// Run against the dev server: bun scripts/build-reflection-probes.ts [webgl|webgpu].
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { ProbeManifest, SavedProbe } from '../src/world/saved-probes';
import { probeSignature } from './probe-signature';
import { packProbeAtlas } from './probe-atlas';

const backend = process.argv[2] ?? 'webgl';
if (!['webgl', 'webgpu'].includes(backend)) throw new Error('Choose webgl or webgpu');
const dir = 'public/probes', url = process.env.LIVISTONE_BASE_URL ?? 'http://127.0.0.1:5173';
const flags = backend === 'webgl' ? ['--disable-features=WebGPU'] : process.platform === 'linux' ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'] : [];
const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.PW_HEADED, args: ['--disable-dev-shm-usage', ...(process.env.PW_HEADED && process.platform === 'linux' ? ['--ozone-platform=x11'] : []), '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', ...flags] });
try {
  for (const tier of ['gpu', 'mobile']) for (const phase of ['day', 'night']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await context.newPage();
    try {
      await page.addInitScript(phase => { localStorage.setItem('livistone-time-of-day', phase); }, phase);
      await page.goto(`${url}/?graphics=${tier}&capture=1&probes=bake${backend === 'webgl' ? '&backend=webgl' : ''}`);
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('#tools button')?.disabled === false, null, { timeout: 120000 });
      const exported = await page.evaluate(async () => {
        type Atlas = { id: string; width: number; height: number; data: Uint16Array };
        const result = await (window as unknown as { __exportProbes(): Promise<{ revision: string; backend: string; size: number; phase: string; probes: Atlas[] }> }).__exportProbes();
        const probes = [];
        for (const atlas of result.probes) {
          const blob = new Blob([atlas.data.buffer as ArrayBuffer]), reader = new FileReader();
          const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
          probes.push({ id: atlas.id, width: atlas.width, height: atlas.height, data });
        }
        return { ...result, probes };
      });
      if (exported.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl2-fallback') || !exported.probes.length) throw new Error(`Expected ${backend} reflection bake, got ${exported.backend}`);
      if (exported.revision !== probeSignature()) throw new Error('Town sources changed during the bake. Restart the dev server and bake the current version.');
      let manifest: ProbeManifest = { revision: exported.revision, sets: {} };
      try { const previous = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')) as ProbeManifest; if (previous.revision === exported.revision) manifest = previous; } catch { /* First bake. */ }
      const key = `${backend}-${exported.size}-${phase}`, entries: SavedProbe[] = []; mkdirSync(`${dir}/${key}`, { recursive: true });
      let bytes = 0;
      for (const atlas of exported.probes) {
        const file = `${key}/${atlas.id}-${exported.revision}.bin.gz`, readback = Buffer.from(atlas.data, 'base64');
        const pixels = packProbeAtlas(new Uint16Array(readback.buffer, readback.byteOffset, readback.byteLength / 2), atlas.width, atlas.height), packed = gzipSync(Buffer.from(pixels.buffer), { level: 9 });
        writeFileSync(`${dir}/${file}`, packed); bytes += packed.length; entries.push({ id: atlas.id, width: atlas.width, height: atlas.height, file });
      }
      manifest.sets[key] = entries; writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
      console.log(`${key}: ${entries.length} filtered HDR atlases, ${(bytes / 1048576).toFixed(2)} MiB`);
    } finally { await context.close(); }
  }
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')) as ProbeManifest, used = new Set(Object.values(manifest.sets).flat().map(entry => entry.file));
  for (const folder of readdirSync(dir, { withFileTypes: true })) if (folder.isDirectory() && /^(webgl|webgpu)-(128|256)-(day|night)$/.test(folder.name)) {
    for (const file of readdirSync(`${dir}/${folder.name}`)) if (file.endsWith('.bin.gz') && !used.has(`${folder.name}/${file}`)) unlinkSync(`${dir}/${folder.name}/${file}`);
  }
} finally { await browser.close(); }
