// Sub-plan 27: the Jepii Mici trail. Round 2 follows the owner's corrections and their own photographs of the real trail
// (3 October 2026): from the forbidden-trail board in the woods it climbs forested switchbacks to a rocky gorge cut along the foot
// of the north ridge's crags, enters it between two rock buttresses, follows its stream west past a waterfall falling from the
// plateau's lip, climbs a gully filled with old avalanche snow (the stream runs out from under the snow), and comes out on a shelf
// of rhododendron meadow below the crest's crags, which looks down over the gorge and the woods to the town. Plain fields with no
// terrain import, so terrain.ts, ground-cover.ts, forest-layout.ts, main.ts and the tests can all read them; mountain-trail.ts
// builds the signs, fences and boulders, alpine-plants.ts the meadow's plants, from the same layout.
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
const smooth = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------------------------------------------------------------
// The trail

/**
 * Centreline in plan: from the north garden path (under its paving) through the woods to the trailhead at the foot of the
 * forested slope, straight up it and in switchbacks up the wooded face, through the gorge's mouth between two buttresses and west
 * up the gorge, north up the snow gully, then east across the plateau to the barrier at the crags' foot; the worn line goes on
 * up into the rock beyond it.
 */
const TRAIL_POINTS: readonly (readonly [number, number])[] = [
  [-5, -158.6], [-6.5, -168], [-9, -177], [-11.5, -184.5], [-13, -190.5],
  [-15, -195.5], [-18.5, -200], [-24, -203.5], [-29.5, -206.5], [-23, -210.5], [-13, -214],
  [-20, -219], [-30, -222], [-38, -224.5], [-39.5, -227], [-34, -229], [-21, -231], [-10, -233.5],
  [-4.5, -237], [-3.5, -241.5], [-7.5, -245.5], [-15, -247.5], [-25, -248.5], [-35, -248], [-44, -248], [-50.5, -250],
  [-55.5, -254.5], [-59, -260.5], [-59.5, -267], [-56.5, -272.5], [-50, -275.5],
  [-43, -274.5], [-36, -275], [-31.5, -278.5], [-29.5, -284], [-28.5, -290], [-28, -296],
];
export const TRAIL_CURVE = new THREE.CatmullRomCurve3(TRAIL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
/** About one sample per metre along the trail. */
export const TRAIL_SAMPLES = TRAIL_CURVE.getSpacedPoints(Math.ceil(TRAIL_CURVE.getLength()));
/** Bare earth half-width; the worn, sparse-grass fringe reaches about a metre further. */
export const TRAIL_HALF = .65;
/** The trail sample nearest a plan point. */
function sampleNear(x: number, z: number): number {
  let best = 0; TRAIL_SAMPLES.forEach((p, k) => { if (Math.hypot(p.x - x, p.z - z) < Math.hypot(TRAIL_SAMPLES[best].x - x, TRAIL_SAMPLES[best].z - z)) best = k; });
  return best;
}
/**
 * The climb's stations by trail sample: the benched switchbacks start, the gorge's mouth and its narrow passage between the
 * buttresses, the gully's foot where the snow starts, its head where the trail comes out on the plateau, and the barrier.
 */
export const STAGE = (() => {
  const bench = TRAIL_SAMPLES.findIndex(p => p.z < -220), mouth = sampleNear(-4.5, -237.5), passage = sampleNear(-3.6, -241), waterfall = sampleNear(-18, -248);
  const snout = sampleNear(-52, -251.5), head = sampleNear(-50.5, -275.4), barrier = sampleNear(-31.2, -278);
  return { bench, mouth, passage, waterfall, snout, head, barrier };
})();
/** The walkable levels at those stations: the benched woods climb to the gorge's mouth, the gorge's floor to the snow, its surface to the plateau. */
const LEVEL = { bench: 9.8, mouth: 19.5, snout: 28.5 } as const;

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
/** Nearest trail position (sample index, fractional) and its distance, within 8 m; null further away or without the trail. */
export function trailNearest(x: number, z: number): { s: number; d: number } | null {
  if (!MOUNTAIN) return null;
  let d = REACH, s = -1; nearTrail(x, z, (distance, at) => { if (distance < d) { d = distance; s = at; } });
  return s < 0 ? null : { s, d };
}
/** Metres between trail samples (the curve's even spacing). */
const SPACING = TRAIL_CURVE.getLength() / (TRAIL_SAMPLES.length - 1);
/**
 * The trail's own frame at (x, z) within 6 m of it on the snow, for the boot prints on it (ground-material.ts): metres along the
 * trail, signed metres across it (+ to the right of the way up) and the trail's direction there. Null elsewhere.
 */
export function trailFrame(x: number, z: number): { along: number; across: number; dx: number; dz: number } | null {
  if (!MOUNTAIN) return null;
  let best = 6, frame: { along: number; across: number; dx: number; dz: number } | null = null;
  nearTrail(x, z, (d, s) => {
    if (d >= best || s < STAGE.snout - 4 || s > STAGE.head + 4) return;
    const i = Math.min(TRAIL_SAMPLES.length - 2, Math.floor(s)), a = TRAIL_SAMPLES[i], b = TRAIL_SAMPLES[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, dx = (b.x - a.x) / l, dz = (b.z - a.z) / l;
    const t = s - i, cx = a.x + (b.x - a.x) * t, cz = a.z + (b.z - a.z) * t;
    best = d; frame = { along: s * SPACING, across: (x - cx) * -dz + (z - cz) * dx, dx, dz };
  });
  return frame;
}
/** Worn soil along the trail, 0–1, for the ground cover bake: bare at the centre, fraying into the grass, gone past the barrier. */
export function trailWear(x: number, z: number): number {
  const near = trailNearest(x, z); if (!near || near.d >= 2.5) return 0;
  return (1 - smooth(near.d, TRAIL_HALF * .55, TRAIL_HALF + .75 + mountainNoise(x * .7, z * .7) * .45)) * .95 * (1 - smooth(near.s, STAGE.barrier - 1, STAGE.barrier + 1.5));
}
/**
 * The walking level along the trail from the switchbacks on: the bench rises evenly to the gorge's mouth, the gorge's floor to
 * the gully's foot, the snow's surface to the plateau; past the gully's head the plateau's own rolling meadow.
 */
export function trailLevel(s: number): number {
  if (s <= STAGE.mouth) return lerp(LEVEL.bench, LEVEL.mouth, clamp((s - STAGE.bench) / (STAGE.mouth - STAGE.bench), 0, 1));
  if (s <= STAGE.snout) return lerp(LEVEL.mouth, LEVEL.snout, (s - STAGE.mouth) / (STAGE.snout - STAGE.mouth));
  const head = TRAIL_SAMPLES[STAGE.head], top = plateauHeight(head.x, head.z);
  if (s <= STAGE.head) return lerp(LEVEL.snout, top, (s - STAGE.snout) / (STAGE.head - STAGE.snout));
  const p = TRAIL_CURVE.getPointAt(Math.min(1, s / (TRAIL_SAMPLES.length - 1))); return plateauHeight(p.x, p.z);
}
/**
 * The switchbacks are benched into the wooded face: within 1.8 m of the centreline the ground is the bench's level, blending back
 * into the hillside by 4.2 m (cut above, fill below), wide enough for the two-metre terrain grid to resolve. Nearby legs blend by
 * distance, so switchbacks never step. Returns the weight (0–1) and the level.
 */
export function trailBench(x: number, z: number): { weight: number; level: number } {
  if (!MOUNTAIN || z > -214 || z < -246) return { weight: 0, level: 0 };
  let weight = 0, sum = 0, total = 0;
  nearTrail(x, z, (d, s) => {
    if (s < STAGE.bench - 6 || s > STAGE.mouth + 3) return;
    const w = (1 - smooth(d, 1.8, 4.2)) * smooth(s, STAGE.bench - 6, STAGE.bench) * (1 - smooth(s, STAGE.mouth, STAGE.mouth + 3));
    if (w <= 0) return;
    weight = Math.max(weight, w); sum += w * trailLevel(s); total += w;
  });
  return { weight, level: total ? sum / total : 0 };
}

/**
 * The danger board hangs across the trail here, at the foot of the forested slope (`hillRise`), facing walkers coming up from
 * the town; `index` is its trail sample, yaw follows Object3D.rotation.y (local -z points up the trail).
 */
export const TRAILHEAD = (() => {
  const index = sampleNear(-13, -190.5), p = TRAIL_SAMPLES[index], a = TRAIL_SAMPLES[index - 2], b = TRAIL_SAMPLES[index + 2];
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

// ---------------------------------------------------------------------------------------------------------------------
// The plateau: a shelf of meadow below the crest's crags

/** The plateau's outline in plan, west to east along its lip over the gorge and back along the crags' foot. */
// Its lip runs along the gorge's north wall (gorgeShape cuts that wall down to the floor), so the meadow ends in a clean cliff.
const PLATEAU_OUTLINE: readonly (readonly [number, number])[] = [
  [-46, -252.5], [-35, -251.6], [-25, -252.1], [-15, -251.2], [-9, -250], [-3, -253], [1, -259.5], [2, -267], [-3, -275.5], [-14, -280],
  [-27, -282], [-39, -281], [-47, -280.5], [-54, -277], [-55.5, -271], [-51.5, -262], [-49.5, -255.5],
];
/**
 * Points round the plateau's edge about `spacing` metres apart, moved `inset` metres in from it, each with the outward direction:
 * the rope fence follows them along the lip.
 */
export function plateauRim(inset: number, spacing = 3): { x: number; z: number; out: { x: number; z: number } }[] {
  const points: { x: number; z: number; out: { x: number; z: number } }[] = [];
  for (let i = 0; i < PLATEAU_OUTLINE.length; i++) {
    const [ax, az] = PLATEAU_OUTLINE[i], [bx, bz] = PLATEAU_OUTLINE[(i + 1) % PLATEAU_OUTLINE.length], length = Math.hypot(bx - ax, bz - az);
    for (let k = 0; k < Math.max(1, Math.round(length / spacing)); k++) {
      const t = k / Math.max(1, Math.round(length / spacing)), x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const gx = plateauInside(x + .5, z) - plateauInside(x - .5, z), gz = plateauInside(x, z + .5) - plateauInside(x, z - .5), g = Math.hypot(gx, gz) || 1;
      points.push({ x: x + gx / g * inset, z: z + gz / g * inset, out: { x: -gx / g, z: -gz / g } });
    }
  }
  return points;
}
/** Its bounds: centre and half-extents (for sampling), the meadow's level at its lip over the gorge and how much it rises to the crags. */
export const PLATEAU = { x: -24.5, z: -268.4, a: 26.5, b: 13.6, level: 41, rise: 5.5 } as const;
/** Signed distance in plan from the plateau's outline, metres: positive inside. */
export function plateauInside(x: number, z: number): number {
  let inside = false, nearest = Infinity;
  for (let i = 0, j = PLATEAU_OUTLINE.length - 1; i < PLATEAU_OUTLINE.length; j = i++) {
    const [ax, az] = PLATEAU_OUTLINE[j], [bx, bz] = PLATEAU_OUTLINE[i], dx = bx - ax, dz = bz - az;
    if ((az > z) !== (bz > z) && x < ax + (z - az) / dz * dx) inside = !inside;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); nearest = Math.min(nearest, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  // The outline wanders a little, so the meadow's edge is not a polygon.
  return (inside ? nearest : -nearest) + 1.2 * (mountainNoise(x * .21 + 4, z * .21 - 9) - .5);
}
/** Normalised depth into the plateau: 0 well inside (12 m from its edge), 1 at its edge, more outside. */
export function plateauRadius(x: number, z: number): number {
  if (!MOUNTAIN || Math.abs(x - PLATEAU.x) > PLATEAU.a + 20 || Math.abs(z - PLATEAU.z) > PLATEAU.b + 20) return 3;
  return 1 - Math.min(1, plateauInside(x, z) / 12);
}
/** How fully the plateau claims the ground, 0–1: whole from 2.5 m inside its edge, giving way to the crags and slopes outside. */
export function plateauMask(x: number, z: number): number {
  if (!MOUNTAIN || Math.abs(x - PLATEAU.x) > PLATEAU.a + 6 || Math.abs(z - PLATEAU.z) > PLATEAU.b + 6) return 0;
  return smooth(plateauInside(x, z), -1.2, 2.5);
}
/** The meadow's level: gently rolling, rising about 5.5 m from its lip over the gorge to the crags at its back. */
export function plateauHeight(x: number, z: number): number {
  return PLATEAU.level + PLATEAU.rise * smooth(-(z - PLATEAU.z) / PLATEAU.b, -1, 1) + 1.6 * (mountainNoise(x * .13 + 3, z * .13 - 5) - .5) + .6 * (mountainNoise(x * .4, z * .4 + 2) - .5);
}
/** First trail sample on the plateau: the gully's head. */
export const TRAIL_ENTRY = STAGE.head;
/**
 * Where the trail leaves the plateau's back for the crags, a log barrier closes it: the walkable trail ends on the plateau; the
 * worn line goes on up into the rock. Yaw as TRAILHEAD's: local -z points up the trail.
 */
export const TRAIL_BARRIER = (() => {
  const index = STAGE.barrier, p = TRAIL_SAMPLES[index], a = TRAIL_SAMPLES[index - 2], b = TRAIL_SAMPLES[index + 2];
  return { index, x: p.x, z: p.z, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
})();
/** The last trail sample before the barrier: the walkable top, on the plateau. */
export const TRAIL_TOP = TRAIL_SAMPLES[TRAIL_BARRIER.index - 1];

// ---------------------------------------------------------------------------------------------------------------------
// The gorge: its mouth, the canyon west along the crags' foot and the snow gully up to the plateau

/** The gorge's axis: the trail from just before its mouth to just past the gully's head, indexed for distance queries. */
const GORGE_FROM = STAGE.mouth - 8, GORGE_TO = STAGE.head + 6, GORGE_REACH = 32, gorgeBins = new Map<string, number[]>();
for (let i = GORGE_FROM + 1; i <= GORGE_TO; i++) {
  const a = TRAIL_SAMPLES[i - 1], b = TRAIL_SAMPLES[i];
  for (let x = Math.floor((Math.min(a.x, b.x) - GORGE_REACH) / CELL); x <= Math.floor((Math.max(a.x, b.x) + GORGE_REACH) / CELL); x++)
    for (let z = Math.floor((Math.min(a.z, b.z) - GORGE_REACH) / CELL); z <= Math.floor((Math.max(a.z, b.z) + GORGE_REACH) / CELL); z++) {
      const key = `${x},${z}`, bucket = gorgeBins.get(key); if (bucket) bucket.push(i); else gorgeBins.set(key, [i]);
    }
}
/** Position along the gorge (trail sample s), distance from its axis (d) and side (+1 left of the way up, -1 right), or null. */
export function gorgeCoords(x: number, z: number): { s: number; d: number; side: number } | null {
  if (!MOUNTAIN) return null;
  let best = GORGE_REACH, s = -1, side = 1;
  for (const i of gorgeBins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const a = TRAIL_SAMPLES[i - 1], b = TRAIL_SAMPLES[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1))), ex = x - a.x - dx * t, ez = z - a.z - dz * t, d = Math.hypot(ex, ez);
    if (d < best) { best = d; s = i - 1 + t; side = dx * ez - dz * ex > 0 ? -1 : 1; }
  }
  return s < 0 ? null : { s, d: best, side };
}
/** The gorge floor's half-width: a narrow passage between the buttresses, the canyon, a pool under the waterfall, the broad gully. */
export function gorgeHalf(s: number): number {
  const passage = 1 - smooth(Math.abs(s - STAGE.passage), 2, 6), pool = 1 - smooth(Math.abs(s - STAGE.waterfall), 2, 6);
  const gully = smooth(s, STAGE.snout - 6, STAGE.snout + 3) * (1 - smooth(s, STAGE.head - 9, STAGE.head + 1));
  return 3.4 - .9 * passage + 1.1 * pool + 2.4 * gully + .5 * (mountainNoise(s * .23, 7) - .5);
}
/** Old snow's depth over the gully's rock floor on its axis: thickening from the snout, thinning out below the head. */
export function snowDepth(s: number): number {
  return 1.7 * smooth(s, STAGE.snout, STAGE.snout + 7) * (1 - smooth(s, STAGE.head - 9, STAGE.head - 1));
}
/** The gorge's rock floor along its axis (the trail's level less the snow on it). */
const gorgeFloor = (s: number): number => trailLevel(s) - snowDepth(s);
/** How far the gorge's walls stand at least above its floor, by side: the built rib south of the canyon, both gully walls. */
function gorgeWall(s: number, side: number): number {
  const into = smooth(s, STAGE.mouth - 4, STAGE.mouth + 1) * (1 - smooth(s, STAGE.head - 6, STAGE.head + 2));
  // Walking up the canyon (west) the crags stand on the right (north); the rib on the left is built where the slope falls away.
  return into * (s < STAGE.snout ? (side > 0 ? 9.5 : 6) : 11) * (.8 + .4 * mountainNoise(s * .17, side * 5));
}
/** The steep run of each wall from the floor's edge, metres: near-vertical at the waterfall and in the passage. */
// The two-metre terrain grid can only draw a wall it samples three times across: steeper ones alias into rows of fins along a
// diagonal rim. Sheer rock comes from the crag blocks set on these faces (crags.ts).
const wallRun = (s: number): number => 5.6 - 1.8 * Math.max(1 - smooth(Math.abs(s - STAGE.passage), 2, 6), 1 - smooth(Math.abs(s - STAGE.waterfall), 3, 7));
/**
 * The gorge cut into the ridge (and its rib built where the slope falls away), given the height `h` before it: inside the floor,
 * the rock floor plus old snow (a shallow dome across the gully); a steep wall up to at least the wall height; then the rib tapers
 * back into the hillside. Fades in at the mouth and out onto the plateau at the gully's head.
 */
function gorgeShape(x: number, z: number, h: number): number {
  const g = gorgeCoords(x, z); if (!g) return h;
  const { s, d, side } = g, half = gorgeHalf(s), floor = gorgeFloor(s), run = wallRun(s), depth = snowDepth(s);
  const ends = smooth(s, GORGE_FROM + 2, STAGE.mouth - 1) * (1 - smooth(s, STAGE.head + 1, GORGE_TO - 1));
  const top = Math.max(h, floor + gorgeWall(s, side) + depth), q = d / half, snowHalf = half * (.88 + .3 * mountainNoise(x * .45 + 3, z * .45));
  // Old snow lies as a slab, flat across and ending in a steep, ragged edge short of the walls (the paint's own edge, snowCover).
  const cross = depth * (1 - smooth(d, snowHalf * .64, snowHalf * .9)) + .25 * (mountainNoise(x * .5, z * .5) - .5) * smooth(q, .4, 1);
  let target: number;
  if (d <= half) target = floor + cross;
  else if (d <= half + run) target = lerp(floor, top, Math.pow(smooth(d, half, half + run), .7));
  else target = lerp(top, h, smooth(d, half + run, half + run + 9));
  return lerp(h, target, ends);
}
/** Ground of the gorge's floor (scree and snow, no grass), 0–1. */
export function gorgeFloorCover(x: number, z: number): number {
  const g = gorgeCoords(x, z); if (!g || g.s < STAGE.mouth - 2 || g.s > STAGE.head) return 0;
  return (1 - smooth(g.d, gorgeHalf(g.s) - .3, gorgeHalf(g.s) + .8)) * smooth(g.s, STAGE.mouth - 2, STAGE.mouth + 1);
}
/** The two rock buttresses either side of the gorge's mouth: centre, radius and how far each rises above the slope. */
const BUTTRESSES = [{ x: -9.8, z: -240.2, radius: 4.6, height: 8 }, { x: 3.4, z: -240.5, radius: 5, height: 6 }] as const;
function buttressRaise(x: number, z: number): number {
  let raise = 0;
  for (const b of BUTTRESSES) { const r = Math.hypot(x - b.x, z - b.z) / b.radius; if (r < 2) raise += b.height * Math.exp(-1.6 * r ** 3) * (.8 + .4 * mountainNoise(x * .35 + b.x, z * .35)); }
  return raise;
}

// ---------------------------------------------------------------------------------------------------------------------
// Old avalanche snow, the meltwater and the shade in the gully

/** Old snow, 0–1: filling the gully's floor from its snout up to just below its head, with ragged, melting edges. */
export function snowCover(x: number, z: number): number {
  const g = gorgeCoords(x, z); if (!g || g.s < STAGE.snout - 2 || g.s > STAGE.head) return 0;
  const half = gorgeHalf(g.s) * (.88 + .3 * mountainNoise(x * .45 + 3, z * .45)), ends = smooth(g.s, STAGE.snout - 1 + 2 * mountainNoise(x * .4, z * .4 + 9), STAGE.snout + 1.5) * (1 - smooth(g.s, STAGE.head - 5, STAGE.head - 1.5));
  return ends * (1 - smooth(g.d, half * .62, half * .86));
}
/** Meltwater, 0–1: a dark wet band along the gorge's floor below the snout, where its stream runs. */
export function meltwater(x: number, z: number): number {
  const g = gorgeCoords(x, z); if (!g || g.s > STAGE.snout + 1 || g.s < STAGE.mouth + 4) return 0;
  // The stream keeps to the crags' side of the floor, clear of the trail, and sinks among boulders before the mouth.
  const off = Math.abs(g.d * g.side + gorgeHalf(g.s) * .55);
  return smooth(g.s, STAGE.mouth + 4, STAGE.mouth + 9) * (1 - smooth(off, .5 + .3 * mountainNoise(x, z), 1.5));
}
/**
 * Extra shade, 0–1, on the gully's snow: the default sun is high in the south-west, so the walls alone leave much of the floor lit;
 * this deepens the shade toward its axis and upper part (mountains.ts multiplies it into the sun's term).
 */
export function couloirShade(x: number, z: number): number {
  const g = gorgeCoords(x, z); if (!g || g.s < STAGE.snout - 4 || g.s > STAGE.head) return 0;
  return .45 * (1 - smooth(g.d, gorgeHalf(g.s) * .5, gorgeHalf(g.s) * 1.2)) * smooth(g.s, STAGE.snout - 4, STAGE.snout + 8) * (1 - smooth(g.s, STAGE.head - 8, STAGE.head - 2));
}
/** The ground the gully's sun shade is baked for (mountains.ts ray-marches the terrain toward the sun there). */
export const COULOIR_SHADE_BOX = { minX: -74, maxX: -38, minZ: -284, maxZ: -244 } as const;

/**
 * How much the ridges' erosion (sub-plan 26) gives way to the gorge's walls and the plateau's crags, 0–1. Its finest gullies are a
 * few metres across, at the two-metre grid's limit: cut open by the gorge they stood along its rims as rows of thin fins.
 */
export function mountainCalm(x: number, z: number): number {
  if (!MOUNTAIN || z > -205 || z < -305 || x < -95 || x > 35) return 0;
  const g = gorgeCoords(x, z), edge = g ? gorgeHalf(g.s) + wallRun(g.s) : 0, gorge = g ? 1 - smooth(g.d, edge + 9, edge + 19) : 0;
  return Math.max(gorge * smooth(g?.s ?? 0, STAGE.mouth - 8, STAGE.mouth - 2), smooth(plateauInside(x, z), -16, -5));
}

// ---------------------------------------------------------------------------------------------------------------------
// The water: the gorge's stream from under the snow, the plateau's brook and its waterfall into the gorge (mountain-water.ts)

/** A plan point `offset` metres to the right (+, north in the westward gorge) or left of trail sample `s`. */
export function besideTrail(s: number, offset: number): { x: number; z: number } {
  const i = Math.min(TRAIL_SAMPLES.length - 2, Math.max(0, Math.floor(s))), p = TRAIL_CURVE.getPointAt(Math.min(1, s / (TRAIL_SAMPLES.length - 1))), q = TRAIL_SAMPLES[i + 1], o = TRAIL_SAMPLES[i], l = Math.hypot(q.x - o.x, q.z - o.z) || 1;
  return { x: p.x - (q.z - o.z) / l * offset, z: p.z + (q.x - o.x) / l * offset };
}
/**
 * The gorge's stream in plan, downhill: out from under the snow's snout on the crags' side of the floor (where `meltwater` wets
 * it), down the gorge clear of the trail, sinking among boulders before the mouth. Heights: the ground's (terrainSurfaceHeight).
 */
export const GORGE_STREAM = (() => {
  const points: { x: number; z: number }[] = [];
  for (let s = STAGE.snout + 1; s >= STAGE.mouth + 7; s -= 1.5) points.push(besideTrail(s, gorgeHalf(s) * .55));
  return points;
})();
/** The waterfall: from the plateau's lip above the gorge's pool to the pool's edge at the wall's foot, in plan. */
export const WATERFALL = { lip: besideTrail(STAGE.waterfall, gorgeHalf(STAGE.waterfall) + wallRun(STAGE.waterfall) + .2), foot: besideTrail(STAGE.waterfall, gorgeHalf(STAGE.waterfall) * .72) } as const;
/** The plateau's brook in plan, downhill: from a spring at the crags' foot across the meadow to the waterfall's lip. */
export const PLATEAU_STREAM = (() => {
  const spring = { x: WATERFALL.lip.x + 1.5, z: -279.2 }, points: { x: number; z: number }[] = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; points.push({ x: spring.x + (WATERFALL.lip.x - spring.x) * t + 1.1 * Math.sin(t * 7.5) * (1 - t * t), z: spring.z + (WATERFALL.lip.z - spring.z) * t }); }
  return points;
})();
/** Distance in plan from the plateau's brook (8 m at most): mats and flowers keep off it. */
export function brookDistance(x: number, z: number): number {
  let best = 8;
  for (let i = 1; i < PLATEAU_STREAM.length; i++) {
    const a = PLATEAU_STREAM[i - 1], b = PLATEAU_STREAM[i], dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------
// The whole shape

/**
 * Everything sub-plan 27 does to the ridge's height at (x, z), given its height `h` there before: the slope behind the board, the
 * buttresses, the plateau's shelf with the crest's crags behind it, the gorge and the bench.
 */
export function mountainShape(x: number, z: number, h: number): number {
  if (!MOUNTAIN || z > -186) return h;
  h += hillRise(x, z) + buttressRaise(x, z);
  const plateau = plateauMask(x, z);
  if (plateau > 0) {
    // Cut into the face: the meadow's level, its edge broken into buttresses and ledges rather than one smooth wall.
    const rim = 4 * plateau * (1 - plateau);
    h += (plateauHeight(x, z) - h) * plateau + rim * 3 * (mountainNoise(x * .16 + 11, z * .16) - .5);
  }
  // The crest's crags above the meadow: bedding ledges and buttresses rather than one smooth face.
  const band = smooth(-(z + 276), 0, 6) * smooth(x, -62, -50) * (1 - smooth(x, 6, 16)) * smooth(h, PLATEAU.level + 8, PLATEAU.level + 14);
  if (band > 0) h += band * (6 * (mountainNoise(x * .12 - 7, z * .12 + 2) - .5) + 1.4 * Math.sin(h * .5));
  h = gorgeShape(x, z, h);
  const bench = trailBench(x, z); if (bench.weight > 0) h += (bench.level - h) * bench.weight;
  return h;
}

/**
 * Ground past the walking bound (z = -225) that main.ts does not reset: the benched switchbacks, the gorge, the gully and the
 * plateau. Walls, crags and the plateau's slopes keep walkers inside it (tests/mountain-trail.test.ts).
 */
export function trailCorridor(x: number, z: number): boolean {
  if (!MOUNTAIN || z > -215 || z < -290 || x < -72 || x > 14) return false;
  if (plateauInside(x, z) > -3 || trailDistance(x, z) < 6) return true;
  const g = gorgeCoords(x, z); return !!g && g.d < gorgeHalf(g.s) + wallRun(g.s) + 2;
}
/** Ground the woodland leaves open: the trail and its signs, the plateau, the gorge with its walls, the crags above the meadow. */
export function mountainClearing(x: number, z: number): boolean {
  if (!MOUNTAIN) return false;
  if (trailDistance(x, z) < TRAIL_HALF + 2.6 || Math.hypot(x - TRAILHEAD.x, z - TRAILHEAD.z) < 4.5) return true;
  if (plateauInside(x, z) > -6 || (z < -274 && x > -64 && x < 12)) return true;
  if (BUTTRESSES.some(b => Math.hypot(x - b.x, z - b.z) < b.radius * 1.4)) return true;
  const g = gorgeCoords(x, z); return !!g && g.d < gorgeHalf(g.s) + wallRun(g.s) + 4.5;
}

/** The HUD's place name along the trail, by stage (null off it): the woods, the gorge, the snow gully, the plateau. */
export function mountainPlace(x: number, z: number): string | null {
  if (!MOUNTAIN || z > -180) return null;
  if (plateauInside(x, z) > -2) return 'Jepii Mici · Rhododendron Plateau';
  const g = gorgeCoords(x, z);
  if (g && g.d < gorgeHalf(g.s) + 4) return g.s >= STAGE.snout - 1 ? 'Jepii Mici · Snow Gully' : g.s >= STAGE.mouth - 2 ? 'Jepii Mici · Rocky Gorge' : 'Jepii Mici · Forest Trail';
  const near = trailNearest(x, z);
  return near && near.s >= TRAILHEAD.index - 8 && near.d < 8 ? 'Jepii Mici · Forest Trail' : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The meadow's plants (alpine-plants.ts) and its turf

/** How strongly the alpine meadow claims a point, 0–1: the plateau, kept free of trees. */
export function driftEnvelope(x: number, z: number): number { return plateauMask(x, z); }
/**
 * Bright alpine turf, 0–1: the plateau's meadow, never on the trail, which keeps its bare earth. The ground material paints it
 * (`groundPaint.x`) so no soil shows between the plants.
 */
export function turfCover(x: number, z: number): number {
  if (!MOUNTAIN) return 0;
  const meadow = smooth(plateauInside(x, z), -.5, 2); if (meadow < .01) return 0;
  return meadow * smooth(trailDistance(x, z), TRAIL_HALF + .15, TRAIL_HALF + 1);
}
/** Rhododendron density, 0–1: drifts across the meadow, off the trail and back from its edge. */
export function bloomDensity(x: number, z: number): number {
  if (!MOUNTAIN) return 0;
  const inside = plateauInside(x, z); if (inside < 1.5) return 0;
  const patches = mountainNoise(x * .16 + 4.1, z * .16 - 2.3) * .65 + mountainNoise(x * .55 - 7, z * .55 + 1.7) * .35;
  return smooth(patches, .3, .62) * smooth(inside, 1.5, 4) * smooth(trailDistance(x, z), TRAIL_HALF + .6, TRAIL_HALF + 1.8) * smooth(brookDistance(x, z), .9, 2);
}
