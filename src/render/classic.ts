// The default renderer: WebGLRenderer on WebGL 2. LIVISTONE_RENDERER=webgpu swaps this module for ./webgpu.ts at build time
// (vite.config.ts), so @livistone/render resolves to exactly one backend and this bundle carries no node-material code.
import * as THREE from 'three';
import { probeGraphics } from '../game/graphics';
import type { NodePatches, RenderView } from './types';

export const nodes: NodePatches | null = null;

export async function createRenderer(canvas: HTMLCanvasElement, antialias: boolean): Promise<RenderView> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
  return {
    backend: 'classic', renderer, graphics: probeGraphics(renderer.getContext() as WebGL2RenderingContext),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    onLost: (handler) => canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); handler(); }),
  };
}
