import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createTimeTower } from '../src/world/time-tower';
import { createFutureHouse } from '../src/world/future-house';
import { FUTURE_NECK, towerPoint } from '../src/world/elevated-layout';
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
