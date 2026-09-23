import { cutShaft } from './shaft';
import { enhancementFigure } from './enhancement-figure';
import * as THREE from 'three';
import { ENHANCEMENT as H, ENHANCEMENT_SUMMIT, enhancementGeometry, SHAFT, enhancementRamp, CAVE_APPROACH, ENHANCEMENT_SIGN } from './enhancement-layout';
import { createPlaceSign, paintPlaceSign } from './place-sign';
import { ENHANCEMENT_URL } from '../game/enhancement';
import { solidMesh, walkwayGeometry, guardRail } from './walkway';
import { addGlow, nightEmission } from './night-lighting';
import type { ColliderSpec } from '../game/physics';

/** Satin violet after the project's rendered and printed crystals; coplanar triangles share a tone so each Voronoi facet reads. */
function facetColors(geometry: THREE.BufferGeometry): void {
  const p=geometry.getAttribute('position'),colors=new Float32Array(p.count*3),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3(),color=new THREE.Color();
  const tones=['#6c58d6','#7d6ae6','#5d4cc6','#8f80ef','#7262dd','#a497f3'].map(t=>new THREE.Color(t)),top=new THREE.Color('#d8d0ff'),base=new THREE.Color('#3d3190');
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);n.subVectors(b,a).cross(c.clone().sub(a)).normalize();
    const key=Math.round(n.x*12)*7+Math.round(n.y*12)*13+Math.round(n.z*12)*29,h=(a.y+b.y+c.y)/60;
    color.copy(tones[(key%6+6)%6]).lerp(h>.5?top:base,Math.abs(h-.5)*.55);
    for(let j=0;j<3;j++)colors.set([color.r,color.g,color.b],(i+j)*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
}
/** The supplied Voronoi shell: original cells retained outside the single approved internal exit shaft. */
export function createEnhancementHill(parent: THREE.Group, colliders: ColliderSpec[]): void {
  const crystal = new THREE.MeshStandardMaterial({vertexColors:true,metalness:.28,roughness:.36,flatShading:true,side:THREE.DoubleSide});
  nightEmission(crystal,'#5a42c8',.11);
  const original=enhancementGeometry(),cut=cutShaft(original,new THREE.Vector3(SHAFT.x-SHAFT.half,-1,SHAFT.z-SHAFT.half),new THREE.Vector3(SHAFT.x+SHAFT.half,30,SHAFT.z+SHAFT.half));original.dispose();facetColors(cut);
  solidMesh(parent,colliders,cut,crystal,'Materialized Enhancements · original Voronoi shell');
  const surface=colliders[colliders.length-1];if(surface.type==='mesh')surface.climbable=true;
  const pathMaterial=new THREE.MeshStandardMaterial({color:'#d6d0e2',roughness:.85,side:THREE.DoubleSide}),rail=new THREE.MeshStandardMaterial({color:'#9c9ab4',metalness:.6,roughness:.35});
  const ramp=enhancementRamp();solidMesh(parent,colliders,walkwayGeometry(ramp,1.6),pathMaterial,'Enhancement · internal spiral');
  solidMesh(parent,colliders,walkwayGeometry(CAVE_APPROACH.getPoints(70),2.2),pathMaterial,'Enhancement · existing cave entry');
  for(const side of [-1,1]){
    const edge=ramp.map((p,i)=>{const d=ramp[Math.min(i+1,ramp.length-1)].clone().sub(ramp[Math.max(0,i-1)]);return p.clone().addScaledVector(new THREE.Vector3(-d.z,0,d.x).normalize(),side*.8);});
    guardRail(parent,colliders,edge.filter((_,i)=>i>=5&&i%2===0),rail);
  }
  solidMesh(parent,colliders,cutShaft(new THREE.CylinderGeometry(2.1,4.3,4.1,32).translate(SHAFT.x,18.05,-176.4),new THREE.Vector3(SHAFT.x-SHAFT.half,-1,SHAFT.z-SHAFT.half),new THREE.Vector3(SHAFT.x+SHAFT.half,30,SHAFT.z+SHAFT.half)),pathMaterial,'Enhancement · summit landing');
  const landing=colliders[colliders.length-1];if(landing.type==='mesh')landing.climbable=true;
  enhancementFigure(parent);
  for(const side of [-1,1])colliders.push({type:'box',position:[SHAFT.x+side*.5,21.9,-175.5],size:[.33,1.8,.4]});
  for(const [x,y,z] of [[101,1.3,-178],[93,1.3,-178],[87,1.4,-178],...ramp.filter((_,i)=>i%50===0).map(p=>[p.x,p.y+.4,p.z])])addGlow(parent,new THREE.Vector3(x,y,z),'#ffbb79',3.5,24,7,.25);
  const lamp=new THREE.MeshStandardMaterial({color:'#ffdb9d',emissive:'#ffab53',emissiveIntensity:.15,roughness:.3});nightEmission(lamp,'#ffab53',2);
  // Foot lights sit on existing facets, never on a filled-in surface.
  const shell=parent.getObjectByName('Materialized Enhancements · original Voronoi shell')!;shell.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const arrowShape=new THREE.Shape();arrowShape.moveTo(-.4,-.25);arrowShape.lineTo(0,.3);arrowShape.lineTo(.4,-.25);arrowShape.lineTo(.2,-.25);arrowShape.lineTo(0,.03);arrowShape.lineTo(-.2,-.25);arrowShape.closePath();
  const arrowMaterial=new THREE.MeshStandardMaterial({color:'#ffe0a6',roughness:.7,side:THREE.DoubleSide});nightEmission(arrowMaterial,'#ffb457',1);
  for(let i=1;i<17;i++){
    const t=i/17,x=100+(87.2-100)*t,z=-154.617+(-174.35+154.617)*t;
    ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(shell)[0];if(!hit)continue;
    const normal=hit.face!.normal.clone();if(normal.y<0)normal.negate();const forward=new THREE.Vector3(-12.8,0,-19.733).projectOnPlane(normal).normalize(),right=forward.clone().cross(normal).normalize();
    const arrow=new THREE.Mesh(new THREE.ShapeGeometry(arrowShape),arrowMaterial);arrow.setRotationFromMatrix(new THREE.Matrix4().makeBasis(right,forward,normal));arrow.position.copy(hit.point).addScaledVector(normal,.025);arrow.name='Outside ascent · painted arrow';parent.add(arrow);
  }
  const caveLink=new THREE.CatmullRomCurve3([[100,-154.617],[108,-159],[112,-170],[111,-178]].map(([x,z])=>new THREE.Vector3(x,.3,z)));
  for(let i=0;i<7;i++){const p=caveLink.getPoint(i/6);const beacon=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,0),lamp);beacon.position.copy(p);parent.add(beacon);addGlow(parent,p,'#ffbb79',2,8,5,.2);}
  for(let i=0;i<12;i++) {
    const t=i/12,x=100+(87.2-100)*t,z=-154.617+(-174.35+154.617)*t;
    for(const side of [-1,1]) {
      ray.set(new THREE.Vector3(x+side*1.25,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(shell)[0];
      const p=hit?hit.point.clone():new THREE.Vector3(x+side*1.25,0,z);p.y+=.25;
      const light=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),lamp);light.position.copy(p);parent.add(light);addGlow(parent,p,'#ffb76e',2.2,6,5,.23);
    }
  }
}
/** The participation sign stands beside the start of the marked climb, turned toward arrivals. */
export function createEnhancementPanel(parent: THREE.Group, colliders: ColliderSpec[]): { panels: THREE.Mesh[]; position: THREE.Vector3 } {
  const sign=createPlaceSign(parent,colliders,ENHANCEMENT_SIGN,'Enhancement · join here');
  paintPlaceSign(sign,{eyebrow:'Bioart · participate',title:'Materialized Enhancements',body:'A game, a gene knowledgebase and a bioart project. Choose real genes from real animals, see how far their evidence reached, and grow a printable crystal. Climb the amber markers to the summit, or follow the road round to the lit cave.',footer:'Click to create your character at enhancement.bio ↗'});
  for(const face of sign.faces){face.userData.href=ENHANCEMENT_URL;face.userData.discovery='materialized-enhancements';}
  return {panels:sign.faces,position:sign.position};
}
