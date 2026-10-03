/** Shared world-space dimensions for the station, its garden clearing and railway. */
export const STATION_LOCAL = {
  x: -2, z: -70, halfLength: 29, front: -60, back: -76.2, floor: .18,
  entranceX: -16, entranceZ: -60, trackZ: -79, railHalfLength: 412,
} as const;

/** Waiting-bench centres in the authored station frame; contact shadows place their footprints from the same list. */
export const STATION_BENCHES: readonly (readonly [number, number])[] = [[-25, -70.2], [5, -70.2], [19, -70.2]];

/**
 * Platform fittings of the detailed station (sub-plan 28), in the authored frame: lamp posts behind the tactile strip, litter
 * bins beside the benches, the free-standing map and timetable panel, and the hanging clock and departures board. Contact
 * shadows read the standing ones from here; walking lanes at x = -16, 0, 18 and the boarding bays at x = -14 and 10 stay clear.
 */
export const STATION_FITTINGS = {
  lamps: [[-28.5, -74.4], [-8, -74.4], [5.5, -74.4], [15.5, -74.4]],
  bins: [[-22.6, -70.3], [7.4, -70.3], [21.4, -70.3]],
  panel: { x: -21, z: -72.2, width: 1.25, height: 1.6, bottom: .95 },
  clock: { x: 16, y: 3.75, z: -73.3, radius: .46 },
  departures: { x: -4, y: 3.55, z: -73.3, width: 3.2, height: .8 },
} as const;

/** Dev-only `?station=classic` restores the station before sub-plan 28 (plain benches, bare foyer, ring through the paving). */
export function stationClassic(): boolean {
  return !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('station') === 'classic';
}

export const RAILWAY_LOCAL = { centerZ: -82, tracks: [-79, -85], portalX: 155, exitX: 370, boreHalfWidth: 7.1, boreSpring: 3.15, boreRise: 5.25, clearanceHeight: 9.6 } as const;

// The authored station remains in its original coordinates; one rigid placement turns its exit toward the bridge.
export const STATION = { ...STATION_LOCAL, x: -14, z: 70, front: 60, back: 76.2, entranceX: 0, entranceZ: 60, trackZ: 79 } as const;
export const RAILWAY = { ...RAILWAY_LOCAL, centerZ: 82, tracks: [79, 85] } as const;
export function stationPoint(x: number, z: number): { x: number; z: number } { return { x: -16 - x, z: -z }; }
export function railwayCorridor(x: number, z: number): boolean {
  return Math.abs(x) < STATION.railHalfLength - 2 && Math.abs(z - RAILWAY.centerZ) < RAILWAY.boreHalfWidth;
}
export function stationClearing(x: number, z: number, radius: number): boolean {
  return (Math.abs(x - STATION.x) < STATION.halfLength + 1 + radius && z > STATION.front - 3 - radius && z < STATION.trackZ + 4 + radius)
    || (Math.abs(x) < STATION.railHalfLength + radius && Math.abs(z - RAILWAY.centerZ) < 7.8 + radius)
    || (Math.abs(Math.abs(x) - RAILWAY.portalX) < 16 + radius && Math.abs(z - RAILWAY.centerZ) < 14 + radius);
}
