/** Reduced geometry is a coarse pointer, software GL, or a typical laptop iGPU — not a discrete card. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|microsoft basic|gdi generic|\bwarp\b/i;
const INTEGRATED = /intel\(r\) (uhd|hd graphics|iris)|intel iris|\bintel hd\b|radeon\(tm\) graphics|amd radeon graphics/i;

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

export type GraphicsTier = 'gpu' | 'mobile' | 'cpu';
export interface GraphicsProfile {
  tier: GraphicsTier; reduced: boolean; pixelRatio: number; shadows: boolean; skyDay: number; skyNight: number; plants: number; forest: number; lights: number;
}
export function graphicsTier(input: { coarse: boolean; caveatFailed?: boolean; renderer?: string }): GraphicsTier {
  if (input.caveatFailed || (input.renderer && softwareRenderer(input.renderer))) return 'cpu';
  return input.coarse || (input.renderer && modestRenderer(input.renderer)) ? 'mobile' : 'gpu';
}
export function graphicsProfile(tier: GraphicsTier): GraphicsProfile {
  if (tier === 'cpu') return { tier, reduced: true, pixelRatio: .55, shadows: false, skyDay: 64, skyNight: 128, plants: 18, forest: 80, lights: 2 };
  if (tier === 'mobile') return { tier, reduced: true, pixelRatio: 1, shadows: true, skyDay: 256, skyNight: 512, plants: 32, forest: 110, lights: 6 };
  return { tier, reduced: false, pixelRatio: 1.5, shadows: true, skyDay: 512, skyNight: 1024, plants: 38, forest: 130, lights: 10 };
}
