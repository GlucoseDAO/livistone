import { MATSU_COURTYARD, COURTYARD_ARRIVAL, COURTYARD_APPROACH, courtyardWorld, courtyardGround, courtyardClearing } from './matsu-courtyard-layout';

/** The geographic islands remain enlarged; the proposal-scale artwork stands inside the reconstructed Matsu courtyard. */
export const STUMP_ISLAND = {
  x: 136.5, z: 20.302535024526335, yaw: .1,
  bounds: { minX: -12.9, maxX: 12.9, minZ: -5.74, maxZ: 5.74 },
  matsu: { x: 10.6439142571, z: -3.4787374527, radius: 2.25 },
  taiwanLanding: { x: 3.7018695672, z: 1.5824432751 },
  capTaiwanApproach: { x: 9.5728336354, z: -2.6406525514 },
  capRadius: .25, islandHeight: .25, capHeight: .70,
  bank: { x: 140, z: 10 },
  sign: { x: 157, z: 39.5, yaw: -Math.PI / 2 },
} as const;
export const STUMP_ARTWORK = { capDiameter: .5, seatHeight: .45, plateThickness: .003, sourceFloor: .25, sourceWoodTop: 2.013, sourceCapTop: 2.04, capScale: .5 / 3.4, woodScale: .165, capVerticalScale: .003 / .025, woodVerticalScale: (.45 - .003) / (2.013 - .25) } as const;

export function stumpWorld(point: { x: number; z: number }): { x: number; z: number } {
  const s = STUMP_ISLAND, c = Math.cos(s.yaw), t = Math.sin(s.yaw);
  return { x: s.x + c * point.x + t * point.z, z: s.z - t * point.x + c * point.z };
}
const matsu = stumpWorld(STUMP_ISLAND.matsu);
const taiwanLanding = stumpWorld(STUMP_ISLAND.taiwanLanding);
const bankLanding = stumpWorld({ x: STUMP_ISLAND.matsu.x + .8, z: STUMP_ISLAND.matsu.z - 1.2 });
const taiwanDeparture = stumpWorld({ x: STUMP_ISLAND.matsu.x + 1.2, z: STUMP_ISLAND.matsu.z + 1 });
export const STUMP_OF_LIFE = {
  ...courtyardWorld(MATSU_COURTYARD.stump),
  sign: STUMP_ISLAND.sign,
  arrival: COURTYARD_ARRIVAL,
};
export const STUMP_BRIDGES = [
  { name: 'riverbank footbridge', width: 1.8, from: { ...STUMP_ISLAND.bank, y: .138 }, to: { ...bankLanding, y: STUMP_ISLAND.islandHeight + .008 } },
  { name: 'Taiwan footbridge', width: 1.8, from: { ...taiwanDeparture, y: STUMP_ISLAND.islandHeight + .008 }, to: { ...taiwanLanding, y: STUMP_ISLAND.islandHeight + .008 } },
  { name: 'courtyard shore footbridge', width: 1.8, from: { ...stumpWorld({ x: STUMP_ISLAND.matsu.x + 1.2, z: STUMP_ISLAND.matsu.z + 1 }), y: STUMP_ISLAND.islandHeight + .008 }, to: { ...COURTYARD_APPROACH[0], y: .138 } },
];

function segmentDistance(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
export function stumpGround(x: number, z: number, radius = 0): boolean {
  const s = STUMP_ISLAND, b = s.bounds, dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), t = Math.sin(s.yaw), lx = c * dx - t * dz, lz = t * dx + c * dz;
  return courtyardGround(x, z, radius) || (lx > b.minX - radius && lx < b.maxX + radius && lz > b.minZ - radius && lz < b.maxZ + radius)
    || Math.hypot(x - s.sign.x, z - s.sign.z) < 2.1 + radius
    || STUMP_BRIDGES.some(bridge => segmentDistance(x, z, bridge.from, bridge.to) < 1.3 + radius);
}
export function stumpClearing(x: number, z: number, radius = 0): boolean { return courtyardClearing(x, z, radius) || stumpGround(x, z, radius + 1.5); }
export function stumpBridgeEntrance(x: number, z: number): boolean { return STUMP_BRIDGES.some(bridge => [bridge.from, bridge.to].some(end => Math.hypot(x - end.x, z - end.z) < 2)); }
