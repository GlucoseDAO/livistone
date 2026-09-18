/** Shared world-space dimensions for the station, its garden clearing and railway. */
export const STATION_LOCAL = {
  x: -2, z: -70, halfLength: 29, front: -60, back: -76.2, floor: .18,
  entranceX: -16, entranceZ: -60, trackZ: -79, railHalfLength: 412,
} as const;

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
