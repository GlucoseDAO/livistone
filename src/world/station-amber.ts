import * as THREE from 'three';
import { STATION_LOCAL as STATION } from './station-layout';

const TAU = Math.PI * 2;
// The stone has a tall, knuckled crown behind the ring and tapers into the platform wing.
const SECTIONS = [
  [-31, 8.7, .08, .08], [-28, 12.9, 4.9, 5.5], [-23, 15.4, 7.8, 9.4],
  [-17, 15.7, 8.4, 10.5], [-10, 15.1, 7.5, 10.9], [-3, 14.5, 7.6, 11],
  [4, 13.5, 6.5, 10.4], [10, 11.2, 4.2, 9.1], [16, 8.9, 2, 7.6],
  [23, 7.5, .9, 4.9], [27, 6.6, .08, .08],
];
function section(x: number): number[] {
  const i = Math.min(SECTIONS.length - 2, Math.max(0, SECTIONS.findIndex((p) => p[0] >= x) - 1));
  const a = SECTIONS[Math.max(0, i - 1)], b = SECTIONS[i], c = SECTIONS[i + 1], d = SECTIONS[Math.min(SECTIONS.length - 1, i + 2)];
  const t = THREE.MathUtils.clamp((x - b[0]) / (c[0] - b[0]), 0, 1);
  return [1, 2, 3].map((k) => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t));
}

export function stationAmberPoint(x: number, angle: number): THREE.Vector3 {
  const [center, height, depth] = section(x), u = (x + 31) / 58, envelope = Math.sin(u * Math.PI);
  const folds = .095 * Math.sin(x * .53 + Math.sin(angle * 3) * 1.8) + .068 * Math.sin(angle * 5 - x * .21) + .027 * Math.sin(x * 1.3 + angle * 9);
  const lobe = 1 + folds * envelope, sine = Math.sin(angle), cosine = Math.cos(angle);
  const y = center + height * cosine * lobe + .34 * Math.sin(x * .7 + angle * 3) * envelope;
  // Recess the stone behind the circular entrance so the shank frames a real glazed foyer.
  const recess = 2.2 * Math.exp(-(((x + 16) / 9) ** 2)) * Math.max(0, sine) ** 5;
  return new THREE.Vector3(x, y, STATION.z + depth * sine * lobe - recess);
}

export function stationAmberSoffit(x: number, z: number): THREE.Vector3 {
  let closest = stationAmberPoint(x, Math.PI), distance = Infinity;
  for (let i = 0; i <= 160; i++) {
    const point = stationAmberPoint(x, Math.PI * (.5 + i / 160)), delta = Math.abs(point.z - z);
    if (delta < distance) { distance = delta; closest = point; }
  }
  return closest;
}

export function stationAmberGeometry(mobile: boolean, inset = 0): THREE.BufferGeometry {
  const nx = mobile ? 96 : 192, ny = mobile ? 48 : 96, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= nx; j++) for (let i = 0; i <= ny; i++) {
    const x = -31 + j / nx * 58, point = stationAmberPoint(x, i / ny * TAU), [center] = section(x);
    point.y = center + (point.y - center) * (1 - inset); point.z = STATION.z + (point.z - STATION.z) * (1 - inset);
    positions.push(point.x, point.y, point.z); uv.push(j / nx, i / ny);
    if (j < nx && i < ny) { const n = j * (ny + 1) + i; indices.push(n, n + 1, n + ny + 1, n + 1, n + ny + 2, n + ny + 1); }
  }
  // Closed end caps give the cover actual volume rather than a single-sided roof sheet.
  for (const [row, reverse] of [[0, true], [nx, false]] as const) for (let i = 1; i < ny - 1; i++) {
    const a = row * (ny + 1), b = a + i, c = b + 1; indices.push(a, reverse ? c : b, reverse ? b : c);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function hash(x: number, y: number): number { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), a), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), a), b);
}
function amberTextures(mobile: boolean): { map: THREE.DataTexture; bumpMap: THREE.DataTexture } {
  const width = mobile ? 512 : 1024, height = width / 2, colors = new Uint8Array(width * height * 4), relief = new Uint8Array(colors.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, a = y / height * TAU, sx = u * 29 + .8 * Math.sin(a * 3 + u * 9), sy = y / height * 19 + .6 * Math.sin(u * 15 + a * 2);
    const gx = Math.floor(sx), gy = Math.floor(sy); let nearest = Infinity, second = Infinity;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const dx = gx + i + hash(gx + i, (gy + j + 38) % 19) - sx, dy = gy + j + hash(gx + i + 57, (gy + j + 38) % 19) - sy, d = dx * dx + dy * dy;
      if (d < nearest) { second = nearest; nearest = d; } else if (d < second) second = d;
    }
    const edge = Math.sqrt(second) - Math.sqrt(nearest), crack = 1 - THREE.MathUtils.smoothstep(edge, .008, .047);
    const fold = noise(u * 37 + Math.sin(a * 2) * 2, Math.sin(a) * 5 + Math.cos(a) * 4 + u * 9);
    const strata = .5 + .5 * Math.sin(u * 44 + a * 7 + fold * 9), cloud = noise(u * 14, Math.cos(a) * 3 + Math.sin(a) * 4);
    const cortex = THREE.MathUtils.smoothstep(Math.cos(a), .35, .95) * (.35 + cloud * .65);
    const shade = .95 + cloud * .05 - crack * .06, k = (y * width + x) * 4;
    colors[k] = 255 * shade; colors[k + 1] = Math.min(255, (169 + fold * 89 + strata * 12 - cortex * 58) * shade); colors[k + 2] = (8 + fold * 22 + strata * 15) * shade; colors[k + 3] = 255;
    const bump = 128 + (fold - .5) * 90 + strata * 25 - crack * 25;
    relief[k] = relief[k + 1] = relief[k + 2] = bump; relief[k + 3] = 255;
  }
  const map = new THREE.DataTexture(colors, width, height), bumpMap = new THREE.DataTexture(relief, width, height);
  for (const texture of [map, bumpMap]) { texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = mobile ? 2 : 8; texture.needsUpdate = true; }
  map.colorSpace = THREE.SRGBColorSpace; return { map, bumpMap };
}

export function stationAmberMaterial(mobile: boolean): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({ ...amberTextures(mobile), color: '#fff7e6', roughness: .085, metalness: 0,
    transmission: mobile ? 0 : .8, thickness: 5.5, attenuationColor: '#ffe063', attenuationDistance: 14, ior: 1.54,
    clearcoat: 1, clearcoatRoughness: .055, envMapIntensity: 1.2, bumpScale: .32, side: THREE.FrontSide,
    emissive: '#ffc108', emissiveIntensity: mobile ? .23 : .2 });
  material.userData.stationAmber = true; return material;
}
