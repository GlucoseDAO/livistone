import * as THREE from 'three';
import source from './models/enhancement-shell.json' with { type: 'json' };
export const ENHANCEMENT = { x:82,z:-178,top:20.0699524 };
export const ENHANCEMENT_SUMMIT = new THREE.Vector3(84.5473,ENHANCEMENT.top,-178.4444);
export function enhancementClearing(x:number,z:number,radius=0):boolean {
 const dx=26,dz=-19.617,t=THREE.MathUtils.clamp(((x-74)*dx+(z+135)*dz)/(dx*dx+dz*dz),0,1);
 return (Math.abs(x-ENHANCEMENT.x)<33+radius&&Math.abs(z-ENHANCEMENT.z)<24+radius)||Math.hypot(x-74-t*dx,z+135-t*dz)<3+radius;
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
export const CAVE_APPROACH = new THREE.CatmullRomCurve3([new THREE.Vector3(111,.12,-178),new THREE.Vector3(99,.12,-178),new THREE.Vector3(91,.12,-177),new THREE.Vector3(87,.12,-176),new THREE.Vector3(82,.12,-177.5),new THREE.Vector3(83,.12,-179.1),enhancementRamp()[0]]);
