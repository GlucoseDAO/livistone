import * as THREE from 'three';
import source from './models/enhancement-shell.json' with { type: 'json' };
export const ENHANCEMENT = { x:82,z:-178,top:20.0699524 };
export const ENHANCEMENT_SUMMIT = new THREE.Vector3(84.5473,ENHANCEMENT.top,-178.4444);
export function enhancementClearing(x:number,z:number,radius=0):boolean {
 const dx=26,dz=-19.617,t=THREE.MathUtils.clamp(((x-74)*dx+(z+135)*dz)/(dx*dx+dz*dz),0,1);
 return (Math.abs(x-ENHANCEMENT.x)<33+radius&&Math.abs(z-ENHANCEMENT.z)<24+radius)||Math.hypot(x-74-t*dx,z+135-t*dz)<3+radius;
}
// The shell's ground footprint: the convex hull of its plan, which covers the overhangs and the cave behind its mouth. A
// convex outline keeps the grass field's 2 m interpolation from cutting into it at notches.
const HULL=((): number[][] => {
 const p=source.positions as number[],points:number[][]=[];for(let i=0;i<p.length;i+=3)points.push([p[i]+ENHANCEMENT.x,p[i+2]+ENHANCEMENT.z]);
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o:number[],a:number[],b:number[]):number=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lower:number[][]=[],upper:number[][]=[];
 for(const q of points){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],q)<=0)lower.pop();lower.push(q);}
 for(const q of [...points].reverse()){while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],q)<=0)upper.pop();upper.push(q);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
})();
/** Signed distance from the hull's outline (negative inside). */
function hillDistance(x:number,z:number):number {
 let best=Infinity,inside=true;
 for(let k=0;k<HULL.length;k++){const a=HULL[k],b=HULL[(k+1)%HULL.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.min(1,Math.max(0,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;}
 return inside?-best:best;
}
const groundLamps=Array.from({length:24},(_,k)=>{const t=Math.floor(k/2)/12;return [100+(87.2-100)*t+(k%2?1.25:-1.25),-154.617+(-174.35+154.617)*t];});
let caveWalk:THREE.Vector3[]|null=null;
/**
 * What stands on the clearing's ground: the shell's whole plan (overhangs and the cave included), the cave entry walk, the
 * display row, the sign's posts and the climb's ground lamps (.75 m discs, resolvable on the 2 m lookup). The rest of
 * enhancementClearing is meadow.
 */
export function enhancementGround(x:number,z:number,radius=0):boolean {
 if(Math.abs(x-ENHANCEMENT.x)>45+radius||Math.abs(z-ENHANCEMENT.z)>35+radius)return false;
 if(hillDistance(x,z)<radius)return true;
 if(x>GALLERY_ROW.west-radius&&x<GALLERY_ROW.east+radius&&Math.abs(z-GALLERY.z)<GALLERY_ROW.half+radius)return true;
 for(const side of [-1,1])if(Math.hypot(x-ENHANCEMENT_SIGN.x-Math.cos(ENHANCEMENT_SIGN.yaw)*side*1.25,z-ENHANCEMENT_SIGN.z+Math.sin(ENHANCEMENT_SIGN.yaw)*side*1.25)<.12+radius)return true;
 if(groundLamps.some(([lx,lz])=>Math.hypot(x-lx,z-lz)<.75+radius))return true;
 const walk=caveWalk??=CAVE_APPROACH.getPoints(70);
 for(let k=1;k<walk.length;k++){const a=walk[k-1],b=walk[k],dx=b.x-a.x,dz=b.z-a.z,t=Math.min(1,Math.max(0,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<1.1+.3+radius)return true;}
 return false;
}
/** Original STL triangles, uniformly scaled and translated. Preserve every opening. */
export function enhancementGeometry():THREE.BufferGeometry {
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));geometry.setIndex(source.indices);geometry.translate(ENHANCEMENT.x,0,ENHANCEMENT.z);geometry.computeVertexNormals();return geometry;
}

export const SHAFT = { x:84.5473,z:-180.6,half:2.5 };
export const ENHANCEMENT_STATUE = new THREE.Vector3(84.5473,20.1,-175.5);
export function enhancementRamp():THREE.Vector3[] {
 const points=Array.from({length:401},(_,i)=>{const t=i/400,a=t*Math.PI*8;return new THREE.Vector3(SHAFT.x+Math.sin(a)*1.5,.12+t*19.98,SHAFT.z+Math.cos(a)*1.5);});
 const last=points[points.length-1];for(let i=1;i<=20;i++)points.push(last.clone().lerp(new THREE.Vector3(SHAFT.x,20.1,-176.8),i/20));return points;
}
/** Beside the start of the marked climb, not on it; faces the map arrival point. */
export const ENHANCEMENT_SIGN = { x: 93.4, z: -157.5, yaw: 1 };
/** One row between the approach and the hill's south face: category stands alternate with posters from the arrival end westward. Gaps stay walkable and the ascent line stays clear. */
export const GALLERY = { z: -160, east: 91.1, step: 2.6, posterWidth: 2.1, standWidth: 1.4 };
export const galleryX = (i: number): number => GALLERY.east - i * GALLERY.step;
export const STAND_SITES = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(galleryX(i * 2), 0, GALLERY.z));
export const POSTER_SITES = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(galleryX(i * 2 + 1), 0, GALLERY.z));
/**
 * The display row's ground, from the outer stand's plinth to the far poster board (enhancement-gallery.ts): one strip that
 * reaches .75 m either side, with the walkable gaps worn bare between, so the grass field's 2 m lookup resolves it.
 */
export const GALLERY_ROW = { half:.75, east:GALLERY.east+.72, west:GALLERY.east-11*GALLERY.step-GALLERY.posterWidth/2 };
export const CAVE_APPROACH = new THREE.CatmullRomCurve3([new THREE.Vector3(111,.12,-178),new THREE.Vector3(99,.12,-178),new THREE.Vector3(91,.12,-177),new THREE.Vector3(87,.12,-176),new THREE.Vector3(82,.12,-177.5),new THREE.Vector3(83,.12,-179.1),enhancementRamp()[0]]);
