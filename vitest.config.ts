import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// Unit tests run against the default (classic) renderer module; vite.config.ts swaps it for the WebGPU build.
export default defineConfig({ resolve: { alias: { '@livistone/render': fileURLToPath(new URL('./src/render/classic.ts', import.meta.url)) } }, test: { include: ['tests/**/*.test.ts'] } });
