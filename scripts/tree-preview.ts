import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TREE_SPECIES } from '../src/world/forest-layout';

// Dev-only review of the tree GLBs side by side at their true sizes, with a person-sized post for scale.
const names = (new URLSearchParams(location.search).get('trees') ?? 'oak,ash,spruce,larch,dwarf-pine').split(',');
const renderer = new THREE.WebGPURenderer({ antialias: true }); await renderer.init();
renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(devicePixelRatio); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfd8dc');
scene.add(new THREE.HemisphereLight('#e8f0ff', '#5b5040', 1.4));
const sun = new THREE.DirectionalLight('#fff4e0', 2.6); sun.position.set(20, 30, 25); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#7c8a5c' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const loader = new GLTFLoader(), files = new Map<string, THREE.Group>(); let x = -(names.length - 1) * 7.5;
for (const name of names) {
  const species = TREE_SPECIES.find(s => s.name === name)!, file = files.get(species.file) ?? (await loader.loadAsync('/models/trees/' + species.file + '.glb')).scene; files.set(species.file, file);
  const tree = (species.file === name ? file : file.getObjectByName(name)!).clone(); tree.position.set(x, 0, 0); scene.add(tree);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 1.8), new THREE.MeshStandardMaterial({ color: '#b03a2e' })); post.position.set(x + 4, .9, 3); scene.add(post);
  x += 15;
}
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 500); camera.position.set(0, 9, 62);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 6, 0); controls.update();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
Object.assign(window, { previewReady: true });
