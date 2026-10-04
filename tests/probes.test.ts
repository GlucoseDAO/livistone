import { eyelenseGround } from '../src/world/eyelense-gate-layout';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PROBE_SITES, ProbeEnvironment, ReflectionProbes, litMaterials, reflective, refreshEnvironment } from '../src/world/probes';
import { CIVIC_LANDMARKS, LANDMARKS } from '../src/game/content';
import { CITY_HALL } from '../src/world/city-hall';
import { ENERGY_HALL } from '../src/world/jewelry';
import { STATION } from '../src/world/station-layout';
import { GATEWAY } from '../src/world/gateway-layout';
import { TIME_TOWER } from '../src/world/waterways';
import { FUTURE_HOUSE } from '../src/world/elevated-layout';
import { WINTER } from '../src/world/winter-gate-layout';

const at = (id: string) => LANDMARKS.find(landmark => landmark.id === id)!;
/** A stand-in for a PMREMGenerator result: the cube-UV layout of a `size` cube. */
const pmrem = (size: number) => { const texture = new THREE.Texture({ width: 3 * Math.max(size, 112), height: 4 * size }); texture.mapping = THREE.CubeUVReflectionMapping; return texture; };
/** Each building-piece's footprint and roof height, from the layouts that place it. */
const FOOTPRINTS: Record<string, (x: number, y: number, z: number) => boolean> = {
  'eyelense-gate': (x, y, z) => eyelenseGround(x, z) && y < 14,
  'winter-gate': (x, y, z) => ((x - WINTER.quartzX) / WINTER.depth) ** 2 + ((y - WINTER.centreY) / WINTER.radius) ** 2 + ((z - WINTER.z) / WINTER.radius) ** 2 < 1,
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
    expect(exterior.sort()).toEqual(['city-hall', 'energy', 'eyelense-gate', 'future-house', 'gateway', 'science', 'station', 'timeface', 'winter-gate']);
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
  it('tags each reflective part with its site and gives shared materials the one environment node, never a copy', () => {
    const root = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ metalness: 1, userData: { surface: 'brass' } });
    const gem = new THREE.MeshPhysicalMaterial({ transmission: .8, userData: { gatewayGem: true, heroEnv: true } }), stone = new THREE.MeshStandardMaterial({ roughness: .9 });
    const hall = new THREE.Group(), gate = new THREE.Group(), lamp = new THREE.Mesh(new THREE.BoxGeometry(), brass);
    const box = new THREE.BoxGeometry(1, 3, 1);
    hall.add(new THREE.Mesh(box, brass), new THREE.Mesh(box, stone)); gate.add(new THREE.Mesh(box, brass), new THREE.Mesh(box, gem)); root.add(hall, gate, lamp);
    const site = (id: string) => PROBE_SITES.find(s => s.id === id)!, environment = new ProbeEnvironment(pmrem(256));
    const probes = new ReflectionProbes([{ site: site('city-hall'), objects: [hall], hide: [hall] }, { site: site('gateway'), objects: [gate], hide: [gate] }], root, environment, 64);
    const [hallBrass, hallStone] = hall.children as THREE.Mesh[], [gateBrass, gateGem] = gate.children as THREE.Mesh[];
    // Alike materials of different buildings stay one material (one shader build); each object carries its site instead.
    expect([hallBrass.material, gateBrass.material, lamp.material]).toEqual([brass, brass, brass]);
    expect([hallBrass.userData.probe, gateBrass.userData.probe, gateGem.userData.probe, lamp.userData.probe]).toEqual(['city-hall', 'gateway', 'gateway', undefined]);
    expect((brass as unknown as { envNode: unknown }).envNode).toBe(environment); expect((gem as unknown as { envNode: unknown }).envNode).toBe(environment);
    expect(gem.userData.gatewayGem).toBe(true); expect(brass.userData.surface).toBe('brass');
    expect(hallStone.material).toBe(stone); expect(hallStone.userData.probe).toBeUndefined(); expect((stone as unknown as { envNode?: unknown }).envNode).toBeFalsy();
    expect(probes.materials.size).toBe(2);
  });
  it('lets each drawn object reflect its own probe, and every other one the sky', () => {
    const sky = pmrem(256), hall = pmrem(256), environment = new ProbeEnvironment(sky);
    environment.view = { sky, probes: new Map([['city-hall', hall]]) };
    const draw = (probe?: string) => { const object = new THREE.Mesh(); if (probe) object.userData.probe = probe; environment.updateBefore({ object } as unknown as Parameters<ProbeEnvironment['updateBefore']>[0]); return environment.value; };
    expect(draw('city-hall')).toBe(hall); expect(draw('gateway')).toBe(sky); expect(draw()).toBe(sky);
  });
  it('refreshes every lit material once per phase without rotating its reflections', () => {
    const root = new THREE.Group(), materials = [new THREE.MeshStandardMaterial(), new THREE.MeshPhysicalMaterial()];
    for (const material of materials) root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const lit = litMaterials(root); expect(lit).toHaveLength(2);
    refreshEnvironment(lit, 'night'); const night = materials.map(material => material.envMapRotation.order);
    refreshEnvironment(lit, 'day'); const day = materials.map(material => material.envMapRotation.order);
    expect(new Set(night).size).toBe(1); expect(new Set(day).size).toBe(1); expect(night[0]).not.toBe(day[0]);
    for (const material of materials) expect([material.envMapRotation.x, material.envMapRotation.y, material.envMapRotation.z]).toEqual([0, 0, 0]);
  });
});
