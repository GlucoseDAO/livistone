import * as THREE from 'three';

type Point = readonly [number, number];
type Cubic = readonly [Point, Point, Point, Point];
export interface StumpStencilConnection { readonly key: string; readonly name: string; readonly centre: Point; readonly label: string; readonly curve: Cubic }
export interface StencilGlyph { character: string; x: number; y: number; angle: number; advance: number }

/** The proposal's native PDF coordinates, not the island's geographic coordinates or a walking network. */
export const STUMP_STENCIL = {
  width: 1200, height: 800, capGuideDiameter: 156, origin: [975, 400] as Point, circleRadius: 48, nameRadius: 74, nameFontSize: 18.5,
  lineFontSize: 22, lineLabelCentre: .52, lineLabelOffset: 13,
  connections: [
    { key: 'Liangdao', name: 'LIANGDAO / MATSU', centre: [175, 670], label: '35 km · oldest record', curve: [[223, 670], [460, 670], [640, 600], [855, 518]] },
    { key: 'Suogang', name: 'SUOGANG / PENGHU', centre: [175, 485], label: '297 km · Penghu site', curve: [[223, 485], [460, 485], [615, 455], [801, 447]] },
    { key: 'Hanben', name: 'HANBEN / BLIHUN', centre: [175, 300], label: '273 km · east-coast records', curve: [[223, 300], [460, 300], [620, 337], [816, 357]] },
    { key: 'Gongguan', name: 'GONGGUAN / GREEN ISLAND', centre: [175, 115], label: '417 km · Green Island', curve: [[223, 115], [460, 115], [630, 220], [852, 277]] },
  ] as readonly StumpStencilConnection[],
} as const;
export const STUMP_STENCIL_SCALE = .5 / STUMP_STENCIL.capGuideDiameter;

export function stumpStencilPoint(curve: Cubic, t: number): Point {
  const u = 1 - t;
  return [0, 1].map(axis => u ** 3 * curve[0][axis] + 3 * u * u * t * curve[1][axis] + 3 * u * t * t * curve[2][axis] + t ** 3 * curve[3][axis]) as [number, number];
}
export function stumpStencilTangent(curve: Cubic, t: number): Point {
  const u = 1 - t;
  return [0, 1].map(axis => 3 * u * u * (curve[1][axis] - curve[0][axis]) + 6 * u * t * (curve[2][axis] - curve[1][axis]) + 3 * t * t * (curve[3][axis] - curve[2][axis])) as [number, number];
}
/** PDF Y is up; the horizontal Three.js drawing uses Z down and has its cap-guide centre at the origin. */
export function stumpStencilLocal(point: Point, scale = STUMP_STENCIL_SCALE, height = .253): THREE.Vector3 {
  return new THREE.Vector3((point[0] - STUMP_STENCIL.origin[0]) * scale, height, (STUMP_STENCIL.origin[1] - point[1]) * scale);
}

export function stumpStencilNameGlyphs(connection: StumpStencilConnection, measure: (character: string) => number): StencilGlyph[] {
  const advances = Array.from(connection.name, measure), radius = STUMP_STENCIL.nameRadius, span = advances.reduce((sum, width) => sum + width, 0) / radius;
  let angle = Math.PI / 2 + span / 2;
  return Array.from(connection.name, (character, i) => {
    const advance = advances[i], middle = angle - advance / (2 * radius); angle -= advance / radius;
    return { character, x: connection.centre[0] + radius * Math.cos(middle), y: connection.centre[1] + radius * Math.sin(middle), angle: middle - Math.PI / 2, advance };
  });
}

export function stumpStencilCurveGlyphs(connection: StumpStencilConnection, measure: (character: string) => number): StencilGlyph[] {
  const advances = Array.from(connection.label, measure), samples: { t: number; length: number }[] = [{ t: 0, length: 0 }];
  let previous = stumpStencilPoint(connection.curve, 0), length = 0;
  for (let i = 1; i <= 512; i++) {
    const t = i / 512, point = stumpStencilPoint(connection.curve, t); length += Math.hypot(point[0] - previous[0], point[1] - previous[1]); samples.push({ t, length }); previous = point;
  }
  const parameterAt = (distance: number): number => {
    let low = 0, high = samples.length - 1;
    while (high - low > 1) { const middle = (low + high) >> 1; if (samples[middle].length < distance) low = middle; else high = middle; }
    const a = samples[low], b = samples[high], fraction = Math.max(0, Math.min(1, (distance - a.length) / (b.length - a.length)));
    return a.t + (b.t - a.t) * fraction;
  };
  let distance = length * STUMP_STENCIL.lineLabelCentre - advances.reduce((sum, width) => sum + width, 0) / 2;
  return Array.from(connection.label, (character, i) => {
    const advance = advances[i], t = parameterAt(distance + advance / 2), [x, y] = stumpStencilPoint(connection.curve, t), [dx, dy] = stumpStencilTangent(connection.curve, t), angle = Math.atan2(dy, dx); distance += advance;
    return { character, x: x - Math.sin(angle) * STUMP_STENCIL.lineLabelOffset, y: y + Math.cos(angle) * STUMP_STENCIL.lineLabelOffset, angle, advance };
  });
}

/** Four uninterrupted cubic ribbons and four empty endpoint circles, in one draw and without raised geometry or collision. */
export function createStumpStencilGeometry(scale = STUMP_STENCIL_SCALE, height = .253, rootContinuation = 0): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const ribbon = (points: Point[], width: number): void => {
    const start = positions.length / 3;
    points.forEach((point, i) => {
      const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)], dx = after[0] - before[0], dy = after[1] - before[1], distance = Math.hypot(dx, dy), nx = -dy / distance * width / 2, ny = dx / distance * width / 2;
      for (const side of [1, -1]) positions.push(...stumpStencilLocal([point[0] + nx * side, point[1] + ny * side], scale, height).toArray());
      if (i) { const a = start + (i - 1) * 2; indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    });
  };
  for (const connection of STUMP_STENCIL.connections) {
    ribbon(Array.from({ length: 129 }, (_, i) => stumpStencilPoint(connection.curve, i / 128 * (1 + rootContinuation))), 2.4);
    ribbon(Array.from({ length: 129 }, (_, i): Point => { const angle = i / 128 * Math.PI * 2; return [connection.centre[0] + Math.cos(angle) * STUMP_STENCIL.circleRadius, connection.centre[1] + Math.sin(angle) * STUMP_STENCIL.circleRadius]; }), 2.6);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Canvas is transparent: the four circle centres retain the terrace's own stone surface. */
export function paintStumpStencilLabels(canvas: HTMLCanvasElement): void {
  canvas.width = 2400; canvas.height = 1600;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.scale(2, 2); ctx.fillStyle = '#161616'; ctx.textBaseline = 'alphabetic';
  const paint = (glyphs: StencilGlyph[]): void => {
    for (const glyph of glyphs) { ctx.save(); ctx.translate(glyph.x, STUMP_STENCIL.height - glyph.y); ctx.rotate(-glyph.angle); ctx.fillText(glyph.character, -glyph.advance / 2, 0); ctx.restore(); }
  };
  for (const connection of STUMP_STENCIL.connections) {
    ctx.font = `700 ${STUMP_STENCIL.nameFontSize}px "Noto Sans", Arial, sans-serif`; paint(stumpStencilNameGlyphs(connection, character => ctx.measureText(character).width));
    ctx.font = `${STUMP_STENCIL.lineFontSize}px "Noto Sans", Arial, sans-serif`; paint(stumpStencilCurveGlyphs(connection, character => ctx.measureText(character).width));
  }
}

export interface StumpStencilOptions { scale?: number; height?: number; labels?: boolean; rootContinuation?: number }
export function createStumpStencil({ scale = STUMP_STENCIL_SCALE, height = .253, labels = typeof document !== 'undefined', rootContinuation = 0 }: StumpStencilOptions = {}): THREE.Group {
  const group = new THREE.Group(); group.name = 'Stump of Life · four proposal floor connections';
  group.userData.stencil = { source: 'Canvas review-v03 native floor-stencil-master', scale, appearance: 'Physical proposal proportions: native cap guide equals500mm; geographic island scale is independent', distances: 'Rounded straight-line geographic separations from the proposed venue; not migration routes or walking paths', circles: STUMP_STENCIL.connections.map(({ name, label }) => ({ name, label })) };
  group.userData.stencil.rootContinuation = rootContinuation;
  const ink = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), lines = new THREE.Mesh(createStumpStencilGeometry(scale, height, rootContinuation), ink);
  lines.name = 'Four smooth floor curves and four empty circles'; lines.userData.keepGeometry = true; group.add(lines);
  if (labels) {
    const canvas = document.createElement('canvas'); paintStumpStencilLabels(canvas);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: .08, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const lettering = new THREE.Mesh(new THREE.PlaneGeometry(STUMP_STENCIL.width * scale, STUMP_STENCIL.height * scale), material); lettering.rotation.x = -Math.PI / 2;
    lettering.position.set((STUMP_STENCIL.width / 2 - STUMP_STENCIL.origin[0]) * scale, height + .0005, (STUMP_STENCIL.origin[1] - STUMP_STENCIL.height / 2) * scale); lettering.name = 'Names around circles and phrases along curves'; lettering.userData.keepGeometry = true; group.add(lettering);
  }
  return group;
}
