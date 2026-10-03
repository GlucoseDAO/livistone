import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// LIVISTONE_RENDERER=webgpu builds the WebGPURenderer bundle (docs/realism/20-webgpu-spike.md). The switch is build-time:
// @livistone/render resolves to one backend module, and in the WebGPU build `three` itself resolves to three/webgpu so every
// module and addon shares that core. The default bundle therefore carries no node-material or WebGPU code.
const webgpu = process.env.LIVISTONE_RENDERER === 'webgpu';
const backend = fileURLToPath(new URL(`./src/render/${webgpu ? 'webgpu' : 'classic'}.ts`, import.meta.url));

export default defineConfig({
  resolve: { alias: [{ find: /^@livistone\/render$/, replacement: backend }, ...(webgpu ? [{ find: /^three$/, replacement: 'three/webgpu' }] : [])] },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['livistone.liviazaharia.com'] },
  preview: { host: '0.0.0.0', allowedHosts: ['livistone.liviazaharia.com'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
