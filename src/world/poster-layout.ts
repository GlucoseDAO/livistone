import { towerPoint, FUTURE_HOUSE } from './elevated-layout';
/** Perimeter bays keep doors and walking axes clear. Elevated sites carry their floor height. */
export function posterLayout(hall: string, count: number): { x: number; z: number; yaw: number; y?: number }[] {
  if (hall === 'timeface') return Array.from({ length: count }, (_, i) => { const t = .08 + i * .84 / Math.max(1, count - 1), p = towerPoint(t, 4.65); return { x: p.x, z: p.z, y: p.y, yaw: Math.atan2(p.x - 17, p.z + 39) }; });
  if (hall === 'future-house') return Array.from({ length: count }, (_, i) => ({ x: FUTURE_HOUSE.x - 4 + i * 8 / Math.max(1, count - 1), z: FUTURE_HOUSE.z - 5, y: FUTURE_HOUSE.floor, yaw: 0 }));
  if (hall === 'station') return Array.from({ length: count }, (_, i) => ({ x: [-27, -22, -5, 1, 7, 13, 18][i], z: -65.5, yaw: 0 }));
  const a = hall === 'energy' ? 10.3 : hall === 'science' ? 4.7 : 6.5, b = hall === 'energy' ? 4.2 : a;
  return Array.from({ length: count }, (_, i) => { const angle = (42 + i * 276 / (count - 1)) * Math.PI / 180; return { x: Math.sin(angle) * a, z: Math.cos(angle) * b, yaw: Math.atan2(-Math.sin(angle) * a, -Math.cos(angle) * b) }; });
}
/**
 * A poster's board, in metres above its floor: the paper runs from the caption's foot to the photograph's top, a brass rail of
 * `rail` overlaps it by `overlap`, and the lit board behind follows the rail's outline down onto the foot (top at `bottom`).
 */
export const POSTER_BOARD = { bottom: .31, paperBottom: .37, paperTop: 3.215, rail: .045, overlap: .012, depth: .09 } as const;
/** The board's outline for a poster `width` wide: centre height and half extents, shared by its mesh and its collider. */
export function posterBoard(width: number): { y: number; halfWidth: number; halfHeight: number } {
  const top = POSTER_BOARD.paperTop + POSTER_BOARD.rail - POSTER_BOARD.overlap;
  return { y: (POSTER_BOARD.bottom + top) / 2, halfWidth: width / 2 + POSTER_BOARD.rail - POSTER_BOARD.overlap, halfHeight: (top - POSTER_BOARD.bottom) / 2 };
}
