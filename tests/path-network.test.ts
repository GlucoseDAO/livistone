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
  return CIVIC_LANDMARKS.some(l => Math.hypot((p.x - l.x) / (1 + (l.stretch.x - 1) * .85), (p.z - l.z) / (1 + (l.stretch.z - 1) * .85)) < 10.6)
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
      expect(pavedDestination(p) || samples.some(s => touches([p], s, PATH_WIDTH / 2)), `${l.name} has no paved arrival`).toBe(true);
    }
    const foot = FUTURE_NECK.getPoint(0);
    expect(samples.some(s => touches([foot], s, .1))).toBe(true);
  });
});
