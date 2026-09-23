import * as THREE from 'three';
import human from './models/enhancement-human.json';
import { enhancementGeometry, ENHANCEMENT_STATUE } from './enhancement-layout';
import { nightEmission, addGlow } from './night-lighting';

/** Continuous CC0 MakeHuman anatomy, posed as an outstretched sculptural monument. */
export function enhancementFigure(parent: THREE.Group): THREE.Group {
  const figure = new THREE.Group();
  figure.name = 'Enhancement · human monument';
  figure.position.copy(ENHANCEMENT_STATUE);
  parent.add(figure);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(human.positions, 3));
  geometry.setIndex(human.indices);
  geometry.computeVertexNormals();
  const skin = new THREE.MeshStandardMaterial({ color: '#d3bfa7', metalness: .18, roughness: .65 });
  nightEmission(skin, '#caa387', .12);
  const body = new THREE.Mesh(geometry, skin);
  body.name = 'Human · continuous anatomical surface';
  body.castShadow = true;
  figure.add(body);
  const form = enhancementGeometry();
  form.translate(-82, 0, 178).rotateX(Math.PI / 2).scale(.026, .026, .026).translate(0, 5.85, .43);
  const heart = new THREE.MeshStandardMaterial({ color: '#a89bff', metalness: .3, roughness: .35, flatShading: true, side: THREE.DoubleSide });
  nightEmission(heart, '#8c74ff', 1.8);
  const chest = new THREE.Mesh(form, heart);
  chest.name = 'Human · Voronoi chest';
  figure.add(chest);
  addGlow(figure, new THREE.Vector3(0, 5.85, .65), '#b9a8ff', 2.2, 10, 5, .18);
  return figure;
}
