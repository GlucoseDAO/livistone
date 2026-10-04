/** A broad snow crossing with room for hikers to choose their own line. Metres, shared with the bake manifest. */
export const SNOW_TRACKS = { across: 8, along: 16 } as const;
export function classicSnow(): boolean { return !!(import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('snow') === 'classic'); }
