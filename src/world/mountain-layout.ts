// Sub-plan 27: the Jepii Mici trail from the north garden path through the woods and up the north ridge to a walkable alpine
// plateau of rhododendrons and moss campion below a band of limestone crags, and old avalanche snow in a shaded couloir between
// two rocky peaks to its west. Plain fields with no terrain import, so terrain.ts, ground-cover.ts, forest-layout.ts, main.ts and
// the tests can all read them; mountain-trail.ts builds the signs, fences, boulders and plants from the same layout.
import * as THREE from 'three';

/** Dev-only `?mountain=off`: the mountains before sub-plan 27, without the trail, its signs, the plateau and the snow. */
export function mountainLook(): 'trail' | 'off' {
  if (!import.meta.env?.DEV || typeof location === 'undefined') return 'trail';
  return new URLSearchParams(location.search).get('mountain') === 'off' ? 'off' : 'trail';
}
export const MOUNTAIN = mountainLook() === 'trail';

function hash(x: number, z: number): number { const n = Math.sin(x * 157.31 + z * 291.73) * 31871.13; return n - Math.floor(n); }
/** Value noise, 0–1 (the same construction as terrainNoise, its own seed). */
export function mountainNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
const smooth = THREE.MathUtils.smoothstep;

// ---------------------------------------------------------------------------------------------------------------------
// The plateau

/** The upper plateau: an irregular ellipse round its centre, its rolling meadow level and the crags behind it. */
export const PLATEAU = { x: -12, z: -249.5, a: 25, b: 10, level: 30.5, rise: 4.5 } as const;
/** Normalised radius from the plateau's centre (1 at its rim), with a wandering outline. */
export function plateauRadius(x: number, z: number): number {
  const u = (x - PLATEAU.x) / PLATEAU.a, v = (z - PLATEAU.z) / PLATEAU.b, angle = Math.atan2(v, u);
  return Math.hypot(u, v) / (1 + .07 * Math.sin(3 * angle + 1) + .05 * Math.sin(5 * angle + 2.3));
}
/** How fully the plateau claims the ground, 0–1: whole inside 88% of its radius, giving way to the slopes and crags by the rim. */
export function plateauMask(x: number, z: number): number {
  if (!MOUNTAIN || Math.abs(x - PLATEAU.x) > PLATEAU.a * 1.3 || Math.abs(z - PLATEAU.z) > PLATEAU.b * 1.3) return 0;
  return 1 - smooth(plateauRadius(x, z), .88, 1);
}
/** The meadow's level: gently rolling, rising about 4.5 m toward the crags at its back. */
export function plateauHeight(x: number, z: number): number {
  return PLATEAU.level + PLATEAU.rise * smooth(-(z - PLATEAU.z) / PLATEAU.b, -1, 1) + 2 * (mountainNoise(x * .11 + 3, z * .11 - 5) - .5);
}

// ---------------------------------------------------------------------------------------------------------------------
// The trail

/**
 * Centreline in plan: from the north garden path (under its paving) on a gentle walk through the woods to the trailhead at the
 * foot of the forested slope, straight up it, in switchbacks across the ridge's face onto the plateau and across it to the crags.
 */
const TRAIL_POINTS: readonly (readonly [number, number])[] = [
  [-5, -158.6], [-6.5, -168], [-9, -177], [-11.5, -184.5], [-13, -190.5], [-15, -195.5], [-18.5, -200], [-24, -203.5], [-29.5, -206.5], [-23, -210.5], [-13, -214],
  [-20, -219], [-30, -222], [-38, -224.5], [-39.5, -227], [-34, -229], [-20, -231], [-8, -232.5], [-5, -235], [-9, -237.5], [-17, -240], [-21.5, -242.5],
  [-17, -246.5], [-11, -251], [-11, -256], [-14, -262], [-18, -268], [-21, -275],
];
export const TRAIL_CURVE = new THREE.CatmullRomCurve3(TRAIL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
/** About one sample per metre along the trail. */
export const TRAIL_SAMPLES = TRAIL_CURVE.getSpacedPoints(Math.ceil(TRAIL_CURVE.getLength()));
/** Bare earth half-width; the worn, sparse-grass fringe reaches about a metre further. */
export const TRAIL_HALF = .65;
/** First sample on the plateau: where the benched climb ends. */
export const TRAIL_ENTRY = TRAIL_SAMPLES.findIndex(p => p.z < -238 && plateauRadius(p.x, p.z) < 1);
/**
 * Where the trail leaves the plateau's back for the crags, a log barrier closes it: the walkable trail ends on the plateau; the
 * worn line goes on up into the rock. Yaw as TRAILHEAD's: local -z points up the trail.
 */
export const TRAIL_BARRIER = (() => {
  const index = TRAIL_SAMPLES.findIndex((p, i) => i > TRAIL_ENTRY + 5 && p.z < PLATEAU.z - 3 && plateauRadius(p.x, p.z) > .56), p = TRAIL_SAMPLES[index], a = TRAIL_SAMPLES[index - 2], b = TRAIL_SAMPLES[index + 2];
  return { index, x: p.x, z: p.z, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
})();
/** The last trail sample before the barrier: the walkable top, on the plateau. */
export const TRAIL_TOP = TRAIL_SAMPLES[TRAIL_BARRIER.index - 1];
/** Where the benched climb across the ridge's face starts (the bench grades the slope there, see `trailBench`). */
const BENCH_START = TRAIL_SAMPLES.findIndex(p => p.z < -220);

const CELL = 8, REACH = 8, bins = new Map<string, number[]>();
for (let i = 1; i < TRAIL_SAMPLES.length; i++) {
  const a = TRAIL_SAMPLES[i - 1], b = TRAIL_SAMPLES[i];
  for (let x = Math.floor((Math.min(a.x, b.x) - REACH) / CELL); x <= Math.floor((Math.max(a.x, b.x) + REACH) / CELL); x++)
    for (let z = Math.floor((Math.min(a.z, b.z) - REACH) / CELL); z <= Math.floor((Math.max(a.z, b.z) + REACH) / CELL); z++) {
      const key = `${x},${z}`, bucket = bins.get(key); if (bucket) bucket.push(i); else bins.set(key, [i]);
    }
}
/** Calls `visit` with the distance to each trail segment near (x, z) and the trail position (sample index) nearest on it. */
function nearTrail(x: number, z: number, visit: (distance: number, s: number) => void): void {
  for (const i of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const a = TRAIL_SAMPLES[i - 1], b = TRAIL_SAMPLES[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    visit(Math.hypot(x - a.x - dx * t, z - a.z - dz * t), i - 1 + t);
  }
}
/** Distance in plan from the trail's centreline, capped at 8 m (8 everywhere without the trail). */
export function trailDistance(x: number, z: number): number {
  if (!MOUNTAIN) return REACH;
  let nearest = REACH; nearTrail(x, z, (d) => { nearest = Math.min(nearest, d); });
  return nearest;
}
/** Worn soil along the trail, 0–1, for the ground cover bake: bare at the centre, fraying into the grass. */
export function trailWear(x: number, z: number): number {
  let d = 8, s = 0; nearTrail(x, z, (distance, at) => { if (distance < d) { d = distance; s = at; } }); if (!MOUNTAIN || d >= 2.5) return 0;
  // The worn line ends at the barrier: the crags above it are bare rock.
  return (1 - smooth(d, TRAIL_HALF * .55, TRAIL_HALF + .75 + mountainNoise(x * .7, z * .7) * .45)) * .95 * (1 - smooth(s, TRAIL_BARRIER.index - 1, TRAIL_BARRIER.index + 1.5));
}
const BENCH_FROM = 9.8;
/** The bench's level along the climb: an even grade from the foot of the face (about 9.8 m) to the plateau's rim. */
function benchLevel(s: number): number {
  const end = TRAIL_SAMPLES[TRAIL_ENTRY], top = plateauHeight(end.x, end.z);
  return THREE.MathUtils.lerp(BENCH_FROM, top, THREE.MathUtils.clamp((s - BENCH_START) / (TRAIL_ENTRY - BENCH_START), 0, 1));
}
/**
 * The climb across the ridge's face is benched into the slope: within 1.8 m of the centreline the ground is the bench's level,
 * blending back into the hillside by 4.2 m (cut above, fill below), wide enough for the two-metre terrain grid to resolve. Nearby legs blend by distance, so switchbacks never step.
 * Returns the weight (0–1) and the level.
 */
export function trailBench(x: number, z: number): { weight: number; level: number } {
  if (!MOUNTAIN || z > -214 || z < -248) return { weight: 0, level: 0 };
  let weight = 0, sum = 0, total = 0;
  nearTrail(x, z, (d, s) => {
    if (s < BENCH_START - 6 || s > TRAIL_ENTRY + 8) return;
    const w = (1 - smooth(d, 1.8, 4.2)) * smooth(s, BENCH_START - 6, BENCH_START) * (1 - smooth(s, TRAIL_ENTRY + 2, TRAIL_ENTRY + 8));
    if (w <= 0) return;
    weight = Math.max(weight, w); sum += w * benchLevel(s); total += w;
  });
  return { weight, level: total ? sum / total : 0 };
}

/**
 * The danger board hangs across the trail here, at the foot of the forested slope (`hillRise`), facing walkers coming up from
 * the town; `index` is its trail sample, yaw follows Object3D.rotation.y (local -z points up the trail).
 */
export const TRAILHEAD = (() => {
  const index = TRAIL_SAMPLES.reduce((best, p, k) => Math.hypot(p.x + 13, p.z + 190.5) < Math.hypot(TRAIL_SAMPLES[best].x + 13, TRAIL_SAMPLES[best].z + 190.5) ? k : best, 0);
  const p = TRAIL_SAMPLES[index], a = TRAIL_SAMPLES[index - 2], b = TRAIL_SAMPLES[index + 2];
  return { index, x: p.x, z: p.z, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
})();
/**
 * Map arrival on the trail 7 m below the board, facing it up the slope. `y` is the capsule's height over that flat forest floor
 * (tests/mountain-trail.test.ts keeps it there); terrain.ts cannot be imported here.
 */
export const TRAIL_ARRIVAL = (() => {
  const p = TRAIL_SAMPLES[TRAILHEAD.index - 7];
  return { x: +p.x.toFixed(2), y: 1.26, z: +p.z.toFixed(2), yaw: +Math.atan2(-(TRAILHEAD.x - p.x), -(TRAILHEAD.z - p.z)).toFixed(3) };
})();
/** The two big trunks the board hangs between, in the trailhead's frame (x across the trail, z down it) with their radii. */
export const TRAILHEAD_TRUNKS = [{ x: -2.35, z: .25, radius: .4 }, { x: 2.15, z: -.2, radius: .5 }] as const;
/** A trailhead-frame point in world x, z. */
export function trailheadPoint(x: number, z: number): { x: number; z: number } {
  const c = Math.cos(TRAILHEAD.yaw), s = Math.sin(TRAILHEAD.yaw);
  return { x: TRAILHEAD.x + c * x + s * z, z: TRAILHEAD.z - s * x + c * z };
}
/**
 * The forested slope the trail climbs at once behind the board: up to 3.4 m added to the ridge's foot over about ten metres
 * (some 30° with the ridge's own slope, under the controller's 45°), easing back into it by z = -223. terrain.ts adds it with
 * the eroded ridges only, so the forest's seeded draws are unchanged; zero at every path, entrance and the map arrival.
 */
export function hillRise(x: number, z: number): number {
  if (!MOUNTAIN || z > -186 || z < -224 || x < -52 || x > 24) return 0;
  const foot = 189.8 + 1.6 * Math.sin((x + 13) * .13);
  return 3.4 * smooth(-z, foot, foot + 10.5) * (1 - smooth(-z, 207, 223)) * smooth(x, -50, -38) * (1 - smooth(x, 10, 22));
}
/**
 * Extra trees round the trailhead, so it stands in thick woods: spots 2.6–3.3 m from the trail (`near`, for the ashes, whose
 * crowns start higher) and 4–6 m (for the oaks), clear of the board, its ropes and the two big trunks. forestSites adds them.
 */
export function trailheadTreeSpots(): { x: number; z: number; near: boolean }[] {
  const spots: { x: number; z: number; near: boolean }[] = [], rand = (k: number): number => mountainNoise(k * 3.7, k * 1.3);
  for (let i = TRAILHEAD.index - 16, k = 0; i <= TRAILHEAD.index + 14; i += 3, k++) {
    const p = TRAIL_SAMPLES[i], q = TRAIL_SAMPLES[i + 1], dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz);
    for (const [side, near] of [[k % 2 ? 1 : -1, true], [k % 2 ? -1 : 1, false]] as const) {
      const offset = near ? 2.6 + rand(k) * .7 : 4.2 + rand(k + 50) * 1.8, x = p.x - dz / length * side * offset, z = p.z + dx / length * side * offset;
      if (trailDistance(x, z) < 2.35 || Math.hypot(x - TRAILHEAD.x, z - TRAILHEAD.z) < 3.8) continue;
      if (TRAILHEAD_TRUNKS.some(t => { const c = trailheadPoint(t.x, t.z); return Math.hypot(x - c.x, z - c.z) < 2.6; })) continue;
      spots.push({ x, z, near });
    }
  }
  return spots;
}
/** Where the trail crosses the garden path's north edge: its kerb stays open there (walking-surface.ts). */
export const TRAIL_GATE = { x: -5.3, z: -160.1 };
/**
 * Ground past the walking bound (z = -225) that main.ts does not reset: the benched climb across the ridge's face and the
 * plateau. Fences and the crags keep walkers inside it (tests/mountain-trail.test.ts).
 */
export function trailCorridor(x: number, z: number): boolean {
  return MOUNTAIN && z < -215 && z > -264 && x > -50 && x < 18 && (plateauRadius(x, z) < 1.1 || trailDistance(x, z) < 6 || (z > -242 && x > -46 && x < 8));
}

// ---------------------------------------------------------------------------------------------------------------------
// Rhododendrons (bujor de munte) and moss campion on the plateau

/** How strongly the alpine meadow claims a point, 0–1: the plateau, kept free of trees. */
export function driftEnvelope(x: number, z: number): number { return plateauMask(x, z); }
/**
 * Bright alpine turf, 0–1: the plateau meadow and the top of the climb, never on the trail, which keeps its bare earth. The
 * ground material paints it (`groundPaint.x`) so no soil shows between the plants.
 */
export function turfCover(x: number, z: number): number {
  if (!MOUNTAIN) return 0;
  const meadow = Math.max(plateauMask(x, z), z < -232 && z > -244 && plateauRadius(x, z) < 1.5 ? .6 : 0); if (meadow < .01) return 0;
  return meadow * smooth(trailDistance(x, z), TRAIL_HALF + .15, TRAIL_HALF + 1);
}
/** Shrub density, 0–1: loose groups on the plateau, off the trail and back from its rim. */
export function bloomDensity(x: number, z: number): number {
  if (!MOUNTAIN || plateauRadius(x, z) > .8) return 0;
  const patches = mountainNoise(x * .16 + 4.1, z * .16 - 2.3) * .65 + mountainNoise(x * .55 - 7, z * .55 + 1.7) * .35;
  return smooth(patches, .3, .62) * (1 - smooth(plateauRadius(x, z), .62, .8)) * smooth(trailDistance(x, z), TRAIL_HALF + .6, TRAIL_HALF + 1.8);
}

// ---------------------------------------------------------------------------------------------------------------------
// Old avalanche snow in a shaded couloir between two rocky peaks

/**
 * Two rocky peaks either side of the couloir west of the plateau, on a massif raised above the ridge so the snow lies high above
 * the meadow: centre, radius and how much each stands above the ridge. The south-western one lies between the couloir and the default sun (SUN_DIR comes from the south-west), so with the
 * couloir's own walls it shades the snow.
 */
const PEAKS = [{ x: -52, z: -250.5, radius: 9, height: 34 }, { x: -40.5, z: -266, radius: 9, height: 20 }, { x: -55, z: -264, radius: 13, height: 20 }] as const;
/** Metres the peaks add to the ridge, rugged rather than round. */
export function peakRaise(x: number, z: number): number {
  if (!MOUNTAIN || x < -78 || x > -16 || z > -238 || z < -286) return 0;
  let raise = 0;
  for (const p of PEAKS) {
    const r = Math.hypot(x - p.x, z - p.z) / p.radius; if (r > 2.2) continue;
    raise += p.height * Math.exp(-1.6 * r * r) * (.72 + .56 * mountainNoise(x * .21 + p.x, z * .21) * mountainNoise(x * .53 - 3, z * .53 + p.z));
  }
  // Limestone: blunt, broken tops, buttresses and bedding ledges every few metres of height.
  raise = raise > 20 ? 20 + (raise - 20) * .5 : raise;
  return raise + (.9 * Math.sin(raise * 1.15) + 6 * (mountainNoise(x * .38 + 5, z * .38) - .5)) * Math.min(1, raise / 8);
}
/** Couloir axis from its top between the peaks (t = 0) down to its fan just west of the plateau (t = 1), so it opens toward the
 *  plateau, which looks straight up it. */
const COULOIR = new THREE.CatmullRomCurve3([[-58, -268], [-53, -264], [-48, -260.5], [-43, -257], [-37.5, -253.5]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
const COULOIR_SAMPLES = COULOIR.getSpacedPoints(64);
const COULOIR_BOX = { minX: -74, maxX: -24, minZ: -280, maxZ: -238 };
/** Position along the couloir (t, 0 at the top) and distance from its axis (r, metres), or null well outside it. */
function couloirCoords(x: number, z: number): { t: number; r: number } | null {
  if (!MOUNTAIN || x < COULOIR_BOX.minX || x > COULOIR_BOX.maxX || z < COULOIR_BOX.minZ || z > COULOIR_BOX.maxZ) return null;
  let best = Infinity, t = 0;
  for (let i = 1; i < COULOIR_SAMPLES.length; i++) {
    const a = COULOIR_SAMPLES[i - 1], b = COULOIR_SAMPLES[i], dx = b.x - a.x, dz = b.z - a.z, k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - a.x - dx * k, z - a.z - dz * k); if (d < best) { best = d; t = (i - 1 + k) / (COULOIR_SAMPLES.length - 1); }
  }
  return { t, r: best };
}
/** The couloir's half-width: about 9 m at the top, narrowing to 5 m at the fan. */
const couloirHalf = (t: number): number => 9 - 4 * t;
/**
 * Metres the couloir cuts into the ridge and its peaks (≤ 0): a deep U between steep rock walls, deepest in its upper middle,
 * that fades out at the top and opens onto its fan.
 */
export function couloirCarve(x: number, z: number): number {
  const c = couloirCoords(x, z); if (!c) return 0;
  const half = couloirHalf(c.t); if (c.r >= half * 1.25) return 0;
  const depth = 13 * smooth(c.t, 0, .14) * (1 - .6 * smooth(c.t, .75, 1)), q = Math.min(1, c.r / (half * 1.25));
  return -depth * Math.pow(1 - q * q, 1.4);
}
/** Old snow, 0–1: a broad field in the upper couloir, about 14–18 m across at its top, tapering to a ragged, melting snout. */
export function snowCover(x: number, z: number): number {
  const c = couloirCoords(x, z); if (!c) return 0;
  const half = (8.5 - 5 * c.t) * (.82 + .36 * mountainNoise(x * .4 + 3, z * .4));
  const ends = smooth(c.t, .03, .09) * (1 - smooth(c.t, .62 + .1 * mountainNoise(x * .35, z * .35 + 9), .74));
  return ends * (1 - smooth(c.r, half * .6, half * 1.02));
}
/** Meltwater, 0–1: a dark wet runnel from the snout down the couloir's fan. */
export function meltwater(x: number, z: number): number {
  const c = couloirCoords(x, z); if (!c) return 0;
  return smooth(c.t, .7, .76) * (1 - smooth(c.r, .4 + .3 * mountainNoise(x, z), 1.5));
}
/**
 * Extra shade, 0–1, in the couloir's upper floor: with the default sun high in the south-west, the walls and peaks alone leave much
 * of the snow lit, so this deepens the shade toward the couloir's axis and top (mountains.ts multiplies it into the sun's term).
 */
export function couloirShade(x: number, z: number): number {
  const c = couloirCoords(x, z); if (!c) return 0;
  return .6 * (1 - smooth(c.r, couloirHalf(c.t) * .55, couloirHalf(c.t) * 1.15)) * (1 - smooth(c.t, .55, .85));
}
/** The ground the couloir's sun shade is baked for (mountains.ts ray-marches the terrain toward the sun there). */
export const COULOIR_SHADE_BOX = { minX: -72, maxX: -14, minZ: -290, maxZ: -232 } as const;

/** Everything sub-plan 27 does to the ridge's height at (x, z), given its height `h` there before: peaks, couloir, plateau, bench. */
export function mountainShape(x: number, z: number, h: number): number {
  if (!MOUNTAIN || z > -186) return h;
  h += hillRise(x, z) + peakRaise(x, z) + couloirCarve(x, z);
  const plateau = plateauMask(x, z);
  // The rim between meadow and crag is broken into buttresses and ledges rather than one smooth wall.
  if (plateau > 0) { const rim = 4 * plateau * (1 - plateau); h += (plateauHeight(x, z) - h) * plateau + rim * (10 * (mountainNoise(x * .45 + 11, z * .45) - .5) + 1.5 * Math.sin(h * .8)); }
  // The band of crags above the meadow: buttresses and bedding ledges rather than one smooth face.
  const band = smooth(-(z + 252), 0, 6) * smooth(x, -48, -40) * (1 - smooth(x, 14, 22)) * smooth(h, PLATEAU.level + 4, PLATEAU.level + 10);
  if (band > 0) h += band * (8 * (mountainNoise(x * .3 - 7, z * .3 + 2) - .5) + 1.8 * Math.sin(h * .75));
  const bench = trailBench(x, z); if (bench.weight > 0) h += (bench.level - h) * bench.weight;
  return h;
}
/** Ground the woodland leaves open: the trail and its signs, the plateau, the rocky peaks and the couloir. */
export function mountainClearing(x: number, z: number): boolean {
  if (!MOUNTAIN) return false;
  if (trailDistance(x, z) < TRAIL_HALF + 2.6 || Math.hypot(x - TRAILHEAD.x, z - TRAILHEAD.z) < 4.5) return true;
  if (plateauRadius(x, z) < 1.35 || peakRaise(x, z) > 4 || trailBench(x, z).weight > 0) return true;
  const c = couloirCoords(x, z); return !!c && c.r < couloirHalf(c.t) * 1.25 + 2;
}
