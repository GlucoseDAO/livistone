import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { gatewayClearing } from './gateway-layout';
import { plantingAllowed } from './landscape';
import { STATION } from './station-layout';
import { terrainHeight, terrainHeightOf } from './terrain';
import { MOUNTAIN, gorgeCoords, mountainClearing, snowCover, trailCorridor, trailheadTreeSpots } from './mountain-layout';

/**
 * The forest's species, in the order Forest loads them: `file` is the GLB under models/trees (conifers.glb holds one group per
 * species), `canopy` the foliage half-extent at scale 1 from its bounds, which planting clearance, contact shadows and the ground
 * shade read. The mountain conifers are sub-plan 27's round 3, after the owner's Jepii Mici photographs.
 */
export const TREE_SPECIES = [
  { name: 'oak', file: 'oak', canopy: 5.4 }, { name: 'ash', file: 'ash', canopy: 5.2 }, { name: 'spruce', file: 'conifers', canopy: 4.3 },
  { name: 'larch', file: 'conifers', canopy: 3.7 }, { name: 'dwarf-pine', file: 'conifers', canopy: 1.6 },
] as const;
export const OAK = 0, ASH = 1, SPRUCE = 2, LARCH = 3, DWARF_PINE = 4;
/** A forest site; `species` pins it (dwarf pines, the trailhead's woods), otherwise treeSpecies decides from where it stands. */
export type TreeSite = THREE.Vector3 & { species?: number };
const smooth = THREE.MathUtils.smoothstep;
/** A fixed fraction for site `index` and `salt`, so a site keeps its species however the list around it grows. */
function unit(index: number, salt: number): number { let h = Math.imul(index ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/**
 * Oaks and ashes alternate in the valley; up the slopes spruce and larch take over from about 15 m (the woods above the Jepii Mici
 * gorge in the owner's photographs), larches gaining toward the high ground.
 */
export function treeSpecies(p: { y?: number; species?: number }, index: number): number {
  if (p.species !== undefined) return p.species;
  const y = p.y ?? 0; if (unit(index, 1) < smooth(y, 11, 22)) return unit(index, 2) < .28 + .3 * smooth(y, 30, 46) ? LARCH : SPRUCE;
  return index % 2;
}

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
export function forestSites(mobile: boolean): TreeSite[] {
  const rand = seeded(3974); const sites: TreeSite[] = [];
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
    // Their species stays the alternation they were placed for, whatever the slope's height.
    if (kept.every((p) => Math.hypot(p.x - spot.x, p.z - spot.z) > 2.8)) kept.push(Object.assign(new THREE.Vector3(spot.x, terrainHeight(spot.x, spot.z), spot.z), { species: kept.length % 2 }));
  }
  kept.push(...dwarfPineSites(mobile, kept));
  return kept;
}
/**
 * Dwarf pines (Pinus mugo) on the high ground round the Jepii Mici gorge and plateau, where the woodland's draws stop: moderate
 * slopes above 28 m, off the trail, its clearings and the snow, in cushions a few metres apart. Drawn after every other tree, so
 * none of those moves.
 */
function dwarfPineSites(mobile: boolean, trees: readonly THREE.Vector3[]): TreeSite[] {
  if (!MOUNTAIN) return [];
  const rand = seeded(6151), pines: TreeSite[] = [];
  for (let i = 0; i < (mobile ? 1400 : 2800); i++) {
    const x = -110 + rand() * 150, z = -300 + rand() * 105, h = terrainHeight(x, z);
    const slope = Math.hypot(terrainHeight(x + 2, z) - h, terrainHeight(x, z + 2) - h) / 2, near = gorgeCoords(x, z);
    // Thickest along the gorge's rims and the plateau's lip, thinning out over the open slopes.
    const rim = near ? 1 - smooth(near.d, 18, 40) : 0;
    if (h < 28 || slope < .2 || slope > .85 || rand() > .35 + .65 * rim || mountainClearing(x, z) || trailCorridor(x, z) || snowCover(x, z) > .02) continue;
    if (!plantingAllowed(x, z, 1.8) || trees.some(p => Math.hypot(p.x - x, p.z - z) < 4.5) || pines.some(p => Math.hypot(p.x - x, p.z - z) < (mobile ? 3.6 : 2.6))) continue;
    pines.push(Object.assign(new THREE.Vector3(x, h, z), { species: DWARF_PINE }));
  }
  return pines;
}
