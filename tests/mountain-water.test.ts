import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createStream, createWaterfall, foamTexture, sprayGeometry, streamGeometry, streamWhite, waterfallGeometry } from '../src/world/mountain-water';
import type { Point3, WaterfallSpec } from '../src/world/mountain-water';

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
      if (y > spec.foot[1] + .01) expect(cliff(x, z)).toBeLessThanOrEqual(y - .35 + .05);
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
  it('fills only a hollow: level water in a bowl, a thin film over ground that falls away', () => {
    // The pool (radius 3 here) is centred a little out from the foot; this bowl round that centre holds water to 0 within 2 m.
    const bowl = (x: number, z: number): number => z < -1 ? 24 : .03 * ((x * x + (z - 4.05) * (z - 4.05)) - 4);
    for (const [ground, level] of [[bowl, 0], [cliff, .05]] as const) {
      const geometry = waterfallGeometry({ ...spec, ledge: undefined, foot: [0, level, 3], pool: 3, ground }, 'gpu'), position = geometry.getAttribute('position'), water = geometry.getAttribute('water');
      let flat = 0, film = 0;
      for (let i = 0; i < position.count; i++) {
        if (water.getX(i) < .5) continue;
        const y = position.getY(i), g = ground(position.getX(i), position.getZ(i));
        if (Math.abs(y - level) < 1e-4 && g < level - .05) flat++; else if (Math.abs(y - g - .03) < 1e-4) film++;
        expect(y).toBeLessThanOrEqual(Math.max(level, g + .03) + 1e-4);
      }
      if (ground === bowl) expect(flat).toBeGreaterThan(film); else expect(flat).toBe(0);
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
