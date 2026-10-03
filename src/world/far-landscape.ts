// The landscape past the town's ±520 m terrain tiles out to about 9 km (sub-plan 26): rings of vertices whose spacing grows with
// distance, so every ring spans about the same angle from the town (0.8° on gpu, 1.6° on mobile, both coarser by 70% past 6 km,
// where the haze hides the facets), stitched to the tiles' exact edge, then cut into six sectors that cull on their own: a
// walking view draws three to five. Splitting them by distance as well drew more sectors for fewer triangles. It draws only in the walking view's distant pass (FAR_LAYER) and the
// map; the cpu tier has none. Its material is cheaper than the meadow's: baked slope and altitude classes (forest, meadow,
// scree, rock) with per-pixel canopy mottling, limestone strata and detail normals.
import * as THREE from 'three';
import { Fn, abs, attribute, cameraPosition, cameraViewMatrix, clamp, dot, exp, float, floor, fract, length, mix, normalWorld, normalize, positionWorld, renderGroup, sin, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { GraphicsTier } from '../game/graphics';
import { DISTANT_DISPLAY } from '../render/output';
import { landscapeHeight } from './terrain';

/** Camera layer of the distant pass (main.ts) and the map; the town's own tiles stay on the walking camera's layer. */
export const FAR_LAYER = 2;
/** The distant pass's far plane: past the ranges' outer fade. */
export const FAR_VIEW = 9600;
const OUTER = 8900, SECTORS = 6;

type Point = { x: number; z: number };
/**
 * Stitch two closed rings around (cx, cz), each ordered by angle, into a strip of triangles: the one whose next point comes
 * first by angle advances (a zipper). Works for any two star-shaped rings with different point counts.
 */
function zipper(inner: number[], outer: number[], angle: (index: number) => number, out: number[]): void {
  const start = (ring: number[]): number => ring.reduce((best, v, i) => angle(v) < angle(ring[best]) ? i : best, 0);
  const a = start(inner), b = start(outer), n = inner.length, m = outer.length;
  const at = (ring: number[], first: number, k: number): number => ring[(first + k) % ring.length];
  const unwrapped = (ring: number[], first: number, k: number): number => angle(at(ring, first, k)) + (k >= ring.length ? Math.PI * 2 : 0);
  let i = 0, j = 0;
  while (i < n || j < m) {
    const advanceInner = j >= m || (i < n && unwrapped(inner, a, i + 1) < unwrapped(outer, b, j + 1));
    if (advanceInner) { out.push(at(inner, a, i), at(outer, b, j), at(inner, a, i + 1)); i++; }
    else { out.push(at(inner, a, i), at(outer, b, j), at(outer, b, j + 1)); j++; }
  }
}

/** Slope (1 - normal.y) and altitude classes as albedo plus forest and rock cover, for one vertex. */
function cover(x: number, y: number, z: number, slope: number, out: { colour: THREE.Color; forest: number; rock: number }): void {
  // A treeline near 430 m that wanders with the massifs; forest thins on steep ground and in sunny dry patches.
  const patch = .5 + .5 * Math.sin(x * .0021 + Math.sin(z * .0017) * 2.1) * Math.sin(z * .0019 - x * .0008);
  const treeline = 360 + 140 * patch, forest = (1 - THREE.MathUtils.smoothstep(slope, .3, .62)) * (1 - THREE.MathUtils.smoothstep(y, treeline - 90, treeline)) * THREE.MathUtils.smoothstep(patch, .08, .3);
  const rock = Math.min(1, THREE.MathUtils.smoothstep(slope, .34, .62) + THREE.MathUtils.smoothstep(y, treeline + 60, treeline + 260) * .55);
  const scree = THREE.MathUtils.smoothstep(slope, .2, .4) * (1 - rock) * THREE.MathUtils.smoothstep(y, 120, 260);
  out.colour.setRGB(.105, .125, .048).lerp(FAR_COLOURS.dry, THREE.MathUtils.smoothstep(y, 200, 520) * .7).lerp(FAR_COLOURS.scree, scree).lerp(FAR_COLOURS.forest, forest).lerp(FAR_COLOURS.rock, rock * (1 - forest));
  out.forest = forest; out.rock = rock * (1 - forest);
}
const FAR_COLOURS = { dry: new THREE.Color().setRGB(.16, .15, .075), scree: new THREE.Color().setRGB(.2, .19, .165), forest: new THREE.Color().setRGB(.03, .048, .022), rock: new THREE.Color().setRGB(.27, .26, .24) };

/**
 * The far landscape's sectors. `edge` is the outer edge of the terrain tiles (mountainGeometry), counter-clockwise; ring 0 reuses
 * its points, so the two meshes share every vertex along the seam.
 */
export function farLandscapeGeometry(mobile: boolean, edge: Point[]): THREE.BufferGeometry[] {
  const minX = Math.min(...edge.map(p => p.x)), maxX = Math.max(...edge.map(p => p.x)), minZ = Math.min(...edge.map(p => p.z)), maxZ = Math.max(...edge.map(p => p.z));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, half = (maxX - minX) / 2, spread = mobile ? .028 : .014;
  const xs: number[] = [], zs: number[] = [], rings: number[][] = [];
  const add = (x: number, z: number): number => { xs.push(x); zs.push(z); return xs.length - 1; };
  rings.push(edge.map(p => add(p.x, p.z)));
  for (let t = (half + 10) * spread; ; ) {
    // Rounded rectangles: square at the tiles' edge, close to a circle by the outer fade.
    const ring: number[] = [], radius = half + t, round = THREE.MathUtils.smoothstep(t, 300, 3000), spacing = spread * (1 + .7 * THREE.MathUtils.smoothstep(radius, 2500, 6000)) * radius;
    const count = Math.max(64, Math.round(Math.PI * 2 * radius * (1.27 - .27 * round) / spacing));
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), square = radius / Math.max(Math.abs(c), Math.abs(s));
      const r = THREE.MathUtils.lerp(square, radius, round); ring.push(add(cx + c * r, cz + s * r));
    }
    rings.push(ring);
    if (radius >= OUTER) break;
    t = Math.min(OUTER - half, t + spacing);
  }
  const angle = (index: number): number => { const a = Math.atan2(zs[index] - cz, xs[index] - cx); return a < 0 ? a + Math.PI * 2 : a; };
  const indices: number[] = [];
  for (let k = 1; k < rings.length; k++) zipper(rings[k - 1], rings[k], angle, indices);
  const positions = new Float32Array(xs.length * 3);
  for (let i = 0; i < xs.length; i++) positions.set([xs[i], landscapeHeight(xs[i], zs[i]), zs[i]], i * 3);
  const whole = new THREE.BufferGeometry(); whole.setAttribute('position', new THREE.BufferAttribute(positions, 3)); whole.setIndex(indices);
  // The zipper's winding follows the angle; make every triangle face up.
  const index = whole.index!.array as Uint32Array | Uint16Array;
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
    if ((xs[b] - xs[a]) * (zs[c] - zs[a]) - (zs[b] - zs[a]) * (xs[c] - xs[a]) > 0) { index[i + 1] = c; index[i + 2] = b; }
  }
  whole.computeVertexNormals();
  const normals = whole.getAttribute('normal'), colours = new Float32Array(xs.length * 3), covers = new Float32Array(xs.length * 2), out = { colour: new THREE.Color(), forest: 0, rock: 0 };
  for (let i = 0; i < xs.length; i++) { cover(xs[i], positions[i * 3 + 1], zs[i], 1 - normals.getY(i), out); colours.set([out.colour.r, out.colour.g, out.colour.b], i * 3); covers.set([out.forest, out.rock], i * 2); }
  // Sectors by triangle centroid angle; each keeps only the vertices it uses.
  const sectors = Array.from({ length: SECTORS }, () => ({ map: new Map<number, number>(), indices: [] as number[] }));
  for (let i = 0; i < index.length; i += 3) {
    const mx = (xs[index[i]] + xs[index[i + 1]] + xs[index[i + 2]]) / 3, mz = (zs[index[i]] + zs[index[i + 1]] + zs[index[i + 2]]) / 3;
    let a = Math.atan2(mz - cz, mx - cx); if (a < 0) a += Math.PI * 2;
    const sector = sectors[Math.min(SECTORS - 1, Math.floor(a / (Math.PI * 2) * SECTORS))];
    for (let k = 0; k < 3; k++) { const v = index[i + k]; let local = sector.map.get(v); if (local === undefined) { local = sector.map.size; sector.map.set(v, local); } sector.indices.push(local); }
  }
  const geometries = sectors.map(({ map, indices: local }, n) => {
    const g = new THREE.BufferGeometry(), count = map.size, p = new Float32Array(count * 3), nm = new Float32Array(count * 3), c = new Float32Array(count * 3), cv = new Float32Array(count * 2);
    for (const [v, i] of map) { p.set(positions.subarray(v * 3, v * 3 + 3), i * 3); nm.set([normals.getX(v), normals.getY(v), normals.getZ(v)], i * 3); c.set(colours.subarray(v * 3, v * 3 + 3), i * 3); cv.set(covers.subarray(v * 2, v * 2 + 2), i * 2); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nm, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('farCover', new THREE.BufferAttribute(cv, 2));
    g.setIndex(local); g.computeBoundingSphere(); g.name = 'Distant ranges ' + n; return g;
  });
  whole.dispose();
  return geometries;
}

type F = Node<'float'>; type V2 = Node<'vec2'>; type V3 = Node<'vec3'>;
const hash12 = Fn(([p]: [V2]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(.1031)).toVar(); q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
}).setLayout({ name: 'farHash12', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const valueNoise = Fn(([p]: [V2]) => {
  const i = floor(p).toVar(), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  return mix(mix(hash12(i), hash12(i.add(vec2(1, 0))), u.x), mix(hash12(i.add(vec2(0, 1))), hash12(i.add(vec2(1, 1))), u.x), u.y);
}).setLayout({ name: 'farValueNoise', type: 'float', inputs: [{ name: 'p', type: 'vec2' }] });
const LUMA = vec3(.2126, .7152, .0722);
/** Blue light scattered into the line of sight in front of the ranges, per phase: distance turns them blue before the haze. */
const inscatter = uniform(new THREE.Color()).setGroup(renderGroup);
export function setDistantPhase(night: boolean): void { inscatter.value.setRGB(...(night ? [.003, .006, .014] : [.13, .22, .42]) as [number, number, number], THREE.LinearSRGBColorSpace); }
setDistantPhase(false);

/**
 * Material of the distant ranges. gpu adds detail normals (noise slopes and the rock normal map); mobile keeps the colour work;
 * `rock` is the mountains' rock colour map, desaturated toward limestone grey and banded into strata on steep ground.
 */
export function farLandscapeMaterial(tier: GraphicsTier, rock: THREE.Texture | null, rockNormal: THREE.Texture | null): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: .95 });
  material.name = 'Distant ranges'; material.mrtNode = DISTANT_DISPLAY;
  const covers = attribute<'vec2'>('farCover', 'vec2'), p = positionWorld, distance = length(p.sub(cameraPosition)).toVar();
  // Detail slopes from two octaves of noise, fading out as they shrink below a pixel.
  const detail = Fn(() => {
    const fade = float(1).sub(smoothstep(900, 4500, distance)), e = float(6);
    const n = (q: V2): F => valueNoise(q.div(30));
    const h = n(p.xz), dx = n(p.xz.add(vec2(e, 0))).sub(h), dz = n(p.xz.add(vec2(0, e))).sub(h);
    return vec3(dx.negate(), 0, dz.negate()).mul(fade.mul(tier === 'gpu' ? 2.6 : 0));
  });
  const surface = (tier === 'gpu' ? normalize(normalWorld.add(detail())) : normalize(normalWorld)).toVar();
  material.colorNode = Fn(() => {
    const steep = smoothstep(.5, .78, float(1).sub(abs(surface.y))), rockiness = clamp(covers.y.add(steep.mul(float(1).sub(covers.x)).mul(.7)), 0, 1).toVar();
    // Canopy: crowns about 9 m across, darker gaps between them; meadows and scree keep a broad mottle.
    const crowns = valueNoise(p.xz.div(9)), mottle = valueNoise(p.xz.div(150));
    const ground = attribute<'vec3'>('color', 'vec3').mul(mix(float(.82).add(mottle.mul(.36)), float(.55).add(crowns.mul(.9)), covers.x)).toVar();
    const strata = float(1).sub(smoothstep(.72, .98, sin(p.y.mul(.31).add(valueNoise(p.xz.div(90)).mul(5))).mul(.5).add(.5)).mul(.28));
    const stone = vec3(.27, .26, .24).mul(strata).toVar();
    if (rock) {
      // World-space triplanar at 45 m: the photographed rock's value, a little of its hue.
      const w = abs(surface).pow(vec3(4)).toVar(); w.divAssign(dot(w, vec3(1)));
      const s = p.div(45), sample = texture(rock, s.yz).rgb.mul(w.x).add(texture(rock, s.xz).rgb.mul(w.y)).add(texture(rock, s.xy).rgb.mul(w.z));
      const value = dot(sample, LUMA);
      stone.assign(mix(vec3(value), sample, .3).mul(1.05).mul(strata));
    }
    return mix(ground, stone, rockiness);
  })();
  material.emissiveNode = (inscatter as unknown as V3).mul(float(1).sub(exp(distance.mul(-1.4e-4))));
  if (tier === 'gpu') {
    material.normalNode = Fn(() => {
      const n = surface.toVar();
      if (rockNormal) {
        const w = abs(n).pow(vec3(4)).toVar(); w.divAssign(dot(w, vec3(1)));
        const s = p.div(45), nx = texture(rockNormal, s.yz).xy.mul(2).sub(1), ny = texture(rockNormal, s.xz).xy.mul(2).sub(1), nz = texture(rockNormal, s.xy).xy.mul(2).sub(1);
        const bump = vec3(0, nx.y, nx.x).mul(w.x).add(vec3(ny.x, 0, ny.y).mul(w.y)).add(vec3(nz.x, nz.y, 0).mul(w.z));
        n.assign(normalize(n.add(bump.mul(.45).mul(float(1).sub(smoothstep(1500, 5000, distance))))));
      }
      return normalize(cameraViewMatrix.mul(vec4(n, 0)).xyz);
    })();
  }
  return material;
}
