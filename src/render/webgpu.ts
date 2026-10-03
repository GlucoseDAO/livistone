// WebGPU build only (LIVISTONE_RENDERER=webgpu, see vite.config.ts): `three` resolves to three/webgpu and @livistone/render to
// this module. WebGPURenderer falls back to its own WebGL 2 backend where WebGPU is unavailable; dev ?backend=webgl forces it.
import * as THREE from 'three/webgpu';
import { probeAdapter, probeGraphics } from '../game/graphics';
import type { AdapterInfo } from '../game/graphics';
import { nodePatches } from './webgpu-nodes';
import type { NodePatches, RenderView } from './types';

export const nodes: NodePatches | null = nodePatches;

/** WebGLRenderer semantics the shared game code relies on: statistics per render() call and renderer-level static shadows. */
class TownRenderer extends THREE.WebGPURenderer {
  declare shadowMap: THREE.WebGPURenderer['shadowMap'] & { autoUpdate: boolean; needsUpdate: boolean };
  private lightsAutoUpdate = true;
  constructor(parameters: ConstructorParameters<typeof THREE.WebGPURenderer>[0]) { super(parameters); Object.assign(this.shadowMap, { autoUpdate: true, needsUpdate: false }); }
  override render(scene: THREE.Object3D, camera: THREE.Camera): void {
    // The Animation loop that would reset these is unused: the game drives its own requestAnimationFrame.
    this.info.reset();
    // WebGPU schedules shadows per light. Like WebGLShadowMap, spend needsUpdate only on a scene that has shadow lights.
    const shadows = this.shadowMap;
    if (shadows.enabled && (shadows.needsUpdate || shadows.autoUpdate !== this.lightsAutoUpdate)) {
      let found = false;
      scene.traverse((object) => {
        const light = object as THREE.DirectionalLight;
        if (light.isLight && light.castShadow && light.shadow) { found = true; light.shadow.autoUpdate = shadows.autoUpdate; if (shadows.needsUpdate) light.shadow.needsUpdate = true; }
      });
      if (found) { shadows.needsUpdate = false; this.lightsAutoUpdate = shadows.autoUpdate; }
    }
    super.render(scene, camera);
  }
}

export async function createRenderer(canvas: HTMLCanvasElement, antialias: boolean): Promise<RenderView> {
  const forceWebGL = import.meta.env.DEV && new URLSearchParams(location.search).get('backend') === 'webgl';
  const renderer = new TownRenderer({ canvas, antialias, powerPreference: 'high-performance', forceWebGL });
  await renderer.init();
  const backend = renderer.backend as THREE.Backend & { isWebGPUBackend?: boolean; device?: { adapterInfo?: AdapterInfo }; gl?: WebGL2RenderingContext };
  const webgpu = backend.isWebGPUBackend === true;
  return {
    backend: webgpu ? 'webgpu' : 'webgl2-fallback', renderer,
    // The fallback has a live WebGL 2 context, read exactly as the classic renderer's is.
    graphics: webgpu ? probeAdapter(backend.device?.adapterInfo ?? {}) : probeGraphics(backend.gl),
    stats: () => ({ calls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles }),
    // Both backends report loss here: WebGPU device loss, and the fallback's webglcontextlost.
    onLost: (handler) => { const report = renderer.onDeviceLost; renderer.onDeviceLost = (info) => { report.call(renderer, info); handler(); }; },
  };
}
