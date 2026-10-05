import type { GraphicsTier } from './graphics';
export type GraphicsChoice = 'auto' | 'rich' | 'balanced' | 'light';
export const GRAPHICS_CHOICE_KEY = 'livistone-graphics-choice';
export function parseGraphicsChoice(value: string | null): GraphicsChoice { return value === 'rich' || value === 'balanced' || value === 'light' ? value : 'auto'; }
export function chosenTier(choice: GraphicsChoice, detected: GraphicsTier): GraphicsTier { return choice === 'auto' ? detected : choice === 'rich' ? 'gpu' : choice === 'balanced' ? 'mobile' : 'cpu'; }
export function readGraphicsChoice(): GraphicsChoice { try { return parseGraphicsChoice(localStorage.getItem(GRAPHICS_CHOICE_KEY)); } catch { return 'auto'; } }
