import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createTimeTower } from '../src/world/time-tower';
import { createFutureHouse } from '../src/world/future-house';
import { LivingWaters } from '../src/world/living-waters';
import { GARDEN_PATHS, GARDENS } from '../src/world/living-waters-layout';
import { townTerrainGeometry } from '../src/world/terrain';
import { FUTURE_HOUSE, FUTURE_NECK, NECK_ARRIVAL, NECK_WIDTH, towerPoint } from '../src/world/elevated-layout';
import { posterLayout } from '../src/world/poster-layout';

async function follow(physics: Physics, points: THREE.Vector3[]): Promise<void> {
  for (const goal of points) {
    for (let step = 0; step < 100; step++) {
      const p = physics.position(), dx = goal.x - p.x, dz = goal.z - p.z, distance = Math.hypot(dx, dz);
      if (distance < .08) break;
      physics.step(dx / distance * Math.min(3, distance * 60), dz / distance * Math.min(3, distance * 60));
    }
    const p = physics.position(); expect(Math.hypot(p.x - goal.x, p.z - goal.z), JSON.stringify({goal:goal.toArray(),position:p})).toBeLessThan(.3); expect(p.y).toBeGreaterThan(goal.y + .65);
  }
}
describe('elevated exhibition routes', () => {
  for (const mobile of [false, true]) it(`walks from the west lake loop onto the Future House neck (${mobile ? 'reduced' : 'rich'})`, async () => {
    const gardens = new LivingWaters(mobile), ground = townTerrainGeometry(), colliders: ColliderSpec[] = [...gardens.colliders, { type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }];
    createFutureHouse(new THREE.Group(), colliders, mobile); ground.dispose();
    const route = GARDEN_PATHS[GARDEN_PATHS.length - 1], points = route.getSpacedPoints(60).map(p => p.clone().add(new THREE.Vector3(GARDENS.x, 0, GARDENS.z)));
    points.push(...FUTURE_NECK.getSpacedPoints(70));
    const physics = await Physics.create(colliders);
    try {
      physics.teleport({ x: points[0].x, y: points[0].y + .9, z: points[0].z });
      await follow(physics, points); await follow(physics, [...points].reverse());
    } finally { physics.dispose(); gardens.dispose(); }
  }, 20000);

  it('keeps the camel neck an even, walkable grade that meets the cabin floor without a lip', () => {
    const points = FUTURE_NECK.getPoints(400); let steepest = 0;
    for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i]; steepest = Math.max(steepest, Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z))); }
    // Well inside the character controller's 45° climbing limit (physics.ts); the old S-bend peaked at 41.5°.
    expect(steepest * 180 / Math.PI).toBeLessThan(34);
    // The ribbon is at deck height where it crosses the hull's rim (x = -54.98, y = 11.92), so nothing trips the capsule there.
    const threshold = points.find(p => p.x < FUTURE_HOUSE.x + 9.02)!; expect(threshold.y).toBeGreaterThan(FUTURE_HOUSE.floor - .05);
    // The walking width, rails included, passes through the cabin's east aperture (±0.24 rad of its 12 m half-length).
    expect(NECK_WIDTH / 2 + .1).toBeLessThan(12 * Math.sin(.24));
  });

  for (const mobile of [false, true]) it(`walks straight from the lake path into the cabin holding forward (${mobile ? 'reduced' : 'rich'})`, async () => {
    const gardens = new LivingWaters(mobile), ground = townTerrainGeometry(), colliders: ColliderSpec[] = [...gardens.colliders, { type: 'mesh', vertices: new Float32Array(ground.getAttribute('position').array), indices: new Uint32Array(ground.index!.array) }];
    createFutureHouse(new THREE.Group(), colliders, mobile); ground.dispose();
    const physics = await Physics.create(colliders);
    try {
      // From the map arrival facing up the neck, and from the path's end facing due west (the old arrival): walking pace (input.ts),
      // no steering, no jump. The old neck stalled the second at its 41.5° bend, pressed against the inner rail.
      for (const [x, z, yaw] of [[NECK_ARRIVAL.x, NECK_ARRIVAL.z, NECK_ARRIVAL.yaw], [-35, -105, Math.PI / 2]]) {
        physics.teleport({ x, y: 1.2, z }); let arrived = Infinity;
        for (let i = 0; i < 60 * 14 && arrived === Infinity; i++) {
          physics.step(-Math.sin(yaw) * 4.2, -Math.cos(yaw) * 4.2); const p = physics.position();
          if (p.x < FUTURE_HOUSE.x + 7.5 && p.y > FUTURE_HOUSE.floor + .7) arrived = i / 60;
        }
        expect(arrived, `from ${x}, ${z} facing ${yaw.toFixed(2)}: ${JSON.stringify(physics.position())}`).toBeLessThan(10.5);
      }
    } finally { physics.dispose(); gardens.dispose(); }
  }, 20000);

  it('lets players jump out over the Timeface gallery rail', async () => {
    const colliders: ColliderSpec[] = [{ type:'box', position:[17,-.2,-39],size:[30,.2,30] }];
    createTimeTower(new THREE.Group(), colliders, true);
    const physics = await Physics.create(colliders), start = towerPoint(.8), outward = towerPoint(.8, 7.55).sub(start).normalize();
    try {
      physics.teleport({ x: start.x, y: start.y + .9, z: start.z });
      for (let i=0;i<30;i++) physics.step(0,0);
      physics.step(0,0,1/60,true);
      for (let i=0;i<200;i++) physics.step(i<100?outward.x*4.2:0,i<100?outward.z*4.2:0);
      expect(physics.position().y).toBeLessThan(1);
      expect(Math.hypot(physics.position().x-start.x,physics.position().z-start.z)).toBeGreaterThan(5);
    } finally { physics.dispose(); }
  });

  it('keeps the roof above all Future House poster corners', () => {
    const root=new THREE.Group();createFutureHouse(root,[],true);root.updateMatrixWorld(true);
    const roof=root.getObjectByName('Future House · PLA printed exhibition cabin')!, ray=new THREE.Raycaster();
    for (const site of posterLayout('future-house',3)) for(const dx of [-1.05,0,1.05]) {
      ray.set(new THREE.Vector3(site.x+dx,12.1,site.z),new THREE.Vector3(0,1,0));
      const hit=ray.intersectObject(roof)[0];expect(hit).toBeDefined();expect(hit.point.y).toBeGreaterThan(15.6);
    }
  });
  it('walks the Timeface spiral to the summit and back without teleporting', async () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = [{ type:'box', position:[17,-.2,-39],size:[12,.2,12] }]; createTimeTower(root,colliders,true);
    const physics = await Physics.create(colliders), points = Array.from({length:241},(_,i)=>towerPoint(i/240));
    try { const start=points[0]; physics.teleport({x:start.x,y:start.y+.9,z:start.z}); await follow(physics,points); expect(physics.position().y).toBeGreaterThan(26); await follow(physics,[...points].reverse()); expect(physics.position().y).toBeLessThan(1.3); }
    finally { physics.dispose(); }
  }, 30000);
  it('climbs the camel neck into the exhibition cabin and returns to the lake', async () => {
    const root = new THREE.Group(), colliders: ColliderSpec[] = [{type:'box',position:[-55,-.3,-110],size:[35,.3,25]}]; createFutureHouse(root,colliders,true);
    const physics=await Physics.create(colliders), points=FUTURE_NECK.getPoints(80); points.push(new THREE.Vector3(-61,12,-110));
    try { const start=points[0]; physics.teleport({x:start.x,y:start.y+.9,z:start.z});await follow(physics,points);expect(physics.position().y).toBeGreaterThan(12.7);await follow(physics,[...points].reverse());expect(physics.position().y).toBeLessThan(1.2); }
    finally { physics.dispose(); }
  }, 30000);
});
