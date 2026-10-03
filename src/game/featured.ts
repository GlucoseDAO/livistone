import type { LandmarkId } from './content';

/**
 * One poster per building also shows its piece as a hovering model, decimated offline from Livia's print STL
 * (scripts/build-jewelry-models.ts, data/catalogue/models.json). Only pieces whose poster hangs in that building and whose
 * mesh is clean enough are candidates; the pieces that became architecture (Mitoring, Nanot, Eye of Winter, Eyelense,
 * Mycelium) are not. Which one hovers changes every hour, the same for every visitor, so only one model per building loads.
 */
export const FEATURED_CANDIDATES: Partial<Record<LandmarkId, readonly string[]>> = {
  'city-hall': ['nucalong', 'nocciola'],
  energy: ['splash', 'ice', 'amberear'],
  science: ['mountain-of-gold', 'beanut', 'hessonite', 'vittoria-amazonica'],
  station: ['inline', 'la-navette'],
  timeface: ['wormy', 'peas-in-pod', 'art-nouveau', 'moldavian-vault', 'first-ring'],
  'future-house': ['deep-sea-pearl'],
};
/** The town hour: whole hours since the epoch, the same everywhere. */
export function townHour(now = Date.now()): number { return Math.floor(now / 3.6e6); }
/** The piece hovering in `building` during `hour`; buildings step through their lists out of phase with one another. */
export function featuredPiece(building: string, hour: number): string | null {
  const list = FEATURED_CANDIDATES[building as LandmarkId]; if (!list?.length) return null;
  const offset = [...building].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return list[((hour + offset) % list.length + list.length) % list.length];
}
export function modelURL(piece: string): string { return (import.meta.env?.BASE_URL ?? '/') + 'models/jewelry/' + piece + '.glb'; }
/** Dev-only `?featured=off`: no jewelry models at all (hovering pieces, the grove's ring), for before/after reviews. */
export const MODELS_OFF = !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('featured') === 'off';
