import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import type { ColliderSpec } from '../game/physics';
import serif from './fonts/monument-serif.json';
import { GATEWAY } from './gateway-layout';
import { gatewayMaterials } from './gateway-materials';

type Point = [number, number, number];
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map((g) => g.index ? g.toNonIndexed() : g), geometry = mergeGeometries(flat)!;
  new Set([...parts, ...flat]).forEach((g) => g.dispose()); return geometry;
}
function solid(g: THREE.BufferGeometry, colliders: ColliderSpec[]): void {
  const p = g.getAttribute('position');
  colliders.push({ type: 'mesh', vertices: new Float32Array(p.array), indices: g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i) });
}

/** Closed step-cut gem: planar tables, bevelled crown, girdle and a faceted pavilion. */
export function gatewayGemGeometry(): THREE.BufferGeometry {
  const length = GATEWAY.stoneLength / 2, h = GATEWAY.stoneHeight / 2;
  const outline = [[-length + .18, -h], [length - .18, -h], [length, -h + .15], [length, h - .15], [length - .18, h], [-length + .18, h], [-length, h - .15], [-length, -h + .15]];
  const rings = [[.92, .4, .46], [.97, .75, .32], [1, 1, .11], [1, 1, -.1], [.91, .3, -.39]];
  const points = rings.map(([sx, sy, z]) => outline.map(([x, y]) => [x * sx, y * sy + GATEWAY.stoneY, z + GATEWAY.z] as Point));
  const vertices: number[] = [], uv: number[] = [];
  const triangle = (a: Point, b: Point, c: Point): void => { for (const p of [a, b, c]) { vertices.push(...p); uv.push((p[0] / length + 1) / 2, (p[1] - GATEWAY.stoneY) / (2 * h) + .5); } };
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    triangle([0, GATEWAY.stoneY, GATEWAY.z + .46], points[0][i], points[0][j]);
    triangle([0, GATEWAY.stoneY, GATEWAY.z - .39], points.at(-1)![j], points.at(-1)![i]);
    for (let r = 0; r < rings.length - 1; r++) { triangle(points[r][i], points[r + 1][i], points[r][j]); triangle(points[r][j], points[r + 1][i], points[r + 1][j]); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals(); return geometry;
}

export function createGateway(parent: THREE.Group, colliders: ColliderSpec[], mobile: boolean, paving?: THREE.Material): THREE.Group {
  const group = new THREE.Group(); group.name = 'King’s Chapel bridge gateway'; parent.add(group);
  const materials = gatewayMaterials(mobile), silver: THREE.BufferGeometry[] = [], bases: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, material: THREE.Material, name: string, collision = true): THREE.Mesh => {
    const object = new THREE.Mesh(g, material); object.name = name; object.castShadow = true; object.receiveShadow = true; group.add(object);
    if (collision) solid(g, colliders); return object;
  };
  const tube = (points: Point[], radius: number, closed = false): void => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, GATEWAY.z + z)), closed, 'centripetal');
    silver.push(new THREE.TubeGeometry(curve, Math.max(mobile ? 20 : 40, points.length * (mobile ? 2 : 4)), radius, mobile ? 8 : 12, closed));
  };
  const cap = (x: number, y: number, z: number, radius: number): void => { silver.push(new THREE.SphereGeometry(radius, mobile ? 10 : 16, 10).translate(x, y, GATEWAY.z + z)); };
  for (const side of [-1, 1]) {
    const base = new RoundedBoxGeometry(1.9, .84, 1.9, 2, .06).translate(side * 3.15, .4, GATEWAY.z);
    const plinth = new RoundedBoxGeometry(2, .14, 2, 2, .045).translate(side * 3.15, .88, GATEWAY.z); bases.push(base, plinth);
    for (const z of [-.34, .34]) {
      // Preserve the source ring's paired inward-facing free ends rather than closing a circular arch.
      tube([[side * 3.05, .97, z], [side * 2.65, 2.05, z], [side * 2.87, 3.5, z], [side * 3.04, 4.35, z], [side * 2.5, 5.25, z], [side * 1.35, 5.47, z], [side * .26, 5.13, z]], .115);
      cap(side * .26, 5.13, z, .12);
      for (const foot of [2.3, 2.8, 3.45, 3.97]) tube([[side * foot, .98, z], [side * (foot * .7 + .86), 1.4, z], [side * 2.81, 2.7, z], [side * 2.88, 3.55, z]], .045);
      tube([[side * 2.28, .98, z], [side * 3.1, .97, z], [side * 4.01, .98, z]], .065);
      // Rounded open bezel ends carry the little radial fans of the photographed setting.
      const center = 3.53, radius = .61;
      const half = Array.from({ length: 25 }, (_, i): Point => { const a = -Math.PI / 2 + i / 24 * Math.PI; return [side * (center + radius * Math.cos(a)), GATEWAY.stoneY + radius * Math.sin(a), z]; });
      tube(half, .06);
      for (let i = 0; i <= 6; i++) {
        const a = -Math.PI / 2 + i / 6 * Math.PI;
        tube([[side * 3.48, GATEWAY.stoneY + .32 * Math.sin(a), z], [side * (center + radius * Math.cos(a)), GATEWAY.stoneY + radius * Math.sin(a), z]], .028);
      }
      tube([[side * 2.91, 4.5, z], [side * 3.23, 5.11, z], [side * 3.55, 5.51, z]], .07);
    }
    for (const y of [1, 3.5, 5.6, 6.5]) tube([[side * (y < 4 ? 2.9 : 3.5), y, -.34], [side * (y < 4 ? 2.9 : 3.5), y, .34]], .045);
  }
  for (const z of [-.34, .34]) for (const y of [GATEWAY.stoneY - .61, GATEWAY.stoneY + .61]) tube([[-3.53, y, z], [0, y, z], [3.53, y, z]], .055);
  // Thin claws hold the prism at its corners; the long table stays unobscured.
  for (const x of [-3.46, 3.46]) for (const side of [-1, 1]) tube([[x, GATEWAY.stoneY + side * .6, -.3], [x, GATEWAY.stoneY + side * .49, .17], [x, GATEWAY.stoneY + side * .31, .43]], .045);
  const baseGeometry = merge(bases), pos = baseGeometry.getAttribute('position'), normal = baseGeometry.getAttribute('normal'), uv = baseGeometry.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    uv.setXY(i, (nx > nz ? pos.getZ(i) : pos.getX(i)) * .75, (ny > .7 ? pos.getZ(i) : pos.getY(i)) * .75);
  }
  add(baseGeometry, materials.limestone, 'Textured limestone gateway abutments');
  const font = new FontLoader().parse(serif), letters: THREE.BufferGeometry[] = [], centers: number[] = []; let advance = 0;
  for (const character of 'LIVISTONE') {
    const g = new TextGeometry(character, { font, size: .65, depth: .085, curveSegments: mobile ? 4 : 8, bevelEnabled: true, bevelThickness: .009, bevelSize: .006, bevelSegments: 2 });
    g.computeBoundingBox(); const bounds = g.boundingBox!, width = bounds.max.x - bounds.min.x;
    g.translate(advance - bounds.min.x, 6.82 - bounds.min.y, GATEWAY.z - .04); letters.push(g); centers.push(advance + width / 2); advance += width + .18;
  }
  const offset = (advance - .18) / 2;
  for (const g of letters) g.translate(-offset, 0, 0);
  for (const x of centers) tube([[x - offset, 6.65, 0], [x - offset, 6.83, 0]], .021);
  add(merge(silver), materials.silver, 'Paired open silver shanks, fan ribs and gemstone bezel');
  add(merge(letters), materials.silver, 'LIVISTONE raised silver lettering');
  const gem = add(gatewayGemGeometry(), materials.gem, 'Long faceted green tourmaline'); gem.castShadow = false;
  if (paving) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (const [z, width] of [[40, 2.2], [42, 2.2], [49, 1.95], [53, 1.95]]) for (const x of [-width, width]) { positions.push(x, .073, z); uv.push(x / 4, z / 4); }
    for (let i = 0; i < 3; i++) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    const apron = new THREE.BufferGeometry(); apron.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); apron.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); apron.setIndex(indices); apron.computeVertexNormals();
    add(apron, paving, 'Paved gateway approach').castShadow = false;
  }
  return group;
}
