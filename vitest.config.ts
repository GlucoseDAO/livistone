import { defineConfig } from 'vitest/config';
import { THREE_WEBGPU } from './vite.config.ts';
// Unit tests load the same three/webgpu core as the game, so node materials and TSL are what they assert.
export default defineConfig({ resolve: { alias: THREE_WEBGPU }, test: { include: ['tests/**/*.test.ts'] } });
