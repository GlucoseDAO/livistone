import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROBE_SITES, ReflectionProbes, reflective } from '../src/world/probes';
import { CIVIC_LANDMARKS, LANDMARKS } from '../src/game/content';
import { CITY_HALL } from '../src/world/city-hall';
import { ENERGY_HALL } from '../src/world/jewelry';
import { STATION } from '../src/world/station-layout';
import { GATEWAY } from '../src/world/gateway-layout';
import { TIME_TOWER } from '../src/world/waterways';
import { FUTURE_HOUSE } from '../src/world/elevated-layout';

const at = (id: string) => LANDMARKS.find(landmark => landmark.id === id)!;
/** Each building-piece's footprint and roof height, from the layouts that place it. */
const FOOTPRINTS: Record<string, (x: number, y: number, z: number) => boolean> = {
  'city-hall': (x, y, z) => Math.hypot(x - at('city-hall').x, z - at('city-hall').z) < CITY_HALL.radius && y < CITY_HALL.centerY + CITY_HALL.radius,
  energy: (x, y, z) => Math.hypot((x - at('energy').x) / ENERGY_HALL.a, (z - at('energy').z) / ENERGY_HALL.b) < 1 && y < ENERGY_HALL.wall + ENERGY_HALL.dome,
  science: (x, y, z) => Math.hypot(x - at('science').x, z - at('science').z) < 8.5 && y < 6 + 8.5,
  station: (x, _y, z) => Math.abs(x - STATION.x) < 29 && z > STATION.front && z < STATION.back,
  gateway: (x, y, z) => Math.abs(x) < GATEWAY.halfWidth && Math.abs(z - GATEWAY.z) < GATEWAY.halfDepth && y < GATEWAY.stoneY,
  timeface: (x, y, z) => Math.hypot(x - TIME_TOWER.x, z - TIME_TOWER.z) < TIME_TOWER.radius && y < 27,
  'future-house': (x, y, z) => Math.hypot((x - FUTURE_HOUSE.x) / FUTURE_HOUSE.radiusX, (z - FUTURE_HOUSE.z) / FUTURE_HOUSE.radiusZ) < 1 && y < FUTURE_HOUSE.floor + 5.4,
};

describe('reflection probes', () => {
  it('stands every probe at a finite point inside its building-piece', () => {
    for (const site of PROBE_SITES) {
      expect(site.position.every(Number.isFinite), site.id).toBe(true);
      expect(site.position[1], site.id).toBeGreaterThan(1);
      expect(FOOTPRINTS[site.landmark](...site.position), site.id).toBe(true);
    }
  });
  it('gives each building-piece an exterior probe and each civic hall and the concourse an interior one', () => {
    const exterior = PROBE_SITES.filter(site => site.kind === 'exterior').map(site => site.landmark), interior = PROBE_SITES.filter(site => site.kind === 'interior').map(site => site.landmark);
    expect(exterior.sort()).toEqual(['city-hall', 'energy', 'future-house', 'gateway', 'science', 'station', 'timeface']);
    expect(interior.sort()).toEqual([...CIVIC_LANDMARKS.map(landmark => landmark.id), 'station'].sort());
    expect(new Set(PROBE_SITES.map(site => site.id)).size).toBe(PROBE_SITES.length);
  });
  it('reflects metals, gems and glazing but leaves stone, paper and wood to the sky', () => {
    expect(reflective(new THREE.MeshStandardMaterial({ metalness: .9 }))).toBe(true);
    expect(reflective(new THREE.MeshStandardMaterial({ metalness: 0, userData: { heroEnv: true } }))).toBe(true);
    expect(reflective(new THREE.MeshPhysicalMaterial({ transmission: .8 }))).toBe(true);
    expect(reflective(new THREE.MeshStandardMaterial({ roughness: .8 }))).toBe(false);
    expect(reflective(new THREE.MeshStandardMaterial({ metalness: 1, userData: { display: true } }))).toBe(false);
    expect(reflective(new THREE.MeshBasicMaterial())).toBe(false);
  });
  it('gives a material shared with other buildings one copy per probe, keeping its quality tags', () => {
    const root = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ metalness: 1, userData: { surface: 'brass' } });
    const gem = new THREE.MeshPhysicalMaterial({ transmission: .8, userData: { gatewayGem: true, heroEnv: true } }), stone = new THREE.MeshStandardMaterial({ roughness: .9 });
    const hall = new THREE.Group(), gate = new THREE.Group(), lamp = new THREE.Mesh(new THREE.BoxGeometry(), brass);
    const box = new THREE.BoxGeometry(1, 3, 1);
    hall.add(new THREE.Mesh(box, brass), new THREE.Mesh(box, stone)); gate.add(new THREE.Mesh(box, brass), new THREE.Mesh(box, gem)); root.add(hall, gate, lamp);
    const site = (id: string) => PROBE_SITES.find(s => s.id === id)!;
    const probes = new ReflectionProbes([{ site: site('city-hall'), objects: [hall], hide: [hall] }, { site: site('gateway'), objects: [gate], hide: [gate] }], root, new THREE.Texture(), 64);
    const [hallBrass, hallStone] = hall.children.map(child => (child as THREE.Mesh).material as THREE.MeshStandardMaterial);
    const [gateBrass, gateGem] = gate.children.map(child => (child as THREE.Mesh).material as THREE.MeshStandardMaterial);
    expect(lamp.material).toBe(brass); expect(brass.userData.probe).toBeUndefined();
    expect(hallBrass).not.toBe(brass); expect(gateBrass).not.toBe(brass); expect(hallBrass).not.toBe(gateBrass);
    expect([hallBrass.userData.probe, gateBrass.userData.probe]).toEqual(['city-hall', 'gateway']); expect(hallBrass.userData.surface).toBe('brass');
    expect(gateGem).toBe(gem); expect(gem.userData.gatewayGem).toBe(true); expect(gem.userData.probe).toBe('gateway');
    expect(hallStone).toBe(stone); expect(stone.userData.probe).toBeUndefined();
    // Alike materials with different probes must not share one node build.
    expect(hallBrass.customProgramCacheKey()).not.toBe(gateBrass.customProgramCacheKey());
    expect(probes.materials.size).toBe(3);
  });
});
