import * as THREE from 'three';
import { channelDistance, riverCenter, tributaryCenter, waterDistance } from './waterways';
import { terrainHeight } from './terrain';

/** The river sheet height. The bank (`terrainHeight` = distance / 1.3 inside the channel) crosses it at WATER_EDGE. */
export const WATER_LEVEL = -.42;
export const WATER_EDGE = WATER_LEVEL * 1.3;
/**
 * A rock footprint that can stir the surface: centre, base scale and yaw as the instanced rocks use them. `lean` is the horizontal
 * part of the up axis of a rock settled against a bank; the footprint below ignores it, which its 12 % allowance and halo absorb.
 */
export interface RockSite { x: number; y: number; z: number; s: number; yaw: number; lean?: readonly [number, number] }

const slope = (f: (t: number) => number, t: number): number => (f(t + .01) - f(t - .01)) / .02;
function arcTable(f: (t: number) => number, start: number, end: number): Float64Array {
  const table = new Float64Array(end - start + 1);
  for (let i = 1; i < table.length; i++) table[i] = table[i - 1] + Math.hypot(1, f(start + i) - f(start + i - 1));
  return table;
}
function arc(table: Float64Array, start: number, t: number): number {
  const u = THREE.MathUtils.clamp(t - start, 0, table.length - 1.0001), i = Math.floor(u);
  return table[i] + (table[i + 1] - table[i]) * (u - i);
}
// The main river flows east (+x). Tributaries flow south (+z) from their sources at z = -58 into it.
const MAIN_START = -660, TRIBUTARY_START = -58;
const mainArc = arcTable(riverCenter, MAIN_START, 660);
const tributaries = [-1, 1].map(side => {
  const centre = (z: number): number => tributaryCenter(z, side), table = arcTable(centre, TRIBUTARY_START, 32);
  // The confluence is where the tributary centreline meets the river centreline.
  let z = 26; for (let i = 0; i < 12; i++) z = riverCenter(centre(z));
  // `along` keeps counting through the junction: the tributary ends at the river's value there.
  return { side, centre, offset: arc(mainArc, MAIN_START, centre(z)) - arc(table, TRIBUTARY_START, z), table };
});

/** Downstream unit tangent (x, z), distance `along` the channel and signed offset `across` it (positive to the right of the flow). */
export interface WaterFlow { x: number; z: number; along: number; across: number }
/** Flow of the main river at the centreline point nearest (x, z). */
function mainFlow(x: number, z: number): WaterFlow {
  let t = x; for (let i = 0; i < 3; i++) t = x - (riverCenter(t) - z) * slope(riverCenter, t);
  const d = slope(riverCenter, t), length = Math.hypot(1, d);
  return { x: 1 / length, z: d / length, along: arc(mainArc, MAIN_START, t), across: ((z - riverCenter(t)) - d * (x - t)) / length };
}
function tributaryFlow(x: number, z: number, channel: typeof tributaries[number]): WaterFlow {
  let t = z; for (let i = 0; i < 3; i++) t = z - (channel.centre(t) - x) * slope(channel.centre, t);
  const d = slope(channel.centre, t), length = Math.hypot(1, d);
  return { x: d / length, z: 1 / length, along: channel.offset + arc(channel.table, TRIBUTARY_START, t), across: (d * (z - t) - (x - channel.centre(t))) / length };
}

/**
 * Downstream direction and distance along the nearest channel. Within a few metres of a confluence the
 * tributary turns smoothly into the river, so scrolled ripples have no seam where the channels meet.
 */
export function waterFlow(x: number, z: number): WaterFlow {
  const main = channelDistance(x, z, 0); let flow = mainFlow(x, z);
  for (const channel of tributaries) {
    const own = channelDistance(x, z, channel.side); if (!Number.isFinite(own)) continue;
    const weight = THREE.MathUtils.smoothstep(main - own, -4, 4); if (!weight) continue;
    const t = tributaryFlow(x, z, channel);
    const mix = (a: number, b: number): number => a + (b - a) * weight;
    flow = { x: mix(flow.x, t.x), z: mix(flow.z, t.z), along: mix(flow.along, t.along), across: mix(flow.across, t.across) };
  }
  const length = Math.hypot(flow.x, flow.z); return { ...flow, x: flow.x / length, z: flow.z / length };
}
/** Water column above the shared terrain: zero on the bank outline, about 1.6 m over the channel floor. */
export function waterDepth(x: number, z: number): number { return Math.max(0, WATER_LEVEL - terrainHeight(x, z)); }

/** 0..1 closeness to the nearest rock footprint edge, over a 0.9 m halo (rock foam and stirred ripples). */
export function rockField(rocks: readonly RockSite[]): (x: number, z: number) => number {
  const CELL = 4, bins = new Map<string, RockSite[]>();
  for (const rock of rocks) {
    const reach = rock.s * 1.6 + 1;
    for (let i = Math.floor((rock.x - reach) / CELL); i <= Math.floor((rock.x + reach) / CELL); i++)
      for (let j = Math.floor((rock.z - reach) / CELL); j <= Math.floor((rock.z + reach) / CELL); j++) {
        const key = `${i},${j}`, bin = bins.get(key); if (bin) bin.push(rock); else bins.set(key, [rock]);
      }
  }
  return (x, z) => {
    let near = 0;
    for (const rock of bins.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
      // Instances scale local x by 1.4 s and z by s before turning by yaw; the shape bulges up to 12 %.
      const dx = x - rock.x, dz = z - rock.z, c = Math.cos(rock.yaw), s = Math.sin(rock.yaw);
      const a = rock.s * 1.4 * 1.12, b = rock.s * 1.12, q = Math.hypot((dx * c - dz * s) / a, (dx * s + dz * c) / b);
      near = Math.max(near, 1 - THREE.MathUtils.smoothstep((q - 1) * b, 0, .9));
    }
    return near;
  };
}

/**
 * One indexed sheet clipped to the shared bank outline on a 1 m grid (no overlapping sheets at junctions),
 * with the per-vertex `flow`, `along`, `across`, `depth` and `rock` the water shader reads. `colour` optionally bakes
 * vertex colours (the CPU tier has no transparency, so depth tint stands in for it); CPU also uses 2 m cells,
 * whose straight edge segments stay within a centimetre of the curved bank.
 */
export function waterSurfaceGeometry(rocks: readonly RockSite[], colour?: (depth: number, rock: number) => THREE.Color, cell = 1): THREE.BufferGeometry {
  const positions: number[] = [], flows: number[] = [], alongs: number[] = [], acrosses: number[] = [], depths: number[] = [], stirred: number[] = [], colours: number[] = [], indices: number[] = [];
  const known = new Map<string, number>(), rockNear = rockField(rocks);
  const vertex = (x: number, z: number): number => {
    const key = `${Math.round(x * 1e4)},${Math.round(z * 1e4)}`, found = known.get(key); if (found !== undefined) return found;
    const flow = waterFlow(x, z), depth = waterDepth(x, z), rock = rockNear(x, z), index = positions.length / 3;
    positions.push(x, WATER_LEVEL, z); flows.push(flow.x, flow.z); alongs.push(flow.along); acrosses.push(flow.across); depths.push(depth); stirred.push(rock);
    if (colour) { const c = colour(depth, rock); colours.push(c.r, c.g, c.b); }
    known.set(key, index); return index;
  };
  const inside = (x: number, z: number): number => waterDistance(x, z) - WATER_EDGE;
  const emit = (corners: [number, number][]): void => {
    const polygon: number[] = [];
    for (let i = 0; i < corners.length; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % corners.length], da = inside(ax, az), db = inside(bx, bz);
      if (da <= 0) polygon.push(vertex(ax, az));
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); polygon.push(vertex(ax + (bx - ax) * t, az + (bz - az) * t)); }
    }
    for (let i = 1; i < polygon.length - 1; i++) indices.push(polygon[0], polygon[i], polygon[i + 1]);
  };
  for (let x = -600; x < 600; x += cell) for (let z = -60; z < 45; z += cell) {
    if (inside(x + cell / 2, z + cell / 2) > 1.5 * cell) continue;
    emit([[x, z], [x, z + cell], [x + cell, z]]); emit([[x + cell, z], [x, z + cell], [x + cell, z + cell]]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(positions.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
  geometry.setAttribute('along', new THREE.Float32BufferAttribute(alongs, 1));
  geometry.setAttribute('across', new THREE.Float32BufferAttribute(acrosses, 1));
  geometry.setAttribute('depth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute('rock', new THREE.Float32BufferAttribute(stirred, 1));
  if (colour) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere(); return geometry;
}
