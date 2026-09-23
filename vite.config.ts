import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true, allowedHosts: ['livistone.liviazaharia.com'] },
  preview: { allowedHosts: ['livistone.liviazaharia.com'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
