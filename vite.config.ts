import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['livistone.liviazaharia.com'] },
  preview: { host: '0.0.0.0', allowedHosts: ['livistone.liviazaharia.com'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
