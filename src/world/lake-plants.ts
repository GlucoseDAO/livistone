import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_EYES, GARDENS } from './living-waters-layout';
import { nightEmission } from './night-lighting';

/** Sculptural aquatic leaves: Untold's split elliptical wrapping meets Spotlight's folded triangles. */
export function createLakePlants(parent: THREE.Group, mobile: boolean): void {
  const leaves: THREE.BufferGeometry[] = [], folds: THREE.BufferGeometry[] = [], stems: THREE.BufferGeometry[] = [];
  WATER_EYES.forEach((cell, index) => {
    if (index % 3 === 0 || (mobile && index % 4 === 0)) return;
    const x = cell.reduce((s, p) => s + p[0], 0) / cell.length, z = cell.reduce((s, p) => s + p[1], 0) / cell.length;
    if (Math.hypot(x - GARDENS.pavilionX, z) < 15 || (x < -27 && Math.abs(z - 5) < 8)) return;
    // Reserve a complete canopy within one water cell, clear of every silver walking vein.
    const edge = Math.min(...cell.map((p, i) => { const q = cell[(i + 1) % cell.length], dx = q[0] - p[0], dz = q[1] - p[1]; return Math.abs(dx * (p[1] - z) - (p[0] - x) * dz) / Math.hypot(dx, dz); }));
    const scale = Math.min(1.25, (edge - .55) / 2.1); if (scale < .5) return;
    const yaw = index * 2.399, matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, -.1, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.13, 1.4, .1), new THREE.Vector3(0, 3, 0)]), 12, .075, 5, false).applyMatrix4(matrix));
    for (let leaf = 0; leaf < 3; leaf++) {
      const turn = new THREE.Matrix4().makeRotationY(leaf * Math.PI * 2 / 3), offset = new THREE.Matrix4().makeTranslation(0, 1.15 + leaf * .48, 0), transform = matrix.clone().multiply(offset).multiply(turn);
      const positions: number[] = [], idx: number[] = [], strips = 15;
      for (let s = 0; s < strips; s++) {
        const a = -.5 * Math.PI + s / strips * Math.PI, b = a + Math.PI / strips * .76;
        const tip = (angle: number): THREE.Vector3 => new THREE.Vector3(Math.sin(angle) * 1.75, .4 + Math.cos(angle) * 1.9, .7 + Math.cos(angle) * .55);
        const n = positions.length / 3, va = tip(a), vb = tip(b), ridge = va.clone().add(vb).multiplyScalar(.5); ridge.z += .18;
        for (const p of [new THREE.Vector3(0, 0, 0), va, ridge, vb]) p.toArray(positions, positions.length);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(idx); g.computeVertexNormals(); leaves.push(g.applyMatrix4(transform));
      // Angular folded bract, drawn from the Spotlight pavilion's triangular membrane.
      const bract = new THREE.BufferGeometry(); bract.setAttribute('position', new THREE.Float32BufferAttribute([0,.1,0, -1.3,.9,.5, 0,1.5,1, 0,.1,0, 0,1.5,1, 1.3,.9,.5], 3)); bract.computeVertexNormals(); folds.push(bract.applyMatrix4(transform));
    }
  });
  const green = new THREE.MeshStandardMaterial({ color: '#689978', metalness: .25, roughness: .46, side: THREE.DoubleSide });
  const pearl = new THREE.MeshStandardMaterial({ color: '#d0d7bb', metalness: .3, roughness: .34, side: THREE.DoubleSide });
  nightEmission(green, '#447b72', .12); nightEmission(pearl, '#79a8b5', .16);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#71847b', metalness: .65, roughness: .4 });
  for (const [geometries, material, name] of [[leaves, green, 'Untold · elliptical strip leaves'], [folds, pearl, 'A Sky for All · folded bracts'], [stems, stemMaterial, 'Sculptural aquatic stems']] as const) {
    if (!geometries.length) continue;
    const normalized = geometries.map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; });
    const mesh = new THREE.Mesh(mergeGeometries(normalized)!, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); normalized.forEach(g => g.dispose());
  }
}
