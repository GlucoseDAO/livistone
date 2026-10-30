import * as THREE from 'three';
import { attribute, length, mix, mrt, positionWorld, cameraPosition, sin, smoothstep, uniform, vec4 } from 'three/tsl';
import { landscapeHeight } from './terrain';
import { HORIZON_RADIANCE, SUN_DIR } from './sky';
import { WATER_LEVEL } from './water-surface';

/** A distant visual continuation, without physics or changes to the town's water/terrain fields. */
export const MATSU_COAST = { minX: 150, maxX: 9200, minZ: -9000, maxZ: 160, hazeStart: 1800, hazeEnd: 8000 } as const;
export function coastalViewActive(eye: { x: number; y: number; z: number }): boolean {
  return eye.x > 154 && eye.x < 250 && eye.z > 5 && eye.z < 85 && eye.y > -3 && eye.y < 25;
}

interface LandVertex { x: number; y: number; z: number; colour: THREE.Color }
/** Actual nearby ridge heights, clipped into low headlands rather than the unrelated mountain ranges beyond the valley. */
export function matsuHeadlandGeometry(): THREE.BufferGeometry {
  const step = 8, cut = .08, positions: number[] = [], colours: number[] = [], sites = new Map<string, LandVertex>();
  const sample = (x: number, z: number): LandVertex => {
    const key = `${x},${z}`, known = sites.get(key); if (known) return known;
    const y = landscapeHeight(x, z), dx = (landscapeHeight(x + 2, z) - landscapeHeight(x - 2, z)) / 4, dz = (landscapeHeight(x, z + 2) - landscapeHeight(x, z - 2)) / 4;
    const normal = new THREE.Vector3(-dx, 1, -dz).normalize(), rock = THREE.MathUtils.smoothstep(Math.hypot(dx, dz), .5, 1.5);
    const colour = new THREE.Color('#455e37').lerp(new THREE.Color('#928774'), rock).multiplyScalar(.4 + .6 * Math.max(0, normal.dot(SUN_DIR)));
    const vertex = { x, y, z, colour }; sites.set(key, vertex); return vertex;
  };
  const triangle = (a: LandVertex, b: LandVertex, c: LandVertex): void => {
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); colours.push(p.colour.r, p.colour.g, p.colour.b); }
  };
  const emit = (corners: LandVertex[]): void => {
    const polygon: LandVertex[] = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length], da = a.y - cut, db = b.y - cut;
      if (da >= 0) polygon.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db); polygon.push({ x: a.x + (b.x - a.x) * t, y: cut, z: a.z + (b.z - a.z) * t, colour: a.colour.clone().lerp(b.colour, t) });
      }
    }
    for (let i = 1; i < polygon.length - 1; i++) triangle(polygon[0], polygon[i], polygon[i + 1]);
    // Close the contour below the sea instead of leaving a bright slit under a trimmed headland.
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]; if (a.y !== cut || b.y !== cut) continue;
      const belowA = { ...a, y: WATER_LEVEL - .2 }, belowB = { ...b, y: WATER_LEVEL - .2 };
      triangle(a, belowA, belowB); triangle(a, belowB, b);
    }
  };
  for (let x = 150; x < 502; x += step) for (let z = -240; z < 160; z += step) {
    const a = sample(x, z), b = sample(x, z + step), c = sample(x + step, z), d = sample(x + step, z + step);
    emit([a, b, c]); emit([c, b, d]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3)); geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

/** Two inexpensive opaque draws fill the far-camera gap over the coast. They deliberately do not use the ranges' valley mist. */
export class MatsuCoast extends THREE.Group {
  readonly sea: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicNodeMaterial>;
  readonly headland: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial>;
  private readonly haze = uniform(new THREE.Color());
  constructor() {
    super(); this.name = 'Matsu · distant coastal context'; this.visible = false;
    const extent = MATSU_COAST, seaGeometry = new THREE.PlaneGeometry(extent.maxX - extent.minX, extent.maxZ - extent.minZ).rotateX(-Math.PI / 2).translate((extent.minX + extent.maxX) / 2, WATER_LEVEL, (extent.minZ + extent.maxZ) / 2);
    const sea = new THREE.MeshBasicNodeMaterial({ fog: false }), land = new THREE.MeshBasicNodeMaterial({ fog: false, side: THREE.DoubleSide });
    const distance = length(positionWorld.sub(cameraPosition)), haze = smoothstep(extent.hazeStart, extent.hazeEnd, distance), mask = mrt({ display: vec4(0, 0, 0, 1) });
    sea.colorNode = mix(uniform(sea.color).mul(sin(positionWorld.x.mul(.04).add(positionWorld.z.mul(.03))).mul(.025).add(.975)), this.haze, haze);
    land.colorNode = mix(attribute('color', 'vec3').mul(uniform(land.color)), this.haze, haze);
    for (const material of [sea, land]) { material.mrtNode = mask; material.depthWrite = true; material.transparent = false; }
    sea.name = 'Matsu sea · distant blue water'; land.name = 'Matsu headlands · actual terrain without valley mist';
    this.sea = new THREE.Mesh(seaGeometry, sea); this.sea.name = 'Matsu distant sea';
    this.headland = new THREE.Mesh(matsuHeadlandGeometry(), land); this.headland.name = 'Matsu distant headland'; this.add(this.sea, this.headland); this.setNight(false);
  }
  setNight(night: boolean): void {
    this.sea.material.color.set(night ? '#071521' : '#2d7fa2'); this.headland.material.color.setRGB(...(night ? [.035, .06, .095] : [1, 1, 1]) as [number, number, number]);
    this.haze.value.copy(HORIZON_RADIANCE[night ? 'night' : 'day']);
  }
  /** Probe visits call the same policy as walking, then restore it to the walking eye after each face. */
  updateView(eye: { x: number; y: number; z: number }, ranges: readonly THREE.Object3D[]): void {
    const active = coastalViewActive(eye); this.visible = active; for (const range of ranges) range.visible = !active;
  }
}
