import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { STATION } from './station-layout';

const DOORS = [-12, 12], WINDOWS = [-18.2, -15.2, -8.6, -5.7, -2.8, .1, 3, 5.9, 8.6, 15.2, 18.2];
const LOW = 2.02 - 1.52 * Math.pow(Math.SQRT1_2, .78), HIGH = 4.04 - LOW;
function sideZ(y: number): number { return 1.38 * Math.pow(Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs((y - 2.02) / 1.52), 2 / .78))), .68); }
function outline(left: number, bottom: number, width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape(), right = left + width, top = bottom + height;
  s.moveTo(left + radius, bottom); s.lineTo(right - radius, bottom); s.quadraticCurveTo(right, bottom, right, bottom + radius);
  s.lineTo(right, top - radius); s.quadraticCurveTo(right, top, right - radius, top); s.lineTo(left + radius, top);
  s.quadraticCurveTo(left, top, left, top - radius); s.lineTo(left, bottom + radius); s.quadraticCurveTo(left, bottom, left + radius, bottom); return s;
}
function surface(shape: THREE.Shape, side: number, offset = 0, mobile = false): THREE.BufferGeometry {
  const flat = new THREE.ShapeGeometry(shape, mobile ? 6 : 12), source = flat.getAttribute('position'), positions: number[] = [], normals: number[] = [];
  type XY = [number, number];
  // Curved panels need intermediate vertices: long flat triangles otherwise cut across the glass.
  const subdivide = (a: XY, b: XY, c: XY): void => {
    const vertices = [a, b, c], spans = [Math.abs(a[1] - b[1]), Math.abs(b[1] - c[1]), Math.abs(c[1] - a[1])], edge = spans.indexOf(Math.max(...spans));
    if (spans[edge] > (mobile ? .16 : .09)) {
      const u = vertices[edge], v = vertices[(edge + 1) % 3], w = vertices[(edge + 2) % 3], mid: XY = [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
      subdivide(u, mid, w); subdivide(mid, v, w); return;
    }
    for (const [x, y] of vertices) {
      positions.push(STATION.x + x, y, STATION.trackZ + side * (sideZ(y) + offset));
      const slope = (sideZ(y + .001) - sideZ(y - .001)) / .002, length = Math.hypot(1, slope); normals.push(0, -slope / length, side / length);
    }
  };
  for (let i = 0; i < flat.index!.count; i += 3) {
    const points = [0, 1, 2].map((j) => { const n = flat.index!.getX(i + j); return [source.getX(n), source.getY(n)] as XY; }); subdivide(points[0], points[1], points[2]);
  }
  flat.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); return g;
}
function rounded(x: number, y: number, z: number, w: number, h: number, d: number, radius = .08): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, 3, radius).translate(x, y, z);
}

/** Windows are holes in the load-bearing shell, with separate glazing and collision panes. */
export function createMaglevTrain(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean): THREE.Group {
  const train = new THREE.Group(); train.name = 'Panoramic maglev'; root.add(train);
  const pearl = new THREE.MeshStandardMaterial({ color: '#eeeae0', metalness: .3, roughness: .28, side: THREE.DoubleSide });
  const lining = new THREE.MeshStandardMaterial({ color: '#ebe5d8', roughness: .65, side: THREE.DoubleSide });
  const metal = new THREE.MeshStandardMaterial({ color: '#aab8b9', metalness: .82, roughness: .25 });
  const teal = new THREE.MeshStandardMaterial({ color: '#26504f', roughness: .85 });
  const seam = new THREE.MeshStandardMaterial({ color: '#172c30', roughness: .38, metalness: .3, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: '#b6d9dc', metalness: .12, roughness: .12, transparent: true, opacity: mobile ? .17 : .22, side: THREE.DoubleSide, depthWrite: false });
  const light = new THREE.MeshBasicMaterial({ color: '#fff0cd' });
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const emit = (g: THREE.BufferGeometry, material: THREE.Material, solid = false): void => {
    const list = parts.get(material) ?? []; list.push(g); parts.set(material, list);
    if (solid) colliders.push({ type: 'mesh', vertices: new Float32Array(g.getAttribute('position').array), indices: g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i) });
  };
  const sections = [[-27, .025, 1], [-26.5, .22, 1.18], [-25.5, .5, 1.48], [-24, .8, 1.8], [-22, .98, 2], [-21, 1, 2.02], [21, 1, 2.02], [22, .98, 2], [24, .8, 1.8], [25.5, .5, 1.48], [26.5, .22, 1.18], [27, .025, 1]];
  const p: number[] = [], ix: number[] = [], sides = mobile ? 48 : 80;
  sections.forEach(([x, scale, cy], j) => {
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      p.push(STATION.x + x, cy + Math.sign(c) * Math.pow(Math.abs(c), .78) * 1.52 * scale, STATION.trackZ + Math.sign(s) * Math.pow(Math.abs(s), .68) * 1.38 * scale);
      const sidePanel = x === -21 && ((i >= sides / 8 && i < sides * 3 / 8) || (i >= sides * 5 / 8 && i < sides * 7 / 8));
      if (j < sections.length - 1 && i < sides && !sidePanel) { const n = j * (sides + 1) + i; ix.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1); }
    }
  });
  const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); shell.setIndex(ix); shell.computeVertexNormals(); emit(shell, pearl, true);
  for (const side of [-1, 1]) {
    const spans = side > 0 ? [[-21, -13.2], [-10.8, 10.8], [13.2, 21]] : [[-21, 21]];
    for (const [left, right] of spans) {
      const wall = new THREE.Shape(); wall.moveTo(left, LOW);
      wall.lineTo(right, LOW); for (let i = 1; i <= 24; i++) wall.lineTo(right, LOW + (HIGH - LOW) * i / 24);
      wall.lineTo(left, HIGH); for (let i = 23; i >= 0; i--) wall.lineTo(left, LOW + (HIGH - LOW) * i / 24);
      for (const x of WINDOWS.filter((x) => x - 1.12 > left && x + 1.12 < right)) {
        const aperture = outline(x - 1.12, 1.58, 2.24, 1.38, .2); wall.holes.push(new THREE.Path(aperture.getPoints(12)));
        emit(surface(aperture, side, 0, mobile), glass, true);
        const bezel = outline(x - 1.19, 1.51, 2.38, 1.52, .25); bezel.holes.push(new THREE.Path(aperture.getPoints(12))); emit(surface(bezel, side, .012, mobile), seam);
        emit(rounded(STATION.x + x, 1.48, STATION.trackZ + side * 1.23, 2.4, .065, .16, .03), metal);
      }
      emit(surface(wall, side, 0, mobile), pearl, true);
      // Shallow interior panels below the windows leave the panoramic glazing unobstructed.
      emit(rounded(STATION.x + (left + right) / 2, 1.12, STATION.trackZ + side * 1.2, right - left, .55, .08, .03), lining);
    }
    for (const x of DOORS) if (side > 0) {
      // Door frames stop at the boarding threshold and leave the full entrance width clear.
      for (const dx of [-1.22, 1.22]) emit(rounded(STATION.x + x + dx, 1.97, STATION.trackZ + 1.29, .085, 2.34, .12, .035), metal);
      emit(rounded(STATION.x + x, 3.13, STATION.trackZ + 1.08, 2.45, .09, .13, .04), metal);
    }
    emit(rounded(STATION.x, 3.22, STATION.trackZ + side * .83, 41.5, .045, .07, .02), light);
    emit(rounded(STATION.x, 2.99, STATION.trackZ + side * 1.02, 41.4, .065, .22, .025), metal);
  }
  const floor = rounded(STATION.x, .62, STATION.trackZ, 41.5, .16, 2.65, .025);
  emit(floor, new THREE.MeshStandardMaterial({ color: '#464e52', roughness: .97 }), true);
  emit(rounded(STATION.x, .706, STATION.trackZ + .25, 41, .012, 1.05, .005), new THREE.MeshStandardMaterial({ color: '#737f80', roughness: 1 }));
  // Transverse lounge seats have sculpted cushions and slender bases; a clear aisle joins both doors.
  for (let x = -19.5; x <= 18.5; x += 1.65) {
    emit(rounded(x, 1.02, STATION.trackZ - .8, .92, .2, .77, .095), teal);
    const back = new RoundedBoxGeometry(.19, 1.02, .8, 4, .09).rotateZ(-.13).translate(x - .39, 1.54, STATION.trackZ - .8); emit(back, teal);
    emit(rounded(x - .43, 2.02, STATION.trackZ - .8, .23, .28, .65, .1), lining);
    emit(rounded(x, .82, STATION.trackZ - .8, .46, .23, .44, .06), metal);
    for (const dz of [-1.22, -.37]) emit(rounded(x, 1.29, STATION.trackZ + dz, .8, .085, .07, .035), metal);
    colliders.push({ type: 'box', position: [x - .05, 1.35, STATION.trackZ - .8], size: [.52, .65, .44] });
  }
  // Bulkheads distinguish the passenger saloon from the tapered driving cabs.
  for (const end of [-1, 1]) {
    const x = STATION.x + end * 20.65;
    emit(rounded(x, 1.97, STATION.trackZ, .12, 2.5, 2.42, .15), lining, true);
    emit(rounded(x - end * .08, 1.98, STATION.trackZ, .025, 1.96, .85, .09), seam);
    emit(rounded(x - end * .1, 2.42, STATION.trackZ, .03, .65, .61, .08), glass);
    // Flush curved windscreen follows the nose, rather than a floating rectangular decal.
    const wp: number[] = [], wi: number[] = [];
    for (let j = 0; j <= 12; j++) for (let i = 0; i <= 16; i++) {
      const xx = 22 + j / 12 * 2, scale = .98 + (.8 - .98) * j / 12, cy = 2 + (1.8 - 2) * j / 12, a = (i / 16 - .5) * 1.75;
      wp.push(STATION.x + xx * end, cy + Math.pow(Math.cos(a), .78) * 1.52 * scale + .02, STATION.trackZ + Math.sign(a) * Math.pow(Math.abs(Math.sin(a)), .68) * 1.38 * scale);
      if (j < 12 && i < 16) { const n = j * 17 + i; wi.push(n, n + 17, n + 1, n + 1, n + 17, n + 18); }
    }
    const windscreen = new THREE.BufferGeometry(); windscreen.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); windscreen.setIndex(wi); windscreen.computeVertexNormals(); emit(windscreen, seam);
    for (const side of [-1, 1]) emit(rounded(STATION.x + end * 25.35, 1.52, STATION.trackZ + side * .49, .32, .085, .21, .035), light);
  }
  for (const [material, geometries] of parts) {
    const normalized = geometries.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; });
    const geometry = mergeGeometries(normalized)!; normalized.forEach((g) => g.dispose()); geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, material); mesh.name = material === glass ? 'Transparent panoramic train windows' : material === teal ? 'Sculpted lounge upholstery' : 'Maglev cabin and body';
    mesh.castShadow = material !== glass && material !== light; mesh.receiveShadow = true; train.add(mesh);
  }
  return train;
}
