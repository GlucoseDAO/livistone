import { towerPoint, FUTURE_HOUSE } from './elevated-layout';
/** Perimeter bays keep doors and walking axes clear. Elevated sites carry their floor height. */
export function posterLayout(hall: string, count: number): { x: number; z: number; yaw: number; y?: number }[] {
  if (hall === 'timeface') return Array.from({ length: count }, (_, i) => { const t = .08 + i * .84 / Math.max(1, count - 1), p = towerPoint(t, 4.65); return { x: p.x, z: p.z, y: p.y, yaw: Math.atan2(p.x - 17, p.z + 39) }; });
  if (hall === 'future-house') return Array.from({ length: count }, (_, i) => ({ x: FUTURE_HOUSE.x - 4 + i * 8 / Math.max(1, count - 1), z: FUTURE_HOUSE.z - 5, y: FUTURE_HOUSE.floor, yaw: 0 }));
  if (hall === 'station') return Array.from({ length: count }, (_, i) => ({ x: [-27, -22, -5, 1, 7, 13, 18][i], z: -65.5, yaw: 0 }));
  const a = hall === 'energy' ? 10.3 : hall === 'science' ? 4.7 : 6.5, b = hall === 'energy' ? 4.2 : a;
  return Array.from({ length: count }, (_, i) => { const angle = (42 + i * 276 / (count - 1)) * Math.PI / 180; return { x: Math.sin(angle) * a, z: Math.cos(angle) * b, yaw: Math.atan2(-Math.sin(angle) * a, -Math.cos(angle) * b) }; });
}
