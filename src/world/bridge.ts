import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';

export function bridgeHeight(z: number): number { return .065 + 2.35 * Math.pow(Math.sin(Math.PI * (z - 12) / 28), 2); }

/** A continuous masonry vault, with its feet buried in the banks and an open waterway. */
export function createBridge(parent: THREE.Group, colliders: ColliderSpec[], stone: THREE.Material, paving: THREE.Material, metal: THREE.Material): void {
  const masonry: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [], joints: THREE.BufferGeometry[] = [];
  const profile = new THREE.Shape(); profile.moveTo(12, bridgeHeight(12) - .008);
  for (let i = 1; i <= 64; i++) { const z = 12 + i / 64 * 28; profile.lineTo(z, bridgeHeight(z) - .008); }
  profile.lineTo(40, -2.2); profile.lineTo(33.5, -2.2);
  profile.quadraticCurveTo(32.5, 1.94, 26, 1.96); profile.quadraticCurveTo(19.5, 1.94, 18.5, -2.2);
  profile.lineTo(12, -2.2); profile.closePath();
  const vault = new THREE.ExtrudeGeometry(profile, { depth: 4.9, bevelEnabled: false, curveSegments: 32 });
  vault.rotateY(-Math.PI / 2); vault.translate(2.45, 0, 0); masonry.push(vault);
  colliders.push({ type: 'mesh', vertices: new Float32Array(vault.getAttribute('position').array), indices: Uint32Array.from({ length: vault.getAttribute('position').count }, (_, i) => i) });
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  for (let i = 0; i <= 84; i++) {
    const z = 12 + i / 84 * 28, y = bridgeHeight(z);
    vertices.push(-2.45, y, z, 2.45, y, z); uv.push(-2.45 / 4, z / 4, 2.45 / 4, z / 4);
    if (i < 84) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const deck = new THREE.BufferGeometry(); deck.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); deck.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); deck.setIndex(indices); deck.computeVertexNormals();
  const walk = new THREE.Mesh(deck, paving); walk.receiveShadow = true; parent.add(walk);
  colliders.push({ type: 'mesh', vertices: new Float32Array(vertices), indices: new Uint32Array(indices) });
  const tube = (points: THREE.Vector3[], radius: number, target: THREE.BufferGeometry[]): void => {
    target.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(6, points.length * 2), radius, 6, false));
  };
  for (const side of [-1, 1]) {
    for (const [height, radius, target] of [[.06, .14, masonry], [1.12, .075, rails], [.36, .035, rails]] as const) {
      tube(Array.from({ length: 65 }, (_, i) => { const z = 12 + i / 64 * 28; return new THREE.Vector3(side * 2.35, bridgeHeight(z) + height, z); }), radius, target);
    }
    for (let i = 0; i <= 40; i++) {
      const z = 12 + i * .7, y = bridgeHeight(z), x = side * 2.35;
      tube([new THREE.Vector3(x, y + .13, z), new THREE.Vector3(x, y + 1.1, z)], .026, rails);
      if (i % 4 === 0) masonry.push(new THREE.BoxGeometry(.25, 1.08, .25).translate(x, y + .54, z));
      if (i < 40) {
        tube([new THREE.Vector3(x, y + .38, z), new THREE.Vector3(x, y + .8, z + .35), new THREE.Vector3(x, bridgeHeight(z + .7) + .38, z + .7)], .018, rails);
        colliders.push({ type: 'box', position: [x, y + .6, z + .35], size: [.13, .65, .36] });
      }
    }
    // Radial joints articulate the arch stones instead of leaving a featureless white slab.
    const arch = [new THREE.QuadraticBezierCurve(new THREE.Vector2(18.5, -2.2), new THREE.Vector2(19.5, 1.94), new THREE.Vector2(26, 1.96)), new THREE.QuadraticBezierCurve(new THREE.Vector2(26, 1.96), new THREE.Vector2(32.5, 1.94), new THREE.Vector2(33.5, -2.2))];
    // Proud arch mouldings and branching haunches catch side light like the concept's sculpted ribs.
    const archPoints = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64, p = arch[t < .5 ? 0 : 1].getPoint(t < .5 ? t * 2 : (t - .5) * 2);
      return new THREE.Vector3(side * 2.49, p.y + .06, p.x);
    });
    tube(archPoints, .19, masonry);
    for (const end of [0, 1]) {
      const z = end ? 33.5 : 18.5, direction = end ? 1 : -1;
      for (const reach of [2.2, 4.4]) tube([
        new THREE.Vector3(side * 2.5, -1.6, z),
        new THREE.Vector3(side * 2.5, -.35, z + direction * reach * .35),
        new THREE.Vector3(side * 2.5, bridgeHeight(z + direction * reach) - .14, z + direction * reach),
      ], .12, masonry);
      tube([
        new THREE.Vector3(side * 2.52, -.7, z + direction * 1.1),
        new THREE.Vector3(side * 2.52, -.1, z + direction * 1.4),
        new THREE.Vector3(side * 2.52, bridgeHeight(z + direction * 2.8) - .2, z + direction * 2.8),
      ], .028, rails);
    }
    for (let i = 0; i <= 22; i++) {
      const t = i / 22, p = arch[t < .5 ? 0 : 1].getPoint(t < .5 ? t * 2 : (t - .5) * 2);
      tube([new THREE.Vector3(side * 2.455, p.y + .025, p.x), new THREE.Vector3(side * 2.455, bridgeHeight(p.x) - .035, p.x + (t - .5) * .22)], .01, joints);
    }
  }
  for (let z = 12.5; z < 40; z += .85) joints.push(new THREE.BoxGeometry(4.4, .008, .012).translate(0, bridgeHeight(z) + .006, z));
  for (const x of [-1.1, 1.1]) tube(Array.from({ length: 65 }, (_, i) => { const z = 12 + i / 64 * 28; return new THREE.Vector3(x, bridgeHeight(z) + .006, z); }), .008, joints);
  for (const [geometries, material] of [[masonry, stone], [rails, metal], [joints, new THREE.MeshStandardMaterial({ color: '#9e9580', roughness: 1 })]] as const) {
    const merged = mergeGeometries(geometries.map((g) => g.index ? g.toNonIndexed() : g))!;
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
}

/** Reuse the vault with exactly the same transform applied to every physics shape. */
export function createGardenBridge(parent: THREE.Group, colliders: ColliderSpec[], stone: THREE.Material, paving: THREE.Material, metal: THREE.Material, site: { x: number; z: number; yaw: number; scale: number }): void {
  const group = new THREE.Group(), local: ColliderSpec[] = [];
  createBridge(group, local, stone, paving, metal);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw);
  const offset = new THREE.Vector3(0, 0, -26 * site.scale).applyQuaternion(rotation).add(new THREE.Vector3(site.x, 0, site.z));
  group.position.copy(offset); group.quaternion.copy(rotation); group.scale.setScalar(site.scale); group.updateMatrix(); parent.add(group);
  for (const spec of local) {
    if (spec.type === 'mesh') {
      const vertices = spec.vertices.slice(), p = new THREE.Vector3();
      for (let i = 0; i < vertices.length; i += 3) { p.fromArray(vertices, i).applyMatrix4(group.matrix); p.toArray(vertices, i); }
      colliders.push({ ...spec, vertices });
    } else {
      const p = new THREE.Vector3(...spec.position).applyMatrix4(group.matrix);
      colliders.push({ type: 'box', position: [p.x, p.y, p.z], size: spec.size.map((v) => v * site.scale) as [number, number, number], yaw: (spec.yaw ?? 0) + site.yaw });
    }
  }
}
