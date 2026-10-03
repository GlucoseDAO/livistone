import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import mitoring from './strands/mitoring.json';
import nanot from './strands/nanot.json';
import { mitoringSilverMaterial } from './mitoring-materials';

export const ENERGY_HALL = { a: 14, b: 6.6, wall: 4.2, dome: 4.2, doorPhi: 0.24 };
const UP = new THREE.Vector3(0, 1, 0);

function outsideMitoring(p: THREE.Vector3): THREE.Vector3 {
  const { a, b, wall, dome } = ENERGY_HALL, rho = Math.hypot(p.x / a, p.z / b);
  if (p.y < 3.6 && rho < 1.02) return p;
  const surface = p.clone(), normal = new THREE.Vector3();
  if (p.y <= wall) {
    surface.x /= Math.max(rho, .001); surface.z /= Math.max(rho, .001);
    normal.set(surface.x / (a * a), 0, surface.z / (b * b)).normalize();
  } else {
    const scale = Math.hypot(p.x / a, (p.y - wall) / dome, p.z / b);
    surface.set(p.x / scale, wall + (p.y - wall) / scale, p.z / scale);
    normal.set(surface.x / (a * a), (surface.y - wall) / (dome * dome), surface.z / (b * b)).normalize();
  }
  // Reserve the entire ribbon section and the chord between samples, not just its centreline.
  if (p.clone().sub(surface).dot(normal) < .34) p.copy(surface).addScaledVector(normal, .34);
  return p;
}

// Bevelled ribbon sections give the cast metal broad faces and narrow highlights.
function band(points: THREE.Vector3[], center: THREE.Vector3, width: number, rounded = false): THREE.BufferGeometry {
  const section = rounded ? Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * Math.PI * 2), -Math.sin(i / 8 * Math.PI * 2)]) : [[-.7, -1], [.7, -1], [1, -.6], [1, .6], [.7, 1], [-.7, 1], [-1, .6], [-1, -.6]];
  const vertices: number[] = [], indices: number[] = [], uv: number[] = []; let previous: THREE.Vector3 | undefined, distance = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], tangent = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, p.clone().sub(center)).normalize();
    // Radial struts have no radial frame; use a safe axis and keep its orientation continuous.
    if (side.lengthSq() < .01) side = new THREE.Vector3().crossVectors(tangent, Math.abs(tangent.y) < .9 ? UP : new THREE.Vector3(1, 0, 0)).normalize();
    if (previous && side.dot(previous) < 0) side.negate();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize(); previous = side;
    if (i) distance += p.distanceTo(points[i - 1]);
    // Small bevels soften clipped tips without adding a cap mesh or changing the source paths.
    const bevel = rounded && (i === 0 || i === points.length - 1) ? .74 : 1;
    for (const [j, [s, n]] of section.entries()) {
      const v = p.clone().addScaledVector(side, s * width / 2 * bevel).addScaledVector(normal, n * width * .28 * bevel); vertices.push(v.x, v.y, v.z); uv.push(distance / 2, j / 8);
    }
    if (i) for (let j = 0; j < 8; j++) {
      const a = (i - 1) * 8 + j, b = (i - 1) * 8 + (j + 1) % 8; indices.push(a, b, a + 8, b, b + 8, a + 8);
    }
  }
  for (let j = 1; j < 7; j++) { const end = (points.length - 1) * 8; indices.push(0, j + 1, j, end, end + j, end + j + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function cage(parent: THREE.Group, strands: number[][], transform: (x: number, y: number, z: number) => THREE.Vector3, allowed: (p: THREE.Vector3) => boolean, center: THREE.Vector3, width: number, mobile: boolean, smooth: boolean, project?: (p: THREE.Vector3) => THREE.Vector3, material?: THREE.MeshStandardMaterial, rounded = false): void {
  const geometries: THREE.BufferGeometry[] = [];
  for (const strand of strands) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < strand.length; i += 3) {
      const p = transform(strand[i], strand[i + 1], strand[i + 2]);
      if (!points.length || p.distanceToSquared(points[points.length - 1]) > .0001) points.push(p);
    }
    if (points.length < 2) continue;
    const path = new THREE.CatmullRomCurve3(points, false, 'catmullrom', smooth ? .4 : .08);
    let run: THREE.Vector3[] = [];
    const flush = (): void => {
      const length = run.reduce((sum, p, i) => sum + (i ? p.distanceTo(run[i - 1]) : 0), 0);
      if (run.length > 1 && length >= 1.2) geometries.push(band(run, center, width, rounded));
      run = [];
    };
    // Clip sampled curves, not just control points: long struts otherwise bridge across the door.
    for (const sample of path.getSpacedPoints(Math.max(points.length * 2, Math.ceil(path.getLength() / (mobile ? .32 : .18))))) {
      const p = project ? project(sample) : sample;
      if (allowed(p)) { if (!run.length || p.distanceToSquared(run[run.length - 1]) > .000001) run.push(p); } else flush();
    }
    flush();
  }
  if (!geometries.length) return;
  const silver = material ?? new THREE.MeshStandardMaterial({ color: '#e1e5df', metalness: .78, roughness: .29, side: THREE.DoubleSide, userData: { heroEnv: true } });
  const sculpture = new THREE.Mesh(mergeGeometries(geometries, false)!, silver); sculpture.name = 'Jewelry silver';
  sculpture.castShadow = true; sculpture.receiveShadow = true; parent.add(sculpture);
  for (const geometry of geometries) geometry.dispose();
}

export function mitoringCage(parent: THREE.Group, mobile: boolean): THREE.MeshStandardMaterial {
  const { a, b, wall, dome } = ENERGY_HALL, silver = mitoringSilverMaterial();
  cage(parent, mitoring.strands, (x, y, z) => {
    const fold = THREE.MathUtils.clamp((z - 26.8) / 7.7, 0, 1);
    const p = new THREE.Vector3(x * a / 15.5 * (1 - .36 * fold), (z - 17.3) * wall / 9.5, y * b / 11.8 * (1 - .36 * fold));
    const rho = Math.hypot(p.x / a, p.z / b);
    // Ease from the bezel onto the cabochon: a hard height threshold tears the cast loops at the shoulder.
    const crown = THREE.MathUtils.smoothstep(z, 25.5, 28.5);
    if (rho > .2) { const factor = THREE.MathUtils.lerp(1.045 / rho, 1, crown); p.x *= factor; p.z *= factor; }
    const surface = Math.hypot(p.x / a, p.z / b), roof = wall + dome * Math.sqrt(Math.max(0, 1 - Math.min(1, surface) ** 2)) + .24;
    p.y = THREE.MathUtils.lerp(p.y, roof, crown);
    return p;
  }, (p) => p.y > .25 && !(p.y < 4.8 && Math.abs(p.x) < 2.8 && p.z > b * .5) && !(p.y < 3.6 && Math.hypot(p.x / a, p.z / b) < 1.02), new THREE.Vector3(0, wall, 0), .48, mobile, true, outsideMitoring, silver, true);
  return silver;
}

/** The Nanot's silver lattice; returns its supporting frame (also its collider) and the one silver it shares with the entrance arch. */
export function nanotCage(parent: THREE.Group, radius: number, centerY: number, mobile: boolean): { frame: THREE.BufferGeometry; silver: THREE.MeshStandardMaterial } {
  const scale = (radius + .5) / 20, angle = .45, center = new THREE.Vector3(0, centerY, 0), frameRadius = radius + .85;
  const baseY = .22, baseRadius = Math.sqrt(frameRadius ** 2 - (centerY - baseY) ** 2), frame: THREE.BufferGeometry[] = [];
  const silver = new THREE.MeshStandardMaterial({ color: '#d9dfda', metalness: .72, roughness: .3, userData: { heroEnv: true } });
  const point = (phi: number, theta: number): THREE.Vector3 => new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * frameRadius, centerY + Math.cos(theta) * frameRadius, Math.cos(phi) * Math.sin(theta) * frameRadius);
  const baseTheta = Math.acos((baseY - centerY) / frameRadius);
  // Continuous ribs carry the folded facade to the foundation; the south bay is the entrance.
  for (let i = 0; i < 10; i++) {
    const phi = .43 + i / 9 * (Math.PI * 2 - .86), points: THREE.Vector3[] = [];
    for (let j = 0; j <= 28; j++) {
      const t = j / 28, theta = baseTheta * (1 - t);
      points.push(point(phi + Math.sin(t * Math.PI) * .055 * (i % 2 ? 1 : -1), theta));
    }
    frame.push(band(points, center, .58));
  }
  for (const y of [baseY, 5.1, 10.5]) {
    const theta = Math.acos((y - centerY) / frameRadius), gap = y < 1 ? .39 : 0;
    frame.push(band(Array.from({ length: 97 }, (_, i) => point(gap + i / 96 * (Math.PI * 2 - gap * 2), theta)), center, y < 1 ? .45 : .28));
  }
  const frameGeometry = mergeGeometries(frame)!; frame.forEach((g) => g.dispose());
  const structure = new THREE.Mesh(frameGeometry, silver); structure.name = 'Nanot supporting frame'; structure.castShadow = structure.receiveShadow = true; parent.add(structure);
  // Keep the original folded silhouettes, but move every sampled span outside the glazing.
  // The pendant's radial hub belongs to jewelry: it cannot occupy an inhabited hall.
  const surfaceStrands: number[][] = [];
  for (const strand of nanot.strands) {
    let run: number[] = [];
    const flush = (): void => { if (run.length >= 6) surfaceStrands.push(run); run = []; };
    for (let i = 0; i < strand.length; i += 3) {
      if (Math.hypot(strand[i], strand[i + 1], strand[i + 2] - 20.7) >= 12) run.push(strand[i], strand[i + 1], strand[i + 2]); else flush();
    }
    flush();
  }
  cage(parent, surfaceStrands, (x, y, z) => new THREE.Vector3((x * Math.cos(angle) - y * Math.sin(angle)) * scale, (z - 20.7) * scale + centerY, (x * Math.sin(angle) + y * Math.cos(angle)) * scale),
    (p) => !(p.y < 4.6 && Math.abs(p.x) < 2.85 && p.z > 2.5), center, .42, mobile, false, (p) => {
      if (p.y > centerY + radius + .6 && Math.hypot(p.x, p.z) < 1.8) return p;
      p.sub(center).setLength(frameRadius).add(center);
      if (p.y < baseY) { const k = baseRadius / Math.max(.001, Math.hypot(p.x, p.z)); p.set(p.x * k, baseY, p.z * k); }
      return p;
    });
  const dark = new THREE.MeshStandardMaterial({ color: '#292628', metalness: .4, roughness: .2 });
  for (const [phi, theta, size] of [[.78, .91, 1.1], [-.85, .55, .85], [-2.3, 1.23, 1.0]]) {
    const p = point(phi, theta), direction = p.clone().sub(center).normalize(); p.addScaledVector(direction, size * .45);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(size, mobile ? 1 : 2), dark); orb.position.copy(p); orb.castShadow = true; parent.add(orb);
    const setting = new THREE.Mesh(new THREE.TorusGeometry(size * .91, .1, 6, 32), silver); setting.position.copy(p); setting.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction); parent.add(setting);
  }
  return { frame: frameGeometry, silver };
}
