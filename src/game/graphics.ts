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

export function probeGraphics(gl?: WebGL2RenderingContext): { reduced: boolean; coarse: boolean; software: boolean } {
  const coarse = matchMedia('(pointer: coarse)').matches;
  let software = false;
  try {
    if (gl) software = softwareContext(gl);
    else {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      software = !context || softwareContext(context);
    }
  } catch { software = false; }
  return { reduced: coarse || software, coarse, software };
}
