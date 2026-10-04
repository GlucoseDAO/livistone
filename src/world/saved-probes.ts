import * as THREE from 'three';
import type { SkyPhase } from './sky';

export interface SavedProbe { id: string; width: number; height: number; file: string }
export interface ProbeManifest { revision: string; sets: Record<string, SavedProbe[]> }
export const probeSet = (size: number, phase: SkyPhase, renderer: THREE.WebGPURenderer): string => `${(renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl'}-${size}-${phase}`;
let manifest: Promise<ProbeManifest | null> | undefined;

/** Restore the already filtered half-float atlas into a target, preserving PMREM's render-target sampling convention. */
export async function loadSavedProbes(renderer: THREE.WebGPURenderer, size: number, phase: SkyPhase, ids: string[]): Promise<Map<string, THREE.RenderTarget> | null> {
  const params = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  if (params?.get('probes') === 'bake' || params && [...params.keys()].some(key => !['graphics', 'capture', 'backend', 'probes', 'featured'].includes(key))) return null;
  const base = `${import.meta.env.BASE_URL}probes/`, targets = new Map<string, THREE.RenderTarget>();
  try {
    manifest ??= fetch(base + 'manifest.json?v=' + import.meta.env.VITE_PROBE_REVISION).then(async response => response.ok ? await response.json() as ProbeManifest : null).catch(() => null);
    const saved = await manifest, set = saved?.sets[probeSet(size, phase, renderer)];
    if (!saved || saved.revision !== import.meta.env.VITE_PROBE_REVISION || !set || ids.some(id => !set.some(entry => entry.id === id))) return null;
    const loaded = await Promise.allSettled(ids.map(async id => {
      const entry = set.find(entry => entry.id === id)!;
      if (entry.width < 1 || entry.height < 1 || entry.width > 1024 || entry.height > 1024 || !/^[a-z0-9/-]+\.bin\.gz$/.test(entry.file)) throw new Error('Invalid reflection atlas');
      const response = await fetch(base + entry.file); if (!response.ok || !response.body) throw new Error('Missing reflection atlas');
      // Some hosts send .gz with Content-Encoding and the browser already expands it; others serve the compressed bytes.
      let buffer = await response.arrayBuffer(); const magic = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b) buffer = await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      if (buffer.byteLength !== entry.width * entry.height * 8) throw new Error('Incomplete reflection atlas');
      const source = new THREE.DataTexture(new Uint16Array(buffer), entry.width, entry.height, THREE.RGBAFormat, THREE.HalfFloatType);
      source.colorSpace = THREE.LinearSRGBColorSpace; source.needsUpdate = true;
      const target = new THREE.RenderTarget(entry.width, entry.height, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      target.texture.mapping = THREE.CubeUVReflectionMapping; target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      targets.set(id, target);
      try { renderer.initRenderTarget(target); renderer.copyTextureToTexture(source, target.texture); } finally { source.dispose(); }
    }));
    const failed = loaded.find(result => result.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason;
    return targets;
  } catch (error) { if (import.meta.env.DEV) console.warn('Saved reflections unavailable', error); for (const target of targets.values()) target.dispose(); return null; }
}
