/** Perimeter bays keep civic doors and the central axis clear. Coordinates are local to each hall. */
export function posterLayout(hall: string, count: number): { x: number; z: number; yaw: number }[] {
  if (hall === 'station') return Array.from({ length: count }, (_, i) => ({ x: [-27, -22, -5, 1, 7, 13, 18][i], z: -65.5, yaw: 0 }));
  const a = hall === 'energy' ? 10.3 : hall === 'science' ? 4.7 : 6.5, b = hall === 'energy' ? 4.2 : a;
  return Array.from({ length: count }, (_, i) => { const angle = (42 + i * 276 / (count - 1)) * Math.PI / 180; return { x: Math.sin(angle) * a, z: Math.cos(angle) * b, yaw: Math.atan2(-Math.sin(angle) * a, -Math.cos(angle) * b) }; });
}
