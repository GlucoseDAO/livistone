// The only renderer: WebGPURenderer, on WebGPU where navigator.gpu gives an adapter and on its own WebGL 2 backend elsewhere.
// Dev-only ?backend=webgl forces that fallback, so it can be reviewed on a WebGPU machine.
import * as THREE from 'three';
import { probeAdapter, probeGraphics } from '../game/graphics';
import type { AdapterInfo } from '../game/graphics';

/** The backend WebGPURenderer actually obtained; snapshot().backend reports it. */
export type Backend = 'webgpu' | 'webgl2-fallback';

export interface RenderView {
  readonly backend: Backend;
  readonly renderer: THREE.WebGPURenderer;
  /** The device probe for the GPU that renders: the WebGPU adapter, or the fallback's WebGL 2 context. */
  readonly graphics: ReturnType<typeof probeGraphics>;
  /** Draw calls and triangles of the last rendered frame, shadow passes and the output pass included. */
  stats(): { calls: number; triangles: number };
  /** Start counting a frame. Frames the cpu tier skips keep the previous count instead of reading zero. */
  beginFrame(): void;
  /** WebGPU device loss, or the fallback's lost WebGL context. */
  onLost(handler: () => void): void;
  /** Dev-only: node builds, shader programs and render pipelines created so far (snapshot().shaders); zeros in production. */
  shaders(): ShaderCounts;
}
export interface ShaderCounts { builds: number; programs: number; pipelines: number }

type GPUProbe = { requestAdapter(options?: { powerPreference?: string }): Promise<{ info?: AdapterInfo } | null> };

/**
 * A fallback (software) WebGPU adapter is the cpu tier, and software WebGL is that tier's long-tested path: headless Chrome's
 * SwiftShader WebGPU device was lost within the first frames on the dev laptop (3 Oct 2026), so such adapters render through
 * WebGPURenderer's WebGL 2 backend instead.
 */
async function softwareAdapter(): Promise<boolean> {
  try { return (await (navigator as Navigator & { gpu?: GPUProbe }).gpu?.requestAdapter({ powerPreference: 'high-performance' }))?.info?.isFallbackAdapter === true; } catch { return false; }
}

type SortItem = { groupOrder: number; renderOrder: number; z: number; id: number; material: THREE.Material & { transmission?: number; transmissionNode?: unknown } };
const transmissive = (item: SortItem): number => (item.material.transmission ?? 0) > 0 || item.material.transmissionNode ? 1 : 0;
/**
 * The classic renderer drew every transmissive surface before any transparent one; WebGPURenderer sorts both by distance in
 * one list. Without that order a night halo inside the Mitoring, farther than the cup's centre, drew first and the amber then
 * covered it. Within each group, three's own back-to-front order.
 */
function classicTransparentOrder(a: SortItem, b: SortItem): number {
  return transmissive(b) - transmissive(a) || a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || a.id - b.id;
}

export async function createRenderer(canvas: HTMLCanvasElement, antialias: boolean): Promise<RenderView> {
  const forceWebGL = (import.meta.env.DEV && new URLSearchParams(location.search).get('backend') === 'webgl') || await softwareAdapter();
  const renderer = new THREE.WebGPURenderer({ canvas, antialias, powerPreference: 'high-performance', forceWebGL });
  // The sky bake and PMREM need an initialised backend; the node PMREMGenerator throws before it.
  await renderer.init();
  // WebGPURenderer's own animation loop would reset these on every display frame, including ones the game skips.
  renderer.info.autoReset = false;
  renderer.setTransparentSort(classicTransparentOrder as unknown as Parameters<THREE.WebGPURenderer['setTransparentSort']>[0]);
  const backend = renderer.backend as THREE.Backend & { isWebGPUBackend?: boolean; device?: { adapterInfo?: AdapterInfo }; gl?: WebGL2RenderingContext };
  const webgpu = backend.isWebGPUBackend === true;
  // Dev-only counts, so a test or timing run can see which step builds shaders: each node build is a synchronous main-thread
  // cost on first sight of an object, and each pipeline a driver compile.
  const shaders: ShaderCounts = { builds: 0, programs: 0, pipelines: 0 };
  if (import.meta.env.DEV) {
    renderer.debug.onNodeBuilderCreated = () => { shaders.builds++; };
    const counted = backend as unknown as Record<'createProgram' | 'createRenderPipeline', (...args: unknown[]) => unknown>;
    for (const [method, key] of [['createProgram', 'programs'], ['createRenderPipeline', 'pipelines']] as const) {
      const create = counted[method].bind(backend); counted[method] = (...args) => { shaders[key]++; return create(...args); };
    }
  }
  return {
    backend: webgpu ? 'webgpu' : 'webgl2-fallback', renderer,
    // The fallback has a live WebGL 2 context, read exactly as the classic renderer's was.
    graphics: webgpu ? probeAdapter(backend.device?.adapterInfo ?? {}) : probeGraphics(backend.gl),
    stats: () => ({ calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles }),
    beginFrame: () => renderer.info.reset(),
    onLost: (handler) => { const report = renderer.onDeviceLost; renderer.onDeviceLost = (info) => { report.call(renderer, info); handler(); }; },
    shaders: () => ({ ...shaders }),
  };
}
