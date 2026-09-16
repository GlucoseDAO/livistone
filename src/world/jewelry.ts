import * as THREE from 'three';

// Broad, flattened metal ribbons preserve the jewelry's cast-silver character.
// They are distinct from the round architectural tubes used for railings.
function band(points: THREE.Vector3[], center: THREE.Vector3, width: number, depth: number, material: THREE.Material, parent: THREE.Object3D, closed = false, smooth = true): void {
  const path = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', smooth ? 0.45 : 0.08);
  const samples = path.getPoints(points.length * 7);
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i], t = path.getTangent(i / (samples.length - 1)).normalize();
    const normal = p.clone().sub(center).normalize();
    const side = new THREE.Vector3().crossVectors(t, normal).normalize();
    const up = new THREE.Vector3().crossVectors(side, t).normalize();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const v = p.clone().addScaledVector(side, sx * width / 2).addScaledVector(up, sy * depth / 2); vertices.push(v.x, v.y, v.z);
    }
    if (i < samples.length - 1) for (let edge = 0; edge < 4; edge++) {
      const a = i * 4 + edge, b = i * 4 + (edge + 1) % 4;
      indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const object = new THREE.Mesh(geo, material); object.castShadow = true; object.receiveShadow = true; parent.add(object);
}

export function jewelryCage(kind: 'energy' | 'science', parent: THREE.Group, radius: number, centerY: number, sx: number, sz: number): void {
  const silver = new THREE.MeshStandardMaterial({ color: '#d9dedb', metalness: 0.85, roughness: 0.27, side: THREE.DoubleSide });
  const groove = new THREE.MeshStandardMaterial({ color: '#404844', metalness: 0.7, roughness: 0.45 });
  const center = new THREE.Vector3(0, centerY, 0);
  const point = (phi: number, theta: number, offset = 0.2): THREE.Vector3 => {
    // Keep the south-facing pedestrian doorway free of the low cage ribbons.
    if (kind === 'science' && Math.cos(theta) * radius + centerY < 3.5) {
      let angle = Math.atan2(Math.sin(phi), Math.cos(phi));
      if (Math.abs(angle) < .4) angle = (angle < 0 ? -1 : 1) * .4;
      phi = angle;
    }
    return new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * (radius + offset) * sx, Math.cos(theta) * (radius + offset) + centerY, Math.cos(phi) * Math.sin(theta) * (radius + offset) * sz);
  };
  const bottom = Math.acos(-centerY / radius);
  if (kind === 'energy') {
    // Folded cristae curl in from the sides, leaving a broad amber oval at the front.
    // Each membrane doubles back on itself instead of spiralling around a dome.
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        const theta = 0.48 + row * 0.49;
        const phi = side * (0.9 + (row % 2) * 0.08);
        const coords = [[0.2, -0.21], [-0.04, -0.25], [-0.36, -0.10], [-0.39, 0.08], [-0.1, 0.18], [0.15, 0.1], [0.12, -0.03], [-0.10, -0.07]];
        const pts = coords.map(([a, b]) => point(phi + side * a, Math.min(bottom - 0.03, theta + b)));
        band(pts, center, 0.48, 0.24, silver, parent);
      }
    }
    // The back and shoulders continue the folded silver cuff around the amber.
    for (let column = 0; column < 6; column++) {
      const phi = 1.45 + column * 0.68;
      const coords: [number, number][] = [];
      for (let row = 0; row < 5; row++) {
        const t = 0.35 + row * 0.42;
        coords.push([phi - 0.20, t], [phi + 0.24, t + 0.11], [phi + 0.22, t + 0.25], [phi - 0.17, t + 0.30]);
      }
      band(coords.map(([p, t]) => point(p, Math.min(bottom, t))), center, 0.42, 0.23, silver, parent);
    }
    // The ring's band becomes a substantial silver arch behind the amber hall.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.55, 10, 80), silver);
    ring.rotation.y = Math.PI / 2; ring.position.set(0, 6.2, -3.8); ring.scale.set(1, 1.1, 1); ring.castShadow = true; parent.add(ring);
  } else {
    // Unequal, angular, doubled-back ribbons: an open cage, with large clear voids.
    const shifts = [0, .17, -.12, .08, -.2, .1, -.08, .18, -.14, .05];
    for (let i = 0; i < 10; i++) {
      const phi = (i + .5) / 10 * Math.PI * 2;
      const bend = shifts[i];
      const coords = [[-.14, .23], [.13, .48], [.23 + bend, .9], [.01, 1.12], [.14, 1.48], [.08, 1.85], [-.08, bottom - .07], [-.25, 1.91], [-.20, 1.56], [-.36, 1.31], [-.19, .99], [-.27, .66]];
      const pts = coords.map(([a, t]) => point(phi + a, t));
      band(pts, center, 0.49 + (i % 3) * 0.09, 0.22, silver, parent, true, false);
      band(coords.map(([a, t]) => point(phi + a, t, 0.34)), center, 0.045, 0.02, groove, parent, true, false);
    }
    // Sparse cross connections break the repeating meridians into irregular cells.
    for (const [phi, theta] of [[1.7, .68], [3.1, 1.45], [4.3, .92], [5.1, 1.9]]) {
      band([point(phi - .34, theta), point(phi, theta + .15), point(phi + .4, theta - .06)], center, .43, .22, silver, parent, false, false);
    }
    const dark = new THREE.MeshPhysicalMaterial({ color: '#252726', metalness: 0.45, roughness: 0.17, clearcoat: 0.8 });
    for (const [phi, theta, size] of [[.82, .64, 1.65], [5.93, .4, 1.15], [3.8, .88, 1.2]]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(size, 22, 16), dark); orb.position.copy(point(phi, theta, -0.5)); orb.scale.set(1, 1.1, .8); orb.castShadow = true; parent.add(orb);
    }
    const bail = new THREE.Mesh(new THREE.TorusGeometry(1.15, .16, 8, 40), silver); bail.scale.set(.64, 1.35, 1); bail.rotation.z = -.28; bail.position.set(.55, centerY + radius + .8, -.3); parent.add(bail);
  }
}
