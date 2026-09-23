import { paintPosterText } from './poster-text';
import * as THREE from 'three';
import { addGlow, nightEmission } from './night-lighting';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';
import { RESEARCH_POSTERS } from '../game/research';
import { GLUCOSE_PAVILION as SITE, GLUCOSE_POSTERS } from './glucose-layout';
import insulin from './molecules/insulin.json';
import glucose from './molecules/glucose.json';

const UP = new THREE.Vector3(0, 1, 0);
const original = insulin.chains.flatMap((chain) => chain.residues.map((r) => new THREE.Vector3(...r.position as [number, number, number])));
const bounds = new THREE.Box3().setFromPoints(original), center = bounds.getCenter(new THREE.Vector3());
/** One rigid axis rotation and uniform scale preserve the deposited fold; lift it clear of every walking route. */
export function insulinPoint(position: number[]): THREE.Vector3 {
  return new THREE.Vector3(SITE.x + (position[0] - center.x) * .53, SITE.canopyY + (position[2] - bounds.min.z) * .53, SITE.z - (position[1] - center.y) * .53);
}
function solid(geometry: THREE.BufferGeometry, material: THREE.Material, root: THREE.Object3D, colliders: ColliderSpec[], position = new THREE.Vector3(), yaw = 0): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material); object.position.copy(position); object.rotation.y = yaw; object.castShadow = true; object.receiveShadow = true; root.add(object);
  object.updateWorldMatrix(true, false); const world = geometry.clone().applyMatrix4(object.matrixWorld);
  colliders.push({ type: 'mesh', vertices: new Float32Array(world.getAttribute('position').array), indices: world.index ? new Uint32Array(world.index.array) : Uint32Array.from({ length: world.getAttribute('position').count }, (_, i) => i) }); world.dispose(); return object;
}
function tube(points: THREE.Vector3[], radius: number, mobile: boolean): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * (mobile ? 4 : 8)), radius, mobile ? 6 : 10, false);
}
function band(points: THREE.Vector3[], mobile: boolean): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points), count = points.length * (mobile ? 5 : 10), frames = curve.computeFrenetFrames(count, false);
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= count; i++) for (let j = 0; j < 8; j++) {
    const angle = j / 8 * Math.PI * 2, p = curve.getPointAt(i / count).addScaledVector(frames.normals[i], Math.cos(angle) * .56).addScaledVector(frames.binormals[i], Math.sin(angle) * .19);
    vertices.push(p.x, p.y, p.z);
    if (i < count) { const a = i * 8 + j, b = i * 8 + (j + 1) % 8; indices.push(a, a + 8, b, b, a + 8, b + 8); }
  }
  for (let j = 1; j < 7; j++) { indices.push(0, j, j + 1); const end = count * 8; indices.push(end, end + j + 1, end + j); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** DOM-independent architecture and collision, shared by the browser and headless traversal tests. */
export function createGlucoseStructure(root: THREE.Object3D, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): { group: THREE.Group; panels: THREE.Mesh[] } {
  const group = new THREE.Group(); group.name = 'Glucose Commons · human insulin 1TRZ'; root.add(group);
  const white = new THREE.MeshStandardMaterial({ color: '#eeeade', roughness: .46, metalness: .17 });
  const silver = new THREE.MeshStandardMaterial({ color: '#91b7ad', roughness: .27, metalness: .72 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c8a061', roughness: .35, metalness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: '#294a43', roughness: .68 });
  solid(new THREE.CylinderGeometry(SITE.radius, SITE.radius + .18, .16, mobile ? 48 : 80), paving, group, colliders, new THREE.Vector3(SITE.x, .08, SITE.z));
  const chains = insulin.chains.map((chain) => chain.residues.map((r) => insulinPoint(r.position)));
  chains.forEach((points, i) => { const object = solid(band(points, mobile), i ? white : silver, group, colliders); object.name = `Insulin chain ${insulin.chains[i].id}`; });
  for (const bond of insulin.disulfides) {
    const ends = bond.positions.map(insulinPoint), object = solid(tube(ends, .17, mobile), gold, group, colliders); object.name = `Disulfide ${bond.from}–${bond.to}`;
    for (const sidechain of bond.sidechains) solid(tube(sidechain.map(insulinPoint), .085, mobile), gold, group, colliders);
    for (const end of ends) solid(new THREE.SphereGeometry(.24, 8, 6), gold, group, colliders, end);
  }
  // Supports meet actual fold coordinates while leaving the north–south axis and poster approaches open.
  for (const [x, z] of [[-4.3, -7.4], [4.3, -7.4], [-4.3, 7.4], [4.3, 7.4]]) {
    const foot = new THREE.Vector3(SITE.x + x, SITE.floorY, SITE.z + z);
    const tip = chains.flat().reduce((a, b) => b.distanceTo(foot) < a.distanceTo(foot) ? b : a);
    solid(tube([foot, new THREE.Vector3(foot.x, 3.3, foot.z), new THREE.Vector3((foot.x + tip.x) / 2, tip.y - .6, (foot.z + tip.z) / 2), tip], .21, mobile), white, group, colliders);
  }
  // A separate, explicitly identified glucose graph occupies a side alcove, never the through route.
  const atomPoints = new Map(glucose.atoms.map((atom) => [atom.id, new THREE.Vector3(SITE.x + 3.8 + atom.position[0] * .42, 2.2 + atom.position[2] * .42, SITE.z + 6.2 - atom.position[1] * .42)]));
  const oxygen = new THREE.MeshStandardMaterial({ color: '#e49d86', emissive: '#ff7955', emissiveIntensity: .55, roughness: .25, metalness: .2 });
  const carbon = white.clone(), bonds = silver.clone(); carbon.emissive.set('#8cf4df'); carbon.emissiveIntensity = .35; bonds.emissive.set('#9effe8'); bonds.emissiveIntensity = .45;
  nightEmission(oxygen, '#ff7955', 2); nightEmission(carbon, '#8cf4df', 1.6); nightEmission(bonds, '#9effe8', 1.2);
  addGlow(group, new THREE.Vector3(SITE.x + 3.8, 2.3, SITE.z + 6.2), '#8fffe1', 5.5, 30, 8, .48);
  addGlow(group, new THREE.Vector3(SITE.x, 5, SITE.z), '#a2ddd2', 16, 65, 19, .22);
  for (const atom of glucose.atoms) solid(new THREE.SphereGeometry(.16, mobile ? 8 : 12, 8), atom.element === 'O' ? oxygen : carbon, group, colliders, atomPoints.get(atom.id)!);
  for (const [from, to] of glucose.bonds) {
    const a = atomPoints.get(from)!, b = atomPoints.get(to)!, geometry = new THREE.CylinderGeometry(.055, .055, a.distanceTo(b), 6); geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()));
    solid(geometry, bonds, group, colliders, a.clone().lerp(b, .5));
  }
  solid(new THREE.CylinderGeometry(.12, .2, 1.65, 8), gold, group, colliders, new THREE.Vector3(SITE.x + 3.8, .98, SITE.z + 6.2));
  const panels = GLUCOSE_POSTERS.map((site, i) => {
    const position = new THREE.Vector3(site.x, 1.98, site.z);
    const frame = solid(new THREE.BoxGeometry(2.62, 3.1, .14), dark, group, colliders, position, site.yaw); frame.name = RESEARCH_POSTERS[i].title;
    solid(new THREE.BoxGeometry(1.7, .25, .65), white, group, colliders, new THREE.Vector3(site.x, .285, site.z), site.yaw);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.46, 2.94), new THREE.MeshBasicMaterial({ color: '#f2eee3' })); panel.position.copy(position).add(new THREE.Vector3(0, 0, .076).applyAxisAngle(UP, site.yaw)); panel.rotation.y = site.yaw; panel.userData.discovery = RESEARCH_POSTERS[i].id; group.add(panel); return panel;
  });
  return { group, panels };
}
function wrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number): number {
  let current = '';
  for (const word of text.split(' ')) {
    if (current && ctx.measureText(current + ' ' + word).width > width) { ctx.fillText(current, x, y); y += line; current = word; }
    else current += (current ? ' ' : '') + word;
  }
  ctx.fillText(current, x, y); return y + line;
}
async function posterTexture(index: number): Promise<THREE.CanvasTexture> {
  const poster = RESEARCH_POSTERS[index], canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1200;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f2eee3'; ctx.fillRect(0, 0, 1000, 1200);
  ctx.fillStyle = '#244f46'; ctx.fillRect(0, 0, 1000, 118); ctx.fillStyle = '#f8f2df'; ctx.font = '500 32px sans-serif'; ctx.fillText('GLUCOSE COMMONS', 60, 72);
  ctx.fillStyle = '#977246'; ctx.font = '24px sans-serif'; ctx.fillText(poster.category, 60, 176);
  ctx.fillStyle = '#23473f'; ctx.font = '54px Georgia, serif'; const end = wrapped(ctx, poster.title, 60, 253, 880, 65);
  const image = new Image(); image.src = poster.slides[0].image!; await image.decode();
  const scale = Math.min(880 / image.naturalWidth, 430 / image.naturalHeight);
  ctx.drawImage(image, 60 + (880 - image.naturalWidth * scale) / 2, end + 8, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.fillStyle = '#304b44'; paintPosterText(ctx, poster.body, 60, end + 465, 880, 1040 - (end + 465), 36);
  ctx.fillStyle = '#d6cdb8'; ctx.fillRect(60, 1063, 880, 2); ctx.fillStyle = '#315a4f'; ctx.font = '28px sans-serif';
  ctx.fillText(`${poster.slides.length} slides  ·  click / tap / E`, 60, 1120);
  ctx.font = '22px sans-serif'; ctx.fillText(poster.category.startsWith('06') ? 'rcsb.org  /  1TRZ + GLC' : 'glucosedao.github.io', 60, 1164);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
export function createGlucosePavilion(root: THREE.Object3D, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): { panels: THREE.Mesh[]; interactives: Interactive[]; ready: Promise<void> } {
  const { group, panels } = createGlucoseStructure(root, colliders, mobile, paving);
  const ready = Promise.all(panels.map(async (panel, i) => { (panel.material as THREE.MeshBasicMaterial).map = await posterTexture(i); (panel.material as THREE.Material).needsUpdate = true; })).then(() => undefined);
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 300; const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#23473f'; ctx.fillRect(0, 0, 1600, 300); ctx.textAlign = 'center'; ctx.fillStyle = '#f2eee3'; ctx.font = '88px Georgia, serif'; ctx.fillText('Glucose Commons', 800, 132); ctx.font = '33px sans-serif'; ctx.fillText('LIVIA ZAHARIA  /  GLUCOSEDAO  /  OPEN RESEARCH', 800, 220);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.22, .12), new THREE.MeshBasicMaterial({ map })); sign.position.set(SITE.x, 3.7, SITE.z + 8.5); group.add(sign);
  colliders.push({ type: 'box', position: [sign.position.x, sign.position.y, sign.position.z], size: [3.25, .61, .06] });
  return { panels, ready, interactives: panels.map((object, i) => ({ id: RESEARCH_POSTERS[i].id, object, position: object.position.clone() })) };
}
