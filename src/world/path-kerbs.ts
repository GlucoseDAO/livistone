import * as THREE from 'three';

/** Low bevelled stone blocks follow both path edges; junctions and thresholds remain open. */
export function pathKerbs(curves: THREE.Curve<THREE.Vector3>[], width: number | ((p: THREE.Vector3, road: number) => number), ground: (x: number, z: number) => number, open: (x: number, z: number) => boolean, reduced: boolean): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], uv: number[] = [], bins = new Map<string, { p: THREE.Vector3; road: number; width: number }[]>(), cell = 4;
  const widthAt = (p: THREE.Vector3, road: number): number => typeof width === 'number' ? width : width(p, road);
  curves.forEach((curve, road) => {
    for (const p of curve.getSpacedPoints(Math.ceil(curve.getLength() / .45))) {
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`, bucket = bins.get(key) ?? []; bucket.push({ p, road, width: widthAt(p, road) }); bins.set(key, bucket);
    }
  });
  const junction = (x: number, z: number, road: number): boolean => {
    if (open(x, z)) return true;
    const bx = Math.floor(x / cell), bz = Math.floor(z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      for (const site of bins.get(`${bx + dx},${bz + dz}`) ?? []) if (site.road !== road && (site.p.x - x) ** 2 + (site.p.z - z) ** 2 < (site.width / 2 + .32) ** 2) return true;
    return false;
  };
  const profile = [[-.14, -.18], [.14, -.18], [.14, .085], [.115, .11], [-.115, .11], [-.14, .085]];
  curves.forEach((curve, road) => {
    const length = curve.getLength(), steps = Math.ceil(length / (reduced ? 1.65 : 1.15));
    for (let i = 0; i < steps; i++) {
      const start = i / steps, end = (i + 1) / steps;
      if (start * length < 1.7 || (1 - end) * length < 1.7) continue;
      for (const side of [-1, 1]) {
        const points = [start + .018 / length, end - .018 / length].map(t => {
          const p = curve.getPointAt(t), tangent = curve.getTangentAt(t), n = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(side);
          const center = p.clone().addScaledVector(n, widthAt(p, road) / 2 + .14);
          return profile.map(([across, up]) => {
            const x = center.x + n.x * across, z = center.z + n.z * across;
            return new THREE.Vector3(x, p.y + ground(x, z) + up, z);
          });
        });
        if ([0, 1].some(j => junction(points[j][3].x, points[j][3].z, road))) continue;
        const axis = points[1][0].clone().sub(points[0][0]); axis.y = 0; const blockLength = axis.length(); axis.normalize();
        const across = points[0][1].clone().sub(points[0][0]); across.y = 0; across.normalize();
        const shade = .87 + ((i * 37 + road * 13) % 17) / 100;
        const emit = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
          for (const p of side > 0 ? [a, b, c] : [c, b, a]) { positions.push(p.x, p.y, p.z); const delta = p.clone().sub(points[0][0]); uv.push(.04 + delta.dot(axis) / blockLength * .17, .045 + delta.dot(across) / .28 * .10 + (p.y - points[0][0].y) * .06); colors.push(shade, shade * .975, shade * .92); }
        };
        for (let j = 0; j < profile.length; j++) { const k = (j + 1) % profile.length; emit(points[0][j], points[1][j], points[0][k]); emit(points[1][j], points[1][k], points[0][k]); }
        for (let j = 1; j < profile.length - 1; j++) { emit(points[0][0], points[0][j], points[0][j + 1]); emit(points[1][0], points[1][j + 1], points[1][j]); }
      }
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals(); return geometry;
}
