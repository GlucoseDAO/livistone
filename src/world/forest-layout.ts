import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { gatewayClearing } from './gateway-layout';
import { plantingAllowed } from './landscape';
import { STATION } from './station-layout';
import { terrainHeight } from './terrain';

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
    const height = terrainHeight(x, z), slope = Math.hypot(terrainHeight(x + 2, z) - height, terrainHeight(x, z + 2) - height) / 2;
    if (height > 47 + rand() * 13 || slope > .95 || Math.hypot(x / 218, (z + 60) / 210) > .82 + rand() * .18 || !clearForTree(x, z) || sites.some((p) => Math.hypot(p.x - x, p.z - z) < (mobile ? 6 : 4.8))) continue;
    sites.push(new THREE.Vector3(x, terrainHeight(x, z), z));
  }
  return sites;
}
