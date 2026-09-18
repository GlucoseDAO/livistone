import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { STATION_LOCAL as STATION } from './station-layout';

const TAU = Math.PI * 2, RADIUS = 6.85, WIDTH = 4.4, WALL = .28;
const CELLS = [
  [[-.96, -.23], [-.32, -.78], [.47, -.59], [.95, .02], [.36, .7], [-.55, .46]],
  [[-.93, -.37], [-.16, -.67], [.66, -.42], [.86, .24], [.25, .68], [-.25, .21], [-.78, .49]],
  [[-.94, -.38], [.24, -.71], [.95, -.22], [.45, .28], [-.61, .73]],
  [[-.88, -.2], [-.42, -.67], [.46, -.6], [.94, .35], [.26, .68], [-.35, .38]],
];

function bandPoint(arc: number, depth: number, thickness: number): THREE.Vector3 {
  const angle = arc / RADIUS, t = depth / WIDTH;
  // The band's axis inclines gently towards the setting, as in the jewelry photograph.
  const radius = RADIUS + thickness - .15 * t + .045 * Math.sin(angle * 3 + .5) * Math.sin(t * Math.PI);
  return new THREE.Vector3(STATION.entranceX + Math.sin(angle) * radius - .6 * t, 6.45 + Math.cos(angle) * radius + .3 * t, STATION.entranceZ - depth);
}

export function stationRingAnchor(angle: number, depth = .15): [number, number, number] { return bandPoint(angle * RADIUS, depth, WALL).toArray() as [number, number, number]; }

/** A pierced cylindrical shank: the openings pass radially through its curved wall. */
export function stationRingGeometry(mobile: boolean): THREE.BufferGeometry {
  const half = Math.PI * RADIUS, strip = new THREE.Shape();
  strip.moveTo(-half, 0); strip.lineTo(half, 0); strip.lineTo(half, WIDTH); strip.lineTo(-half, WIDTH); strip.closePath();
  const hole = (arc: number, depth: number, width: number, height: number, kind: number, skew: number): void => {
    const curve = new THREE.CatmullRomCurve3(CELLS[kind % CELLS.length].map(([x, y]) => new THREE.Vector3(arc + x * width + y * skew, depth + y * height, 0)), true);
    const points = curve.getPoints(mobile ? 20 : 36), path = new THREE.Path(); path.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) path.lineTo(p.x, p.y); path.closePath(); strip.holes.push(path);
  };
  // Staggered leaves and rounded triangles make a connected, irregular silver web.
  // The front rim stays thin and unperforated; there is no punched annular face.
  let cursor = -half + .45, index = 0;
  while (cursor < half - 1.5) {
    const span = 2.2 + .38 * Math.sin(index * 2.31 + .4), center = cursor + span / 2;
    if (Math.abs(center) > 5.25) {
      if (index % 4 === 1) hole(center, 2.19, span * .36, 1.85, index, .21 * Math.sin(index));
      else {
        hole(center - .14, 1.13 + .12 * Math.sin(index * 1.7), span * .42, .9, index, .16);
        hole(center + .13, 3.16 + .12 * Math.cos(index * 1.3), span * .38, .99, index + 2, -.2);
      }
    }
    cursor += span; index++;
  }
  const flat = new THREE.ExtrudeGeometry(strip, { depth: WALL, bevelEnabled: true, bevelSize: .075, bevelThickness: .065, bevelSegments: mobile ? 2 : 4, steps: 1, curveSegments: 1 });
  // Tessellate before bending so even the plain crown follows the cylindrical surface.
  const bent = new TessellateModifier(mobile ? .95 : .62, 10).modify(flat); flat.dispose();
  const p = bent.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const point = bandPoint(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, point.x, point.y, point.z); }
  bent.deleteAttribute('normal'); bent.deleteAttribute('uv');
  const smooth = mergeVertices(bent); bent.dispose(); smooth.computeVertexNormals();
  smooth.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(smooth.getAttribute('position').count * 2), 2));
  const rims = [0, WIDTH].map((depth) => {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 128 }, (_, i) => bandPoint(i / 128 * TAU * RADIUS, depth, WALL / 2)), true);
    return new THREE.TubeGeometry(curve, mobile ? 112 : 224, .22, mobile ? 8 : 12, true);
  });
  const result = mergeGeometries([smooth, ...rims])!; smooth.dispose(); rims.forEach((rim) => rim.dispose()); return result;
}
