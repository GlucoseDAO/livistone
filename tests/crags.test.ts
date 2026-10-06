import { describe, expect, it } from 'vitest';
import { CRAG_BURY, CragGround, LUMPS, cragColliders, cragGeometry, cragSites, cragsDrawn, seatHeight } from '../src/world/crags';
import type { CragSite } from '../src/world/crags';
import { GORGE_STREAM, STAGE, TRAIL_HALF, TRAIL_SAMPLES, cragOnMeadow, cragOnSnow, gorgeCoords, gorgeHalf, passageClosing, rockZone, trailDistance } from '../src/world/mountain-layout';
import { TERRAIN_GRID } from '../src/world/terrain';

// Sub-plan 27 round 2: the crags line the gorge and stand on the mountain's steep ground, seated, clear of the trail.
const ground = new CragGround(), sites = cragSites({ ground });
/** Rendered vertices of one block on one tier. */
const vertices = (site: CragSite, tier: 'gpu' | 'mobile' | 'cpu'): Float32Array => cragGeometry([site], tier, ground).getAttribute('position').array as Float32Array;

describe('limestone crags (sub-plan 27, round 2)', () => {
  it('stand in the rock zones and line both walls of the gorge, closing in at the narrow passage', () => {
    expect(sites.length).toBeGreaterThan(250);
    expect(sites.filter(s => rockZone(s.x, s.z)).length).toBeGreaterThan(sites.length * .5);
    // Along the canyon and the gully, a block's face stands near the floor's edge on each side for most of the way.
    for (const side of [1, -1]) {
      let lined = 0, total = 0;
      for (let s = STAGE.passage; s < STAGE.head - 2; s += 2, total++) if (sites.some(b => { const g = gorgeCoords(b.x, b.z); return !!g && g.side === side && b.kind !== 'talus' && Math.abs(g.s - s) < b.width / 2 && g.d < gorgeHalf(g.s) + b.depth; })) lined++;
      expect(lined / total, `side ${side}`).toBeGreaterThan(.6);
    }
    // At the passage rock comes within 3 m of the trail on both sides.
    for (const side of [1, -1]) expect(sites.some(b => { const g = gorgeCoords(b.x, b.z); return !!g && g.side === side && passageClosing(g.s) > .5 && g.d - b.depth / 2 < 3; }), `passage ${side}`).toBe(true);
  });

  it('seat every block: its lowest vertex and its whole foot under the lowest ground mesh, on every tier', () => {
    for (const site of sites) {
      for (const tier of ['gpu', 'mobile', 'cpu'] as const) {
        if (!cragsDrawn([site], tier).length) continue;
        const v = vertices(site, tier); let lowest = 0;
        for (let i = 1; i < v.length / 3; i++) if (v[i * 3 + 1] < v[lowest * 3 + 1]) lowest = i;
        expect(v[lowest * 3 + 1], `${site.kind} at ${site.x.toFixed(1)}, ${site.z.toFixed(1)} (${tier})`).toBeLessThan(ground.floor(v[lowest * 3], v[lowest * 3 + 2]) + .01);
      }
      // Re-seating lands where it stands, so the foot's seated outline lies CRAG_BURY under the ground.
      expect(seatHeight(site, ground)).toBeCloseTo(site.y, 5);
      expect(CRAG_BURY[site.kind]).toBeGreaterThan(.2);
    }
  });

  it('keep the trail, the gorge floor, the snow, the meadow and the stream clear', () => {
    for (const site of sites) {
      const v = vertices(site, 'gpu');
      for (let i = 0; i < v.length; i += 3) {
        const x = v[i], y = v[i + 1], z = v[i + 2], d = trailDistance(x, z);
        expect(d, `${site.kind} at ${site.x.toFixed(1)}, ${site.z.toFixed(1)}`).toBeGreaterThan(Math.min(site.trail, TRAIL_HALF + 1) - .01);
        expect(d).toBeGreaterThan(TRAIL_HALF + .9 - .01);
        // On the ground (not high on a wall, not buried in it): never on the snow or the walkable meadow, never in the stream.
        const above = y - ground.near(x, z);
        if (above > -.3 && above < 1) {
          expect(cragOnSnow(x, z), `snow at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false);
          if (cragOnMeadow(x, z) > 0) expect(ground.normal(x, z).slope, `meadow at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBeGreaterThan(35);
          expect(GORGE_STREAM.every(p => Math.hypot(p.x - x, p.z - z) > .5)).toBe(true);
        }
      }
    }
    expect(LUMPS).toBeGreaterThan(.1);
    // The walkable floor of the gorge: only small boulders and the passage's rock come inside its edge.
    for (const site of sites) {
      const g = gorgeCoords(site.x, site.z); if (!g || g.d > gorgeHalf(g.s)) continue;
      expect(site.kind === 'talus' && site.width < 2.2 || passageClosing(g.s) > 0, `${site.kind} at ${site.x.toFixed(1)}, ${site.z.toFixed(1)}`).toBe(true);
    }
  });

  it('collide on every tier: one trimesh for every block on the walking terrain', () => {
    const collider = cragColliders(sites); if (collider.type !== 'mesh') throw new Error('mesh expected');
    const inside = sites.filter(s => s.x > TERRAIN_GRID.minX + 10 && s.x < -TERRAIN_GRID.minX - 10 && s.z > TERRAIN_GRID.minZ + 8);
    expect(inside.every(s => s.collider)).toBe(true);
    expect(collider.indices.length / 3).toBeGreaterThan(inside.length * 30);
    // The trail stays walkable: the capsule (radius 0.29) on its centreline is clear of every collider triangle's vertices.
    for (let i = 0; i < collider.vertices.length; i += 3) expect(trailDistance(collider.vertices[i], collider.vertices[i + 2])).toBeGreaterThan(TRAIL_HALF + .9 - .01);
    // Every tier draws every block that collides, so nothing invisible blocks the way.
    for (const tier of ['gpu', 'mobile', 'cpu'] as const) expect(cragsDrawn(sites, tier).filter(s => s.collider).length).toBe(sites.filter(s => s.collider).length);
  });

  // Round 3 placed more blocks over the steep faces' smooth planes: the budgets rose from 150k and 50k.
  it('stay within budget: one mesh, at most 180k triangles on gpu, 60k on mobile, fewer on cpu, and the same blocks every time', () => {
    const triangles = (tier: 'gpu' | 'mobile' | 'cpu'): number => cragGeometry(sites, tier, ground).index!.count / 3;
    const gpu = triangles('gpu'), mobile = triangles('mobile'), cpu = triangles('cpu');
    expect(gpu).toBeLessThan(180_000); expect(mobile).toBeLessThan(60_000); expect(cpu).toBeLessThanOrEqual(mobile);
    expect(cragSites({ ground }).map(s => [s.x, s.y, s.z, s.seed])).toEqual(sites.map(s => [s.x, s.y, s.z, s.seed]));
    expect(TRAIL_SAMPLES.length).toBeGreaterThan(STAGE.head);
  });
});
