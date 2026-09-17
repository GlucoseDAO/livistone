/** Shared world-space dimensions for the station, its garden clearing and railway. */
export const STATION = {
  x: -2, z: -70, halfLength: 29, front: -60, back: -76.2, floor: .18,
  entranceX: -16, entranceZ: -60, trackZ: -79, railHalfLength: 476,
} as const;

export const RAILWAY = { portalX: 112, exitX: 428, boreHalfWidth: 4.1, boreSpring: 3.15, boreRise: 5.25, clearanceHeight: 9.6 } as const;

export function railwayCorridor(x: number, z: number): boolean {
  return Math.abs(x) < STATION.railHalfLength - 2 && Math.abs(z - STATION.trackZ) < RAILWAY.boreHalfWidth;
}

export function stationClearing(x: number, z: number, radius: number): boolean {
  return (Math.abs(x - STATION.x) < STATION.halfLength + 1 + radius && z < STATION.front + 3 + radius && z > STATION.trackZ - 4 - radius)
    || (Math.abs(x) < STATION.railHalfLength + radius && Math.abs(z - STATION.trackZ) < 4.8 + radius)
    || (Math.abs(Math.abs(x) - RAILWAY.portalX) < 16 + radius && Math.abs(z - STATION.trackZ) < 12 + radius);
}
