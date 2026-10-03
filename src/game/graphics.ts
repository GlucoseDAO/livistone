/** Reduced geometry is a coarse pointer, software GL, or a typical laptop iGPU — not a discrete card. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|microsoft basic|gdi generic|\bwarp\b/i;
// Newer iGPUs drop the UHD/Iris family names: the dev laptop's Raptor Lake reads "Mesa Intel(R) Graphics (RPL-S)" (Chrome 154,
// Linux, 3 Oct 2026); Windows ANGLE reports "Intel(R) Graphics (0x…)". Meteor/Arrow/Lunar Lake integrate "Intel(R) Arc(TM) Graphics"
// or "Arc(TM) 140V/140T GPU", while discrete Arc cards carry an A/B model ("Arc(TM) A770", "B580"). AMD APUs report "Radeon(TM)
// Graphics", "Radeon 780M" or "Vega 8 Graphics"; discrete cards say "RX" or "Pro".
const INTEGRATED = /intel\(r\) (uhd|hd graphics|iris|xe graphics|graphics\b)|intel\(r\) arc\(tm\) (graphics|\d{3}[vt]\b)|intel iris|\bintel hd\b|radeon(\(tm\))? (graphics|vega \d+ graphics|\d{3}m\b)|amd radeon graphics/i;

export function softwareRenderer(name: string): boolean {
  return SOFTWARE.test(name);
}

export function modestRenderer(name: string): boolean {
  return softwareRenderer(name) || INTEGRATED.test(name);
}

export function reducedGraphics(input: { coarse: boolean; caveatFailed?: boolean; renderer?: string }): boolean {
  return input.coarse || !!input.caveatFailed || (!!input.renderer && modestRenderer(input.renderer));
}

function unmaskedRenderer(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : '';
}

/** Read a live context. Avoid a second getContext — that can stall headless Chrome. */
export function softwareContext(gl: WebGL2RenderingContext): boolean {
  return modestRenderer(unmaskedRenderer(gl));
}

export function probeGraphics(gl?: WebGL2RenderingContext): GraphicsProfile & { coarse: boolean; software: boolean } {
  const coarse = matchMedia('(pointer: coarse)').matches;
  let renderer = '', caveatFailed = false;
  try {
    const context = gl ?? document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (context) renderer = unmaskedRenderer(context); else caveatFailed = true;
  } catch { caveatFailed = true; }
  return { ...graphicsProfile(graphicsTier({ coarse, renderer, caveatFailed })), coarse, software: caveatFailed || softwareRenderer(renderer) };
}

/** WebGPU adapter info. Chrome reports vendor and architecture; device and description stay blank without debug flags. */
export interface AdapterInfo { vendor?: string; architecture?: string; device?: string; description?: string; isFallbackAdapter?: boolean }

/**
 * graphicsTier() input for the adapter that actually renders (on hybrid laptops WebGPU and WebGL can pick different GPUs).
 * A fallback adapter is the CPU path, as a failed performance caveat is for WebGL. Intel and AMD each ship integrated and
 * discrete GPUs under the same vendor and architecture names, so for them the WebGL renderer string decides, through the
 * same regex as the classic build; without one, every Intel family except the discrete gen-12hp / xe-2hpg Arc cards counts.
 */
export function adapterProbe(info: AdapterInfo, webglRenderer: () => string): { renderer: string; caveatFailed: boolean; integrated: boolean } {
  const renderer = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ');
  const intel = /intel/i.test(info.vendor ?? ''), gl = (intel || /\b(amd|ati)\b/i.test(info.vendor ?? '')) && !info.description ? webglRenderer() : '';
  return { renderer, caveatFailed: !!info.isFallbackAdapter, integrated: INTEGRATED.test(renderer) || (gl ? INTEGRATED.test(gl) : intel && !/hp/i.test(info.architecture ?? '')) };
}

/** The WebGPU build's probeGraphics. A throwaway WebGL context is read only for Intel and AMD adapters. */
export function probeAdapter(info: AdapterInfo): ReturnType<typeof probeGraphics> {
  const coarse = matchMedia('(pointer: coarse)').matches, input = adapterProbe(info, () => {
    try { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return ''; const name = unmaskedRenderer(gl); gl.getExtension('WEBGL_lose_context')?.loseContext(); return name; } catch { return ''; }
  });
  return { ...graphicsProfile(graphicsTier({ coarse, ...input })), coarse, software: input.caveatFailed || softwareRenderer(input.renderer) };
}

export type GraphicsTier = 'gpu' | 'mobile' | 'cpu';
export interface GraphicsProfile {
  tier: GraphicsTier; reduced: boolean; pixelRatio: number; shadows: boolean; skyDay: number; skyNight: number; plants: number; forest: number; lights: number;
}
export function graphicsTier(input: { coarse: boolean; caveatFailed?: boolean; renderer?: string; integrated?: boolean }): GraphicsTier {
  if (input.caveatFailed || (input.renderer && softwareRenderer(input.renderer))) return 'cpu';
  return input.coarse || input.integrated || (input.renderer && modestRenderer(input.renderer)) ? 'mobile' : 'gpu';
}
export function graphicsProfile(tier: GraphicsTier): GraphicsProfile {
  if (tier === 'cpu') return { tier, reduced: true, pixelRatio: .55, shadows: false, skyDay: 64, skyNight: 128, plants: 18, forest: 80, lights: 2 };
  if (tier === 'mobile') return { tier, reduced: true, pixelRatio: 1, shadows: true, skyDay: 256, skyNight: 512, plants: 32, forest: 110, lights: 6 };
  return { tier, reduced: false, pixelRatio: 1.5, shadows: true, skyDay: 512, skyNight: 1024, plants: 38, forest: 130, lights: 10 };
}
