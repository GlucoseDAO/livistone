import type { AdapterInfo, GraphicsTier } from './graphics';
import type { Backend } from '../render/renderer';

// Kept out of graphics.ts and render/renderer.ts, which feed the saved-probe signature (scripts/probe-signature.ts): which tier a
// device gets never changes what a tier's bake sees, so a detection rule must not invalidate every saved probe.

/**
 * Phone GPUs that hold the Rich scene. A HONOR Magic8 Pro (Adreno 840, Chrome 154, 6 Oct 2026) walked Rich at 41–47 fps at its
 * CSS resolution. Adreno 730 and up (Snapdragon 8 Gen 1 onward, the 7+ Gen 3's 732) less the mid-range 8xx parts below 825, ARM
 * Immortalis and Samsung Xclipse 9xx. Apple reports only "Apple GPU", so iPhones and iPads stay Balanced (untested).
 */
export function flagshipMobileRenderer(name: string): boolean {
  const adreno = /adreno\D*?(\d{3})\b/i.exec(name);
  if (adreno) { const model = Number(adreno[1]); return model >= 730 && (model < 800 || model >= 825); }
  return /immortalis|xclipse\s*9\d\d/i.test(name);
}

/** The probe's Balanced tier, raised to Rich for a phone whose GPU holds it. The name is read only when it can matter. */
export function deviceTier(probe: { tier: GraphicsTier; coarse: boolean }, renderer: () => string): GraphicsTier {
  return probe.tier === 'mobile' && probe.coarse && flagshipMobileRenderer(renderer()) ? 'gpu' : probe.tier;
}

/** WebGL's unmasked renderer: the fallback's live context, else a throwaway one (WebGPU adapters on phones name only a family). */
export function webglRenderer(gl?: WebGL2RenderingContext | null): string {
  try {
    const context = gl ?? document.createElement('canvas').getContext('webgl2'); if (!context) return '';
    const info = context.getExtension('WEBGL_debug_renderer_info'), name = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    if (!gl) context.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

/**
 * "ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)" → "Adreno (TM) 840": the device between ANGLE's vendor and API, without PCI ids
 * or ANGLE-on-Vulkan's wrapping. A WebGPU adapter from another vendor than WebGL's (a hybrid laptop) names itself instead.
 */
export function gpuLabel(renderer: string, adapter: AdapterInfo = {}): string {
  const own = [adapter.vendor, adapter.architecture].filter(Boolean).join(' ');
  if (adapter.vendor && renderer && !renderer.toLowerCase().includes(adapter.vendor.toLowerCase())) return own;
  const angle = /^ANGLE \([^,]+, (.+), [^,]+\)$/.exec(renderer.trim());
  let name = (angle ? angle[1] : renderer).replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s+(Direct3D|vs_|ps_).*$/i, '').trim();
  const vulkan = /^Vulkan [\d.]+ \((.+)\)$/.exec(name); if (vulkan) name = vulkan[1].replace(/^(\w+) \1\b/i, '$1');
  return name || own;
}

/** Where a browser setting, not the hardware, holds the town back: Chrome on desktop Linux offers WebGPU only with Vulkan on. */
export interface Platform { linuxChrome: boolean }
export function platform(agent = navigator.userAgent): Platform {
  return { linuxChrome: /\bLinux\b/.test(agent) && !/Android|CrOS/.test(agent) && /\bChrome\//.test(agent) };
}

type Probe = { tier: GraphicsTier; coarse: boolean; software: boolean };
/** Chrome on Linux without WebGPU drew on a laptop's integrated GPU; with these four flags it used the RTX 4090 beside it (6 Oct 2026). */
const LINUX_FLAGS = 'In chrome://flags enable Vulkan, Vulkan from ANGLE, Default ANGLE Vulkan and Unsafe WebGPU Support, then relaunch Chrome.';
/** Only a setting the visitor can change: software rendering, or Chrome on Linux drawing a reduced tier without WebGPU. */
export function graphicsTip(probe: Probe, backend: Backend, where: Platform): string {
  if (probe.software) return 'The browser is drawing without the graphics card; turning on hardware acceleration in its settings gives a sharper, faster town.';
  if (where.linuxChrome && backend !== 'webgpu' && probe.tier !== 'gpu') return 'On Linux, Chrome uses WebGPU and a stronger graphics card only with Vulkan. ' + LINUX_FLAGS;
  return '';
}

/** The Graphics menu's line about the device: what draws the town, and what would let a stronger GPU draw it. */
export function deviceNote(probe: Probe, backend: Backend, label: string, where: Platform = { linuxChrome: false }): string {
  const drawn = `This device: ${label || 'graphics unnamed by the browser'} · ${backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'}.`;
  const tip = graphicsTip(probe, backend, where);
  if (tip) return drawn + ' ' + tip;
  if (probe.tier === 'mobile' && !probe.coarse) return drawn + ' This is integrated graphics. If the computer has a stronger graphics card, set the browser to use it.';
  return drawn;
}

export type Level = 'light' | 'balanced' | 'rich';
const LEVELS: readonly Level[] = ['light', 'balanced', 'rich'];
const LEVEL: Record<GraphicsTier, Level> = { cpu: 'light', mobile: 'balanced', gpu: 'rich' };
/** Declined offers, as "tier:level", so a visitor who said no is not asked again on this device. */
export const OFFER_DECLINED_KEY = 'livistone-graphics-offer-declined';
/** Fifteen walking seconds decide; 55 fps at the resolution ceiling is about twice Balanced's 28 fps target. */
const HOLD = 15, SMOOTH = 55;

/**
 * Auto picks a tier from the GPU's name; the frame rate then shows whether the name undersold or oversold it. Holding SMOOTH at the
 * resolution ceiling suggests the next level up; under half the tier's target at the floor, the next level down. One offer per
 * load, never one the visitor declined, and none up from software rendering, which no setting here can speed up.
 */
export class TierAdvisor {
  private up = 0;
  private down = 0;
  private offered = false;
  constructor(private readonly tier: GraphicsTier, private readonly software: boolean, private readonly target: number, private readonly declined: readonly string[] = []) {}
  sample(fps: number, seconds: number, scale: number, floor: number, ceiling: number): Level | null {
    if (this.offered) return null;
    const index = LEVELS.indexOf(LEVEL[this.tier]), higher = this.software ? undefined : LEVELS[index + 1], lower = LEVELS[index - 1];
    this.up = higher && scale >= ceiling - .001 && fps >= SMOOTH ? this.up + seconds : 0;
    this.down = lower && scale <= floor + .001 && fps < this.target / 2 ? this.down + seconds : 0;
    const offer = this.up >= HOLD ? higher : this.down >= HOLD ? lower : undefined;
    if (!offer || this.declined.includes(this.tier + ':' + offer)) return null;
    this.offered = true; return offer;
  }
}
export function declinedOffers(): string[] {
  try { const saved: unknown = JSON.parse(localStorage.getItem(OFFER_DECLINED_KEY) ?? '[]'); return Array.isArray(saved) ? saved.filter((entry): entry is string => typeof entry === 'string') : []; } catch { return []; }
}
export function declineOffer(entry: string): void {
  try { localStorage.setItem(OFFER_DECLINED_KEY, JSON.stringify([...new Set([...declinedOffers(), entry])])); } catch { /* Blocked storage: the offer may return next visit. */ }
}
/** The arrival toast pointing at a graphicsTip shows once per device. */
export const TIP_SHOWN_KEY = 'livistone-graphics-tip-shown';
export function firstTip(): boolean {
  try { if (localStorage.getItem(TIP_SHOWN_KEY)) return false; localStorage.setItem(TIP_SHOWN_KEY, '1'); return true; } catch { return false; }
}
