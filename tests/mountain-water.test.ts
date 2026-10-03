import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GORGE_FALL, SNOW_CAVE, brookCourse, createGorgeWater, createStream, createWaterfall, foamTexture, gorgeStreamCourse, snowCaveGeometry, sprayGeometry, streamGeometry, streamWhite, waterfallClearance, waterfallGeometry } from '../src/world/mountain-water';
import type { Point3, WaterfallSpec } from '../src/world/mountain-water';
import { GORGE_STREAM, PLATEAU_STREAM, STAGE, TRAIL_HALF, TRAIL_SAMPLES, WATERFALL, gorgeCoords, snowCover, trailDistance } from '../src/world/mountain-layout';
import { terrainSurfaceHeight } from '../src/world/terrain';

const finite = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): boolean => Array.from(attribute.array as ArrayLike<number>).every(Number.isFinite);
/** Distance in plan from (x, z) to a polyline. */
function planDistance(points: readonly Point3[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, , az] = points[i - 1], [bx, , bz] = points[i], dx = bx - ax, dz = bz - az, t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

describe('mountain stream ribbon', () => {
  // A slope falling toward +z: gentle for 12 m, then a 40° step, then gentle again; the stream runs straight down it.
  const ground = (_x: number, z: number): number => z < 12 ? -.08 * z : z < 18 ? -.96 - .84 * (z - 12) : -6 - .08 * (z - 18);
  const points: Point3[] = [0, 4, 8, 12, 15, 18, 22, 26].map(z => [Math.sin(z * .2) * .6, ground(0, z), z]);
  const width = (t: number): number => .6 + t;
  for (const tier of ['gpu', 'mobile', 'cpu'] as const) it(`follows its points on the ground with the given widths (${tier})`, () => {
    const geometry = streamGeometry(points, width, tier, { ground }), position = geometry.getAttribute('position'), across = geometry.getAttribute('across');
    const flow = geometry.getAttribute('flow'), along = geometry.getAttribute('along'), depth = geometry.getAttribute('depth'), wet = geometry.getAttribute('wet'), rock = geometry.getAttribute('rock');
    for (const name of ['position', 'normal', 'flow', 'along', 'across', 'depth', 'rock', 'wet']) { expect(geometry.getAttribute(name).count).toBe(position.count); expect(finite(geometry.getAttribute(name))).toBe(true); }
    expect(!!geometry.getAttribute('color')).toBe(tier === 'cpu');
    const bank = tier === 'cpu' ? 0 : .38 * 1.25;
    let edges = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i), a = Math.abs(across.getX(i));
      // On its centreline's plan within half its widest width plus the bank, and lying on the ground, at most its depth above it.
      expect(planDistance(points, x, z)).toBeLessThan(.8 + bank + .05);
      expect(y).toBeGreaterThanOrEqual(ground(x, z) + .01);
      expect(y).toBeLessThanOrEqual(ground(x, z) + .08 + 1.6 * .1 + .02);
      // Downstream (+z), unit length.
      expect(Math.hypot(flow.getX(i), flow.getY(i))).toBeCloseTo(1, 5); expect(flow.getY(i)).toBeGreaterThan(.8);
      expect(depth.getX(i)).toBeGreaterThanOrEqual(0); expect(wet.getX(i)).toBeGreaterThanOrEqual(0); expect(wet.getX(i)).toBeLessThanOrEqual(1);
      expect(rock.getX(i)).toBeGreaterThanOrEqual(0); expect(rock.getX(i)).toBeLessThanOrEqual(1);
      if (wet.getX(i) < 1) { expect(depth.getX(i)).toBe(0); edges++; }
      else expect(a).toBeLessThanOrEqual(.8 + 1e-4);
    }
    if (tier !== 'cpu') expect(edges).toBeGreaterThan(0);
    // Rows: `along` grows downstream, and the outermost water columns sit at plus and minus half the width there.
    const columns = tier === 'gpu' ? 11 : tier === 'mobile' ? 7 : 4, rows = position.count / columns, water = tier === 'gpu' ? [2, 8] : tier === 'mobile' ? [1, 5] : [0, 3];
    expect(Number.isInteger(rows)).toBe(true);
    for (let k = 1; k < rows; k++) expect(along.getX(k * columns)).toBeGreaterThan(along.getX((k - 1) * columns));
    for (const k of [0, Math.floor(rows / 2), rows - 1]) {
      const t = k / (rows - 1), left = across.getX(k * columns + water[0]), right = across.getX(k * columns + water[1]);
      expect(right).toBeCloseTo(width(t) / 2, 4); expect(left).toBeCloseTo(-width(t) / 2, 4);
      expect(depth.getX(k * columns + water[0])).toBe(0); expect(depth.getX(k * columns + water[1])).toBe(0);
    }
  });
  it('turns white where the bed steepens and stays clear where it is gentle', () => {
    const geometry = streamGeometry(points, .8, 'gpu', { ground }), position = geometry.getAttribute('position'), rock = geometry.getAttribute('rock'), across = geometry.getAttribute('across');
    const middle = (from: number, to: number): number => { let sum = 0, n = 0; for (let i = 0; i < position.count; i++) if (Math.abs(across.getX(i)) < .05 && position.getZ(i) > from && position.getZ(i) < to) { sum += rock.getX(i); n++; } return sum / n; };
    expect(middle(13.5, 16.5)).toBeGreaterThan(.8); expect(middle(1, 7)).toBeLessThan(.15); expect(middle(21, 25)).toBeLessThan(.15);
    expect(streamWhite(0, 0)).toBe(0); expect(streamWhite(1, 0)).toBe(1); expect(streamWhite(.4, .3)).toBeGreaterThan(streamWhite(.4, 0));
  });
  it('is one draw of the river shader on the shared clock, with no colliders to add', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
      const mesh = createStream(points, .8, tier, { ground }), material = mesh.material as THREE.Material;
      expect(mesh.name).toBe('Mountain stream'); expect(mesh.userData.keepGeometry).toBe(true); expect(material.name).toBe('Mountain stream');
      if (tier === 'cpu') { expect(material).toBeInstanceOf(THREE.MeshLambertMaterial); expect(material.transparent).toBe(false); continue; }
      expect((material as THREE.MeshPhysicalNodeMaterial).isMeshPhysicalNodeMaterial).toBe(true); expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
      expect(material.userData.heroEnv).toBe(true); expect(material.userData.look).toBe('stream');
      const lighting = (material as unknown as { setupLightingModel(): THREE.PhysicalLightingModel }).setupLightingModel();
      expect(lighting.constructor.name).toBe('WaterLighting');
    }
  });
});

describe('mountain waterfall', () => {
  // A 24 m cliff facing +z at z = 0, a plateau below it falling gently away, and a bowl round the foot.
  const cliff = (x: number, z: number): number => z < 0 ? 24 : z < 1.5 ? 24 * (1 - z / 1.5) : -.05 * (z - 1.5);
  const spec: WaterfallSpec = { lip: [0, 24.1, -.3], ledge: [0, 12, .9], foot: [0, .05, 3], width: 2, ground: cliff };
  for (const tier of ['gpu', 'mobile', 'cpu'] as const) it(`hangs in front of the rock from lip to pool, widening as it falls (${tier})`, () => {
    const geometry = waterfallGeometry(spec, tier), position = geometry.getAttribute('position'), fall = geometry.getAttribute('fall'), water = geometry.getAttribute('water');
    for (const name of ['position', 'normal', 'fall', 'water']) { expect(geometry.getAttribute(name).count).toBe(position.count); expect(finite(geometry.getAttribute(name))).toBe(true); }
    expect(!!geometry.getAttribute('color')).toBe(tier === 'cpu');
    let top = -Infinity, bottom = Infinity, sheet = 0, pool = 0, topWidth = 0, footWidth = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      if (water.getX(i) > .5) { pool++; expect(water.getY(i)).toBeGreaterThanOrEqual(0); continue; }
      sheet++; top = Math.max(top, y); bottom = Math.min(bottom, y);
      // Above the pool the sheet keeps clear of the rock; below it, it sinks into water or ground on purpose.
      if (y > spec.foot[1] + .01) expect(cliff(x, z)).toBeLessThanOrEqual(y - waterfallClearance(y, spec.foot[1]) + .01);
      expect(fall.getY(i)).toBeGreaterThanOrEqual(0); expect(fall.getZ(i)).toBeGreaterThanOrEqual(0); expect(fall.getZ(i)).toBeLessThanOrEqual(1);
      if (Math.abs(y - 24.1) < 1e-3) topWidth = Math.max(topWidth, Math.abs(fall.getX(i)) / Math.max(fall.getW(i), 1e-6));
      if (Math.abs(y - spec.foot[1]) < 1e-3) footWidth = Math.max(footWidth, Math.abs(fall.getX(i)) / Math.max(fall.getW(i), 1e-6));
    }
    expect(sheet).toBeGreaterThan(100); expect(pool).toBeGreaterThan(50);
    expect(top).toBeCloseTo(24.1, 3); expect(bottom).toBeLessThan(spec.foot[1] - 1);
    // Half-widths: the lip's, and the foot's at the default spread of 2.2 plus the splash where it lands.
    expect(topWidth).toBeCloseTo(1, 2); expect(footWidth).toBeGreaterThan(2.2); expect(footWidth).toBeLessThan(2.2 * 1.25);
  });
  it('time runs on as the water accelerates, so the foam streaks lengthen as it falls', () => {
    const geometry = waterfallGeometry({ ...spec, ledge: undefined }, 'gpu'), position = geometry.getAttribute('position'), fall = geometry.getAttribute('fall'), water = geometry.getAttribute('water');
    const rows = new Map<number, number>();
    for (let i = 0; i < position.count; i++) if (water.getX(i) < .5) rows.set(+position.getY(i).toFixed(3), fall.getY(i));
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (let k = 1; k < sorted.length; k++) expect(sorted[k][1]).toBeGreaterThanOrEqual(sorted[k - 1][1]);
    // Free fall from 1.6 m/s over 24 m takes about 1.9 s.
    const landed = sorted.find(([y]) => Math.abs(y - spec.foot[1]) < 1e-3)![1]; expect(landed).toBeGreaterThan(1.7); expect(landed).toBeLessThan(2.3);
  });
  it('stands level in a hollow or over flat ground, and thins to a film where the ground falls away', () => {
    // The pool (radius 3 here) is centred a little out from the foot. A bowl round it holds water 0.12 m deep; flat ground a
    // hand below the level makes a shallow pool; a 1-in-3 slope falling away from the foot leaves only a film.
    const bowl = (x: number, z: number): number => z < -1 ? 24 : .03 * ((x * x + (z - 3.6) * (z - 3.6)) - 4);
    const flatFloor = (_x: number, z: number): number => z < -1 ? 24 : -.1, slope = (_x: number, z: number): number => z < -1 ? 24 : -.33 * Math.max(0, z - 2);
    for (const [ground, level] of [[bowl, 0], [flatFloor, 0], [slope, 0]] as const) {
      const geometry = waterfallGeometry({ ...spec, ledge: undefined, foot: [0, level, 3], pool: 3, ground }, 'gpu'), position = geometry.getAttribute('position'), water = geometry.getAttribute('water');
      let flat = 0, film = 0;
      for (let i = 0; i < position.count; i++) {
        if (water.getX(i) < .5) continue;
        const y = position.getY(i), g = ground(position.getX(i), position.getZ(i));
        if (Math.abs(y - level) < 1e-4 && g < level - .05) flat++; else if (Math.abs(y - g - .03) < 1e-4) film++;
        // Never more than a film over ground above the level, nor a sheet floating over ground that falls away.
        expect(y).toBeLessThanOrEqual(Math.max(level, g + .03) + 1e-4); expect(y - g).toBeLessThanOrEqual(Math.max(.3, level - g) + 1e-4);
      }
      if (ground === slope) { expect(film).toBeGreaterThan(flat); } else expect(flat).toBeGreaterThan(film);
    }
  });
  it('is at most two draws: sheet and pool, then mist on gpu and mobile only; lit, never emissive', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
      const fall = createWaterfall(spec, tier), sheet = fall.sheet.material as THREE.MeshStandardMaterial;
      expect(fall.sheet.name).toBe('Mountain waterfall'); expect(fall.sheet.userData.keepGeometry).toBe(true); expect(fall.sheet.castShadow).toBe(false);
      if (tier === 'cpu') { expect(fall.spray).toBeNull(); expect(sprayGeometry(spec, tier)).toBeNull(); expect(sheet).toBeInstanceOf(THREE.MeshLambertMaterial); expect(sheet.transparent).toBe(false); continue; }
      expect(sheet.transparent).toBe(true); expect(sheet.depthWrite).toBe(false); expect(sheet.userData.heroEnv).toBe(true); expect(sheet.emissive.getHex()).toBe(0);
      const spray = fall.spray!, cards = spray.geometry.getAttribute('card').count / 4;
      expect(cards).toBe((tier === 'gpu' ? 18 : 9) + 2); expect((spray.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
      expect(spray.renderOrder).toBeGreaterThan(fall.sheet.renderOrder); expect(finite(spray.geometry.getAttribute('card'))).toBe(true);
    }
  });
  it('builds its foam from equalised, tiling noise', () => {
    const map = foamTexture(64), data = map.image.data as Uint8Array;
    for (let c = 0; c < 3; c++) {
      let low = 0; for (let i = 0; i < 64 * 64; i++) if (data[i * 4 + c] < 128) low++;
      expect(low / 4096).toBeCloseTo(.5, 1);
    }
    expect(map.wrapS).toBe(THREE.RepeatWrapping); expect(foamTexture(64)).toBe(map);
  });
});

describe('the gorge water, placed from the layout', () => {
  const near = (a: Point3, b: { x: number; z: number }): number => Math.hypot(a[0] - b.x, a[2] - b.z);
  it('hangs the waterfall from the plateau lip to the pool at the wall foot, clear of the rock everywhere', () => {
    expect(near(GORGE_FALL.lip, WATERFALL.lip)).toBeLessThan(1e-9); expect(near(GORGE_FALL.foot, WATERFALL.foot)).toBeLessThan(1e-9);
    // About 40.6 m up at the lip, 22.9 m at the pool: the drop the layout gives.
    expect(GORGE_FALL.lip[1]).toBeGreaterThan(40); expect(GORGE_FALL.foot[1]).toBeLessThan(23.5); expect(GORGE_FALL.lip[1] - GORGE_FALL.foot[1]).toBeGreaterThan(17);
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
      const geometry = waterfallGeometry(GORGE_FALL, tier), position = geometry.getAttribute('position'), water = geometry.getAttribute('water'), index = geometry.index!;
      // Above the pool every vertex keeps its clearance over the rendered rock, and no triangle dips into the rock between them
      // until the sheet is about to land in its pool.
      const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3(), level = GORGE_FALL.foot[1];
      let lowest = Infinity;
      for (let i = 0; i < index.count; i += 3) {
        const [a, b, c] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]; if (water.getX(a) > .5) continue;
        p.fromBufferAttribute(position, a); q.fromBufferAttribute(position, b); r.fromBufferAttribute(position, c);
        for (const point of [p, q, r]) if (point.y > level + .01) expect(terrainSurfaceHeight(point.x, point.z)).toBeLessThanOrEqual(point.y - waterfallClearance(point.y, level) + .01);
        for (const point of [p.clone().add(q).add(r).divideScalar(3), p.clone().lerp(q, .5), q.clone().lerp(r, .5), r.clone().lerp(p, .5)]) if (point.y > level + .5) expect(terrainSurfaceHeight(point.x, point.z)).toBeLessThan(point.y - .02);
        // Hanging just in front of the cliff: never flung across the gorge.
        for (const point of [p, q, r]) if (point.y > level) lowest = Math.min(lowest, Math.hypot(point.x - GORGE_FALL.foot[0], point.z - GORGE_FALL.foot[2]));
      }
      expect(lowest).toBeLessThan(.5);
      for (let i = 0; i < position.count; i++) if (water.getX(i) < .5) expect(Math.hypot(position.getX(i) - GORGE_FALL.foot[0], position.getZ(i) - GORGE_FALL.foot[2])).toBeLessThan(8);
      // Its pool keeps off the trail's bare earth.
      for (let i = 0; i < position.count; i++) if (water.getX(i) > .5 && water.getY(i) > 0) expect(trailDistance(position.getX(i), position.getZ(i))).toBeGreaterThan(TRAIL_HALF);
    }
  });
  it('runs the gorge stream out of the cave and down GORGE_STREAM, and the brook down PLATEAU_STREAM to the lip', () => {
    const gorge = gorgeStreamCourse(), brook = brookCourse();
    expect(gorge.length).toBe(GORGE_STREAM.length + 2); gorge.slice(2).forEach((p, i) => expect(near(p, GORGE_STREAM[i])).toBeLessThan(1e-9));
    // It starts a metre inside the cave, upstream of the snow's snout, and stays off the trail.
    expect(near(gorge[0], SNOW_CAVE.mouth)).toBeCloseTo(1, 5); expect(gorgeCoords(gorge[0][0], gorge[0][2])!.s).toBeGreaterThan(STAGE.snout);
    for (const p of gorge) { expect(p[1]).toBeCloseTo(terrainSurfaceHeight(p[0], p[2]), 6); expect(trailDistance(p[0], p[2])).toBeGreaterThan(1.2); }
    // The brook ends on the lip; its spring is the first point where the crag's face gives way to the meadow.
    expect(near(brook[brook.length - 1], WATERFALL.lip)).toBeLessThan(1e-9); expect(brook.length).toBeGreaterThan(PLATEAU_STREAM.length - 4);
    for (let i = 1; i < brook.length; i++) expect(brook[i][1]).toBeLessThan(brook[i - 1][1] + .05);
    expect((brook[0][1] - brook[1][1]) / Math.hypot(brook[1][0] - brook[0][0], brook[1][2] - brook[0][2])).toBeLessThanOrEqual(1.2);
  });
  it('opens the snow cave where the stream leaves the snout: a 1.4 × 0.8 m mouth under a lip in a steep face', () => {
    expect(near([SNOW_CAVE.mouth.x, 0, SNOW_CAVE.mouth.z], GORGE_STREAM[0])).toBeLessThan(1e-9);
    expect(SNOW_CAVE.width).toBe(1.4); expect(SNOW_CAVE.height).toBe(.8); expect(SNOW_CAVE.lip).toBeGreaterThanOrEqual(.5); expect(SNOW_CAVE.lip).toBeLessThanOrEqual(.8);
    // Upstream of the mouth lies the old snow the cave runs into.
    const inside = { x: SNOW_CAVE.mouth.x - SNOW_CAVE.out.x * 1.2, z: SNOW_CAVE.mouth.z - SNOW_CAVE.out.z * 1.2 }; expect(snowCover(inside.x, inside.z)).toBeGreaterThan(.5);
    // The face thins away well short of the trail.
    const trail = TRAIL_SAMPLES[STAGE.snout], side = (trail.x - SNOW_CAVE.mouth.x) * SNOW_CAVE.out.z - (trail.z - SNOW_CAVE.mouth.z) * SNOW_CAVE.out.x;
    expect(Math.abs(side) - (side < 0 ? SNOW_CAVE.left : SNOW_CAVE.right)).toBeGreaterThanOrEqual(1.1 - 1e-9);
    for (const tier of ['gpu', 'cpu'] as const) {
      const geometry = snowCaveGeometry(SNOW_CAVE, tier), position = geometry.getAttribute('position'), colour = geometry.getAttribute('color');
      expect(finite(position)).toBe(true); expect(finite(colour)).toBe(true); expect(geometry.index!.count / 3).toBeLessThan(tier === 'gpu' ? 2000 : 800);
      // The opening: nothing of the snow stands in the 1.4 × 0.8 m mouth in front of the cave (the dark interior lies behind it).
      const g = terrainSurfaceHeight(SNOW_CAVE.mouth.x, SNOW_CAVE.mouth.z);
      let blocking = 0, thick = 0, dark = 0;
      for (let i = 0; i < position.count; i++) {
        const dx = position.getX(i) - SNOW_CAVE.mouth.x, dz = position.getZ(i) - SNOW_CAVE.mouth.z, b = dx * SNOW_CAVE.out.z - dz * SNOW_CAVE.out.x, a = -(dx * SNOW_CAVE.out.x + dz * SNOW_CAVE.out.z), y = position.getY(i) - g;
        if (Math.abs(b) < .55 && y > .05 && y < .6 && a < -.12) blocking++;
        if (Math.abs(b) < .3 && a > -.6 && a < .3 && y > 1.3) thick++;
        if (colour.getX(i) < .05) dark++;
      }
      expect(blocking).toBe(0); expect(thick).toBeGreaterThan(0); expect(dark).toBeGreaterThan(0);
    }
  });
  it('adds four draws at most (three on cpu): fall and pool, mist, both streams together, the snow cave', () => {
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
      const { group, spray } = createGorgeWater(tier), meshes = group.children as THREE.Mesh[];
      expect(meshes.length).toBe(3); expect(!!spray).toBe(tier !== 'cpu');
      expect(meshes.map(mesh => mesh.name)).toEqual(['Mountain waterfall', 'Gorge stream and plateau brook', 'Snow cave']);
      for (const mesh of [...meshes, ...(spray ? [spray] : [])]) { expect(mesh.userData.keepGeometry).toBe(true); expect((mesh.material as THREE.MeshStandardMaterial).emissive?.getHex() ?? 0).toBe(0); }
    }
  });
});
