import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { LANDMARKS, CIVIC_LANDMARKS, DISCOVERIES } from '../src/game/content';
import { LivingWaters } from '../src/world/living-waters';
import { forestSites } from '../src/world/forest-layout';
import { riverRockSites } from '../src/world/stone';
import { rockColliders, rockReach } from '../src/world/river-rocks';
import { terrainHeight, terrainSurfaceHeight, townTerrainGeometry } from '../src/world/terrain';
import { FALL_FLOOR, TOWN_BOUNDS } from '../src/world/town-layout';
import { PLATEAU, STAGE, TRAILHEAD, TRAIL_ARRIVAL, TRAIL_BARRIER, TRAIL_ENTRY, TRAIL_HALF, TRAIL_SAMPLES, TRAIL_TOP, gorgeCoords, gorgeHalf, plateauInside, plateauRadius, snowCover, snowDepth, trailCorridor, trailDistance, trailLevel } from '../src/world/mountain-layout';
import { createTrailSigns, trailBoulders } from '../src/world/mountain-trail';
import { cragColliders, cragObstacles, cragSites } from '../src/world/crags';
import { MAT_EDGE, campionSites, matGrid, matStats, turfFlowers } from '../src/world/alpine-plants';

const walkable = TRAIL_SAMPLES.slice(0, TRAIL_BARRIER.index);
/** main.ts's reset: out of the walking bounds and outside every corridor, or fallen. */
const reset = (p: { x: number; y: number; z: number }): boolean => p.y < FALL_FLOOR || ((p.x < TOWN_BOUNDS.minX || p.x > TOWN_BOUNDS.maxX || p.z < TOWN_BOUNDS.minZ || p.z > TOWN_BOUNDS.maxZ) && !trailCorridor(p.x, p.z));
/** A point `offset` metres to the left (+) or right (-) of trail sample `s`. */
const beside = (s: number, offset: number): { x: number; z: number } => {
  const p = TRAIL_SAMPLES[s], q = TRAIL_SAMPLES[s + 1], l = Math.hypot(q.x - p.x, q.z - p.z);
  return { x: p.x - (q.z - p.z) / l * offset, z: p.z + (q.x - p.x) / l * offset };
};

describe('the Jepii Mici trail (sub-plan 27, round 2)', () => {
  it('climbs from the forbidden-trail board in the woods through a rocky gorge and over old snow onto the plateau at the top', () => {
    expect(Math.hypot(walkable[0].x + 5, walkable[0].z + 158.6)).toBeLessThan(1);
    // The board stands at the foot of the forested slope: the trail climbs at once behind it, gently before it.
    const at = (k: number): number => { const p = TRAIL_SAMPLES[TRAILHEAD.index + k]; return terrainHeight(p.x, p.z); };
    expect(at(10) - at(0)).toBeGreaterThan(3.5); expect(Math.abs(at(0) - at(-7))).toBeLessThan(1);
    // The owner's order: woods, then the gorge, then the snow, then the plateau.
    expect([TRAILHEAD.index, STAGE.bench, STAGE.mouth, STAGE.passage, STAGE.waterfall, STAGE.snout, STAGE.head, STAGE.barrier]).toEqual([TRAILHEAD.index, STAGE.bench, STAGE.mouth, STAGE.passage, STAGE.waterfall, STAGE.snout, STAGE.head, STAGE.barrier].sort((a, b) => a - b));
    expect(TRAIL_ENTRY).toBe(STAGE.head);
    // In the gorge, from the narrow passage on, rock stands at least 4 m above the floor on both sides (at its mouth the benched
    // woods come up beside it).
    for (let s = STAGE.passage + 6; s < STAGE.snout - 1; s += 5) for (const side of [1, -1]) {
      const p = beside(s, side * (gorgeHalf(s) + 4.5));
      expect(terrainHeight(p.x, p.z) - trailLevel(s), `wall at ${s} ${side}`).toBeGreaterThan(3.5);
    }
    // The trail itself crosses the snow for well over 15 m, on its surface, a slab more than a metre thick.
    const onSnow = walkable.filter(p => snowCover(p.x, p.z) > .5);
    expect(onSnow.length).toBeGreaterThan(18);
    const middle = Math.round((STAGE.snout + STAGE.head) / 2), m = TRAIL_SAMPLES[middle];
    expect(Math.abs(terrainHeight(m.x, m.z) - trailLevel(middle))).toBeLessThan(.4); expect(snowDepth(middle)).toBeGreaterThan(1.2);
    // The plateau is the top of the walk: above every bit of snow on the way, the barrier at its back, the worn line beyond.
    const snowTop = Math.max(...onSnow.map(p => terrainHeight(p.x, p.z)));
    expect(terrainHeight(TRAIL_TOP.x, TRAIL_TOP.z)).toBeGreaterThan(snowTop); expect(plateauRadius(TRAIL_TOP.x, TRAIL_TOP.z)).toBeLessThan(.9);
    expect(TRAIL_SAMPLES.at(-1)!.z).toBeLessThan(TRAIL_BARRIER.z - 10);
    for (let i = 3; i < walkable.length; i += 3) {
      const a = walkable[i - 3], b = walkable[i], grade = Math.abs(terrainHeight(b.x, b.z) - terrainHeight(a.x, a.z)) / Math.hypot(b.x - a.x, b.z - a.z);
      expect(grade, `${b.x.toFixed(1)}, ${b.z.toFixed(1)}`).toBeLessThan(.72);
      expect(reset({ x: b.x, y: 1, z: b.z }), `${b.x.toFixed(1)}, ${b.z.toFixed(1)}`).toBe(false);
    }
  });

  it('is a map destination after Materialized Enhancements, with a story that keeps the real trail apart from the fiction', () => {
    const trail = LANDMARKS.at(-1)!; expect(trail.id).toBe('jepii-mici'); expect(CIVIC_LANDMARKS).not.toContain(trail);
    expect(LANDMARKS.at(-2)!.id).toBe('enhancement');
    // The arrival stands on the flat forest floor below the board, facing it.
    expect(trail.entrance.y - terrainHeight(trail.entrance.x, trail.entrance.z)).toBeCloseTo(1.05, 1);
    const toSign = Math.atan2(-(TRAILHEAD.x - trail.entrance.x), -(TRAILHEAD.z - trail.entrance.z));
    expect(Math.abs(toSign - trail.entrance.yaw)).toBeLessThan(.05); expect(trail.entrance).toEqual(TRAIL_ARRIVAL);
    const story = DISCOVERIES.find(d => d.id === 'jepii-mici')!;
    expect(story.body).toContain('blue cross'); expect(story.body).toContain('closed in winter'); expect(story.body).toContain('Livistone fiction');
  });

  it('keeps trunks, boulders and plants off the trail; the rhododendron mats low, in drifts, on the plateau', () => {
    const trees = forestSites(false);
    for (const tree of trees) expect(trailDistance(tree.x, tree.z)).toBeGreaterThan(TRAIL_HALF + 1.5);
    // The trailhead stands in thick woods: trunks on both sides within a few metres.
    expect(trees.filter(t => Math.hypot(t.x - TRAILHEAD.x, t.z - TRAILHEAD.z) < 9).length).toBeGreaterThanOrEqual(4);
    // No tree grows in the gorge, on the snow or on the plateau.
    for (const tree of trees) { const g = gorgeCoords(tree.x, tree.z); expect(!!g && g.d < gorgeHalf(g.s) + 2, `${tree.x}, ${tree.z}`).toBe(false); expect(plateauInside(tree.x, tree.z)).toBeLessThan(-3); }
    const boulders = trailBoulders(false), rocks = boulders.map(b => b.site);
    expect(boulders.filter(b => b.blaze).length).toBeGreaterThanOrEqual(8);
    for (const rock of rocks) {
      expect(trailDistance(rock.x, rock.z)).toBeGreaterThan(TRAIL_HALF + rockReach(rock.s));
      expect(rock.y - rock.s * .26).toBeLessThan(terrainSurfaceHeight(rock.x, rock.z) + .01);
    }
    // Mats cover a good share of the meadow in drifts, a hand or two high, and never the trail.
    const stats = matStats(false, rocks);
    expect(stats.cover).toBeGreaterThan(.25); expect(stats.cover).toBeLessThan(.65);
    for (const s of stats.samples) { expect(s.height).toBeGreaterThan(-.05); expect(s.height).toBeLessThan(.3); expect(trailDistance(s.x, s.z)).toBeGreaterThan(TRAIL_HALF + .3); expect(plateauInside(s.x, s.z)).toBeGreaterThan(1); }
    const grid = matGrid(false, rocks), flowers = turfFlowers(false, grid, rocks), campion = campionSites(false, grid, rocks);
    expect(flowers.length).toBeGreaterThan(1200); expect(campion.length).toBeGreaterThan(30);
    for (const f of flowers) { expect(trailDistance(f.x, f.z)).toBeGreaterThan(TRAIL_HALF + .3); const i = Math.round((f.x - grid.x0) / grid.step), j = Math.round((f.z - grid.z0) / grid.step); expect(grid.field[j * grid.nx + i]).toBeLessThan(MAT_EDGE); }
    for (const c of campion) expect(trailDistance(c.x, c.z)).toBeGreaterThan(TRAIL_HALF + c.radius);
  });

  it('fills the gully between the gorge and the plateau with a broad field of old snow', () => {
    let snow = 0, widest = 0;
    for (let z = -290; z <= -240; z += 1) {
      let row = 0;
      for (let x = -75; x <= -35; x += 1) if (snowCover(x, z) > .5) { row++; snow++; }
      widest = Math.max(widest, row);
    }
    expect(snow).toBeGreaterThan(220); expect(widest).toBeGreaterThanOrEqual(8);
    // Above the gorge's floor where it begins, below the plateau where it ends.
    let lowest = Infinity, highest = -Infinity;
    for (let x = -75; x <= -35; x += 1) for (let z = -290; z <= -240; z += 1) if (snowCover(x, z) > .5) { const h = terrainHeight(x, z); lowest = Math.min(lowest, h); highest = Math.max(highest, h); }
    expect(lowest).toBeGreaterThan(trailLevel(STAGE.mouth) + 5); expect(highest).toBeLessThan(PLATEAU.level + PLATEAU.rise + 1);
  });

  it('walks a capsule from the map arrival under the board, through the gorge and over the snow onto the plateau, where it is held', async () => {
    const gardens = new LivingWaters(false), ground = townTerrainGeometry(), colliders: ColliderSpec[] = [...gardens.colliders, { type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }];
    ground.dispose();
    const boulders = trailBoulders(false), trees = forestSites(false), signs = createTrailSigns(colliders, boulders, trees);
    colliders.push(rockColliders([...riverRockSites(false), ...boulders.map(b => b.site)]));
    // Round 2's crags line the gorge and close in its passage: the walk must get through them (crags.ts).
    colliders.push(cragColliders(cragSites({ obstacles: cragObstacles(trees, boulders.map(b => b.site)) })));
    for (const { x, y, z } of trees) colliders.push({ type: 'box', position: [x, y + 2, z], size: [.3, 2, .3] });
    // The board hangs with its lower edge above the capsule's head.
    expect(signs.position.y - .45 - terrainSurfaceHeight(TRAILHEAD.x, TRAILHEAD.z)).toBeGreaterThan(1.95);
    const physics = await Physics.create(colliders);
    try {
      physics.teleport(TRAIL_ARRIVAL);
      let passedSign = false, onSnow = 0;
      for (const goal of walkable.slice(TRAILHEAD.index - 6)) {
        for (let step = 0; step < 120; step++) {
          const p = physics.position(), dx = goal.x - p.x, dz = goal.z - p.z, distance = Math.hypot(dx, dz);
          if (distance < .1) break;
          physics.step(dx / distance * Math.min(3, distance * 60), dz / distance * Math.min(3, distance * 60));
          expect(reset(physics.position()), JSON.stringify(physics.position())).toBe(false);
        }
        const p = physics.position();
        expect(Math.hypot(p.x - goal.x, p.z - goal.z), JSON.stringify({ goal, p })).toBeLessThan(.35);
        expect(p.y).toBeGreaterThan(terrainSurfaceHeight(p.x, p.z) + .6);
        if (Math.hypot(p.x - TRAILHEAD.x, p.z - TRAILHEAD.z) < .5) passedSign = true;
        if (snowCover(p.x, p.z) > .5) onSnow++;
      }
      expect(passedSign).toBe(true); expect(onSnow).toBeGreaterThan(15);
      expect(plateauRadius(physics.position().x, physics.position().z)).toBeLessThan(.9);
      // On the plateau: holding on up the worn line past the barrier, and toward every edge, never reaches the reset. Toward the
      // crags it stays on the plateau; toward the lip the fence holds it (or it drops into the gorge, still inside the corridor).
      const pushes = [TRAIL_SAMPLES[TRAIL_BARRIER.index + 8], ...Array.from({ length: 16 }, (_, k) => ({ x: PLATEAU.x + Math.cos(k / 16 * Math.PI * 2) * PLATEAU.a * 1.6, z: PLATEAU.z + Math.sin(k / 16 * Math.PI * 2) * PLATEAU.b * 1.6 }))];
      for (const goal of pushes) {
        physics.teleport({ x: PLATEAU.x, y: terrainHeight(PLATEAU.x, PLATEAU.z) + 1.1, z: PLATEAU.z });
        for (let step = 0; step < 60 * 9; step++) {
          const p = physics.position(), dx = goal.x - p.x, dz = goal.z - p.z, distance = Math.hypot(dx, dz) || 1;
          physics.step(dx / distance * 4.2, dz / distance * 4.2);
          expect(reset(physics.position()), `toward ${goal.x.toFixed(0)}, ${goal.z.toFixed(0)}: ${JSON.stringify(physics.position())}`).toBe(false);
        }
        // Toward the crags it stays on the plateau, or goes back down the gully the trail came up by.
        const end = physics.position(), gully = gorgeCoords(end.x, end.z);
        if (goal.z < PLATEAU.z - 4) expect(plateauRadius(end.x, end.z) < 1.15 || (!!gully && gully.d < gorgeHalf(gully.s) + 3), `toward ${goal.x.toFixed(0)}, ${goal.z.toFixed(0)}: ${JSON.stringify(end)}`).toBe(true);
      }
    } finally { physics.dispose(); gardens.dispose(); }
  }, 90000);
});
