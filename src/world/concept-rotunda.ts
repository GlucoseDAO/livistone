import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDMARKS } from '../game/content';
import type { ColliderSpec } from '../game/physics';
import { displayMaterial } from '../render/output';
import { ROTUNDA } from './concept-rotunda-layout';
import { addGlow } from './night-lighting';
import { gardenArch } from './garden-arch';

const IMAGES: Record<string, string> = { station: 'embryo', 'eyelense-gate': 'eyelense', 'winter-gate': 'winter', gateway: 'gateway', overview: 'overview', 'city-hall': 'city-hall', energy: 'energy', science: 'science', timeface: 'timeface', glucose: 'glucose', 'living-waters': 'lake', 'future-house': 'future-house', 'mycelium-garden': 'mycelium', enhancement: 'enhancement', 'jepii-mici': 'jepii' };
export function createConceptRotunda(parent: THREE.Group, colliders: ColliderSpec[], mobile: boolean): { panels: THREE.Mesh[]; ready: Promise<void> } {
  const root = new THREE.Group(); root.name = 'Concept rotunda'; parent.add(root);
  const panels: THREE.Mesh[] = [], loads: Promise<void>[] = [], boards: THREE.BufferGeometry[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: '#cec8b5', roughness: .86 }), green = new THREE.MeshStandardMaterial({ color: '#467147', roughness: .8, side: THREE.DoubleSide });
  const archMaterials = { stone, green, metal: new THREE.MeshStandardMaterial({ color: '#577364', metalness: .6, roughness: .35 }), ivory: new THREE.MeshStandardMaterial({ color: '#fff1db', roughness: .65, side: THREE.DoubleSide }), pink: new THREE.MeshStandardMaterial({ color: '#d88ca5', roughness: .65, side: THREE.DoubleSide }), gold: new THREE.MeshStandardMaterial({ color: '#bd8538', roughness: .72 }) };
  const addSolid = (g: THREE.BufferGeometry, m: THREE.Material, name: string): void => {
    const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.receiveShadow = true; root.add(mesh);
    colliders.push({ type: 'mesh', vertices: new Float32Array(g.getAttribute('position').array), indices: g.index ? new Uint32Array(g.index.array) : Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i) });
  };
  addSolid(new THREE.CylinderGeometry(ROTUNDA.radius, ROTUNDA.radius, .13, 96).translate(ROTUNDA.x, .065, ROTUNDA.z), stone, 'Continuous rotunda terrace');
  addSolid(new THREE.BoxGeometry(9, .13, 2.6).translate(118.5, .065, ROTUNDA.z), stone, 'Eyelense to rotunda threshold');
  const entries = [{ id: 'overview', name: 'A living world' }, { id: 'gateway', name: "King’s Chapel gateway" }, ...LANDMARKS];
  entries.forEach((entry, i) => {
    // The west sector stays open to the gate. Faces look into the circle; foliage never covers the picture aperture.
    const a = -Math.PI + .4 + i / (entries.length - 1) * (Math.PI * 2 - .8), x = ROTUNDA.x + Math.cos(a) * ROTUNDA.panels, z = ROTUNDA.z + Math.sin(a) * ROTUNDA.panels;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(x, .13, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a - Math.PI / 2), new THREE.Vector3(1, 1, 1));
    gardenArch(root, transform, colliders, archMaterials, mobile, i);
    const board = new THREE.BoxGeometry(3.84, 3.36, .1).translate(0, 2.5, 0).applyMatrix4(transform); boards.push(board);
    for (const side of [-1, 1]) boards.push(new THREE.CylinderGeometry(.018, .018, .72, 6).translate(side * 1.5, 4.52, 0).applyMatrix4(transform));
    colliders.push({ type: 'mesh', vertices: new Float32Array(board.getAttribute('position').array), indices: new Uint32Array(board.index!.array) });
    const canvas = document.createElement('canvas'); canvas.width = mobile ? 640 : 1024; canvas.height = mobile ? 560 : 896; const c = canvas.getContext('2d')!; c.scale(canvas.width / 1024, canvas.height / 896);
    const paint = (image?: HTMLImageElement): void => {
      c.fillStyle = '#f4f0e5'; c.fillRect(0, 0, 1024, 896); c.fillStyle = '#42644a'; c.font = '22px sans-serif'; c.fillText('LIVISTONE  /  CONCEPT GARDEN', 58, 65);
      c.fillStyle = '#263e34'; c.font = '40px Georgia'; c.fillText(entry.name, 58, 126, 908);
      if (image) { const scale = Math.min(900 / image.width, 594 / image.height), w = image.width * scale, h = image.height * scale; c.drawImage(image, (1024 - w) / 2, 170 + (594 - h) / 2, w, h); }
      else { c.strokeStyle = '#a8b99a'; c.lineWidth = 2; c.strokeRect(62, 181, 900, 567); c.fillStyle = '#63735b'; c.font = '32px Georgia'; c.textAlign = 'center'; c.fillText('A place for the next vision', 512, 445); c.font = '22px sans-serif'; c.fillText('Concept image to come', 512, 487); c.textAlign = 'left'; }
      c.fillStyle = '#586653'; c.font = '20px sans-serif'; c.fillText(image ? 'AI-generated architectural study · click to view' : 'Reserved for an original concept of this space', 58, 837, 908);
    };
    paint(); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = mobile ? 4 : 8;
    const material = displayMaterial({ map });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.74, 3.26).translate(0, 2.5, .055).applyMatrix4(transform), material); face.name = 'Concept · ' + entry.name; root.add(face);
    const file = IMAGES[entry.id];
    if (file) {
      const url = import.meta.env.BASE_URL + 'images/concepts/' + file + '.webp'; face.userData.href = url; panels.push(face);
      loads.push(new Promise(resolve => { const img = new Image(); img.onload = () => { paint(img); map.needsUpdate = true; resolve(); }; img.onerror = () => resolve(); img.src = url; }));
    }
    if (i % 3 === 0) addGlow(root, new THREE.Vector3(x, 4.6, z), '#f8dda3', 2.3, 10, 5, .25);
  });
  for (const [parts, material, name] of [[boards, stone, 'Suspended concept panels']] as const) {
    const g = mergeGeometries(parts as THREE.BufferGeometry[])!; const mesh = new THREE.Mesh(g, material); mesh.name = name; mesh.castShadow = true; root.add(mesh); parts.forEach(p => p.dispose());
  }
  return { panels, ready: Promise.all(loads).then(() => undefined) };
}
