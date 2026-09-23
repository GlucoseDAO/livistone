import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import serif from './fonts/monument-serif.json';
import type { ColliderSpec } from '../game/physics';
import { FUTURE_HOUSE as H, FUTURE_NECK } from './elevated-layout';
import { guardRail, solidMesh, walkwayGeometry } from './walkway';
import { addGlow, nightEmission } from './night-lighting';

/** Camel Dalí translated into a copper animal carrying a printed, leather-bound exhibition cabin. */
export function createFutureHouse(parent: THREE.Group, colliders: ColliderSpec[], mobile: boolean): void {
  const copper = new THREE.MeshStandardMaterial({ color: '#b36d45', metalness: .88, roughness: .32 });
  const patina = new THREE.MeshStandardMaterial({ color: '#344d48', metalness: .66, roughness: .43 });
  const pla = new THREE.MeshStandardMaterial({ color: '#172e32', metalness: .2, roughness: .48, side: THREE.DoubleSide });
  const leather = new THREE.MeshStandardMaterial({ color: '#342119', roughness: .87, side: THREE.DoubleSide });
  const floor = new THREE.MeshStandardMaterial({ color: '#c9bba0', roughness: .78, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#9cbbb5', metalness: .15, roughness: .2, transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false });
  nightEmission(copper, '#bb6638', .12); nightEmission(pla, '#598f82', .08);
  const pieces: THREE.BufferGeometry[] = [];
  const copperStrand = (points: number[][], radius: number, solid = false): void => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2]))), steps = mobile ? 40 : 64, sides = 12, frames = curve.computeFrenetFrames(steps, false), vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, center = curve.getPointAt(t);
      // Closed, lumpy teardrop ends: thin neck, heavy rounded droplet, soft terminal tip.
      const tip = Math.sqrt(Math.max(.0001, Math.min(1, (1 - t) * 12, t * 18))), drop = 1 + .65 * Math.exp(-(((t - .9) / .065) ** 2));
      const flow = .9 + .23 * Math.sin(t * 17 + points[0][0]) + .13 * Math.sin(t * 39);
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2, r = radius * tip * drop * flow * (1 + .17 * Math.sin(a * 3 + t * 9) + .09 * Math.cos(a * 5 - t * 11));
        const p = center.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r * .84); p.toArray(vertices, vertices.length);
        if (i < steps && j < sides) { const n = i * (sides + 1) + j; indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2); }
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
    geometry.computeVertexNormals();
    if (solid) solidMesh(parent, colliders, geometry, copper, 'Future House · native copper leg'); else pieces.push(geometry);
  };
  for (const z of [-7, 7]) for (const side of [-1, 1]) {
    const x = H.x + side * 5, zz = H.z + z;
    copperStrand([[x, 11.4, zz], [x + side * .7, 8, zz + .8], [x - side * .4, 4.4, zz + 1.3], [x + side * 1.4, .3, zz + 2.5]], .48, true);
    for (let j = 0; j < 5; j++) { const a = j * 1.45, ox = Math.sin(a) * .65, oz = Math.cos(a) * .55;
      copperStrand([[x + ox, 10.8, zz + oz], [x + side * .7 + ox, 7 - j * .3, zz + oz], [x + ox * 2, 4.2 - j * .6, zz + oz * 2]], .12 + j * .035);
    }
    for (let j = 0; j < 3; j++) copperStrand([[x + side * 1.4, .7, zz + 2.5], [x + side * 2 + j * .22, .15, zz + 3 + j * .4]], .23);
  }
  // A tapered, irregular copper tail balances the lowered drinking head.
  copperStrand([[H.x - 5, 11, H.z - 10], [H.x - 7, 8, H.z - 14], [H.x - 6, 4, H.z - 15], [H.x - 5, 3, H.z - 14]], .2);
  const deck = new THREE.CylinderGeometry(1, 1, .3, 64).scale(8.9, 1, 11.9).translate(H.x, H.floor - .15, H.z);
  solidMesh(parent, colliders, deck, floor, 'Future House · exhibition floor');
  // A rounded keel curves below the flat inhabited deck, as a ship's hull does.
  const hull = new THREE.SphereGeometry(1, mobile ? 48 : 80, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(9.02, 3.8, 12.02).translate(H.x, H.floor - .08, H.z);
  solidMesh(parent, colliders, hull, pla, 'Future House · curved ship hull');
  // Elliptical shell with a real east-facing neck aperture and a continuous window band.
  const shell: number[] = [], windows: number[] = [], segments = mobile ? 48 : 80;
  const vertex = (a: number, v: number): THREE.Vector3 => new THREE.Vector3(H.x + Math.cos(a) * 9 * Math.cos(v), 12 + 5.4 * Math.sin(v), H.z + Math.sin(a) * 12 * Math.cos(v));
  for (let j = 0; j < 20; j++) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2, v = -.22 + j / 20 * (Math.PI / 2 + .22), w = -.22 + (j + 1) / 20 * (Math.PI / 2 + .22);
    if ((a < .24 || b > Math.PI * 2 - .24) && v < .63) continue;
    const target = v > .03 && v < .55 ? windows : shell;
    for (const p of [vertex(a, v), vertex(b, v), vertex(a, w), vertex(b, v), vertex(b, w), vertex(a, w)]) target.push(p.x, p.y, p.z);
  }
  for (const [vertices, material, name] of [[shell, pla, 'PLA printed exhibition cabin'], [windows, glass, 'Panoramic cabin glazing']] as const) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); solidMesh(parent, colliders, geometry, material, 'Future House · ' + name);
  }
  // Horizontal contour lines read as enlarged print layers, with a broad flattened lower hull.
  const layers: THREE.BufferGeometry[] = [];
  for (let j = 0; j < 19; j++) {
    const v = .65 + j / 19 * .87, points = Array.from({ length: 65 }, (_, i) => vertex(i / 64 * Math.PI * 2, v));
    layers.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, .025, 4, false));
  }
  parent.add(new THREE.Mesh(mergeGeometries(layers)!, patina)); layers.forEach(g => g.dispose());
  // Broad leather straps loop over the printed body and cinch its two long flanks.
  for (const dz of [-6, 0, 6]) {
    const points = Array.from({ length: 41 }, (_, i) => { const a = -.15 + i / 40 * (Math.PI + .3); return new THREE.Vector3(H.x + Math.cos(a) * 8.5, 12 + Math.sin(a) * (6 - Math.abs(dz) * .07), H.z + dz); });
    const strapPositions: number[] = [], strapIndices: number[] = [];
    points.forEach((p, i) => { for (const side of [-1, 1]) strapPositions.push(p.x, p.y, p.z + side * .3); if (i < 40) { const n = i * 2; strapIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(strapPositions, 3)); g.setIndex(strapIndices); g.computeVertexNormals(); parent.add(new THREE.Mesh(g, leather));
    for (const side of [-1, 1]) { const clasp = new THREE.Mesh(new THREE.TorusGeometry(.36, .055, 6, 12), copper); clasp.rotation.y = Math.PI / 2; clasp.position.set(H.x + side * 8.55, 11.8, H.z + dz); parent.add(clasp); }
  }
  const path = FUTURE_NECK.getPoints(150); solidMesh(parent, colliders, walkwayGeometry(path, 3.2), floor, 'Future House · climb through the neck');
  for (const side of [-1, 1]) {
    const edge = path.map((p, i) => { const tangent = FUTURE_NECK.getTangent(i / 150), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(); return p.clone().addScaledVector(normal, side * 1.6); });
    guardRail(parent, colliders, edge.filter((_, i) => i % 3 === 0), copper);
    copperStrand(edge.filter((_, i) => i % 10 === 0).map(p => [p.x, p.y - .22, p.z]), .48);
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 12, p = FUTURE_NECK.getPoint(t), tangent = FUTURE_NECK.getTangent(t), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const arch = Array.from({ length: 13 }, (_, j) => p.clone().addScaledVector(normal, Math.cos(j / 12 * Math.PI) * 1.8).add(new THREE.Vector3(0, Math.sin(j / 12 * Math.PI) * 3.2, 0)));
    copperStrand(arch.map(v => v.toArray()), i % 3 ? .13 : .23);
  }
  // Drooping muzzle stays hollow so the mouth is the entrance to the climb.
  for (const side of [-1, 1]) {
    copperStrand([[-35, .1, -105 + side * 1.9], [-34.3, 1.3, -105 + side * 1.9], [-36.5, 3.1, -105 + side * 1.8], [-39, 3.2, -105 + side * 1.5]], .34);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshStandardMaterial({ color: '#112628', emissive: '#79dec5', emissiveIntensity: .5 })); eye.position.set(-36.4, 2.65, -105 + side * 1.95); parent.add(eye);
  }
  parent.add(new THREE.Mesh(mergeGeometries(pieces)!, copper)); pieces.forEach(g => g.dispose());
  const font = new FontLoader().parse(serif), letters = new TextGeometry('FUTURE HOUSE', { font, size: 1.1, depth: .035, curveSegments: 4 }); letters.computeBoundingBox(); letters.translate(-(letters.boundingBox!.max.x + letters.boundingBox!.min.x) / 2, 0, 0);
  const neon = new THREE.MeshStandardMaterial({ color: '#d3ffe5', emissive: '#9fffd8', emissiveIntensity: .2, metalness: .15, roughness: .4 }); nightEmission(neon, '#9fffd8', 4);
  const sign = new THREE.Mesh(letters, neon); sign.position.set(H.x, 19.15, H.z); sign.name = 'FUTURE HOUSE · neon sign'; parent.add(sign);
  for (const x of [-68, -60]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 2.8, 6), leather); post.position.set(x, 18.45, H.z); parent.add(post); }
  addGlow(parent, new THREE.Vector3(H.x, 19.5, H.z + 1.3), '#8cf5c8', 15, 25, 14, .3);
  addGlow(parent, new THREE.Vector3(H.x, 14.6, H.z), '#ffdfb2', 12, 95, 18, .2);
  for (const t of [.15, .5, .85]) addGlow(parent, FUTURE_NECK.getPoint(t).add(new THREE.Vector3(0, .6, 0)), '#ffd097', 4, 16, 8, .3);
}
