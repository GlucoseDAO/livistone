import { defineConfig } from 'vitest/config';
import { THREE_WEBGPU } from './vite.config.ts';
// Unit tests load the same three/webgpu core as the game, so node materials and TSL are what they assert.
// The layout tests build whole meshes (path network and kerbs, railway apertures, the grass bake, crags): about 1–3 s alone, past
// the 5 s default when every worker runs at once on a loaded laptop (4 October 2026, load average 8–13).
export default defineConfig({ resolve: { alias: THREE_WEBGPU }, test: { include: ['tests/**/*.test.ts'], testTimeout: 20000 } });
