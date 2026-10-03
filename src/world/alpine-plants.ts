// Sub-plan 27, round 2: the plateau's plants after the owner's photograph of the real Jepii Mici meadow. Rhododendron myrtifolium
// in bloom grows in low mats a hand or two high that spread in drifts across the turf: small dark glossy leaves under masses of
// small magenta funnel flowers in trusses. Yellow buttercups and avens, small white flowers and moss campion dot the turf between.
// The mats are one heightfield draw over their whole extent, flowered by their own shader; their fringe of leafy sprigs, the
// trusses raised above them and the turf's flowers are alpha-cut cards from one atlas painted at load: one more draw. Moss campion
// keeps its cushions (a third draw). Nothing on cpu, where the ground's paint stands in.
import * as THREE from 'three';
import { atan, attribute, cameraPosition, cameraViewMatrix, color, cos, diffuseColor, distance, float, floor, fract, fwidth, length, mix, mx_cell_noise_float, mx_noise_float, mx_worley_noise_float, normalLocal, normalize, positionLocal, positionWorld, smoothstep, step, vec2, vec3, vec4 } from 'three/tsl';
import type { GraphicsTier } from '../game/graphics';
import type { RockSite } from './water-surface';
import type { ContactSite } from './contact-shadows';
import { terrainHeight, terrainSurfaceNormal } from './terrain';
import { rockReach } from './river-rocks';
import { PLATEAU, TRAIL_HALF, bloomDensity, mountainNoise, plateauInside, trailDistance, turfCover } from './mountain-layout';
import { WIND_ROOT, plantSway } from './wind';

const TAU = Math.PI * 2, smooth = THREE.MathUtils.smoothstep;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
/** The plateau's sampling box, a little beyond its outline. */
const BOX = { minX: PLATEAU.x - PLATEAU.a - 3, maxX: PLATEAU.x + PLATEAU.a + 3, minZ: PLATEAU.z - PLATEAU.b - 3, maxZ: PLATEAU.z + PLATEAU.b + 3 };

/**
 * The rendered ground's height, cached per two-metre cell: the same triangles as terrainSurfaceHeight (terrain.ts), whose corner
 * heights would otherwise be recomputed for every one of the mats' many vertices.
 */
function groundHeights(): (x: number, z: number) => number {
  const cells = new Map<number, [number, number, number, number]>();
  return (x, z) => {
    const x0 = Math.floor(x / 2) * 2, z0 = Math.floor(z / 2) * 2, key = x0 * 4096 + z0, u = (x - x0) / 2, v = (z - z0) / 2;
    let c = cells.get(key); if (!c) { c = [terrainHeight(x0, z0), terrainHeight(x0 + 2, z0), terrainHeight(x0, z0 + 2), terrainHeight(x0 + 2, z0 + 2)]; cells.set(key, c); }
    return u + v <= 1 ? c[0] + (c[1] - c[0]) * u + (c[2] - c[0]) * v : c[3] + (c[2] - c[3]) * (1 - u) + (c[1] - c[3]) * (1 - v);
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Rhododendron mats

/** Mats grow where `matField` exceeds this. */
export const MAT_EDGE = .5;
/**
 * Rhododendron cover at (x, z): the layout's drifts (bloomDensity) broken into clumps a metre or three across with turf between,
 * as in the photograph, where the mats run in uneven bands along the slope.
 */
export function matField(x: number, z: number): number {
  const drift = bloomDensity(x, z); if (drift <= 0) return 0;
  const clumps = mountainNoise(x * .9 + 13, z * 1.25 - 4) * .62 + mountainNoise(x * 2.3 - 9, z * 2.3 + 3) * .38;
  return drift * (.35 + .95 * clumps);
}
/** A mat's height above the ground, metres: buried just outside its edge, rising over its first 30 cm to a 15–32 cm top. */
function matHeight(f: number, x: number, z: number): number {
  if (f < MAT_EDGE) return -.04;
  return (.1 + .12 * mountainNoise(x * .7 + 2, z * .7)) * Math.pow(smooth(f, MAT_EDGE, MAT_EDGE + .22), .55) + .03 * (mountainNoise(x * 4.1, z * 4.1 - 7) - .5);
}
/** What keeps the mats and the turf's flowers off a point: the trail's tread and the boulders. */
function blockedBy(rocks: readonly RockSite[]): (x: number, z: number, margin: number) => boolean {
  const stones = rocks.filter(r => r.x > BOX.minX - 4 && r.x < BOX.maxX + 4 && r.z > BOX.minZ - 4 && r.z < BOX.maxZ + 4);
  return (x, z, margin) => trailDistance(x, z) < TRAIL_HALF + .35 + margin || stones.some(r => Math.hypot(r.x - x, r.z - z) < rockReach(r.s) + .15 + margin);
}

export interface MatGrid { step: number; x0: number; z0: number; nx: number; nz: number; field: Float32Array }
/** The mat field on a regular grid over the plateau (0.18 m on gpu, 0.3 m on mobile), zero where a rock or the trail blocks it. */
export function matGrid(mobile: boolean, rocks: readonly RockSite[]): MatGrid {
  const step = mobile ? .3 : .18, x0 = BOX.minX, z0 = BOX.minZ, nx = Math.ceil((BOX.maxX - x0) / step) + 1, nz = Math.ceil((BOX.maxZ - z0) / step) + 1;
  const field = new Float32Array(nx * nz), blocked = blockedBy(rocks), ground = groundHeights();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step; let f = matField(x, z); if (f <= 0) continue;
    // Mats spread on the meadow, not up the crags' foot, where a mound would stand out as a spike.
    f *= 1 - smooth(Math.hypot(ground(x + .6, z) - ground(x - .6, z), ground(x, z + .6) - ground(x, z - .6)) / 1.2, .28, .42);
    field[j * nx + i] = f > MAT_EDGE - .1 && blocked(x, z, 0) ? 0 : f;
  }
  return { step, x0, z0, nx, nz, field };
}
/** The mats as one indexed heightfield: every grid cell with a corner inside a mat, edges buried; `mat` is 0 at the fringe, 1 on top. */
function matGeometry(grid: MatGrid, ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const { step, x0, z0, nx, nz, field } = grid, index = new Int32Array(nx * nz).fill(-1), positions: number[] = [], tops: number[] = [], indices: number[] = [];
  const vertex = (i: number, j: number): number => {
    const k = j * nx + i; if (index[k] >= 0) return index[k];
    const x = x0 + i * step, z = z0 + j * step, h = matHeight(field[k], x, z);
    positions.push(x, ground(x, z) + h, z); tops.push(THREE.MathUtils.clamp(h / .2, 0, 1));
    return (index[k] = positions.length / 3 - 1);
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const k = j * nx + i; if (Math.max(field[k], field[k + 1], field[k + nx], field[k + nx + 1]) < MAT_EDGE) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('mat', new THREE.Float32BufferAttribute(tops, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}
/**
 * The mats' own surface is the shade inside them: dense small dark leaves, glossy only in specks, seen through the gaps between
 * the cards. Past the distance where the cards fold away, it takes on the flowers' share of magenta, so a far drift stays pink.
 */
function matMaterial(fold: readonly [number, number]): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial(), top = attribute<'float'>('mat', 'float'), xz = positionWorld.xz;
  const leafCell = mx_worley_noise_float(vec3(xz.mul(42), top.mul(3))).toVar(), bronze = step(.93, mx_cell_noise_float(vec3(floor(xz.mul(42)), 7)));
  const leaves = mix(mix(color('#14270f'), color('#2f4d22'), mx_noise_float(vec3(xz.mul(9), 2)).mul(.5).add(.5)), color('#4a2a18'), bronze.mul(.6)).mul(mix(.55, 1.1, smoothstep(0, .75, leafCell))).toVar();
  // Specks of flower in the shade, then the whole drift's share of them where the cards no longer draw.
  const specks = step(.9, mx_cell_noise_float(vec3(floor(xz.mul(26)), 3))).mul(top);
  const far = smoothstep(fold[0] * .7, fold[1], distance(positionWorld, cameraPosition));
  const flowers = mix(specks.mul(.7), mix(.25, .68, top), far);
  material.colorNode = mix(leaves, mix(color('#a8226e'), color('#d0459a'), mx_noise_float(vec3(xz.mul(6), 5)).mul(.5).add(.5)), flowers).mul(mix(.6, 1, top));
  material.roughnessNode = mix(.62, .8, leafCell);
  return material;
}

// ---------------------------------------------------------------------------------------------------------------------
// The atlas: rhododendron trusses and sprigs, the turf's flowers

type Ctx = CanvasRenderingContext2D;
/** Atlas cells of 128 units (256 px on gpu): eight columns, two rows. */
const CELL = 128, ATLAS = { width: 1024, height: 256 };
const SPRITE = {
  bouquet: [[0, 0], [1, 0], [2, 0], [3, 0]], side: [[4, 0], [5, 0]], leafy: [[6, 0], [7, 0]],
  buttercup: [[0, 1], [1, 1]], cup: [[2, 1]], white: [[3, 1]], buds: [[4, 1]], stem: [[7, 1]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;
/** Texture coordinates of (s, t) ∈ [0, 1]² in a cell, t up; the atlas's first data row is the canvas's top row (v = 0). */
const cellUV = ([col, row]: readonly [number, number], s: number, t: number): [number, number] => [(col * CELL + s * CELL) / ATLAS.width, (row * CELL + (1 - t) * CELL) / ATLAS.height];

/** One small elliptic leaf from (x, y) toward `angle`, glossy with a paler midrib; bronze ones are the old leaves. */
function leaf(c: Ctx, m: Ctx, x: number, y: number, angle: number, length: number, width: number, rand: () => number, bronze = false): void {
  const path = new Path2D(), dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, side = (t: number): number => width / 2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .7) * (1 - .25 * t);
  for (let k = 0; k <= 16; k++) { const t = k / 16; path.lineTo(x + dx * length * t + nx * side(t), y + dy * length * t + ny * side(t)); }
  for (let k = 16; k >= 0; k--) { const t = k / 16; path.lineTo(x + dx * length * t - nx * side(t), y + dy * length * t - ny * side(t)); }
  path.closePath(); m.fillStyle = '#fff'; m.fill(path);
  const g = c.createLinearGradient(x - nx * width / 2, y - ny * width / 2, x + nx * width / 2, y + ny * width / 2), shade = .85 + rand() * .3;
  const [dark, mid, light] = bronze ? ['#4a2a18', '#6e4026', '#8f5a35'] : ['#152c14', '#274a20', '#4d7436'];
  g.addColorStop(0, dark); g.addColorStop(.45, mid); g.addColorStop(.7, light); g.addColorStop(1, dark);
  c.save(); c.globalAlpha = shade > 1 ? 1 : shade; c.fillStyle = g; c.fill(path); c.restore();
  c.strokeStyle = bronze ? 'rgba(200,150,110,.35)' : 'rgba(170,205,140,.4)'; c.lineWidth = Math.max(.8, width * .08);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * length * .92, y + dy * length * .92); c.stroke();
  // The sun's sheen along one half of the blade.
  c.strokeStyle = 'rgba(220,240,200,.22)'; c.lineWidth = Math.max(1, width * .18);
  c.beginPath(); c.moveTo(x + dx * length * .2 + nx * width * .18, y + dy * length * .2 + ny * width * .18); c.lineTo(x + dx * length * .75 + nx * width * .12, y + dy * length * .75 + ny * width * .12); c.stroke();
}
/** One funnel flower seen into its mouth (squashed by `sy` when seen at a slant): five lobes, dark throat, pale rims, spots, stamens. */
function flower(c: Ctx, m: Ctx, cx: number, cy: number, radius: number, turn: number, sy: number, rand: () => number, hue = 0): void {
  const path = new Path2D(), squash = (x: Ctx): void => { x.translate(cx, cy); x.scale(1, sy); x.translate(-cx, -cy); };
  for (let k = 0; k <= 90; k++) {
    const a = k / 90 * TAU, lobe = Math.pow(Math.abs(Math.cos((a - turn) * 2.5)), .55), r = radius * (.74 + .26 * lobe);
    path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  path.closePath(); m.save(); squash(m); m.fillStyle = '#fff'; m.fill(path); m.restore();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, radius), tone = (l: number, s = 1): string => `hsl(${322 + hue},${Math.round(70 * s)}%,${l}%)`;
  g.addColorStop(0, tone(17)); g.addColorStop(.16, tone(28)); g.addColorStop(.42, tone(44)); g.addColorStop(.8, tone(55)); g.addColorStop(1, tone(70, .8));
  c.save(); squash(c); c.fillStyle = g; c.fill(path); c.clip(path);
  for (let k = 0; k < 5; k++) {
    const a = turn + k / 5 * TAU, b = a + TAU / 10;
    // A paler vein up each lobe and a shaded crease between lobes.
    c.strokeStyle = 'rgba(255,205,235,.28)'; c.lineWidth = radius * .11; c.beginPath(); c.moveTo(cx + Math.cos(a) * radius * .25, cy + Math.sin(a) * radius * .25); c.lineTo(cx + Math.cos(a) * radius * .85, cy + Math.sin(a) * radius * .85); c.stroke();
    c.strokeStyle = 'rgba(80,8,50,.35)'; c.lineWidth = radius * .05; c.beginPath(); c.moveTo(cx + Math.cos(b) * radius * .3, cy + Math.sin(b) * radius * .3); c.lineTo(cx + Math.cos(b) * radius * .95, cy + Math.sin(b) * radius * .95); c.stroke();
  }
  // Darker spots on the upper lobe.
  for (let k = 0; k < 6; k++) { const a = turn + (rand() - .5) * .6, d = radius * (.25 + rand() * .3); c.fillStyle = 'rgba(105,15,65,.75)'; c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(.7, radius * .045), 0, TAU); c.fill(); }
  // Ten stamens, pale filaments with brown anthers, curving out of the throat.
  for (let k = 0; k < 9; k++) {
    const a = rand() * TAU, d = radius * (.42 + rand() * .2), ex = cx + Math.cos(a) * d, ey = cy + Math.sin(a) * d;
    c.strokeStyle = 'rgba(250,228,240,.85)'; c.lineWidth = Math.max(.6, radius * .035); c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + Math.cos(a + .3) * d * .5, cy + Math.sin(a + .3) * d * .5, ex, ey); c.stroke();
    c.fillStyle = '#5b3326'; c.beginPath(); c.arc(ex, ey, Math.max(.8, radius * .055), 0, TAU); c.fill();
  }
  c.restore();
}
/** A bud: a dark magenta ovoid tipped paler, in green bracts. */
function bud(c: Ctx, m: Ctx, x: number, y: number, angle: number, length: number): void {
  const path = new Path2D(), dx = Math.cos(angle), dy = Math.sin(angle);
  path.ellipse(x + dx * length * .5, y + dy * length * .5, length * .5, length * .28, angle, 0, TAU); m.fillStyle = '#fff'; m.fill(path);
  const g = c.createLinearGradient(x, y, x + dx * length, y + dy * length); g.addColorStop(0, '#5d1340'); g.addColorStop(.6, '#9c2369'); g.addColorStop(1, '#d4589f');
  c.fillStyle = g; c.fill(path);
  c.fillStyle = '#3b5a26'; c.beginPath(); c.ellipse(x + dx * length * .12, y + dy * length * .12, length * .16, length * .2, angle, 0, TAU); c.fill(); m.beginPath(); m.ellipse(x + dx * length * .12, y + dy * length * .12, length * .16, length * .2, angle, 0, TAU); m.fill();
}
/** A buttercup or avens face: broad glossy golden petals round a green boss ringed with stamens. */
function buttercup(c: Ctx, m: Ctx, cx: number, cy: number, radius: number, petals: number, rand: () => number, deep = false): void {
  for (let k = 0; k < petals; k++) {
    const a = k / petals * TAU + rand() * .2, px = cx + Math.cos(a) * radius * .5, py = cy + Math.sin(a) * radius * .5, path = new Path2D();
    path.ellipse(px, py, radius * .52, radius * .4, a, 0, TAU); m.fillStyle = '#fff'; m.fill(path);
    const g = c.createRadialGradient(cx, cy, radius * .1, cx, cy, radius); g.addColorStop(0, deep ? '#d08a00' : '#d9a300'); g.addColorStop(.55, deep ? '#f2b000' : '#f6cb17'); g.addColorStop(1, deep ? '#ffc52a' : '#ffe14d');
    c.fillStyle = g; c.fill(path); c.strokeStyle = 'rgba(150,100,0,.35)'; c.lineWidth = 1; c.stroke(path);
    c.fillStyle = 'rgba(255,255,235,.55)'; c.beginPath(); c.ellipse(cx + Math.cos(a) * radius * .55, cy + Math.sin(a) * radius * .55, radius * .14, radius * .07, a, 0, TAU); c.fill();
  }
  c.fillStyle = '#9aa53a'; c.beginPath(); c.arc(cx, cy, radius * .22, 0, TAU); c.fill();
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; c.fillStyle = '#e09a0c'; c.beginPath(); c.arc(cx + Math.cos(a) * radius * .27, cy + Math.sin(a) * radius * .27, radius * .05, 0, TAU); c.fill(); }
}
/**
 * Paints the plateau's atlas: rhododendron trusses seen from above and from the side, leafy rosettes and sprigs, buds, buttercups,
 * avens and small white flowers, and a stem swatch. Colour and coverage are painted separately and joined into one texture, so the
 * colour round every cut-out edge is the sprite's own rather than the canvas's transparent black, which would fringe the mipmaps.
 */
export function paintAlpineAtlas(tier: GraphicsTier): THREE.DataTexture {
  const scale = tier === 'gpu' ? 2 : 1, w = ATLAS.width * scale, h = ATLAS.height * scale;
  const canvas = (): Ctx => { const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d', { willReadFrequently: true })!; x.scale(scale, scale); return x; };
  const c = canvas(), m = canvas(), rand = random(8821);
  const cell = ([col, row]: readonly [number, number], ground: string, draw: () => void): void => {
    c.save(); m.save(); c.translate(col * CELL, row * CELL); m.translate(col * CELL, row * CELL);
    c.fillStyle = ground; c.fillRect(0, 0, CELL, CELL); c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip(); m.beginPath(); m.rect(0, 0, CELL, CELL); m.clip();
    draw(); c.restore(); m.restore();
  };
  /** A flower with a soft shadow on what lies beneath, so a crowded truss reads in depth. */
  const shaded = (x: number, y: number, radius: number, sy: number, hue: number): void => {
    c.save(); c.fillStyle = 'rgba(10,20,8,.38)'; c.filter = 'blur(2px)'; c.beginPath(); c.ellipse(x + radius * .15, y + radius * .3, radius * .95, radius * .8 * sy, 0, 0, TAU); c.fill(); c.restore();
    flower(c, m, x, y, radius, rand() * TAU, sy, rand, hue);
  };
  // Masses of flowers seen from above: a bed of leaves, then ten to fourteen flowers crowded back to front, a few buds.
  SPRITE.bouquet.forEach((at, v) => cell(at, '#2a3a22', () => {
    for (let k = 0; k < 11; k++) leaf(c, m, 64 + (rand() - .5) * 20, 64 + (rand() - .5) * 20, k / 11 * TAU + rand() * .4, 34 + rand() * 22, 12 + rand() * 4, rand, rand() < .12);
    const blooms = Array.from({ length: 10 + v + Math.floor(rand() * 3) }, () => { const a = rand() * TAU, d = Math.sqrt(rand()) * 36; return { x: 64 + Math.cos(a) * d, y: 64 + Math.sin(a) * d * .9, r: 11 + rand() * 6, sy: .72 + rand() * .28 }; });
    blooms.sort((p, q) => p.y - q.y).forEach(b => shaded(b.x, b.y, b.r, b.sy, (rand() - .5) * 12));
    for (let k = 0; k < 2 + v % 2; k++) bud(c, m, 64 + (rand() - .5) * 60, 64 + (rand() - .5) * 60, rand() * TAU, 12 + rand() * 4);
  }));
  // The same from the side: leafy twigs below, flowers nodding out over the top half.
  SPRITE.side.forEach((at) => cell(at, '#24331d', () => {
    for (let s2 = 0; s2 < 5; s2++) {
      const x = 22 + s2 * 21 + (rand() - .5) * 8, top = 62 + rand() * 18; c.strokeStyle = '#4c3a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 128); c.lineTo(x + (rand() - .5) * 10, top); c.stroke(); m.strokeStyle = '#fff'; m.lineWidth = 3; m.beginPath(); m.moveTo(x, 128); m.lineTo(x, top); m.stroke();
      for (let k = 0; k < 5; k++) { const y = 124 - k * 11, side = k % 2 ? 1 : -1; leaf(c, m, x, y, -Math.PI / 2 + side * (.7 + rand() * .5), 22 + rand() * 9, 9, rand, rand() < .1); }
    }
    const blooms = Array.from({ length: 9 }, (_, k) => ({ x: 14 + k * 12.5 + (rand() - .5) * 8, y: 30 + Math.abs(k - 4) * 4 + rand() * 22, r: 11 + rand() * 5, sy: .45 + rand() * .3 }));
    blooms.sort((p, q) => p.y - q.y).forEach(b => shaded(b.x, b.y, b.r, b.sy, (rand() - .5) * 12));
  }));
  // Leaf masses for the mats' fringe: overlapping sprigs of small glossy leaves.
  SPRITE.leafy.forEach((at) => cell(at, '#1f331a', () => {
    for (let s2 = 0; s2 < 6; s2++) {
      const x = 14 + s2 * 20 + (rand() - .5) * 8; c.strokeStyle = '#4c3a2a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, 128); c.lineTo(x + (rand() - .5) * 14, 30 + rand() * 30); c.stroke(); m.strokeStyle = '#fff'; m.lineWidth = 2.5; m.beginPath(); m.moveTo(x, 128); m.lineTo(x, 40); m.stroke();
      for (let k = 0; k < 8; k++) { const y = 124 - k * 11, side = k % 2 ? 1 : -1; leaf(c, m, x, y, -Math.PI / 2 + side * (.55 + rand() * .55), 22 + rand() * 10, 9, rand, rand() < .12); }
    }
  }));
  SPRITE.buttercup.forEach((at, v) => cell(at, '#e2b81c', () => buttercup(c, m, 64, 64, 54, v ? 6 : 5, rand, v === 1)));
  // A buttercup's cup from the side, green sepals beneath.
  cell(SPRITE.cup[0], '#e2b81c', () => {
    const path = new Path2D(); path.moveTo(14, 40); path.quadraticCurveTo(64, 140, 114, 40); path.quadraticCurveTo(64, 70, 14, 40); m.fillStyle = '#fff'; m.fill(path);
    const g = c.createLinearGradient(0, 40, 0, 110); g.addColorStop(0, '#ffe14d'); g.addColorStop(1, '#c99400'); c.fillStyle = g; c.fill(path);
    c.fillStyle = '#4f6d2a'; for (const x of [44, 64, 84]) { c.beginPath(); c.ellipse(x, 102, 10, 18, (x - 64) / 40, 0, TAU); c.fill(); m.beginPath(); m.ellipse(x, 102, 10, 18, (x - 64) / 40, 0, TAU); m.fill(); }
  });
  // A small white flower: five narrow veined petals, a yellow eye.
  cell(SPRITE.white[0], '#e8e6dc', () => {
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU, path = new Path2D(); path.ellipse(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28, 30, 15, a, 0, TAU); m.fillStyle = '#fff'; m.fill(path); c.fillStyle = '#f6f4ec'; c.fill(path); c.strokeStyle = 'rgba(150,150,140,.45)'; c.lineWidth = 1.2; c.stroke(path); }
    c.fillStyle = '#e8c23a'; c.beginPath(); c.arc(64, 64, 12, 0, TAU); c.fill();
  });
  cell(SPRITE.buds[0], '#3a2433', () => { for (let k = 0; k < 6; k++) leaf(c, m, 64, 70, k / 6 * TAU + rand(), 34, 12, rand); for (let k = 0; k < 5; k++) bud(c, m, 64, 66, -Math.PI / 2 + (k - 2) * .45, 26 + rand() * 8); });
  cell(SPRITE.stem[0], '#557a32', () => { m.fillStyle = '#fff'; m.fillRect(0, 0, CELL, CELL); c.fillStyle = '#557a32'; c.fillRect(0, 0, CELL, CELL); });
  const rgb = c.getImageData(0, 0, w, h).data, alpha = m.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = rgb[i * 4]; data[i * 4 + 1] = rgb[i * 4 + 1]; data[i * 4 + 2] = rgb[i * 4 + 2]; data[i * 4 + 3] = alpha[i * 4 + 3]; }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = tier === 'gpu' ? 8 : 4; texture.needsUpdate = true; return texture;
}

// ---------------------------------------------------------------------------------------------------------------------
// Cards: the mats' sprigs and raised trusses, the turf's flowers

/** Merged cards: every vertex keeps its card's root (WIND_ROOT, with scale 1), which the wind bends from and distance folds into. */
class Cards {
  readonly positions: number[] = []; readonly normals: number[] = []; readonly uvs: number[] = []; readonly roots: number[] = []; readonly index: number[] = [];
  /** A quad from its four corners (bottom left, bottom right, top right, top left) mapped onto a sprite; `normal` lights both faces. */
  quad(corners: THREE.Vector3[], sprite: readonly [number, number], normal: THREE.Vector3, root: THREE.Vector3): void {
    const first = this.positions.length / 3;
    corners.forEach((p, k) => {
      this.positions.push(p.x, p.y, p.z); this.normals.push(normal.x, normal.y, normal.z); this.roots.push(root.x, root.y, root.z, 1);
      this.uvs.push(...cellUV(sprite, k === 0 || k === 3 ? 0 : 1, k < 2 ? 0 : 1));
    });
    this.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  /** A card lying across `normal` round `centre`, `size` wide, turned by `turn` about it. */
  flat(centre: THREE.Vector3, normal: THREE.Vector3, size: number, turn: number, sprite: readonly [number, number], light: THREE.Vector3): void {
    const a = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn)), b = new THREE.Vector3().crossVectors(normal, a).normalize(); a.crossVectors(b, normal).normalize();
    const h = size / 2; this.quad([centre.clone().addScaledVector(a, -h).addScaledVector(b, -h), centre.clone().addScaledVector(a, h).addScaledVector(b, -h), centre.clone().addScaledVector(a, h).addScaledVector(b, h), centre.clone().addScaledVector(a, -h).addScaledVector(b, h)], sprite, light, centre);
  }
  /** Two crossed upright cards standing on `foot`, `width` × `height`, leaning along `up`. */
  crossed(foot: THREE.Vector3, up: THREE.Vector3, width: number, height: number, turn: number, sprite: readonly [number, number], light: THREE.Vector3): void {
    for (const t of [turn, turn + Math.PI / 2]) {
      const side = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).addScaledVector(up, -Math.cos(t) * up.x - Math.sin(t) * up.z).normalize().multiplyScalar(width / 2), rise = up.clone().multiplyScalar(height);
      this.quad([foot.clone().sub(side), foot.clone().add(side), foot.clone().add(side).add(rise), foot.clone().sub(side).add(rise)], sprite, light, foot);
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2)); g.setAttribute(WIND_ROOT, new THREE.Float32BufferAttribute(this.roots, 4)); g.setIndex(this.index); g.computeBoundingSphere(); return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
/**
 * Cards over the mats on a jittered grid (11 cm on gpu, 17 cm on mobile), each 15–25 cm across, so they overlap two deep: on the
 * tops, masses of flowers tilted every way (a card lying flat would vanish edge-on from standing height) and side views of
 * flowering twigs standing among them; round the fringe, leafy sprigs leaning outward, which break the mats' outline as the
 * shrubs' shoots do. Gaps between cards show the mound's dark leaves, the shade inside a real mat.
 */
function matCards(cards: Cards, grid: MatGrid, ground: (x: number, z: number) => number, mobile: boolean): void {
  const rand = random(4521), spacing = mobile ? .17 : .11, at = (x: number, z: number): number => {
    const i = Math.min(grid.nx - 2, Math.max(0, Math.floor((x - grid.x0) / grid.step))), j = Math.min(grid.nz - 2, Math.max(0, Math.floor((z - grid.z0) / grid.step)));
    const u = (x - grid.x0) / grid.step - i, v = (z - grid.z0) / grid.step - j, f = grid.field, k = j * grid.nx + i;
    return (f[k] * (1 - u) + f[k + 1] * u) * (1 - v) + (f[k + grid.nx] * (1 - u) + f[k + grid.nx + 1] * u) * v;
  };
  const tilted = (out: THREE.Vector3, tilt: number): THREE.Vector3 => {
    const a = rand() * TAU, lean = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).lerp(out, .35).normalize();
    return UP.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(lean, Math.sin(tilt)).normalize();
  };
  for (let z = BOX.minZ; z < BOX.maxZ; z += spacing) for (let x = BOX.minX; x < BOX.maxX; x += spacing) {
    const px = x + (rand() - .5) * spacing, pz = z + (rand() - .5) * spacing, f = at(px, pz); if (f < MAT_EDGE + .01) continue;
    const height = matHeight(f, px, pz), top = THREE.MathUtils.clamp(height / .2, 0, 1), y = ground(px, pz) + height, pick = rand();
    // The mound's slope here, from the field's gradient, points the fringe's sprigs outward.
    const out = new THREE.Vector3(at(px - .1, pz) - at(px + .1, pz), 0, at(px, pz - .1) - at(px, pz + .1)); if (out.lengthSq() < 1e-8) out.set(rand() - .5, 0, rand() - .5); out.normalize();
    const light = UP.clone().addScaledVector(out, .3 * (1 - top)).normalize(), centre = new THREE.Vector3(px, y, pz), turn = rand() * TAU;
    if (top > .4) {
      if (pick < .58) cards.flat(centre.setY(y + .03 + rand() * .06), tilted(out, .35 + rand() * .75), .15 + rand() * .1, turn, SPRITE.bouquet[Math.floor(rand() * 4)], light);
      else if (pick < .8) cards.crossed(centre.setY(y - .05), tilted(out, rand() * .25), .17 + rand() * .07, .15 + rand() * .07, turn, SPRITE.side[Math.floor(rand() * 2)], light);
      else if (pick < .88) cards.flat(centre.setY(y + .02), tilted(out, .3 + rand() * .5), .1 + rand() * .04, turn, SPRITE.buds[0], light);
    } else if (pick < .62) {
      cards.crossed(centre.setY(y - .06), UP.clone().addScaledVector(out, .45 + rand() * .45).normalize(), .15 + rand() * .07, .13 + rand() * .08, turn, (rand() < .65 ? SPRITE.leafy : SPRITE.side)[Math.floor(rand() * 2)], light);
    } else if (pick < .82) {
      cards.flat(centre.setY(y + .02), tilted(out, .7 + rand() * .5), .14 + rand() * .06, turn, SPRITE.bouquet[Math.floor(rand() * 4)], light);
    }
  }
}
export interface TurfFlower { x: number; z: number; kind: 'buttercup' | 'avens' | 'white'; height: number; size: number }
/**
 * Yellow buttercups and avens and small white flowers in the turf (gpu 2,300, mobile 900): off the mats, the trail and the rocks,
 * in loose drifts, the yellow ones thickest toward the meadow's lip as in the photograph.
 */
export function turfFlowers(mobile: boolean, grid: MatGrid, rocks: readonly RockSite[]): TurfFlower[] {
  const rand = random(7310), flowers: TurfFlower[] = [], target = mobile ? 900 : 2300, blocked = blockedBy(rocks);
  for (let attempt = 0; attempt < target * 12 && flowers.length < target; attempt++) {
    const x = BOX.minX + rand() * (BOX.maxX - BOX.minX), z = BOX.minZ + rand() * (BOX.maxZ - BOX.minZ);
    if (turfCover(x, z) < .6 || plateauInside(x, z) < 1) continue;
    const i = Math.round((x - grid.x0) / grid.step), j = Math.round((z - grid.z0) / grid.step); if (grid.field[j * grid.nx + i] > MAT_EDGE - .06) continue;
    const drift = mountainNoise(x * .45 + 31, z * .45 - 8), lip = smooth(-(z - PLATEAU.z) / PLATEAU.b, 1, -.6), white = mountainNoise(x * .6 - 17, z * .6 + 5) > .68;
    if (rand() > (white ? .35 : smooth(drift, .38, .7) * (.4 + .6 * lip))) continue;
    if (blocked(x, z, .05) || terrainSurfaceNormal(x, z).y < .8) continue;
    const kind = white ? 'white' : rand() < .3 ? 'avens' : 'buttercup';
    flowers.push({ x, z, kind, height: (white ? .06 : .09) + rand() * (white ? .06 : .11), size: white ? .016 + rand() * .006 : .024 + rand() * .01 });
  }
  return flowers;
}
function flowerCards(cards: Cards, flowers: readonly TurfFlower[], ground: (x: number, z: number) => number): void {
  const rand = random(93);
  for (const f of flowers) {
    const foot = new THREE.Vector3(f.x, ground(f.x, f.z) - .01, f.z), lean = new THREE.Vector3((rand() - .5) * .25, 1, (rand() - .5) * .25).normalize();
    // A thin stem: two crossed strips of the stem swatch.
    for (const t of [rand() * Math.PI, rand() * Math.PI + Math.PI / 2]) {
      const side = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).multiplyScalar(.0028), top = foot.clone().addScaledVector(lean, f.height);
      cards.quad([foot.clone().sub(side), foot.clone().add(side), top.clone().add(side), top.clone().sub(side)], SPRITE.stem[0], UP, foot);
    }
    const head = foot.clone().addScaledVector(lean, f.height + .004), face = UP.clone().add(new THREE.Vector3(rand() - .5, 0, rand() - .5).multiplyScalar(.9)).normalize();
    cards.flat(head, face, f.size * 2, rand() * TAU, f.kind === 'white' ? SPRITE.white[0] : SPRITE.buttercup[f.kind === 'avens' ? 1 : 0], UP.clone().lerp(face, .5).normalize());
    // Half the buttercups also show their cup to the side.
    if (f.kind === 'buttercup' && rand() < .5) cards.crossed(head.clone().setY(head.y - f.size * .5), UP, f.size * 1.6, f.size * 1.2, rand() * TAU, SPRITE.cup[0], UP);
  }
}
/**
 * The cards' material: the atlas cut out by its alpha (alpha-to-coverage where the frame is multisampled), both faces lit by the
 * authored normals (up-turned, so a card's back is not black), bent by the wind from each card's root and, past `fold` metres,
 * folded into that root: the mats' own shader carries their flowers into the distance.
 */
function cardMaterial(atlas: THREE.Texture | null, coverage: boolean, fold: readonly [number, number]): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: .5, roughness: .55 });
  if (atlas) material.map = atlas;
  const root = attribute<'vec4'>(WIND_ROOT, 'vec4').xyz, keep = float(1).sub(smoothstep(fold[0], fold[1], distance(root, cameraPosition)));
  material.positionNode = mix(root, plantSway(positionLocal, .2, .3), keep); material.castShadowPositionNode = positionLocal;
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(normalLocal, 0)).xyz);
  if (coverage) { material.alphaToCoverage = true; material.alphaTestNode = float(.5).sub(fwidth(diffuseColor.a).mul(.5)); }
  return material;
}

// ---------------------------------------------------------------------------------------------------------------------
// Moss campion

export interface CampionSite { x: number; z: number; radius: number }
/** Moss campion cushions (gpu 90, mobile 45) in the turf between the mats, off the trail and the rocks. */
export function campionSites(mobile: boolean, grid: MatGrid, rocks: readonly RockSite[]): CampionSite[] {
  const rand = random(6151), sites: CampionSite[] = [], target = mobile ? 45 : 90, blocked = blockedBy(rocks);
  for (let attempt = 0; attempt < 5000 && sites.length < target; attempt++) {
    const x = BOX.minX + rand() * (BOX.maxX - BOX.minX), z = BOX.minZ + rand() * (BOX.maxZ - BOX.minZ), radius = .15 + rand() * rand() * .4;
    if (plateauInside(x, z) < 1.5 + radius || turfCover(x, z) < .7 || terrainSurfaceNormal(x, z).y < .86 || blocked(x, z, radius)) continue;
    const i = Math.round((x - grid.x0) / grid.step), j = Math.round((z - grid.z0) / grid.step); if (grid.field[j * grid.nx + i] > MAT_EDGE - .15) continue;
    if (sites.every(s => Math.hypot(s.x - x, s.z - z) > s.radius + radius + .15)) sites.push({ x, z, radius });
  }
  return sites;
}
/** Campion as one merged mesh hugging the ground: each cushion a low, irregular dome a few centimetres high, edge buried. */
function campionGeometry(sites: readonly CampionSite[], ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const rand = random(733), positions: number[] = [], normals: number[] = [], index: number[] = [];
  for (const site of sites) {
    const first = positions.length / 3, normal = terrainSurfaceNormal(site.x, site.z), lift = .03 + site.radius * .04;
    const add = (x: number, z: number, y: number, out: number): void => { positions.push(x, ground(x, z) + y, z); const n = normal.clone().add(new THREE.Vector3(x - site.x, 0, z - site.z).normalize().multiplyScalar(out)).normalize(); normals.push(n.x, n.y, n.z); };
    add(site.x, site.z, lift, 0);
    for (const [ring, height, out] of [[.55, lift * .85, .15], [1, -.012, .5]] as const) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + (ring === 1 ? .31 : 0), r = site.radius * ring * (ring === 1 ? .8 + rand() * .35 : 1); add(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r, height, out); }
    for (let k = 0; k < 10; k++) { const a = first + 1 + k, b = first + 1 + (k + 1) % 10, c = first + 11 + k, d = first + 11 + (k + 1) % 10; index.push(first, b, a, a, b, c, b, d, c); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(index); geometry.computeBoundingSphere(); return geometry;
}
/** Dense bright moss with five-petalled lilac-pink stars (about 1.8 cm) and dark-red buds; far off the stars average into a tint. */
function campionMaterial(): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: .9 }), xz = positionWorld.xz, cell = xz.div(.026).toVar(), id = floor(cell);
  const h1 = mx_cell_noise_float(vec3(id, 1)), h2 = mx_cell_noise_float(vec3(id, 2)), h3 = mx_cell_noise_float(vec3(id, 3));
  const q = fract(cell).sub(.5).sub(vec2(h2.sub(.5), h3.sub(.5)).mul(.22)).toVar(), r = length(q), angle = atan(q.y, q.x).add(h2.mul(6.2831853));
  const density = mx_noise_float(vec3(xz.mul(1.8), 0)).mul(.25).add(.42), near = float(1).sub(smoothstep(12, 30, distance(positionWorld, cameraPosition)));
  const star = float(1).sub(step(density, h1)).mul(float(1).sub(smoothstep(.33, .37, r.div(cos(angle.mul(5)).mul(.26).add(.74))))).mul(near).toVar();
  const eye = star.mul(float(1).sub(smoothstep(.05, .09, r)));
  const bud = step(density, h1).mul(step(h1, density.add(.1))).mul(float(1).sub(smoothstep(.08, .12, r))).mul(near);
  const moss = mix(vec3(.045, .11, .016), vec3(.11, .25, .03), mx_noise_float(vec3(xz.mul(60), 0)).mul(.5).add(.5)).mul(mix(.7, 1.1, smoothstep(0, .6, mx_worley_noise_float(vec3(xz.mul(90), 0)))));
  const far = mix(moss, vec3(.36, .26, .42), float(1).sub(near).mul(.3));
  material.colorNode = mix(mix(far, vec3(.28, .03, .07), bud), mix(vec3(.6, .38, .72), vec3(.5, .16, .38), eye), star);
  return material;
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * The plateau's plants: rhododendron mats (one draw), their cards with the turf's flowers (one draw) and moss campion (one draw),
 * none on cpu. `coverage` is FOREST_DETAIL.coverage (alpha-to-coverage where the frame is multisampled). The atlas is painted
 * here when a document exists; tests build the same geometry without it.
 */
export function createAlpinePlants(tier: GraphicsTier, rocks: readonly RockSite[], coverage = false): { meshes: THREE.Mesh[]; contacts: ContactSite[] } {
  if (tier === 'cpu') return { meshes: [], contacts: [] };
  const mobile = tier === 'mobile', ground = groundHeights(), grid = matGrid(mobile, rocks), cards = new Cards();
  matCards(cards, grid, ground, mobile); flowerCards(cards, turfFlowers(mobile, grid, rocks), ground);
  const fold: [number, number] = mobile ? [14, 20] : [24, 34], mats = new THREE.Mesh(matGeometry(grid, ground), matMaterial(fold)); mats.name = 'Rhododendron mats'; mats.receiveShadow = mats.castShadow = true;
  const atlas = typeof document === 'undefined' ? null : paintAlpineAtlas(tier);
  const sprigs = new THREE.Mesh(cards.geometry(), cardMaterial(atlas, coverage, fold)); sprigs.name = 'Rhododendron sprigs and meadow flowers'; sprigs.receiveShadow = true;
  const cushions = new THREE.Mesh(campionGeometry(campionSites(mobile, grid, rocks), ground), campionMaterial()); cushions.name = 'Moss campion'; cushions.receiveShadow = true;
  // Merged in world space from seeded layouts; cpu-detail.ts never sees them (no cpu tier), but keep their exact shapes anyway.
  for (const mesh of [mats, sprigs, cushions]) mesh.userData.keepGeometry = true;
  // A soft patch under each stretch of mat, on a 2 m lattice.
  const contacts: ContactSite[] = [];
  for (let z = BOX.minZ; z < BOX.maxZ; z += 2) for (let x = BOX.minX; x < BOX.maxX; x += 2) if (matField(x + 1, z + 1) > MAT_EDGE + .12) contacts.push({ x: x + 1, z: z + 1, rx: 1.15, rz: 1.15, strength: .28 });
  return { meshes: [mats, sprigs, cushions], contacts };
}
/** For tests: the mats' cover over the plateau's interior and their heights at sampled points. */
export function matStats(mobile: boolean, rocks: readonly RockSite[]): { cover: number; samples: { x: number; z: number; height: number }[] } {
  const grid = matGrid(mobile, rocks); let inside = 0, mats = 0; const samples: { x: number; z: number; height: number }[] = [];
  for (let j = 0; j < grid.nz; j += 3) for (let i = 0; i < grid.nx; i += 3) {
    const x = grid.x0 + i * grid.step, z = grid.z0 + j * grid.step; if (plateauInside(x, z) < 2) continue;
    inside++; const f = grid.field[j * grid.nx + i]; if (f >= MAT_EDGE) { mats++; samples.push({ x, z, height: matHeight(f, x, z) }); }
  }
  return { cover: mats / Math.max(1, inside), samples };
}
