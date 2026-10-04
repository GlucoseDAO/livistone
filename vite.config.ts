import { defineConfig } from 'vite';
import { probeSignature } from './scripts/probe-signature.ts';

// WebGPURenderer is the only renderer (docs/realism/20-webgpu-spike.md): `three` resolves to three/webgpu, so the game, its
// addons and TSL share one core. Where WebGPU is unavailable, WebGPURenderer falls back to its own WebGL 2 backend.
export const THREE_WEBGPU = [{ find: /^three$/, replacement: 'three/webgpu' }];

export default defineConfig({
  define: { 'import.meta.env.VITE_PROBE_REVISION': JSON.stringify(probeSignature()) },
  resolve: { alias: THREE_WEBGPU },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['livistone.liviazaharia.com'] },
  preview: { host: '0.0.0.0', allowedHosts: ['livistone.liviazaharia.com'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
