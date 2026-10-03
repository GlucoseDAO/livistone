import type * as THREE from 'three';
import type { GraphicsTier, probeGraphics } from '../game/graphics';

/** 'classic' is WebGLRenderer; the WebGPU build reports the backend WebGPURenderer actually obtained. */
export type Backend = 'classic' | 'webgpu' | 'webgl2-fallback';

/**
 * The renderer surface main.ts and sky.ts use. WebGLRenderer has it natively; the WebGPU build's renderer adds
 * WebGLRenderer's per-render() statistics and renderer-level static-shadow switches, so the game code stays shared.
 */
export interface SceneRenderer {
  shadowMap: { enabled: boolean; type: THREE.ShadowMapType; autoUpdate: boolean; needsUpdate: boolean };
  toneMapping: THREE.ToneMapping; toneMappingExposure: number;
  setPixelRatio(value: number): void; getPixelRatio(): number; setSize(width: number, height: number): void;
  render(scene: THREE.Object3D, camera: THREE.Camera): void;
  compileAsync(scene: THREE.Object3D, camera: THREE.Camera): Promise<unknown>;
}

export interface RenderView {
  readonly backend: Backend;
  readonly renderer: SceneRenderer;
  /** The device probe for this renderer: a WebGL renderer string, or the WebGPU adapter that renders. */
  readonly graphics: ReturnType<typeof probeGraphics>;
  /** Draw calls and triangles of the latest render(), as WebGLRenderer.info.render counts them. */
  stats(): { calls: number; triangles: number };
  /** WebGL context loss or WebGPU device loss. */
  onLost(handler: () => void): void;
}

export interface Sky { background: THREE.CubeTexture; environment: THREE.Texture }

/** TSL counterparts of the onBeforeCompile / ShaderMaterial patches; null in the classic build. */
export interface NodePatches {
  createSky(renderer: SceneRenderer, mobile: boolean, night: boolean, tier: GraphicsTier, darkGround: boolean): Sky;
  rockMaterial(mobile: boolean): THREE.MeshStandardMaterial;
  lakeWater(source: THREE.MeshStandardMaterial, time: { value: number }): THREE.MeshStandardMaterial;
  /** Round, sized points: WebGPU point primitives are one pixel wide, so these draw instanced quads instead. */
  sizedPoints(points: THREE.Points): void;
  /** cpu-detail: node materials expose every MeshStandardMaterial property, so they convert like classic ones. */
  isStandard(material: THREE.Material): material is THREE.MeshStandardMaterial;
  /** cpu-detail keeps only the terrain blend when converting to Lambert. */
  lambertTerrain(source: THREE.Material, lambert: THREE.MeshLambertMaterial): THREE.Material;
}
