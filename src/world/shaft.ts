import * as THREE from 'three';
/** Subtract one axis-aligned shaft, clipping faces at its boundary rather than deleting whole cells. */
export function cutShaft(source:THREE.BufferGeometry,min:THREE.Vector3,max:THREE.Vector3):THREE.BufferGeometry {
 const p=source.getAttribute('position'),index=source.index!,vertices:number[]=[];
 const planes=[(v:THREE.Vector3)=>min.x-v.x,(v:THREE.Vector3)=>v.x-max.x,(v:THREE.Vector3)=>min.y-v.y,(v:THREE.Vector3)=>v.y-max.y,(v:THREE.Vector3)=>min.z-v.z,(v:THREE.Vector3)=>v.z-max.z];
 const clip=(poly:THREE.Vector3[],plane:(v:THREE.Vector3)=>number,inside:boolean)=>{
  const result:THREE.Vector3[]=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=plane(a),db=plane(b),ka=inside?da<=0:da>=0,kb=inside?db<=0:db>=0;
   if(ka)result.push(a);if(ka!==kb)result.push(a.clone().lerp(b,da/(da-db)));
  }return result;
 };
 const append=(poly:THREE.Vector3[])=>{for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])vertices.push(v.x,v.y,v.z);};
 for(let i=0;i<index.count;i+=3){let poly=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+j)));
  if(planes.some(plane=>poly.every(v=>plane(v)>=0))){append(poly);continue;}
  for(const plane of planes){append(clip(poly,plane,false));poly=clip(poly,plane,true);if(poly.length<3)break;}
 }
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));out.computeVertexNormals();return out;
}
