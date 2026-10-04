import { WINTER } from '../src/world/winter-gate-layout';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LANDMARKS, CIVIC_LANDMARKS } from '../src/game/content';
import { PATH_CURVES, PATH_WIDTH } from '../src/world/landscape';
import { GARDEN_PATHS, GARDENS } from '../src/world/living-waters-layout';
import { GARDEN_BRIDGES, TIME_TOWER } from '../src/world/waterways';
import { FUTURE_NECK } from '../src/world/elevated-layout';
import { CAVE_APPROACH } from '../src/world/enhancement-layout';
import { GLUCOSE_PAVILION } from '../src/world/glucose-layout';
import { STATION } from '../src/world/station-layout';
import { WALKING_NETWORK } from '../src/world/landscape';
import { kerbOpening, walkingSurface } from '../src/world/walking-surface';
import type { Road } from '../src/world/path-network';
import { TRAIL_HALF, TRAIL_SAMPLES, trailDistance } from '../src/world/mountain-layout';

const point = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, 0, z);
const line = (a: THREE.Vector3, b: THREE.Vector3): THREE.LineCurve3 => new THREE.LineCurve3(a, b);
const roads = [
  ...PATH_CURVES,
  ...GARDEN_PATHS.map(c => new THREE.CatmullRomCurve3(c.points.map(p => p.clone().add(point(GARDENS.x, GARDENS.z))))),
  line(point(0, 12), point(0, 40)),
  ...GARDEN_BRIDGES.map(b => line(point(b.x - 14 * b.scale, b.z), point(b.x + 14 * b.scale, b.z))),
  CAVE_APPROACH,
];
const samples = roads.map(c => c.getSpacedPoints(Math.ceil(c.getLength() / .4)));
const distance2 = (a: THREE.Vector3, b: THREE.Vector3): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
function touches(a: THREE.Vector3[], b: THREE.Vector3[], width: number): boolean {
  return a.some(p => b.some(q => distance2(p, q) < width * width));
}
function pavedDestination(p: THREE.Vector3): boolean {
  return Math.hypot(p.x - WINTER.plazaX, p.z - WINTER.z) < WINTER.plazaRadius
    || CIVIC_LANDMARKS.some(l => Math.hypot((p.x - l.x) / (1 + (l.stretch.x - 1) * .85), (p.z - l.z) / (1 + (l.stretch.z - 1) * .85)) < 10.6)
    || Math.hypot(p.x - GLUCOSE_PAVILION.x, p.z - GLUCOSE_PAVILION.z) < GLUCOSE_PAVILION.radius
    || Math.hypot(p.x - TIME_TOWER.x, p.z - TIME_TOWER.z) < 9.4
    || (p.x >= STATION.x - STATION.halfLength && p.x <= STATION.x + STATION.halfLength && p.z >= STATION.front && p.z <= STATION.back)
    || Math.hypot(p.x - GARDENS.pavilionX, p.z - GARDENS.z) < 6
    || distance2(p, FUTURE_NECK.getPoint(0)) < .25
    || distance2(p, CAVE_APPROACH.getPoint(1)) < .25;
}

describe('town walking network', () => {
  it('has no unexplained path ends: each joins another route or an inhabited destination', () => {
    roads.forEach((road, index) => {
      for (const p of [road.getPoint(0), road.getPoint(1)]) {
        expect(pavedDestination(p) || samples.some((other, j) => j !== index && touches([p], other, PATH_WIDTH)), `road ${index} ends at ${p.x}, ${p.z}`).toBe(true);
      }
    });
  });
  it('connects every road to the station through paths, bridges and civic aprons', () => {
    const aprons = CIVIC_LANDMARKS.map(l => Array.from({ length: 180 }, (_, i) => {
      const angle = i * Math.PI / 90;
      return point(l.x + Math.sin(angle) * 9.5 * (1 + (l.stretch.x - 1) * .85), l.z + Math.cos(angle) * 9.5 * (1 + (l.stretch.z - 1) * .85));
    }));
    const surfaces = [...samples, ...aprons], visited = new Set<number>([PATH_CURVES.findIndex(c => c.points.some(p => p.x === 0 && p.z === 64))]);
    let changed = true;
    while (changed) {
      changed = false;
      surfaces.forEach((candidate, i) => {
        if (!visited.has(i) && [...visited].some(j => touches(candidate, surfaces[j], j >= samples.length || i >= samples.length ? PATH_WIDTH / 2 + 1.1 : PATH_WIDTH))) { visited.add(i); changed = true; }
      });
    }
    for (let i = 0; i < roads.length; i++) expect(visited.has(i), `road ${i} is disconnected`).toBe(true);
  });
  it('brings the walking network to every map entrance and the Future House neck', () => {
    for (const l of LANDMARKS) {
      const p = point(l.entrance.x, l.entrance.z);
      // Jepii Mici arrives on its earth trail below the trailhead; the trail itself leaves the garden path at TRAIL_GATE.
      const trail = l.id === 'jepii-mici' && trailDistance(p.x, p.z) < TRAIL_HALF && WALKING_NETWORK.clearance(TRAIL_SAMPLES[0].x, TRAIL_SAMPLES[0].z, 2) < 0;
      expect(pavedDestination(p) || trail || samples.some(s => touches([p], s, PATH_WIDTH / 2)), `${l.name} has no paved arrival`).toBe(true);
    }
    const foot = FUTURE_NECK.getPoint(0);
    expect(samples.some(s => touches([foot], s, .1))).toBe(true);
  });
});

describe('merged junctions', () => {
  const { paving, kerbs } = walkingSurface(false), roads = WALKING_NETWORK.roads;
  const half = (road: Road, p: THREE.Vector3): number => (typeof road.width === 'number' ? road.width : road.width(p)) / 2;
  // Paving triangles binned by 2 m cell, in plan.
  const cells = new Map<string, number[][]>();
  for (const geometry of paving) {
    const p = geometry.getAttribute('position'), index = geometry.index!;
    for (let k = 0; k < index.count; k += 3) {
      const t = [0, 1, 2].flatMap(o => [p.getX(index.getX(k + o)), p.getY(index.getX(k + o)), p.getZ(index.getX(k + o))]);
      for (let i = Math.floor(Math.min(t[0], t[3], t[6]) / 2); i <= Math.floor(Math.max(t[0], t[3], t[6]) / 2); i++)
        for (let j = Math.floor(Math.min(t[2], t[5], t[8]) / 2); j <= Math.floor(Math.max(t[2], t[5], t[8]) / 2); j++) cells.set(`${i},${j}`, [...cells.get(`${i},${j}`) ?? [], t]);
    }
  }
  /** Heights of the paving triangles covering a point in plan, edges included unless it must lie `inset` inside them. */
  const cover = (x: number, z: number, inset = 0): number[] => (cells.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? []).flatMap(([x0, y0, z0, x1, y1, z1, x2, y2, z2]) => {
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2), a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d;
    if (!(a > -1e-6 && b > -1e-6 && a + b < 1 + 1e-6)) return [];
    // Barycentric weight over the opposite edge's height is the distance from that edge.
    const edges = [[x1, z1, x2, z2, a], [x2, z2, x0, z0, b], [x0, z0, x1, z1, 1 - a - b]].map(([ax, az, bx, bz, w]) => w * Math.abs(d) / Math.hypot(bx - ax, bz - az));
    return Math.min(...edges) >= inset ? [a * y0 + b * y1 + (1 - a - b) * y2] : [];
  });
  const covered = (x: number, z: number): boolean => cover(x, z).length > 0;
  /** Points across each road's own ribbon, with the ribbon's direction. */
  const ribbon = (road: Road, offsets: number[]): { x: number; z: number; offset: number }[] => {
    const points = road.curve.getSpacedPoints(Math.ceil(road.curve.getLength() / .25));
    return points.flatMap((q, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l;
      return offsets.map(offset => ({ x: q.x + nx * offset * half(road, q), z: q.z + nz * offset * half(road, q), offset }));
    });
  };
  const ends = roads.flatMap(road => [0, 1].map(t => road.curve.getPoint(t)));
  const junctions = ends.filter(p => !WALKING_NETWORK.freeEnds.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 1e-6));

  it('paves every route, junctions included, as one layer with no overlapping strips', () => {
    for (const road of roads) for (const { x, z } of ribbon(road, [-.97, -.5, 0, .5, .97])) {
      const layers = cover(x, z);
      // Points on a shared triangle edge count twice; never more, and never at two heights.
      expect(layers.length, `${x}, ${z}`).toBeGreaterThan(0); expect(Math.max(...layers) - Math.min(...layers), `${x}, ${z}: ${layers}`).toBeLessThan(.002);
    }
    // Nothing paved beyond the merged outline: no skirts, shoulders or stray strip ends in the lawn.
    for (const geometry of paving) { const p = geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) expect(WALKING_NETWORK.edge(p.getX(i), p.getZ(i), 1)).toBeLessThan(.01); }
  });

  it('fillets the inside corners of every junction', () => {
    expect(junctions.length).toBeGreaterThan(24);
    const centres = roads.map(road => ribbon(road, [0]).map(q => ({ ...q, half: half(road, new THREE.Vector3(q.x, 0, q.z)) })));
    for (const p of junctions) {
      // Ground just outside every ribbon but inside the corner two of them make is paved.
      const near = centres.flatMap(list => list.filter(q => Math.hypot(q.x - p.x, q.z - p.z) < 6));
      let fillet = 0;
      for (let dx = -3; dx <= 3 && fillet <= 3; dx += .1) for (let dz = -3; dz <= 3 && fillet <= 3; dz += .1) {
        const x = p.x + dx, z = p.z + dz;
        if (near.every(q => Math.hypot(q.x - x, q.z - z) >= q.half + .05) && covered(x, z)) fillet++;
      }
      expect(fillet, `junction ${p.x}, ${p.z}`).toBeGreaterThan(3);
    }
  });

  it('runs kerbs along the merged outline, never across paving, open only at thresholds and free ends', () => {
    const stones = new Map<string, number[]>();
    for (const geometry of kerbs) {
      const p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        // No kerb on the merged paving, so none runs into another route's surface; the inner face rests on its edge.
        expect(cover(x, z, .002), `${x}, ${z}`).toHaveLength(0);
        expect(kerbOpening(x, z), `${x}, ${z}`).toBe(false);
        const key = `${Math.floor(x)},${Math.floor(z)}`; stones.set(key, [...stones.get(key) ?? [], x, z]);
      }
    }
    const near = (x: number, z: number, reach: number): boolean => {
      for (let i = Math.floor(x - reach); i <= Math.floor(x + reach); i++) for (let j = Math.floor(z - reach); j <= Math.floor(z + reach); j++) {
        const list = stones.get(`${i},${j}`) ?? []; for (let k = 0; k < list.length; k += 2) if (Math.hypot(list[k] - x, list[k + 1] - z) < reach) return true;
      } return false;
    };
    let edges = 0;
    for (const road of roads) for (const { x, z } of ribbon(road, [-1.1, 1.1])) {
      // Wherever the outline runs along a ribbon edge, outside thresholds and the free ends, a kerb lines it.
      // A stone reaching into a threshold is left out whole, so the opening can widen by up to one block.
      const threshold = Array.from({ length: 9 }, (_, k) => k < 8 ? [Math.cos(k * Math.PI / 4) * 1.8, Math.sin(k * Math.PI / 4) * 1.8] : [0, 0]).some(([dx, dz]) => kerbOpening(x + dx, z + dz));
      if (Math.abs(WALKING_NETWORK.edge(x, z, 1) - (1.1 - 1) * 1.3) > .05 || threshold || WALKING_NETWORK.freeEnds.some(e => Math.hypot(e.x - x, e.z - z) < 2.6)) continue;
      edges++; expect(near(x, z, .9), `${x}, ${z}`).toBe(true);
    }
    expect(edges).toBeGreaterThan(3000);
  });
});
