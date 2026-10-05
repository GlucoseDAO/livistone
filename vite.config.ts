import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { probeSignature } from './scripts/probe-signature.ts';
import { probeProblems, REBAKE } from './scripts/check-probes.ts';

// WebGPURenderer is the only renderer (docs/realism/20-webgpu-spike.md): `three` resolves to three/webgpu, so the game, its
// addons and TSL share one core. Where WebGPU is unavailable, WebGPURenderer falls back to its own WebGL 2 backend.
export const THREE_WEBGPU = [{ find: /^three$/, replacement: 'three/webgpu' }];

/**
 * A build whose saved reflection probes do not match its sources serves pages that ignore them and bake every probe live after
 * loading. Say so loudly; PROBES_STRICT=1 fails the build instead (not the default, so the server's pull-and-build still deploys).
 */
const checkProbes = (): Plugin => ({
  name: 'livistone-probe-check', apply: 'build',
  buildStart() {
    const problems = probeProblems(process.cwd(), false); if (!problems.length) return;
    const message = ['', '!'.repeat(100), 'Saved reflection probes do not match this build: visitors will bake reflections live after loading.', ...problems.map(problem => '  - ' + problem), '', REBAKE, '!'.repeat(100), ''].join('\n');
    if (process.env.PROBES_STRICT === '1') this.error(message); else console.warn(message);
  },
});

export default defineConfig({
  plugins: [checkProbes()],
  define: { 'import.meta.env.VITE_PROBE_REVISION': JSON.stringify(probeSignature()) },
  resolve: { alias: THREE_WEBGPU },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['livistone.liviazaharia.com'] },
  preview: { host: '0.0.0.0', allowedHosts: ['livistone.liviazaharia.com'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
