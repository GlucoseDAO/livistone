import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { gatewayClearing } from './gateway-layout';
import { plantingAllowed } from './landscape';
import { STATION } from './station-layout';
import { terrainHeight, terrainHeightOf } from './terrain';
import { mountainClearing, trailheadTreeSpots } from './mountain-layout';

function seeded(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function clearForTree(x: number, z: number): boolean {
  if (gatewayClearing(x, z, 6)) return false;
  if (!plantingAllowed(x, z, 6.9)) return false;
  if (Math.abs(x) < 6 && z > -13 && z < 49) return false;
  if (Math.abs(x - 17) < 6 && z > -45 && z < -19) return false;
  // Frame the station-to-bridge arrival with full tree crowns outside the sightline.
  if (Math.abs(x) < 8 && z > 39 && z < STATION.front + 2) return false;
  if (CIVIC_LANDMARKS.some((l) => Math.hypot((x - l.x) / l.stretch.x, (z - l.z) / Math.max(1, l.stretch.z)) < 14)) return false;
  return true;
}
/** Seeded woodland trunk positions, standing on the walking terrain. DOM-independent, so tests see the same trees as the town. */
export function forestSites(mobile: boolean): THREE.Vector3[] {
  const rand = seeded(3974); const sites: THREE.Vector3[] = [];
  for (let i = 0; i < (mobile ? 2600 : 5400); i++) {
    const x = (rand() - 0.5) * 410, z = (rand() - 0.5) * 385 - 62;
    // The tests read the uneroded ridges (sub-plan 26): how many draws each candidate takes depends on them, so eroding a ridge
    // would reshuffle every later tree, the town's included. Trees then stand on the eroded ground.
    const height = terrainHeightOf(x, z, false), slope = Math.hypot(terrainHeightOf(x + 2, z, false) - height, terrainHeightOf(x, z + 2, false) - height) / 2;
    if (height > 47 + rand() * 13 || slope > .95 || Math.hypot(x / 218, (z + 60) / 210) > .82 + rand() * .18 || !clearForTree(x, z) || sites.some((p) => Math.hypot(p.x - x, p.z - z) < (mobile ? 6 : 4.8))) continue;
    sites.push(new THREE.Vector3(x, terrainHeight(x, z), z));
  }
  // The Jepii Mici trail, its rhododendron meadow and the snow gully (sub-plan 27) take out the trees standing on them after the
  // draws, so every other tree stays exactly where it was; then the trailhead's woods are thickened. Odd indices are ashes, whose
  // crowns start higher, so they take the spots nearest the trail.
  const kept = sites.filter((p) => !mountainClearing(p.x, p.z)), spots = trailheadTreeSpots(), near = spots.filter(s => s.near), far = spots.filter(s => !s.near);
  while (near.length || far.length) {
    const spot = (kept.length % 2 ? near : far).shift() ?? (kept.length % 2 ? far : near).shift()!;
    if (kept.every((p) => Math.hypot(p.x - spot.x, p.z - spot.z) > 2.8)) kept.push(new THREE.Vector3(spot.x, terrainHeight(spot.x, spot.z), spot.z));
  }
  return kept;
}
