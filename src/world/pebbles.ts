import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GraphicsTier } from '../game/graphics';
import { layoutAllows } from './landscape';
import { rockReach } from './river-rocks';
import { terrainNoise, terrainSurfaceHeight, terrainSurfaceNormal } from './terrain';
import { WATER_EDGE } from './water-surface';
import type { RockSite } from './water-surface';
import { GARDEN_BRIDGES, channelDistance, riverCenter, tributaryCenter, waterDistance } from './waterways';

/** Pebbles per tier. The cpu tier draws none: its details group is hidden anyway. */
export const PEBBLE_COUNT: Record<GraphicsTier, number> = { gpu: 3200, mobile: 1100, cpu: 0 };
/** The shore band in channel distance: from about 0.35 m deep at the bank to 0.9 m up the dry bank (the waterline is WATER_EDGE). */
export const SHORE_BAND: readonly [number, number] = [WATER_EDGE - .45, .9];
/** Beyond this distance from any channel the whole batch is hidden: the pebbles are sub-pixel there. */
export const PEBBLE_RANGE = 60;
export interface Pebble { x: number; y: number; z: number; size: number; flat: number; long: number; yaw: number; wet: boolean; normal: THREE.Vector3 }

function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);

/** Whether a pebble of half-length `size` keeps clear of both bridges' decks and abutments, every route and authored ground. */
function shoreClear(x: number, z: number, size: number): boolean {
  if (Math.abs(x) < 3.6 + size && z > 10 && z < 45) return false;
  if (GARDEN_BRIDGES.some(b => Math.abs(z - b.z) < 2.6 + size && Math.abs(x - b.x) < 10.5 + size)) return false;
  return layoutAllows(x, z, size);
}

/**
 * Seeded pebbles in small clusters along both river banks and the tributaries, densest at the waterline, out of every rock
 * footprint and off routes and bridges. Each lies on the two-metre ground triangle the player walks on.
 */
export function pebbleSites(tier: GraphicsTier, rocks: readonly RockSite[]): Pebble[] {
  const count = PEBBLE_COUNT[tier], sites: Pebble[] = []; if (!count) return sites;
  const rand = random(6151), bins = new Map<string, RockSite[]>(), CELL = 4;
  for (const rock of rocks) {
    const reach = rockReach(rock.s);
    for (let i = Math.floor((rock.x - reach) / CELL); i <= Math.floor((rock.x + reach) / CELL); i++)
      for (let j = Math.floor((rock.z - reach) / CELL); j <= Math.floor((rock.z + reach) / CELL); j++) { const key = `${i},${j}`, bin = bins.get(key); if (bin) bin.push(rock); else bins.set(key, [rock]); }
  }
  // The same ellipse the water's rock foam uses, so no pebble sits inside a boulder.
  const underRock = (x: number, z: number, size: number): boolean => (bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []).some(rock => {
    const dx = x - rock.x, dz = z - rock.z, c = Math.cos(rock.yaw), s = Math.sin(rock.yaw);
    return Math.hypot((dx * c - dz * s) / (rock.s * 1.4 * 1.12 + size), (dx * s + dz * c) / (rock.s * 1.12 + size)) < 1;
  });
  for (let cluster = 0; cluster < count * 3 && sites.length < count; cluster++) {
    const pick = rand(), side = rand() < .5 ? -1 : 1, along = rand(), across = (rand() + rand() - .85) * .8, members = 3 + Math.floor(rand() * rand() * 10);
    let cx: number, cz: number;
    if (pick < .56) { cx = (along - .5) * 170; const centre = riverCenter(cx); cz = centre + side * (-channelDistance(cx, centre, 0) + WATER_EDGE + across); }
    else { const channel = pick < .78 ? -1 : 1; cz = -52 + along * 72; const centre = tributaryCenter(cz, channel); cx = centre + side * (-channelDistance(centre, cz, channel) + WATER_EDGE + across); }
    // Broad patches of gravel alternate with bare bank, as wash and eddies sort it.
    const patch = terrainNoise(cx * .13 + 17, cz * .13 - 5) > .42;
    for (let m = 0; m < members && sites.length < count; m++) {
      const angle = rand() * TAU, r = Math.sqrt(rand()) * .5, x = cx + Math.cos(angle) * r, z = cz + Math.sin(angle) * r;
      const size = .016 + rand() ** 2.4 * .06 + (rand() < .05 ? .045 : 0), flat = .36 + rand() * .3, long = .6 + rand() * .4, yaw = rand() * TAU;
      if (!patch && m > 0) continue;
      const d = waterDistance(x, z); if (d < SHORE_BAND[0] || d > SHORE_BAND[1]) continue;
      if (underRock(x, z, size) || !shoreClear(x, z, size)) continue;
      const normal = terrainSurfaceNormal(x, z), y = terrainSurfaceHeight(x, z);
      sites.push({ x, y, z, size, flat, long, yaw, wet: d < WATER_EDGE + .06, normal });
    }
  }
  return sites;
}

/** One rounded pebble: an octahedron (gpu) or icosahedron (mobile) sphere with smooth normals, a flatter underside and darker foot. */
export function pebbleGeometry(tier: GraphicsTier): THREE.BufferGeometry {
  const source = tier === 'gpu' ? new THREE.OctahedronGeometry(1, 1) : new THREE.IcosahedronGeometry(1, 0);
  source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const geometry = mergeVertices(source), p = geometry.getAttribute('position'), colors: number[] = []; source.dispose();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = 1 + .07 * Math.sin(x * 4.1 + z * 2.7 + y * 3.3);
    p.setXYZ(i, x * r, y * r * (y < 0 ? .7 : 1), z * r);
    const shade = .66 + .34 * THREE.MathUtils.smoothstep(y, -.8, .7); colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); return geometry;
}

/** All shore pebbles as one instanced draw that casts no shadow, or null on the cpu tier. */
export function createPebbles(tier: GraphicsTier, rocks: readonly RockSite[]): THREE.InstancedMesh | null {
  const sites = pebbleSites(tier, rocks); if (!sites.length) return null;
  const mesh = new THREE.InstancedMesh(pebbleGeometry(tier), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .74 }), sites.length);
  const palette = ['#7f817b', '#8f8d86', '#6f6a5f', '#8a806d', '#555a58', '#9c978a', '#7a7364', '#686b64'].map(c => new THREE.Color(c));
  const rand = random(9203), matrix = new THREE.Matrix4(), tilt = new THREE.Quaternion(), turn = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3(), tint = new THREE.Color();
  sites.forEach((pebble, i) => {
    // Lie on the bank slope, most of the underside sunk into it.
    tilt.setFromUnitVectors(UP, pebble.normal).multiply(turn.setFromAxisAngle(UP, pebble.yaw));
    position.set(pebble.x, pebble.y, pebble.z).addScaledVector(pebble.normal, pebble.size * pebble.flat * .15);
    mesh.setMatrixAt(i, matrix.compose(position, tilt, scale.set(pebble.size, pebble.size * pebble.flat, pebble.size * pebble.long)));
    tint.copy(palette[Math.floor(rand() * palette.length)]).multiplyScalar((.82 + rand() * .24) * (pebble.wet ? .72 : 1)); mesh.setColorAt(i, tint);
  });
  mesh.name = 'Shore pebbles'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.computeBoundingSphere(); return mesh;
}
