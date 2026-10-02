export const GATEWAY = { z: 40.2, halfWidth: 4.35, halfDepth: 1.1, stoneY: 6.04, stoneLength: 7.2, stoneHeight: .9 };
export const GATEWAY_POSTER = { x: -5.9, z: 49.5, yaw: .25 };

export function gatewayClearing(x: number, z: number, radius: number): boolean {
  return (Math.abs(x) < GATEWAY.halfWidth + .3 + radius && Math.abs(z - GATEWAY.z) < GATEWAY.halfDepth + .35 + radius)
    || (Math.abs(x) < 2.5 + radius && z > 40 - radius && z < 53.3 + radius)
    || (Math.abs(x - GATEWAY_POSTER.x) < 1.4 + radius && Math.abs(z - GATEWAY_POSTER.z) < 1.4 + radius);
}

/** The wide bridge apron tapers into the ordinary town path beyond the gateway. */
export function gatewayApproachWidth(z: number): number {
  const stations = [[40, 4.9], [42, 4.4], [49, 3.9], [53, 3.9], [58, 2.6]];
  for (let i = 1; i < stations.length; i++) if (z < stations[i][0]) {
    const [a, widthA] = stations[i - 1], [b, widthB] = stations[i]; return widthA + (widthB - widthA) * Math.max(0, (z - a) / (b - a));
  }
  return 2.6;
}
