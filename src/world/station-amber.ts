import * as THREE from 'three';
import { cameraPosition, float, materialColor, materialEmissive, mix, normalWorldGeometry, positionWorld, smoothstep, texture, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { STATION_LOCAL as STATION } from './station-layout';
import { nightEmission } from './night-lighting';

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

/** The stone's surface, or with `inset` (`insetZ` across the platform, if different) an inner body that much nearer its axis. */
export function stationAmberGeometry(mobile: boolean, inset = 0, insetZ = inset): THREE.BufferGeometry {
  const nx = mobile ? 96 : 192, ny = mobile ? 48 : 96, positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= nx; j++) for (let i = 0; i <= ny; i++) {
    const x = -31 + j / nx * 58, point = stationAmberPoint(x, i / ny * TAU), [center] = section(x);
    point.y = center + (point.y - center) * (1 - inset); point.z = STATION.z + (point.z - STATION.z) * (1 - insetZ);
    positions.push(point.x, point.y, point.z); uv.push(j / nx, i / ny);
    if (j < nx && i < ny) { const n = j * (ny + 1) + i; indices.push(n, n + 1, n + ny + 1, n + 1, n + ny + 2, n + ny + 1); }
  }
  // Closed end caps give the cover actual volume rather than a single-sided roof sheet.
  for (const [row, reverse] of [[0, true], [nx, false]] as const) for (let i = 1; i < ny - 1; i++) {
    const a = row * (ny + 1), b = a + i, c = b + 1; indices.push(a, reverse ? c : b, reverse ? b : c);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/**
 * Deeper honey amber (sub-plan 28, round 2; the owner's choice over silver prongs or a wider bezel): a deeper honey body, a
 * darker underside and a stronger glowing core, so from below it reads as a set jewel. `under` darkens the map's red, green
 * and blue toward the soffit; `rim` multiplies the body toward the outline, where a cabochon is thickest; emission is per tier
 * (`rich` sees the core through the transmissive stone, `low` is opaque and glows by itself) and per phase.
 */
const HONEY = {
  green: 164, under: [.34, .42, .48], color: '#fff2dc', attenuation: '#f5c060', distance: 12, rim: [.62, .48, .38],
  shell: { color: '#ff9b30', rich: { day: .08, night: .2 }, low: { day: .5, night: .9 } },
  core: { color: '#fff0c8', glow: '#ffe6b5', day: 2.4, night: 3, side: .45, inset: [.3, .48] },
} as const;

function hash(x: number, y: number): number { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), a), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), a), b);
}
function amberTextures(mobile: boolean, honey: boolean): { map: THREE.DataTexture; bumpMap: THREE.DataTexture } {
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
    if (honey) {
      // Deeper honey (sub-plan 28, round 2), darkening toward the soffit (v = .5 is the underside): from the platform the
      // stone's own body frames the glowing core instead of reading as one flat orange sheet.
      const under = THREE.MathUtils.smoothstep(-Math.cos(a), .05, .9);
      colors[k] = 255 * shade * (1 - HONEY.under[0] * under); colors[k + 1] = (HONEY.green + fold * 64 + strata * 10 - cortex * 40) * shade * (1 - HONEY.under[1] * under);
      colors[k + 2] = (6 + fold * 14 + strata * 9) * shade * (1 - HONEY.under[2] * under);
    } else { colors[k] = 255 * shade; colors[k + 1] = Math.min(255, (169 + fold * 89 + strata * 12 - cortex * 58) * shade); colors[k + 2] = (8 + fold * 22 + strata * 15) * shade; }
    colors[k + 3] = 255;
    const bump = 128 + (fold - .5) * 90 + strata * 25 - crack * 25;
    relief[k] = relief[k + 1] = relief[k + 2] = bump; relief[k + 3] = 255;
  }
  const map = new THREE.DataTexture(colors, width, height), bumpMap = new THREE.DataTexture(relief, width, height);
  for (const texture of [map, bumpMap]) { texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = mobile ? 2 : 8; texture.needsUpdate = true; }
  map.colorSpace = THREE.SRGBColorSpace; return { map, bumpMap };
}

/** How squarely the camera meets a surface: 1 face-on, 0 at its outline (the outward geometric normal, before bump). */
function facing(): Node<'float'> { return normalWorldGeometry.dot(cameraPosition.sub(positionWorld).normalize()).clamp() as unknown as Node<'float'>; }
/** Fire caught in the resin: the relief's folds glow (up to about 1.5) and its cracks stay dark; its mean is about a half. */
function fire(relief: THREE.Texture): Node<'float'> { return texture(relief).r.pow(2.2).mul(2.5) as unknown as Node<'float'>; }

export function stationAmberMaterial(mobile: boolean, classic = false): THREE.MeshPhysicalNodeMaterial {
  const textures = amberTextures(mobile, !classic);
  const material = new THREE.MeshPhysicalNodeMaterial({ ...textures, color: classic ? '#fff7e6' : HONEY.color, roughness: .085, metalness: 0,
    thickness: 5.5, attenuationColor: classic ? '#ffe063' : HONEY.attenuation, attenuationDistance: classic ? 14 : HONEY.distance, ior: 1.54,
    clearcoat: 1, clearcoatRoughness: .055, envMapIntensity: 1.2, bumpScale: .32, side: THREE.FrontSide,
    emissive: classic ? '#ffc108' : HONEY.shell.color });
  material.name = 'Embryo station amber'; material.userData.stationAmber = material.userData.heroEnv = true;
  if (!classic) {
    const face = facing();
    material.colorNode = materialColor.rgb.mul(mix(vec3(...HONEY.rim), vec3(1), smoothstep(.04, .75, face)));
    // The stone glows from inside, most where the view meets it squarely: all the opaque tiers have of the core.
    material.emissiveNode = materialEmissive.mul(fire(textures.bumpMap)).mul(face.pow(1.2));
    nightEmission(material, HONEY.shell.color, HONEY.shell.rich.night);
  }
  material.userData.classicAmber = classic; setStationAmberQuality(material, mobile); return material;
}

/** The resin core inside the stone (desktop), as `stationAmberGeometry`'s insets: since round 2 a slimmer heart, framed from below by the darker body. */
export function stationAmberCore(classic = false): THREE.BufferGeometry { return classic ? stationAmberGeometry(true, .14) : stationAmberGeometry(true, ...HONEY.core.inset); }

/** The resin core inside the desktop stone, seen through the body: fire in its folds, brightest face-on and from below. */
export function stationAmberCoreMaterial(amber: THREE.MeshPhysicalNodeMaterial, classic = false): THREE.MeshStandardNodeMaterial {
  if (classic) return new THREE.MeshStandardNodeMaterial({ color: '#fff3ad', map: amber.map, bumpMap: amber.bumpMap, bumpScale: .3, roughness: .28, emissive: '#ffda3d', emissiveMap: amber.map, emissiveIntensity: .2 });
  // With a core inside, the transmissive (rich) stone leaves the glow to it; without one it glows by itself even when rich.
  amber.userData.cored = true; setStationAmberQuality(amber, amber.transmission === 0);
  const core = new THREE.MeshStandardNodeMaterial({ color: HONEY.core.color, map: amber.map, bumpMap: amber.bumpMap, bumpScale: .3, roughness: .28,
    emissive: HONEY.core.glow, emissiveIntensity: HONEY.core.day });
  // Full strength downward, where the darker underside must let it through; the sides, behind a clearer body, take `side`.
  const down = mix(float(HONEY.core.side), float(1), normalWorldGeometry.y.negate().clamp());
  core.name = 'Embryo station amber core'; core.emissiveNode = materialEmissive.mul(fire(amber.bumpMap!)).mul(facing().pow(.8)).mul(down);
  nightEmission(core, HONEY.core.glow, HONEY.core.night); return core;
}

/** The generic glazing switch must not touch the amber: rich is transmissive with the core behind it, low an opaque glowing stone. */
export function setStationAmberQuality(material: THREE.MeshPhysicalNodeMaterial, low: boolean): void {
  material.transmission = low ? 0 : .8; material.opacity = 1;
  if (material.userData.classicAmber) material.emissiveIntensity = low ? .23 : .2;
  else {
    const glow = HONEY.shell[low || !material.userData.cored ? 'low' : 'rich'];
    material.emissiveIntensity = glow.day; material.userData.dayEmission.intensity = glow.day; material.userData.nightEmission.intensity = glow.night;
  }
  material.needsUpdate = true;
}
