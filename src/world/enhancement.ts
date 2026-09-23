import { cutShaft } from './shaft';
import { enhancementFigure } from './enhancement-figure';
import * as THREE from 'three';
import { ENHANCEMENT as H, ENHANCEMENT_SUMMIT, enhancementGeometry, SHAFT, enhancementRamp, CAVE_APPROACH } from './enhancement-layout';
import { solidMesh, walkwayGeometry, guardRail } from './walkway';
import { addGlow, nightEmission } from './night-lighting';
import type { ColliderSpec } from '../game/physics';

/** The supplied Voronoi shell: original cells retained outside the single approved internal exit shaft. */
export function createEnhancementHill(parent: THREE.Group, colliders: ColliderSpec[]): void {
  const crystal = new THREE.MeshStandardMaterial({color:'#a6472c',metalness:.02,roughness:.96,flatShading:true,side:THREE.DoubleSide});
  nightEmission(crystal,'#a93b18',.09);
  const original=enhancementGeometry(),cut=cutShaft(original,new THREE.Vector3(SHAFT.x-SHAFT.half,-1,SHAFT.z-SHAFT.half),new THREE.Vector3(SHAFT.x+SHAFT.half,30,SHAFT.z+SHAFT.half));original.dispose();
  solidMesh(parent,colliders,cut,crystal,'Materialized Enhancements · original Voronoi shell');
  const surface=colliders[colliders.length-1];if(surface.type==='mesh')surface.climbable=true;
  const pathMaterial=new THREE.MeshStandardMaterial({color:'#bda58c',roughness:.9,side:THREE.DoubleSide}),rail=new THREE.MeshStandardMaterial({color:'#7b5140',metalness:.45,roughness:.5});
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
export function createEnhancementPanel(parent: THREE.Group): THREE.Mesh {
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#f0ebd8';ctx.fillRect(0,0,1200,900);ctx.fillStyle='#264e42';ctx.textAlign='center';
  const line=(text:string,y:number,size:number)=>{ctx.font=`${size>50?'700':'400'} ${size}px sans-serif`;ctx.fillText(text,600,y,1100);};
  line('MATERIALIZED',110,82);line('ENHANCEMENTS',205,82);line('A game. A knowledgebase. A bioart project.',315,36);
  line('Choose traits. Explore the evidence.',400,42);line('Turn your character into a printable crystal.',465,39);
  line('CLIMB: follow the amber markers',565,42);line('WALK: enter the cave to your right',635,42);line('JOIN HERE / enhancement.bio',745,53);line('Click to create your character',825,32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.25,1.69),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide}));panel.position.set(98.8,1.7,-157);panel.name='Enhancement · join here';panel.userData.href='https://enhancement.bio/';panel.userData.discovery='materialized-enhancements';parent.add(panel);
  const postMaterial=new THREE.MeshStandardMaterial({color:'#87604c',metalness:.4,roughness:.5});for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,6),postMaterial);post.position.set(panel.position.x+side*.8,.5,panel.position.z);parent.add(post);}
  return panel;
}
