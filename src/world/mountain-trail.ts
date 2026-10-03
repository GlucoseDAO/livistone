// Sub-plan 27: what stands on the Jepii Mici trail (mountain-layout.ts). At the trailhead in the woods, a rope-hung danger board
// between two big trunks, the arrow pointer and two small boards in the style of Romanian mountain trail signs, roots across the
// trail, ferns and butterbur; blue-cross blazes on trail-side boulders; on the plateau, a rope fence, limestone blocks, the barrier
// at the crags, rhododendron shrubs and moss campion. Geometry and colliders are DOM-independent; paintTrailSigns draws the one
// canvas atlas every sign face, trunk, root, rope, fence and fern maps into, so all of that is a single draw.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atan, attribute, cameraPosition, cos, distance, float, floor, fract, length, mix, mx_cell_noise_float, mx_noise_float, mx_worley_noise_float, positionWorld, smoothstep, step, vec2, vec3 } from 'three/tsl';
import type { ColliderSpec } from '../game/physics';
import type { GraphicsTier } from '../game/graphics';
import type { RockSite } from './water-surface';
import type { ContactSite } from './contact-shadows';
import { terrainSurfaceHeight, terrainSurfaceNormal } from './terrain';
import { rockColliders, rockReach, seatedHeight } from './river-rocks';
import { PLATEAU, TRAILHEAD, TRAILHEAD_TRUNKS, TRAIL_BARRIER, TRAIL_CURVE, TRAIL_ENTRY, TRAIL_HALF, TRAIL_SAMPLES, bloomDensity, plateauHeight, plateauMask, plateauRadius, trailDistance, trailheadPoint } from './mountain-layout';

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

// ---------------------------------------------------------------------------------------------------------------------
// Boulders

/** A boulder beside the trail, and whether it carries a blaze facing the trail point it stands next to. */
export interface TrailBoulder { site: RockSite; blaze: THREE.Vector3 | null }
/** Seated like the river rocks, but leaning with the slope, so a boulder on a slope lies on it instead of showing a thin sliced
 *  lens above the uphill ground. */
const seat = (x: number, z: number, s: number, yaw: number): RockSite => {
  const n = terrainSurfaceNormal(x, z), site: RockSite = { x, y: terrainSurfaceHeight(x, z) + s * .26, z, s, yaw, lean: [n.x * .85, n.z * .85] };
  return { ...site, y: Math.min(site.y, seatedHeight(site, .05)) };
};
/** Half the barrier's span across the trail, post to post. */
const BARRIER_HALF = 1.75;
/**
 * Seeded boulders: a blazed one every 15 m or so beside the trail from the trailhead to the plateau, alternating sides; pale
 * limestone blocks on the plateau; a rock band at both ends of the barrier.
 */
export function trailBoulders(mobile: boolean): TrailBoulder[] {
  const rand = random(2717), boulders: TrailBoulder[] = [], length = TRAIL_CURVE.getLength();
  const clear = (x: number, z: number, s: number): boolean => trailDistance(x, z) > TRAIL_HALF + .45 + rockReach(s) && boulders.every(b => Math.hypot(b.site.x - x, b.site.z - z) > rockReach(b.site.s) + rockReach(s) + .4);
  for (const [k, distance] of [44, 60, 76, 92, 108, 124, 140, 156, 172].entries()) {
    const u = distance / length, p = TRAIL_CURVE.getPointAt(u), tangent = TRAIL_CURVE.getTangentAt(u), s = .38 + rand() * .3;
    for (const side of k % 2 ? [1, -1] : [-1, 1]) {
      const offset = TRAIL_HALF + .55 + rockReach(s), x = p.x - tangent.z * side * offset, z = p.z + tangent.x * side * offset;
      if (!clear(x, z, s)) continue;
      boulders.push({ site: seat(x, z, s, rand() * TAU), blaze: new THREE.Vector3(p.x, 0, p.z) }); break;
    }
  }
  for (let i = 0, placed = 0; i < 400 && placed < (mobile ? 9 : 16); i++) {
    const x = PLATEAU.x + (rand() - .5) * PLATEAU.a * 1.8, z = PLATEAU.z + (rand() - .5) * PLATEAU.b * 1.8, s = .3 + rand() * rand() * .75;
    if (plateauRadius(x, z) > .8 || !clear(x, z, s)) continue;
    boulders.push({ site: seat(x, z, s, rand() * TAU), blaze: null }); placed++;
  }
  for (const [side, s] of [[-1, .62], [1, .5]]) {
    const x = TRAIL_BARRIER.x + Math.cos(TRAIL_BARRIER.yaw) * side * (BARRIER_HALF + .25 + rockReach(s)), z = TRAIL_BARRIER.z - Math.sin(TRAIL_BARRIER.yaw) * side * (BARRIER_HALF + .25 + rockReach(s));
    boulders.push({ site: seat(x, z, s, rand() * TAU), blaze: null });
  }
  return boulders;
}

// ---------------------------------------------------------------------------------------------------------------------
// One mesh mapping into one canvas atlas

type Region = readonly [number, number, number, number];
const ATLAS = { width: 2048, height: 1536 };
/** Canvas pixels of each painted face or swatch (x0, y0, x1, y1). */
const REGION = {
  danger: [0, 0, 1280, 720], back: [0, 736, 500, 1016], pointer: [1296, 0, 2032, 216], pointerBack: [1296, 232, 2032, 448],
  closed: [520, 736, 880, 908], blaze: [1296, 656, 1424, 784], paint: [1440, 656, 1568, 784], wood: [1584, 656, 1712, 784], rope: [1728, 656, 1856, 784],
  warning: [0, 1040, 640, 1420], winter: [656, 1040, 1216, 1340], bark: [1232, 1040, 1360, 1536], butterbur: [1376, 1040, 1696, 1360], fern: [1712, 1040, 1872, 1536],
} as const satisfies Record<string, Region>;
/** Texture coordinates of (s, t) ∈ [0, 1]² inside a region; the canvas texture's flipY puts t = 1 at the region's top edge. */
const atlasUV = (r: Region, s: number, t: number): [number, number] => [(r[0] + s * (r[2] - r[0])) / ATLAS.width, 1 - (r[3] - t * (r[3] - r[1])) / ATLAS.height];
/** The middle of a swatch, clear of its neighbours' mipmap bleed. */
const swatch = (r: Region, k = .3): Region => [r[0] + (r[2] - r[0]) * k, r[1] + (r[3] - r[1]) * k, r[2] - (r[2] - r[0]) * k, r[3] - (r[3] - r[1]) * k];
function mapInto(geometry: THREE.BufferGeometry, region: Region | ((i: number, u: number, v: number) => [number, number])): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ...(typeof region === 'function' ? region(i, uv.getX(i), uv.getY(i)) : atlasUV(region, uv.getX(i), uv.getY(i))));
  return geometry;
}
/** A box whose +z face shows `front`, its -z face `back`, and whose edges show the white paint. */
function board(width: number, height: number, depth: number, front: Region, back: Region = swatch(REGION.paint)): THREE.BufferGeometry {
  return mapInto(new THREE.BoxGeometry(width, height, depth), (i, u, v) => atlasUV(i >= 16 && i < 20 ? front : i >= 20 ? back : swatch(REGION.paint), u, v));
}
const ARROW = { length: .82, height: .24, tip: .14 };
/** The pointer: an arrow-shaped board, tip toward +x, lettered on both faces (the back is painted with its tip to the left). */
function arrowBoard(): THREE.BufferGeometry {
  const { length: l, height: h, tip } = ARROW, shape = new THREE.Shape();
  shape.moveTo(-l / 2, -h / 2); shape.lineTo(l / 2 - tip, -h / 2); shape.lineTo(l / 2, 0); shape.lineTo(l / 2 - tip, h / 2); shape.lineTo(-l / 2, h / 2); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .022, bevelEnabled: false }).translate(0, 0, -.011), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  return mapInto(geometry, (i) => {
    const s = (p.getX(i) + l / 2) / l, t = (p.getY(i) + h / 2) / h;
    return n.getZ(i) > .5 ? atlasUV(REGION.pointer, s, t) : n.getZ(i) < -.5 ? atlasUV(REGION.pointerBack, 1 - s, t) : atlasUV(swatch(REGION.paint), .5, .5);
  });
}
/** A rough-sawn post from `bottom` to `top`, buried below the ground it stands on. */
const post = (radius: number, bottom: number, top: number, sides = 6): THREE.BufferGeometry =>
  mapInto(new THREE.CylinderGeometry(radius * .9, radius, top - bottom, sides, 1).rotateY(Math.PI / sides).translate(0, (top + bottom) / 2, 0), swatch(REGION.wood));
/** A sagging rope between two points, in world space. */
function rope(a: THREE.Vector3, b: THREE.Vector3, radius = .011): THREE.BufferGeometry {
  const middle = a.clone().lerp(b, .5); middle.y -= .06 + a.distanceTo(b) * .02;
  return mapInto(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, middle, b), 10, radius, 4, false), swatch(REGION.rope));
}
/** A rough log rail between two points, in world space. */
function log(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const g = mapInto(new THREE.CylinderGeometry(radius, radius * 1.1, a.distanceTo(b), 7, 1), swatch(REGION.wood));
  return g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())).translate(...a.clone().add(b).multiplyScalar(.5).toArray());
}
/** A painted blaze .17 m square on a surface at `point` facing `normal`, kept upright. */
function blaze(point: THREE.Vector3, normal: THREE.Vector3): THREE.BufferGeometry {
  const z = normal.clone().normalize(), x = new THREE.Vector3().crossVectors(UP, z); if (x.lengthSq() < 1e-4) x.set(1, 0, 0); x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x), matrix = new THREE.Matrix4().makeBasis(x, y, z).setPosition(point.clone().addScaledVector(z, .006));
  return mapInto(new THREE.PlaneGeometry(.17, .17), REGION.blaze).applyMatrix4(matrix);
}
/**
 * A tube of varying radius along `points`, bark-mapped: u round it, v along it from `v0` to `v1` of the bark strip (its lowest
 * part is mossy), so trunks, limbs and roots share one swatch.
 */
function barkTube(points: THREE.Vector3[], radius: (u: number) => number, sides: number, v0 = 0, v1 = 1): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [], t = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3(), d = new THREE.Vector3();
  points.forEach((p, k) => {
    t.subVectors(points[Math.min(points.length - 1, k + 1)], points[Math.max(0, k - 1)]).normalize();
    n1.crossVectors(t, Math.abs(t.y) < .9 ? UP : new THREE.Vector3(1, 0, 0)).normalize(); n2.crossVectors(t, n1);
    const u = k / (points.length - 1), r = radius(u);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * TAU; d.copy(n1).multiplyScalar(Math.cos(a)).addScaledVector(n2, Math.sin(a));
      positions.push(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r); normals.push(d.x, d.y, d.z); uvs.push(...atlasUV(swatch(REGION.bark, .04), j / sides, v0 + (v1 - v0) * u));
      if (k < points.length - 1 && j < sides) { const a0 = k * (sides + 1) + j; index.push(a0, a0 + sides + 1, a0 + 1, a0 + 1, a0 + sides + 1, a0 + sides + 2); }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(index); return g;
}
/** Where a ray from the trail meets a boulder's (collider) surface at about two thirds of its height, and that facet's normal. */
function boulderFace(site: RockSite, toward: THREE.Vector3): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
  const shape = rockColliders([site]) as Extract<ColliderSpec, { type: 'mesh' }>, v = shape.vertices, ix = shape.indices;
  const direction = new THREE.Vector3(site.x - toward.x, 0, site.z - toward.z).normalize(), y = site.y + site.s * .35;
  const ray = new THREE.Ray(new THREE.Vector3(site.x, y, site.z).addScaledVector(direction, -rockReach(site.s) - 1), direction);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3(); let best: { point: THREE.Vector3; normal: THREE.Vector3 } | null = null, nearest = Infinity;
  for (let k = 0; k < ix.length; k += 3) {
    a.fromArray(v, ix[k] * 3); b.fromArray(v, ix[k + 1] * 3); c.fromArray(v, ix[k + 2] * 3);
    if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
    const d = hit.distanceTo(ray.origin); if (d >= nearest) continue;
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize(); if (normal.dot(direction) > 0) normal.negate();
    nearest = d; best = { point: hit.clone(), normal };
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------
// The undergrowth at the trailhead

/** A fern: arching fronds, each a strip mapped to the painted frond, whose transparent margins the material's alpha test cuts. */
function fern(at: THREE.Vector3, size: number, fronds: number, rand: () => number): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [], segments = 4;
  for (let f = 0; f < fronds; f++) {
    const a = f / fronds * TAU + rand() * .6, rise = .9 + rand() * .5, length = size * (.75 + rand() * .45), width = length * .32, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const first = positions.length / 3;
    for (let k = 0; k <= segments; k++) {
      const u = k / segments, centre = at.clone().addScaledVector(dir, length * u * .9 + .03).setY(at.y + length * (rise * u - .95 * u * u) + .02), w = width * (.35 + .65 * Math.sin(Math.min(1, u * 1.2) * Math.PI * .5));
      const slope = new THREE.Vector3().copy(dir).multiplyScalar(.9).setY(rise - 1.9 * u).normalize(), normal = new THREE.Vector3().crossVectors(side, slope).normalize(); if (normal.y < 0) normal.negate();
      for (const s of [-1, 1]) { const p = centre.clone().addScaledVector(side, s * w / 2); positions.push(p.x, p.y + (s > 0 ? .01 : -.01), p.z); normals.push(normal.x, normal.y, normal.z); uvs.push(...atlasUV(REGION.fern, s < 0 ? 0 : 1, u)); }
      if (k < segments) { const n = first + k * 2; index.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(index); return g;
}
/** A butterbur: one to three big round leaves on stalks, each a cupped disc mapped to the painted leaf. */
function butterbur(at: THREE.Vector3, size: number, rand: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [], leaves = 1 + Math.floor(rand() * 3), stalkUV = atlasUV([1532, 1196, 1540, 1204], .5, .5);
  for (let k = 0; k < leaves; k++) {
    const a = rand() * TAU, reach = rand() * .2, radius = size * (.75 + rand() * .4), height = .22 + rand() * .3, centre = at.clone().add(new THREE.Vector3(Math.cos(a) * reach, height, Math.sin(a) * reach));
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), .25 + rand() * .45).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * TAU));
    const disc = new THREE.CircleGeometry(radius, 10), p = disc.getAttribute('position'), uv = disc.getAttribute('uv');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y) / radius; p.setXYZ(i, x, y, .1 * radius * (1 - r * r) - .04 * radius); uv.setXY(i, ...atlasUV(REGION.butterbur, .5 + x / radius * .5, .5 + y / radius * .5)); }
    disc.rotateX(-Math.PI / 2).applyQuaternion(tilt).translate(centre.x, centre.y, centre.z); disc.computeVertexNormals(); parts.push(disc);
    const stalk = new THREE.CylinderGeometry(.008, .012, height, 4, 1).translate(at.x + Math.cos(a) * reach / 2, at.y + height / 2, at.z + Math.sin(a) * reach / 2), su = stalk.getAttribute('uv');
    for (let i = 0; i < su.count; i++) su.setXY(i, ...stalkUV); parts.push(stalk);
  }
  const merged = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g))!; parts.forEach(g => g.dispose()); return merged;
}

export interface TrailSigns { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; position: THREE.Vector3; contacts: ContactSite[] }
/**
 * The trailhead as on the real trail's photograph: on the steep forested foot of the slope, a white board with a blue border hangs
 * across the trail on four cream ropes tied round two big trunks; the JEPII MICI arrow is nailed to the left trunk over a blaze,
 * two small boards with blue-cross squares to the right one; roots cross the trail; ferns and butterbur crowd its edges. Blazes
 * mark the boulders up the trail; a rope fence keeps the plateau's edges and a log barrier closes the trail at its crags. Board,
 * trunks, pointer, fence and barrier get colliders; walkers pass beneath the board (its lower edge clears the capsule).
 */
export function createTrailSigns(colliders: ColliderSpec[], boulders: readonly TrailBoulder[], trees: readonly THREE.Vector3[] = [], mobile = false): TrailSigns {
  const frame = new THREE.Matrix4().makeRotationY(TRAILHEAD.yaw).setPosition(TRAILHEAD.x, 0, TRAILHEAD.z), parts: THREE.BufferGeometry[] = [], contacts: ContactSite[] = [], rand = random(5501);
  const world = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).applyMatrix4(frame);
  const ground = (x: number, z: number): number => { const p = world(x, 0, z); return terrainSurfaceHeight(p.x, p.z); };
  const place = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, turn = 0): THREE.BufferGeometry => geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(turn).setPosition(x, y, z).premultiply(frame));
  const box = (x: number, y: number, z: number, size: [number, number, number]): void => { const p = world(x, y, z); colliders.push({ type: 'box', position: [p.x, p.y, p.z], size, yaw: TRAILHEAD.yaw }); };
  const facing = world(0, 0, 1).sub(world(0, 0, 0));
  // Two big trunks, flared and mossy at the foot, with roots running over the ground and across the trail; crowns stand above.
  const trunks = TRAILHEAD_TRUNKS.map((t) => {
    const g = ground(t.x, t.z), radius = (h: number): number => t.radius * (h < .9 ? 1 + .55 * (1 - h / .9) ** 2 : 1 - .5 * Math.min(1, (h - .9) / 8.5));
    const lean = new THREE.Vector3((rand() - .5) * .12, 0, (rand() - .5) * .12), axis = Array.from({ length: 12 }, (_, k) => { const h = -.4 + k / 11 * 9.8; return world(t.x, 0, t.z).setY(g + h).addScaledVector(lean, Math.max(0, h) / 9.8); });
    parts.push(barkTube(axis, (u) => radius(-.4 + u * 9.8), 12, 0, 1));
    for (let k = 0; k < 3; k++) {
      const a = rand() * TAU, from = axis[8 + k], out = new THREE.Vector3(Math.cos(a), .7 + rand() * .4, Math.sin(a)).normalize();
      parts.push(barkTube([0, .5, 1].map(u => from.clone().addScaledVector(out, u * 2.4)), (u) => .1 * (1 - u * .7), 5, .6, .75));
    }
    const centre = world(t.x, 0, t.z);
    for (let k = 0; k < 6; k++) {
      // Toward the trail first, so the climb behind the board goes over roots.
      const a = Math.atan2(world(0, 0, -1.5 - k * .4).z - centre.z, world(0, 0, -1.5 - k * .4).x - centre.x) * (k < 2 ? 1 : 0) + (k < 2 ? (rand() - .5) * .5 : k / 6 * TAU + rand()), reach = 1.3 + rand() * 1.1;
      const points = Array.from({ length: 6 }, (_, j) => {
        const u = j / 5, x = centre.x + Math.cos(a + Math.sin(u * 3 + k) * .25) * (t.radius * 1.1 + reach * u), z = centre.z + Math.sin(a + Math.sin(u * 3 + k) * .25) * (t.radius * 1.1 + reach * u);
        return new THREE.Vector3(x, terrainSurfaceHeight(x, z) + (j ? .02 : .3), z);
      });
      parts.push(barkTube(points, (u) => .11 * (1 - u * .75), 5, 0, .12));
    }
    box(t.x, g + 2, t.z, [t.radius * 1.15, 2, t.radius * 1.15]); contacts.push({ x: centre.x, z: centre.z, rx: t.radius * 2.6, rz: t.radius * 2.6, strength: .75 });
    return { ...t, g, at: radius };
  });
  // The danger board: 1.6 × 0.9 m, its lower edge 2.05 m above the trail, roped round both trunks.
  const g0 = ground(0, 0), centre = g0 + 2.5, half = [.8, .45];
  parts.push(place(board(1.6, .9, .028, REGION.danger, REGION.back), 0, centre, 0)); box(0, centre, 0, [.8, .45, .03]);
  for (const t of trunks) {
    const side = Math.sign(t.x);
    for (const [corner, height] of [[half[1], 2.95], [-half[1], 1.6]]) {
      const tie = new THREE.Vector3(side * (half[0] - .03), centre + corner - Math.sign(corner) * .03, 0), toward = new THREE.Vector3(tie.x - t.x, 0, tie.z - t.z).normalize();
      parts.push(rope(world(tie.x, tie.y, tie.z), world(t.x + toward.x * t.at(height), t.g + height, t.z + toward.z * t.at(height))));
      parts.push(mapInto(new THREE.TorusGeometry(t.at(height) + .012, .014, 4, 16).rotateX(Math.PI / 2), swatch(REGION.rope)).applyMatrix4(new THREE.Matrix4().setPosition(t.x, t.g + height, t.z).premultiply(frame)));
    }
  }
  // The pointer nailed to the left trunk, tail at the trunk and tip toward the trail, over a blaze.
  const [left, right] = trunks, lr = left.at(1.95), px = left.x + ARROW.length / 2 - .12, pz = left.z + lr + .03;
  parts.push(place(arrowBoard(), px, left.g + 1.95, pz)); box(px, left.g + 1.95, pz, [ARROW.length / 2, ARROW.height / 2, .02]);
  parts.push(blaze(world(left.x, left.g + 1.5, left.z + left.at(1.5) + .004), facing));
  // Two small boards nailed to the right trunk's face toward the walker, each with its blue-cross square.
  const rz = right.z + right.at(1.8) + .02;
  parts.push(place(board(.54, .32, .016, REGION.warning), right.x - .1, right.g + 2.0, rz), place(board(.48, .256, .016, REGION.winter), right.x - .1, right.g + 1.6, rz));
  // Ferns and butterbur along both edges of the trail round the trailhead, kept off the tread, the trunks and the trees.
  const occupied = (x: number, z: number, r: number): boolean => trailDistance(x, z) < TRAIL_HALF + .25 + r * .4 || trunks.some(t => { const c = world(t.x, 0, t.z); return Math.hypot(x - c.x, z - c.z) < t.radius * 1.6 + .2; }) || trees.some(p => Math.abs(p.x - x) < 1 && Math.hypot(p.x - x, p.z - z) < .55);
  let ferns = 0, leaves = 0;
  for (let attempt = 0; attempt < 600 && (ferns < (mobile ? 30 : 60) || leaves < (mobile ? 18 : 34)); attempt++) {
    const i = TRAILHEAD.index - 12 + Math.floor(rand() * 30), p = TRAIL_SAMPLES[i], q = TRAIL_SAMPLES[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz), side = rand() < .5 ? -1 : 1, offset = .9 + rand() * rand() * 3;
    const x = p.x - dz / l * side * offset, z = p.z + dx / l * side * offset, isFern = rand() < .62, size = isFern ? .55 + rand() * .45 : .24 + rand() * .14;
    if ((isFern ? ferns >= (mobile ? 30 : 60) : leaves >= (mobile ? 18 : 34)) || occupied(x, z, size)) continue;
    const at = new THREE.Vector3(x, terrainSurfaceHeight(x, z), z);
    if (isFern) { parts.push(fern(at, size, mobile ? 5 : 7, rand)); ferns++; } else { parts.push(butterbur(at, size, rand)); leaves++; }
  }
  // The rope fence round the plateau's open edges: posts where no crag closes it, gaps for the trail and at the barrier.
  const posts: (THREE.Vector3 | null)[] = [], wobble = (a: number): number => 1 + .07 * Math.sin(3 * a + 1) + .05 * Math.sin(5 * a + 2.3);
  for (let k = 0, count = 44; k < count; k++) {
    const a = k / count * TAU, rim = (r: number): { x: number; z: number } => ({ x: PLATEAU.x + Math.cos(a) * PLATEAU.a * r * wobble(a), z: PLATEAU.z + Math.sin(a) * PLATEAU.b * r * wobble(a) });
    const p = rim(.86), beyond = rim(1.14), crag = terrainSurfaceHeight(beyond.x, beyond.z) - plateauHeight(p.x, p.z) > 7.5;
    const gap = trailDistance(p.x, p.z) < 1.5 || Math.hypot(p.x - TRAIL_BARRIER.x, p.z - TRAIL_BARRIER.z) < BARRIER_HALF + 1;
    posts.push(crag || gap ? null : new THREE.Vector3(p.x, terrainSurfaceHeight(p.x, p.z), p.z));
  }
  posts.forEach((p, k) => {
    if (!p) return;
    parts.push(post(.05, -.4, 1.1).translate(p.x, p.y, p.z)); contacts.push({ x: p.x, z: p.z, rx: .3, rz: .3, strength: .6 });
    const q = posts[(k + 1) % posts.length]; if (!q || p.distanceTo(q) > 4.5 || [.25, .5, .75].some(u => trailDistance(p.x + (q.x - p.x) * u, p.z + (q.z - p.z) * u) < 1.6)) return;
    for (const height of [.55, 1]) parts.push(rope(p.clone().setY(p.y + height), q.clone().setY(q.y + height), .013));
    const low = Math.min(p.y, q.y) - .2, high = Math.max(p.y, q.y) + 1.1, mid = p.clone().lerp(q, .5);
    colliders.push({ type: 'box', position: [mid.x, (low + high) / 2, mid.z], size: [p.distanceTo(q) / 2 + .05, (high - low) / 2, .08], yaw: -Math.atan2(q.z - p.z, q.x - p.x) });
  });
  // The barrier that ends the walkable trail at the plateau's crags: two posts, two log rails and a small board, one collider.
  const fence = new THREE.Matrix4().makeRotationY(TRAIL_BARRIER.yaw).setPosition(TRAIL_BARRIER.x, 0, TRAIL_BARRIER.z), at = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z).applyMatrix4(fence);
  const feet = [-1, 1].map(side => { const p = at(side * BARRIER_HALF, 0, 0); return terrainSurfaceHeight(p.x, p.z); });
  [-1, 1].forEach((side, k) => {
    parts.push(post(.075, -.45, 1.22).applyMatrix4(new THREE.Matrix4().setPosition(side * BARRIER_HALF, feet[k], 0).premultiply(fence)));
    const p = at(side * BARRIER_HALF, 0, 0); contacts.push({ x: p.x, z: p.z, rx: .4, rz: .4, strength: .7 });
  });
  for (const height of [.55, 1.02]) parts.push(log(at(-BARRIER_HALF - .12, feet[0] + height, .06), at(BARRIER_HALF + .12, feet[1] + height, .06), .05));
  parts.push(board(.42, .2, .016, REGION.closed).applyMatrix4(new THREE.Matrix4().setPosition(0, (feet[0] + feet[1]) / 2 + .79, .1).premultiply(fence)));
  const low = Math.min(...feet) - .3, high = Math.max(...feet) + 1.15, middle = at(0, (low + high) / 2, .03);
  colliders.push({ type: 'box', position: [middle.x, middle.y, middle.z], size: [BARRIER_HALF + .1, (high - low) / 2, .12], yaw: TRAIL_BARRIER.yaw });
  // Blue-cross blazes up the trail, painted on the boulders' faces toward it.
  for (const { site, blaze: toward } of boulders) { const face = toward && boulderFace(site, toward); if (face) parts.push(blaze(face.point, face.normal)); }
  const geometry = mergeGeometries(parts.map(part => { const g = part.index ? part.toNonIndexed() : part; if (!g.getAttribute('normal')) g.computeVertexNormals(); return g; }))!; parts.forEach(part => part.dispose());
  // Fern fronds and butterbur leaves are cut out of the atlas by its alpha; both sides of every leaf show.
  const material = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: .86, side: THREE.DoubleSide, alphaTest: .5 });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Jepii Mici trail signs'; mesh.castShadow = true; mesh.receiveShadow = true;
  // The atlas places every face exactly; cpu-detail.ts must not simplify it. Clicks and E open the trail's story.
  mesh.userData.keepGeometry = true; mesh.userData.discovery = 'jepii-mici';
  return { mesh, position: world(0, centre, 0), contacts };
}

// ---------------------------------------------------------------------------------------------------------------------
// The atlas

type Ctx = CanvasRenderingContext2D;
const FONT = (size: number): string => `700 ${size}px Arial, "Liberation Sans", "DejaVu Sans", sans-serif`;
/** Hand-painted capitals: condensed, each letter a little turned, lifted and resized, the paint thinning in specks. */
function lettering(ctx: Ctx, text: string, x: number, y: number, size: number, colour: string, rand: () => number, condense = .8): void {
  ctx.font = FONT(size); const widths = [...text].map(ch => ctx.measureText(ch).width * condense), total = widths.reduce((a, b) => a + b, 0);
  const layer = document.createElement('canvas'); layer.width = Math.ceil(total + size); layer.height = Math.ceil(size * 1.6);
  const paint = layer.getContext('2d')!; paint.font = FONT(size); paint.fillStyle = colour; paint.textBaseline = 'middle';
  let cx = size / 2;
  [...text].forEach((ch, i) => {
    paint.save(); paint.translate(cx + widths[i] / 2, layer.height / 2 + (rand() - .5) * size * .06); paint.rotate((rand() - .5) * .07);
    paint.scale(condense * (1 + (rand() - .5) * .07), 1 + (rand() - .5) * .09);
    const w = paint.measureText(ch).width; paint.globalAlpha = .9; paint.fillText(ch, -w / 2, 0); paint.globalAlpha = .55; paint.fillText(ch, -w / 2 + (rand() - .5) * 2.5, (rand() - .5) * 2.5);
    paint.restore(); cx += widths[i];
  });
  // Brush drag: the paint is thinner in places, showing the board through it.
  paint.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < total * size / 90; i++) { paint.globalAlpha = .15 + rand() * .35; paint.fillRect(rand() * layer.width, rand() * layer.height, 1 + rand() * size * .08, 1 + rand() * 2); }
  ctx.drawImage(layer, x - total / 2 - size / 2, y - layer.height / 2);
}
/** Slightly textured, weathered white paint over a region. */
function whiteBoard(ctx: Ctx, r: Region, rand: () => number, base = '#f1efe8'): void {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0; ctx.fillStyle = base; ctx.fillRect(x0, y0, w, h);
  for (let i = 0; i < w * h / 160; i++) { ctx.fillStyle = `rgba(${rand() < .5 ? '120,115,100' : '255,255,250'},${rand() * .08})`; ctx.fillRect(x0 + rand() * w, y0 + rand() * h, 1 + rand() * 6, 1 + rand() * 2); }
  for (let i = 0; i < h / 7; i++) { ctx.fillStyle = `rgba(110,104,90,${rand() * .05})`; ctx.fillRect(x0, y0 + rand() * h, w, 1 + rand() * 2); }
}
/** The trail mark: a blue cross on a white square with a black outline (the real Jepii Mici marking). */
function blueCross(ctx: Ctx, cx: number, cy: number, size: number): void {
  ctx.fillStyle = '#fbfbf7'; ctx.fillRect(cx - size / 2, cy - size / 2, size, size); ctx.strokeStyle = '#111'; ctx.lineWidth = size * .07; ctx.strokeRect(cx - size / 2 + size * .035, cy - size / 2 + size * .035, size * .93, size * .93);
  ctx.fillStyle = '#1d4ea6'; const arm = size * .2, reach = size * .34; ctx.fillRect(cx - arm / 2, cy - reach, arm, reach * 2); ctx.fillRect(cx - reach, cy - arm / 2, reach * 2, arm);
}
function arrowPath(ctx: Ctx, r: Region, mirrored: boolean, inset: number): void {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0, tip = ARROW.tip / ARROW.length * w, X = (s: number): number => mirrored ? x1 - s : x0 + s;
  ctx.beginPath(); ctx.moveTo(X(inset), y0 + inset); ctx.lineTo(X(w - tip - inset * .4), y0 + inset); ctx.lineTo(X(w - inset * 1.6), y0 + h / 2); ctx.lineTo(X(w - tip - inset * .4), y1 - inset); ctx.lineTo(X(inset), y1 - inset); ctx.closePath();
}
/** Hand-lettered lines centred in a column, each fitted to `width`. */
function lines(ctx: Ctx, rows: readonly (readonly [string, number, string])[], cx: number, top: number, width: number, rand: () => number): void {
  let y = top;
  for (const [text, size, colour] of rows) {
    ctx.font = FONT(size); const condense = Math.min(.8, width / ctx.measureText(text).width);
    y += size * .62; lettering(ctx, text, cx, y, size, colour, rand, condense); y += size * .62;
  }
}
/** Paints every face of the trail signs, the bark, ropes, fern and butterbur into one canvas texture on their shared material. */
export function paintTrailSigns(signs: TrailSigns, tier: GraphicsTier): void {
  const scale = tier === 'gpu' ? 1 : .5, canvas = document.createElement('canvas'); canvas.width = ATLAS.width * scale; canvas.height = ATLAS.height * scale;
  const ctx = canvas.getContext('2d')!, rand = random(1977); ctx.scale(scale, scale);
  ctx.fillStyle = '#efede6'; ctx.fillRect(0, 0, ATLAS.width, ATLAS.height);
  // Danger board: blue painted border, red hand-lettered warnings in Romanian and English.
  const d = REGION.danger; whiteBoard(ctx, d, rand);
  ctx.strokeStyle = '#2353a8'; ctx.lineWidth = 34; ctx.lineJoin = 'round'; ctx.beginPath();
  const edge = (x: number, y: number): void => ctx.lineTo(x + (rand() - .5) * 5, y + (rand() - .5) * 5);
  for (let i = 0; i <= 24; i++) edge(20 + i / 24 * 1240, 20); for (let i = 1; i <= 14; i++) edge(1260, 20 + i / 14 * 680); for (let i = 1; i <= 24; i++) edge(1260 - i / 24 * 1240, 700); for (let i = 1; i < 14; i++) edge(20, 700 - i / 14 * 680);
  ctx.closePath(); ctx.stroke();
  const red = '#c4161c', black = '#1b1b1b';
  lettering(ctx, 'ATENȚIE! · ATTENTION!', 640, 150, 118, red, rand, .74);
  lettering(ctx, 'TRASEU ÎNCHIS!', 345, 315, 66, red, rand, .76); lettering(ctx, 'TRAIL CLOSED!', 345, 402, 66, red, rand, .76);
  lettering(ctx, 'PERICOL DE MOARTE!', 935, 315, 66, red, rand, .7); lettering(ctx, 'DEATH HAZARD!', 935, 402, 66, red, rand, .76);
  lettering(ctx, 'INTERZIS! · FORBIDDEN!', 640, 575, 118, red, rand, .74);
  // Its plain back, weathered with a few rust runs from the rope holes.
  whiteBoard(ctx, REGION.back, rand, '#e9e6dc'); for (const x of [30, 470]) { ctx.fillStyle = 'rgba(130,80,40,.18)'; ctx.fillRect(REGION.back[0] + x - 4, REGION.back[1] + 10, 8, 60 + rand() * 60); }
  // The pointer, front (tip right) and back (tip left): white arrow, thin black outline, the mark at the tail, the destination.
  for (const [r, mirrored] of [[REGION.pointer, false], [REGION.pointerBack, true]] as const) {
    whiteBoard(ctx, r, rand, '#f6f5f0'); arrowPath(ctx, r, mirrored, 9); ctx.strokeStyle = '#151515'; ctx.lineWidth = 6; ctx.stroke();
    const w = r[2] - r[0], h = r[3] - r[1], mark = mirrored ? r[2] - h * .55 : r[0] + h * .55; blueCross(ctx, mark, r[1] + h / 2, h * .62);
    ctx.fillStyle = '#141414'; ctx.font = FONT(84); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(mirrored ? r[0] + w * .44 : r[0] + w * .56, r[1] + h / 2 + 3); ctx.scale(.8, 1); ctx.fillText('JEPII MICI', 0, 0); ctx.restore();
    ctx.textAlign = 'start';
  }
  // The two boards on the right trunk: black-framed white, hand-lettered, a blue-cross square at the right.
  for (const [r, rows] of [
    [REGION.warning, [['TRASEU DEOSEBIT', 44, red], ['DE PERICULOS!', 44, red], ['PERMIS NUMAI TURIȘTILOR', 30, black], ['ECHIPAȚI CORESPUNZĂTOR', 30, black], ['ȘI BINE ANTRENAȚI', 30, black], ['PENTRU URGENȚE: 112', 30, black]]],
    [REGION.winter, [['DIFFICULT OR', 38, black], ['DANGEROUS TRAIL!', 38, black], ['CLOSED IN WINTER', 32, red], ['(NOVEMBER–APRIL)', 28, black]]],
  ] as const) {
    whiteBoard(ctx, r, rand); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 7; ctx.strokeRect(r[0] + 8, r[1] + 8, r[2] - r[0] - 16, r[3] - r[1] - 16);
    const h = r[3] - r[1], mark = h * .36; blueCross(ctx, r[2] - mark / 2 - 26, r[1] + h / 2, mark);
    const column = r[2] - r[0] - mark - 70; lines(ctx, rows, r[0] + 22 + column / 2, r[1] + 22, column, rand);
  }
  const c = REGION.closed; whiteBoard(ctx, c, rand); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5; ctx.strokeRect(c[0] + 8, c[1] + 8, c[2] - c[0] - 16, c[3] - c[1] - 16);
  lettering(ctx, 'TRASEU ÎNCHIS', (c[0] + c[2]) / 2, c[1] + 62, 46, red, rand, .76); lettering(ctx, 'TRAIL CLOSED', (c[0] + c[2]) / 2, c[1] + 122, 38, black, rand, .78);
  const b = REGION.blaze; ctx.fillStyle = '#d9d6cc'; ctx.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); blueCross(ctx, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 112);
  whiteBoard(ctx, REGION.paint, rand);
  // Weathered spruce and a cream rope, in swatches the posts and ropes map into.
  const w = REGION.wood; ctx.fillStyle = '#6d5539'; ctx.fillRect(w[0], w[1], w[2] - w[0], w[3] - w[1]);
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(${rand() < .5 ? '40,28,16' : '150,128,96'},${.15 + rand() * .25})`; ctx.fillRect(w[0] + rand() * 128, w[1], 1 + rand() * 2, 128); }
  const r = REGION.rope; ctx.fillStyle = '#e4dcc5'; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  for (let i = -128; i < 128; i += 9) { ctx.strokeStyle = 'rgba(150,135,105,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r[0] + i, r[1]); ctx.lineTo(r[0] + i + 128, r[3]); ctx.stroke(); }
  // Fir bark: grey-brown plates split by dark vertical furrows, mossy toward the foot (the bottom of the strip).
  const k = REGION.bark, kw = k[2] - k[0], kh = k[3] - k[1]; ctx.fillStyle = '#5b4a3b'; ctx.fillRect(k[0], k[1], kw, kh);
  for (let i = 0; i < 260; i++) { const x = k[0] + rand() * kw, y = k[1] + rand() * kh; ctx.fillStyle = `rgba(${rand() < .5 ? '62,48,36' : '150,132,112'},${.25 + rand() * .3})`; ctx.fillRect(x, y, 3 + rand() * 9, 14 + rand() * 40); }
  for (let i = 0; i < 26; i++) { const x = k[0] + rand() * kw; ctx.strokeStyle = 'rgba(30,25,22,.55)'; ctx.lineWidth = 1.5 + rand() * 2.5; ctx.beginPath(); ctx.moveTo(x, k[1]); for (let y = 0; y <= kh; y += 24) ctx.lineTo(x + Math.sin(y * .05 + i) * 3, k[1] + y); ctx.stroke(); }
  const moss = ctx.createLinearGradient(0, k[3] - kh * .22, 0, k[3]); moss.addColorStop(0, 'rgba(78,98,38,0)'); moss.addColorStop(1, 'rgba(78,98,38,.85)'); ctx.fillStyle = moss; ctx.fillRect(k[0], k[3] - kh * .22, kw, kh * .22);
  // Butterbur: a big kidney-shaped leaf with pale radiating veins on a transparent ground the alpha test cuts away.
  const f = REGION.butterbur, fx = (f[0] + f[2]) / 2, fy = (f[1] + f[3]) / 2, fr = (f[2] - f[0]) * .47; ctx.clearRect(f[0], f[1], f[2] - f[0], f[3] - f[1]);
  ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, notch = 1 - .5 * Math.exp(-(((a - Math.PI * 1.5 + TAU) % TAU - Math.PI) ** 2) * 18), wave = 1 + .03 * Math.sin(a * 14); ctx.lineTo(fx + Math.cos(a) * fr * notch * wave, fy + Math.sin(a) * fr * notch * wave); } ctx.closePath();
  const leaf = ctx.createRadialGradient(fx, fy + fr * .1, 4, fx, fy, fr); leaf.addColorStop(0, '#6f9b3c'); leaf.addColorStop(1, '#3f6b25'); ctx.fillStyle = leaf; ctx.fill();
  ctx.strokeStyle = 'rgba(190,215,140,.55)'; for (let i = 0; i < 11; i++) { const a = Math.PI * .05 + i / 10 * Math.PI * 1.9 - Math.PI * .45; ctx.lineWidth = 3 - i % 2; ctx.beginPath(); ctx.moveTo(fx, fy + fr * .35); ctx.lineTo(fx + Math.cos(a - Math.PI / 2) * fr * .92, fy + fr * .35 + Math.sin(a - Math.PI / 2) * fr * .92); ctx.stroke(); }
  ctx.fillStyle = '#5e8a33'; ctx.fillRect(1532, 1196, 8, 8);
  // Fern frond: a rachis with paired, tapering pinnae, tip at the top of the strip, on transparent ground.
  const n = REGION.fern, nx = (n[0] + n[2]) / 2, nh = n[3] - n[1]; ctx.clearRect(n[0], n[1], n[2] - n[0], nh);
  for (let i = 0; i < 26; i++) {
    const u = i / 26, y = n[3] - 10 - u * (nh - 20), len = (n[2] - n[0]) * .46 * Math.sin(Math.min(1, (u + .08) * 1.15) * Math.PI) ** .8;
    ctx.fillStyle = `rgb(${60 + rand() * 25},${110 + rand() * 30},${38 + rand() * 15})`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(nx + s * len * .5, y - len * .18, len * .52, Math.max(3, len * .16), s * -.35, 0, TAU); ctx.fill(); }
  }
  ctx.strokeStyle = '#4c6b2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx, n[3]); ctx.lineTo(nx, n[1] + 8); ctx.stroke();
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = tier === 'gpu' ? 8 : 4;
  signs.mesh.material.map = map; signs.mesh.material.color.set('#ffffff'); signs.mesh.material.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rhododendron shrubs and moss campion on the plateau

export interface ShrubSite { x: number; z: number; radius: number; height: number }
/**
 * Rhododendron shrubs in loose groups on the plateau (gpu 80, mobile 44), 1–2.8 m across and 0.4–0.7 m tall, off the trail,
 * the boulders and each other, and a few strays on the verges of the climb's top.
 */
export function shrubSites(mobile: boolean, rocks: readonly RockSite[]): ShrubSite[] {
  const rand = random(4409), sites: ShrubSite[] = [], target = mobile ? 44 : 80, stones = rocks.filter(r => plateauRadius(r.x, r.z) < 1.2);
  const free = (x: number, z: number, radius: number): boolean => terrainSurfaceNormal(x, z).y > .86 && trailDistance(x, z) > TRAIL_HALF + .4 + radius * .9 && stones.every(r => Math.hypot(r.x - x, r.z - z) > rockReach(r.s) + radius * .8) && sites.every(s => Math.hypot(s.x - x, s.z - z) > (s.radius + radius) * .92);
  for (let attempt = 0; attempt < 6000 && sites.length < target; attempt++) {
    const x = PLATEAU.x + (rand() - .5) * PLATEAU.a * 1.7, z = PLATEAU.z + (rand() - .5) * PLATEAU.b * 1.7, density = bloomDensity(x, z);
    if (rand() > density) continue;
    const radius = .5 + rand() * .55 * (.6 + density * .7), height = Math.min(.4 + rand() * .3, .3 + radius * .32);
    if (free(x, z, radius)) sites.push({ x, z, radius, height });
  }
  for (let i = TRAIL_ENTRY - 22; i < TRAIL_ENTRY; i += 7) {
    const p = TRAIL_SAMPLES[i], q = TRAIL_SAMPLES[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z), side = i % 2 ? 1 : -1, radius = .45 + rand() * .2;
    const x = p.x - (q.z - p.z) / l * side * (TRAIL_HALF + 1.2 + radius), z = p.z + (q.x - p.x) / l * side * (TRAIL_HALF + 1.2 + radius);
    if (free(x, z, radius)) sites.push({ x, z, radius, height: .4 });
  }
  return sites;
}
/** Shrubs as one merged mesh: dark glossy leaf clumps with a red-brown cast, magenta trusses on top, fewer down the sides. */
function shrubGeometry(sites: readonly ShrubSite[], mobile: boolean): THREE.BufferGeometry {
  const rand = random(3203), positions: number[] = [], normals: number[] = [], colors: number[] = [], bloom: number[] = [], index: number[] = [];
  const blossom = [new THREE.Color('#c8378f'), new THREE.Color('#e05ab0')], leafColours = [new THREE.Color('#2b4523'), new THREE.Color('#40592e')], cast = new THREE.Color('#5a3626'), colour = new THREE.Color();
  const ico = new THREE.IcosahedronGeometry(1, 0), unit = ico.getAttribute('position'), faces = Array.from({ length: (ico.index?.count ?? unit.count) / 3 }, (_, f) => [0, 1, 2].map(k => ico.index ? ico.index.getX(f * 3 + k) : f * 3 + k));
  // Icosahedron(1, 0) is not indexed in three; weld its corners so each clump is 12 vertices.
  const corners: THREE.Vector3[] = [], corner = (i: number): number => { const v = new THREE.Vector3().fromBufferAttribute(unit, i); let k = corners.findIndex(c => c.distanceToSquared(v) < 1e-6); if (k < 0) k = corners.push(v) - 1; return k; };
  const tris = faces.map(f => f.map(corner)).filter(f => f.some(k => corners[k].y > -.35));
  const vertex = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, b: number): number => { positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b); bloom.push(b); return positions.length / 3 - 1; };
  const v = new THREE.Vector3(), n = new THREE.Vector3(), dome = new THREE.Vector3();
  for (const site of sites) {
    const phase = [rand() * TAU, rand() * TAU], rim = (a: number): number => site.radius * (.86 + .12 * Math.sin(3 * a + phase[0]) + .08 * Math.sin(5 * a + phase[1]));
    const g = (x: number, z: number): number => terrainSurfaceHeight(x, z), mound = (q: number): number => site.height * Math.pow(Math.max(0, 1 - q * q), .6);
    const clumps = Math.round(mobile ? 12 + site.radius * 14 : 28 + site.radius * 36);
    for (let k = 0; k < clumps; k++) {
      const a = k * 2.399 + rand() * .6, q = Math.min(1.02, Math.sqrt((k + .5) / clumps) * (1 + rand() * .08)), r = q * rim(a), x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
      const size = (mobile ? .2 : .14) + rand() * (mobile ? .08 : .07), y = g(x, z) + Math.max(size * .45, mound(q) - size * .2);
      const tint = colour.copy(leafColours[0]).lerp(leafColours[1], rand()).lerp(cast, rand() * rand() * .5).clone();
      dome.set(Math.cos(a) * q * .8, 1, Math.sin(a) * q * .8).normalize();
      const first = positions.length / 3;
      corners.forEach(c => { const s = .82 + rand() * .36; v.copy(c).multiplyScalar(s); n.copy(c).lerp(dome, .55).normalize(); vertex(new THREE.Vector3(x + v.x * size, y + v.y * size * .75, z + v.z * size), n, colour.copy(tint).multiplyScalar(c.y < 0 ? .62 : .9 + .15 * c.y), 0); });
      for (const t of tris) index.push(first + t[0], first + t[1], first + t[2]);
    }
    // Trusses at the branch tips: dense over the top, a few lone ones low on the sides.
    const trusses = Math.round((mobile ? 46 : 92) * site.radius * site.radius + 4), size = mobile ? .09 : .07;
    for (let k = 0, placed = 0; k < trusses * 3 && placed < trusses; k++) {
      const a = rand() * TAU, q = Math.sqrt(rand()) * 1.02; if (rand() > (q < .72 ? .95 : .28)) continue;
      // On the outer leaves, not among them: the clumps reach about 10 cm above the mound.
      const x = site.x + Math.cos(a) * q * rim(a), z = site.z + Math.sin(a) * q * rim(a), y = g(x, z) + Math.max(.16, mound(q) + .11);
      const tone = colour.copy(blossom[0]).lerp(blossom[1], rand()).clone(), up = new THREE.Vector3(Math.cos(a) * q * .9, 1, Math.sin(a) * q * .9).normalize(), side = new THREE.Vector3().crossVectors(up, new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))).normalize(), across = new THREE.Vector3().crossVectors(up, side);
      const top = vertex(new THREE.Vector3(x, y, z).addScaledVector(up, size * .75), up, colour.copy(tone).multiplyScalar(1.12), 1), turn = rand() * TAU;
      const ring = Array.from({ length: 6 }, (_, j) => { const b = turn + j / 6 * TAU, s = size * (.85 + rand() * .3), p = new THREE.Vector3(x, y, z).addScaledVector(side, Math.cos(b) * s).addScaledVector(across, Math.sin(b) * s); return vertex(p, p.clone().sub(new THREE.Vector3(x, y, z)).normalize().lerp(up, .5).normalize(), colour.copy(tone).multiplyScalar(.82), 1); });
      ring.forEach((_, j) => index.push(top, ring[j], ring[(j + 1) % 6]));
      placed++;
    }
  }
  ico.dispose();
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('bloom', new THREE.Float32BufferAttribute(bloom, 1)); geometry.setIndex(index); geometry.computeBoundingSphere(); return geometry;
}
/** Leaves as small glossy cells and every truss as a cluster of funnel blooms, from world-space Worley cells. */
function shrubMaterial(): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true }), b = attribute<'float'>('bloom', 'float');
  const blooms = mix(1.16, .7, smoothstep(.1, .62, mx_worley_noise_float(positionWorld.mul(34)))), leaves = mix(1.18, .58, smoothstep(0, .78, mx_worley_noise_float(positionWorld.mul(26))));
  material.colorNode = vec3(mix(leaves, blooms, b)); material.roughnessNode = mix(.5, .62, b);
  return material;
}
export interface CampionSite { x: number; z: number; radius: number }
/** Moss campion cushions (gpu 110, mobile 55): between the shrubs on the plateau and along the verges of the climb's top. */
export function campionSites(mobile: boolean, shrubs: readonly ShrubSite[], rocks: readonly RockSite[]): CampionSite[] {
  const rand = random(6151), sites: CampionSite[] = [], target = mobile ? 55 : 110, stones = rocks.filter(r => plateauRadius(r.x, r.z) < 1.5);
  const free = (x: number, z: number, radius: number): boolean => terrainSurfaceNormal(x, z).y > .88 && trailDistance(x, z) > TRAIL_HALF + .2 + radius && shrubs.every(s => Math.hypot(s.x - x, s.z - z) > s.radius + radius * .6) && stones.every(r => Math.hypot(r.x - x, r.z - z) > rockReach(r.s) + radius) && sites.every(s => Math.hypot(s.x - x, s.z - z) > s.radius + radius + .15);
  for (let attempt = 0; attempt < 5000 && sites.length < target; attempt++) {
    const verge = rand() < .3, radius = .15 + rand() * rand() * .45;
    let x: number, z: number;
    if (verge) {
      const i = TRAIL_ENTRY - 40 + Math.floor(rand() * (TRAIL_BARRIER.index - TRAIL_ENTRY + 40)), p = TRAIL_SAMPLES[i], q = TRAIL_SAMPLES[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z), side = rand() < .5 ? -1 : 1, offset = TRAIL_HALF + .35 + radius + rand() * 1.8;
      x = p.x - (q.z - p.z) / l * side * offset; z = p.z + (q.x - p.x) / l * side * offset;
    } else { x = PLATEAU.x + (rand() - .5) * PLATEAU.a * 1.7; z = PLATEAU.z + (rand() - .5) * PLATEAU.b * 1.7; if (plateauRadius(x, z) > .84) continue; }
    if (free(x, z, radius)) sites.push({ x, z, radius });
  }
  return sites;
}
/** Campion as one merged mesh hugging the ground: each cushion a low, irregular dome a few centimetres high, edge buried. */
function campionGeometry(sites: readonly CampionSite[]): THREE.BufferGeometry {
  const rand = random(733), positions: number[] = [], normals: number[] = [], index: number[] = [];
  for (const site of sites) {
    const first = positions.length / 3, ground = terrainSurfaceNormal(site.x, site.z), lift = .03 + site.radius * .04;
    const add = (x: number, z: number, y: number, out: number): void => { positions.push(x, terrainSurfaceHeight(x, z) + y, z); const n = ground.clone().add(new THREE.Vector3(x - site.x, 0, z - site.z).normalize().multiplyScalar(out)).normalize(); normals.push(n.x, n.y, n.z); };
    add(site.x, site.z, lift, 0);
    for (const [ring, height, out] of [[.55, lift * .85, .15], [1, -.012, .5]] as const) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + (ring === 1 ? .31 : 0), r = site.radius * ring * (ring === 1 ? .8 + rand() * .35 : 1); add(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r, height, out); }
    for (let k = 0; k < 10; k++) {
      const a = first + 1 + k, b = first + 1 + (k + 1) % 10, c = first + 11 + k, d = first + 11 + (k + 1) % 10;
      index.push(first, b, a, a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(index); geometry.computeBoundingSphere(); return geometry;
}
/**
 * Dense bright moss with five-petalled lilac-pink stars (about 1.8 cm) and dark-red buds in 2.6 cm world-space cells; past 12–30 m
 * the stars average into a lilac tint instead of shimmering.
 */
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
/**
 * The plateau's plants: rhododendron shrubs and moss campion, two merged draws (none on cpu, where the ground's paint stands in),
 * with contact patches under the shrubs. No wind: shrubs this low and woody, and moss cushions, barely move.
 */
export function createAlpinePlants(tier: GraphicsTier, rocks: readonly RockSite[]): { meshes: THREE.Mesh[]; contacts: ContactSite[] } {
  if (tier === 'cpu') return { meshes: [], contacts: [] };
  const mobile = tier === 'mobile', shrubs = shrubSites(mobile, rocks), campion = campionSites(mobile, shrubs, rocks);
  const bushes = new THREE.Mesh(shrubGeometry(shrubs, mobile), shrubMaterial()); bushes.name = 'Rhododendron shrubs'; bushes.receiveShadow = true;
  const cushions = new THREE.Mesh(campionGeometry(campion), campionMaterial()); cushions.name = 'Moss campion'; cushions.receiveShadow = true;
  // Merged in world space from seeded layouts; cpu-detail.ts never sees them (no cpu tier), but keep their exact shapes anyway.
  bushes.userData.keepGeometry = cushions.userData.keepGeometry = true;
  return { meshes: [bushes, cushions], contacts: shrubs.map(s => ({ x: s.x, z: s.z, rx: s.radius * 1.05, rz: s.radius * 1.05, strength: .55 })) };
}
/** For tests: plateau ground heights where plants stand must be the plateau's (no shrub on a crag). */
export function onPlateau(x: number, z: number): boolean { return plateauMask(x, z) > .99; }
