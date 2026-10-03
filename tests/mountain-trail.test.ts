import * as THREE from 'three';
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
import { PLATEAU, TRAILHEAD, TRAIL_ARRIVAL, TRAIL_BARRIER, TRAIL_ENTRY, TRAIL_HALF, TRAIL_SAMPLES, TRAIL_TOP, couloirCarve, plateauRadius, snowCover, trailCorridor, trailDistance } from '../src/world/mountain-layout';
import { campionSites, createTrailSigns, shrubSites, trailBoulders } from '../src/world/mountain-trail';

const walkable = TRAIL_SAMPLES.slice(0, TRAIL_BARRIER.index);
/** main.ts's reset: out of the walking bounds and outside every corridor, or fallen. */
const reset = (p: { x: number; y: number; z: number }): boolean => p.y < FALL_FLOOR || ((p.x < TOWN_BOUNDS.minX || p.x > TOWN_BOUNDS.maxX || p.z < TOWN_BOUNDS.minZ || p.z > TOWN_BOUNDS.maxZ) && !trailCorridor(p.x, p.z));

describe('the Jepii Mici trail (sub-plan 27)', () => {
  it('runs from the north garden path up the forested slope and the ridge onto the plateau, then on into the crags', () => {
    expect(Math.hypot(walkable[0].x + 5, walkable[0].z + 158.6)).toBeLessThan(1);
    // The board stands at the foot of the forested slope: the trail climbs at once behind it, gently before it.
    const at = (k: number): number => { const p = TRAIL_SAMPLES[TRAILHEAD.index + k]; return terrainHeight(p.x, p.z); };
    expect(at(10) - at(0)).toBeGreaterThan(3.5); expect(Math.abs(at(0) - at(-7))).toBeLessThan(1);
    // The plateau stands some 30 m above the town, the barrier at its back, the worn line beyond it.
    expect(terrainHeight(TRAIL_TOP.x, TRAIL_TOP.z)).toBeGreaterThan(30); expect(plateauRadius(TRAIL_TOP.x, TRAIL_TOP.z)).toBeLessThan(.9);
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

  it('keeps trunks, boulders, shrubs and moss campion off the trail, and the plants on the plateau', () => {
    const trees = forestSites(false);
    for (const tree of trees) expect(trailDistance(tree.x, tree.z)).toBeGreaterThan(TRAIL_HALF + 1.5);
    // The trailhead stands in thick woods: trunks on both sides within a few metres.
    const near = trees.filter(t => Math.hypot(t.x - TRAILHEAD.x, t.z - TRAILHEAD.z) < 9);
    expect(near.length).toBeGreaterThanOrEqual(4);
    const boulders = trailBoulders(false), rocks = boulders.map(b => b.site);
    expect(boulders.filter(b => b.blaze).length).toBeGreaterThanOrEqual(6);
    for (const rock of rocks) {
      expect(trailDistance(rock.x, rock.z)).toBeGreaterThan(TRAIL_HALF + rockReach(rock.s));
      expect(rock.y - rock.s * .26).toBeLessThan(terrainSurfaceHeight(rock.x, rock.z) + .01);
    }
    const shrubs = shrubSites(false, rocks), campion = campionSites(false, shrubs, rocks);
    expect(shrubs.length).toBeGreaterThan(60); expect(campion.length).toBeGreaterThan(80);
    for (const s of shrubs) { expect(trailDistance(s.x, s.z)).toBeGreaterThan(TRAIL_HALF + s.radius * .9); expect(s.height).toBeGreaterThan(.29); expect(s.height).toBeLessThan(.71); }
    expect(shrubs.filter(s => plateauRadius(s.x, s.z) < .85).length).toBeGreaterThan(shrubs.length * .9);
    for (const c of campion) expect(trailDistance(c.x, c.z)).toBeGreaterThan(TRAIL_HALF + c.radius);
  });

  it('fills a couloir between two peaks above the plateau with a broad snowfield', () => {
    let snow = 0, deepest = 0, widest = 0;
    for (let z = -282; z <= -236; z += 1) {
      let row = 0;
      for (let x = -76; x <= -22; x += 1) { deepest = Math.min(deepest, couloirCarve(x, z)); if (snowCover(x, z) > .5) { row++; snow++; } }
      widest = Math.max(widest, row);
    }
    expect(snow).toBeGreaterThan(150); expect(widest).toBeGreaterThanOrEqual(10); expect(deepest).toBeLessThan(-10);
    // Upper middle of its mountain, high above the plateau's meadow.
    let lowest = Infinity; for (let x = -76; x <= -22; x += 2) for (let z = -282; z <= -236; z += 2) if (snowCover(x, z) > .5) lowest = Math.min(lowest, terrainHeight(x, z));
    expect(lowest).toBeGreaterThan(PLATEAU.level + 5);
  });

  it('walks a capsule from the map arrival under the board and up the trail onto the plateau, where fences and crags hold it', async () => {
    const gardens = new LivingWaters(false), ground = townTerrainGeometry(), colliders: ColliderSpec[] = [...gardens.colliders, { type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }];
    ground.dispose();
    const boulders = trailBoulders(false), trees = forestSites(false), signs = createTrailSigns(colliders, boulders, trees);
    colliders.push(rockColliders([...riverRockSites(false), ...boulders.map(b => b.site)]));
    for (const { x, y, z } of trees) colliders.push({ type: 'box', position: [x, y + 2, z], size: [.3, 2, .3] });
    // The board hangs with its lower edge above the capsule's head.
    expect(signs.position.y - .45 - terrainSurfaceHeight(TRAILHEAD.x, TRAILHEAD.z)).toBeGreaterThan(1.95);
    const physics = await Physics.create(colliders);
    try {
      physics.teleport(TRAIL_ARRIVAL);
      let passedSign = false;
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
      }
      expect(passedSign).toBe(true);
      expect(plateauRadius(physics.position().x, physics.position().z)).toBeLessThan(.9);
      // On the plateau: holding on up the painted trail past the barrier, and toward every edge, never reaches the reset.
      const pushes = [TRAIL_SAMPLES[TRAIL_BARRIER.index + 8], ...Array.from({ length: 16 }, (_, k) => ({ x: PLATEAU.x + Math.cos(k / 16 * Math.PI * 2) * PLATEAU.a * 1.6, z: PLATEAU.z + Math.sin(k / 16 * Math.PI * 2) * PLATEAU.b * 1.6 }))];
      for (const goal of pushes) {
        physics.teleport({ x: PLATEAU.x, y: terrainHeight(PLATEAU.x, PLATEAU.z) + 1.1, z: PLATEAU.z });
        for (let step = 0; step < 60 * 9; step++) {
          const p = physics.position(), dx = goal.x - p.x, dz = goal.z - p.z, distance = Math.hypot(dx, dz) || 1;
          physics.step(dx / distance * 4.2, dz / distance * 4.2);
          expect(reset(physics.position()), `toward ${goal.x.toFixed(0)}, ${goal.z.toFixed(0)}: ${JSON.stringify(physics.position())}`).toBe(false);
        }
        // Toward the crags and the side fences it stays on the plateau; toward the south it may find the trail's gap and go down the
        // climb, which is still inside the corridor.
        const end = physics.position(); if (goal.z < PLATEAU.z - 1) expect(plateauRadius(end.x, end.z), `toward ${goal.x.toFixed(0)}, ${goal.z.toFixed(0)}: ${JSON.stringify(end)}`).toBeLessThan(1.1);
      }
      expect(TRAIL_ENTRY).toBeGreaterThan(TRAILHEAD.index);
    } finally { physics.dispose(); gardens.dispose(); }
  }, 60000);
});
