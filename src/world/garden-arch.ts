import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';

/** A curved petal/leaf surface with real depth, not a face-on flower card. */
function petal(length: number, width: number, cup: number): THREE.BufferGeometry {
  const p: number[] = [], uv: number[] = [], indices: number[] = [], rows = 5, columns = 4;
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    const t = r / rows, across = c / columns * 2 - 1;
    p.push(across * Math.sin(Math.PI * t) * width, t * length, cup * (t * t + across * across * Math.sin(Math.PI * t) * .65));
    uv.push(c / columns, t);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const a = r * (columns + 1) + c, b = a + columns + 1; indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export interface ArchMaterials { metal: THREE.Material; green: THREE.Material; ivory: THREE.Material; pink: THREE.Material; gold: THREE.Material; stone: THREE.Material }
export function gardenArch(parent: THREE.Group, transform: THREE.Matrix4, colliders: ColliderSpec[], materials: ArchMaterials, mobile: boolean, seed: number): void {
  const parts: Record<keyof ArchMaterials, THREE.BufferGeometry[]> = { metal: [], green: [], ivory: [], pink: [], gold: [], stone: [] };
  const add = (g: THREE.BufferGeometry, material: keyof ArchMaterials, solid = false): void => {
    g.applyMatrix4(transform); parts[material].push(g);
    if (solid) colliders.push({ type: 'mesh', vertices: Float32Array.from(g.getAttribute('position').array), indices: g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: g.getAttribute('position').count }, (_, i) => i) });
  };
  const points: THREE.Vector3[] = [new THREE.Vector3(-2.32, .45, 0), new THREE.Vector3(-2.32, 1.7, 0)];
  for (let i = 0; i <= 20; i++) { const a = Math.PI - i / 20 * Math.PI; points.push(new THREE.Vector3(Math.cos(a) * 2.32, 3.2 + Math.sin(a) * 2.32, 0)); }
  points.push(new THREE.Vector3(2.32, 1.7, 0), new THREE.Vector3(2.32, .45, 0));
  const curve = new THREE.CatmullRomCurve3(points);
  for (const z of [-.32, .32]) add(new THREE.TubeGeometry(curve, 64, .065, 8, false).translate(0, 0, z), 'metal', true);
  for (let i = 0; i <= 16; i++) { const at = curve.getPointAt(i / 16); add(new THREE.CylinderGeometry(.035, .035, .64, 6).rotateX(Math.PI / 2).translate(at.x, at.y, 0), 'metal'); }
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(.74, .42, 1.08).translate(side * 2.32, .21, 0), 'stone', true);
    add(new THREE.BoxGeometry(.62, .035, .96).translate(side * 2.32, .435, 0), 'green');
  }
  // Climbing stems wind through a deep trellis. Leaf clusters sit outside the print aperture.
  for (const z of [.34, -.28]) {
    const stem = Array.from({ length: 65 }, (_, i) => { const p = curve.getPointAt(i / 64); p.x += Math.sin(i * .9 + seed) * .1; p.z = z + Math.cos(i * 1.1) * .08; return p; });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stem), 80, .026, 5, false), 'green');
  }
  const leaf = petal(.34, .105, .07), bloomPetal = petal(.18, .082, .065);
  const count = mobile ? 34 : 52;
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt((i + .3) / count), angle = seed + i * 2.399;
    for (const sign of [-1, 1]) add(leaf.clone().rotateZ(angle + sign).rotateY(Math.sin(angle) * .6).translate(p.x + sign * .065, p.y, .37 + Math.sin(i) * .09), 'green');
  }
  const blooms = mobile ? 9 : 13;
  for (let i = 0; i < blooms; i++) {
    const p = curve.getPointAt(.06 + .88 * (i + .4) / blooms), rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(i + seed) * .45, Math.cos(i * 2 + seed) * .5, i * 1.8));
    const matrix = new THREE.Matrix4().compose(p.add(new THREE.Vector3(0, 0, .44)), rotation, new THREE.Vector3(1, 1, 1).multiplyScalar(.85 + (i % 3) * .15));
    for (let layer = 0; layer < 2; layer++) for (let j = 0; j < (layer ? 5 : 7); j++) {
      const s = layer ? .68 : 1, g = bloomPetal.clone().scale(s, s, s).translate(0, layer ? .016 : .035, layer ? .048 : 0).rotateZ(j / (layer ? 5 : 7) * Math.PI * 2 + layer * .5).applyMatrix4(matrix);
      add(g, (i + seed) % 3 === 0 ? 'pink' : 'ivory');
    }
    add(new THREE.SphereGeometry(.04, 7, 5).translate(0, 0, .072).applyMatrix4(matrix), 'gold');
    for (let j = 0; j < 5; j++) add(new THREE.SphereGeometry(.012, 5, 3).translate(Math.cos(j * 1.257) * .035, Math.sin(j * 1.257) * .035, .103).applyMatrix4(matrix), 'gold');
  }
  leaf.dispose(); bloomPetal.dispose();
  for (const key of Object.keys(parts) as (keyof ArchMaterials)[]) {
    const geometries = parts[key]; if (!geometries.length) continue;
    const g = mergeGeometries(geometries)!; g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, materials[key]); mesh.name = 'Garden arch · ' + key; mesh.receiveShadow = true; mesh.castShadow = key === 'metal' || key === 'stone'; parent.add(mesh);
    geometries.forEach(part => part.dispose());
  }
}
