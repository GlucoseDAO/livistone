import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createEnhancementHill } from '../src/world/enhancement';
import { enhancementGeometry,ENHANCEMENT_SUMMIT,enhancementRamp,CAVE_APPROACH,SHAFT } from '../src/world/enhancement-layout';
import { createTimeTower } from '../src/world/time-tower';
import { towerPoint,TOWER_WALK } from '../src/world/elevated-layout';
import { posterLayout } from '../src/world/poster-layout';
import font from '../src/world/fonts/monument-serif.json';
import source from '../src/world/models/enhancement-shell.json';
async function follow(physics:Physics,points:THREE.Vector3[]) {
 for(const goal of points) {
  for(let step=0;step<140;step++) {const p=physics.position(),dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d<.1)break;physics.step(dx/d*Math.min(3,d*60),dz/d*Math.min(3,d*60));}
  const p=physics.position();expect(Math.hypot(p.x-goal.x,p.z-goal.z),JSON.stringify({goal:goal.toArray(),p})).toBeLessThan(.32);expect(p.y).toBeGreaterThan(goal.y+.62);
 }
}
describe('enhancement and signage',()=>{
 it('bundles every Future House glyph and the complete supplied mesh',()=>{for(const c of 'FUTURE HOUSE')expect(font.glyphs).toHaveProperty(c);expect(source.indices.length/3).toBe(3642);});
 it('preserves every source triangle and climbs the original slopes',async()=>{
  const geometry=enhancementGeometry();expect(Array.from(geometry.index!.array)).toEqual(source.indices);expect(geometry.getAttribute('position').count).toBe(source.positions.length/3);
  const root=new THREE.Group(),colliders:ColliderSpec[]=[{type:'box',position:[82,-.2,-177],size:[45,.2,45]}];createEnhancementHill(root,colliders);
  const physics=await Physics.create(colliders);
  try{
    physics.teleport({x:100,y:1.05,z:-154.617});
    for(const goal of [{x:87.2,z:-174.35},{x:84.5473,z:-176.8}])for(let i=0;i<2200;i++){const p=physics.position(),dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d<.15)break;physics.step(dx/d*3,dz/d*3);}
    const p=physics.position();expect(p.y,JSON.stringify(p)).toBeGreaterThan(20);expect(Math.hypot(p.x-ENHANCEMENT_SUMMIT.x,p.z+176.8)).toBeLessThan(.3);

  }finally{physics.dispose();}
 },30000);
 it('changes the STL surface only within the approved shaft',()=>{
  const root=new THREE.Group();createEnhancementHill(root,[]);root.updateMatrixWorld(true);
  const edited=root.getObjectByName('Materialized Enhancements · original Voronoi shell')!,original=new THREE.Mesh(enhancementGeometry(),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();original.updateMatrixWorld(true);
  for(let x=60;x<107;x+=2.3)for(let z=-192;z<-162;z+=2.3){
    if(Math.abs(x-SHAFT.x)<SHAFT.half+.01&&Math.abs(z-SHAFT.z)<SHAFT.half+.01)continue;
    ray.set(new THREE.Vector3(x,35,z),new THREE.Vector3(0,-1,0));const a=ray.intersectObject(original),b=ray.intersectObject(edited);
    expect(!!a.length).toBe(!!b.length);if(a.length)expect(a[0].point.y).toBeCloseTo(b[0].point.y,3);
  }
 });
 it('walks the cave entry and hidden ramp to the monument',async()=>{
  const colliders:ColliderSpec[]=[{type:'box',position:[82,-.2,-177],size:[45,.2,45]}];createEnhancementHill(new THREE.Group(),colliders);const physics=await Physics.create(colliders),points=[...CAVE_APPROACH.getPoints(50),...enhancementRamp().filter((_,i)=>i%2===0)];
  try{const start=points[0];physics.teleport({x:start.x,y:1.05,z:start.z});await follow(physics,points);expect(physics.position().y).toBeGreaterThan(20.7);await follow(physics,[...points].reverse());}finally{physics.dispose();}
 },30000);
 it('keeps panels outside the Timeface lane and walks past their colliders',async()=>{
  const root=new THREE.Group(),colliders:ColliderSpec[]=[];createTimeTower(root,colliders,true);
  for(const site of posterLayout('timeface',6)) {
   expect(Math.hypot(4.65+.1,1.05)).toBeLessThan(TOWER_WALK.inner);
   colliders.push({type:'box',position:[site.x,site.y!+1.82,site.z],size:[1.05,1.475,.09],yaw:site.yaw});
  }
  const physics=await Physics.create(colliders),points=Array.from({length:241},(_,i)=>towerPoint(i/240));
  try{const p=points[0];physics.teleport({x:p.x,y:p.y+.9,z:p.z});await follow(physics,points);}finally{physics.dispose();}
 },30000);
});
