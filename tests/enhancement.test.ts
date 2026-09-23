import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import { Physics } from '../src/game/physics';
import type { ColliderSpec } from '../src/game/physics';
import { createEnhancementHill } from '../src/world/enhancement';
import { enhancementGeometry,ENHANCEMENT_SUMMIT,enhancementRamp,CAVE_APPROACH,SHAFT,GALLERY,POSTER_SITES,STAND_SITES,ENHANCEMENT_SIGN } from '../src/world/enhancement-layout';
import { PLACE_SIGN,placeSignColliders } from '../src/world/place-sign';
import { crystalGeometry,enhancementGalleryColliders } from '../src/world/enhancement-gallery';
import { ENHANCEMENT_CATEGORIES } from '../src/game/enhancement';
import { PATH_CURVES,PATH_WIDTH } from '../src/world/landscape';
import crystals from '../src/world/models/enhancement-crystals.json';
import meta from '../data/enhancement/crystals/meta.json';
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
  const root=new THREE.Group(),colliders:ColliderSpec[]=[{type:'box',position:[82,-.2,-177],size:[45,.2,45]},...enhancementGalleryColliders(),...placeSignColliders(ENHANCEMENT_SIGN)];createEnhancementHill(root,colliders);
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
 it('keeps every generated triangle, one crystal per gene category, on its plinth',()=>{
  expect(crystals.crystals.map(c=>c.category).sort()).toEqual(ENHANCEMENT_CATEGORIES.map(c=>c.name).sort());
  for(const c of crystals.crystals){
   const source=meta.crystals.find(e=>e.category===c.category)!;expect(c.indices.length/3).toBe(source.faces);expect(c.triangles).toBe(source.faces);expect(c.sha256).toBe(source.sha256);
   const box=new THREE.Box3().setFromBufferAttribute(crystalGeometry(c).getAttribute('position') as THREE.BufferAttribute),size=box.getSize(new THREE.Vector3());
   expect(box.min.y).toBeCloseTo(0,5);expect(size.x).toBeLessThan(GALLERY.standWidth);expect(size.z).toBeLessThan(.9);
  }
 });
 it('keeps the poster row clear of routes, the marked climb and every overhang',()=>{
  const shell=new THREE.Mesh(enhancementGeometry(),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster(),routes=[...PATH_CURVES.map(c=>c.getPoints(200)),CAVE_APPROACH.getPoints(100)];shell.updateMatrixWorld(true);
  const climb=(x:number,z:number)=>{const dx=-12.8,dz=-19.733,t=THREE.MathUtils.clamp(((x-100)*dx+(z+154.617)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-100-t*dx,z+154.617-t*dz);};
  const items=[...POSTER_SITES.map(p=>({p,w:GALLERY.posterWidth/2})),...STAND_SITES.map(p=>({p,w:GALLERY.standWidth/2}))].sort((a,b)=>a.p.x-b.p.x);
  const half=PLACE_SIGN.width/2+PLACE_SIGN.frame,sign=[-half,0,half].map(d=>({x:ENHANCEMENT_SIGN.x+Math.cos(ENHANCEMENT_SIGN.yaw)*d,z:ENHANCEMENT_SIGN.z-Math.sin(ENHANCEMENT_SIGN.yaw)*d}));
  for(const {x,z} of sign){
   ray.set(new THREE.Vector3(x,.05,z),new THREE.Vector3(0,1,0));expect(ray.intersectObject(shell).length).toBe(0);expect(climb(x,z)).toBeGreaterThan(2.2);
   expect(routes.every(route=>route.every(q=>Math.hypot(q.x-x,q.z-z)>PATH_WIDTH/2+.5))).toBe(true);
   for(const item of items)expect(Math.hypot(item.p.x-x,item.p.z-z)).toBeGreaterThan(item.w+.8);
  }
  items.forEach((item,i)=>{
   for(const dx of [-item.w,0,item.w])for(const dz of [-.5,0,.5]){
    const x=item.p.x+dx,z=item.p.z+dz;ray.set(new THREE.Vector3(x,.05,z),new THREE.Vector3(0,1,0));const hit=ray.intersectObject(shell)[0];
    expect(!hit||hit.point.y>4.2,JSON.stringify({x,z,y:hit?.point.y})).toBe(true);expect(climb(x,z)).toBeGreaterThan(2.4);
    expect(routes.every(route=>route.every(q=>Math.hypot(q.x-x,q.z-z)>PATH_WIDTH/2+.5))).toBe(true);
   }
   if(i)expect(item.p.x-item.w-(items[i-1].p.x+items[i-1].w)).toBeGreaterThan(.8);
  });
 });
 it('walks the length of the poster row and through a gap',async()=>{
  const colliders:ColliderSpec[]=[{type:'box',position:[82,-.2,-177],size:[45,.2,45]},...enhancementGalleryColliders(),...placeSignColliders(ENHANCEMENT_SIGN)];createEnhancementHill(new THREE.Group(),colliders);
  const physics=await Physics.create(colliders),gap=(POSTER_SITES[0].x+GALLERY.posterWidth/2+STAND_SITES[0].x-GALLERY.standWidth/2)/2;
  try{
   physics.teleport({x:91,y:1.05,z:-156.4});await follow(physics,Array.from({length:17},(_,i)=>new THREE.Vector3(91-i*2,0,-156.4)));
   physics.teleport({x:gap,y:1.05,z:-156.4});await follow(physics,[new THREE.Vector3(gap,0,-158.5),new THREE.Vector3(gap,0,-161.2),new THREE.Vector3(gap,0,-156.4)]);
  }finally{physics.dispose();}
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
