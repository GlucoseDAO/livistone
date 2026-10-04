import { WINTER } from './winter-gate-layout';
import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { WALKING_NETWORK } from './landscape';
import { GARDENS } from './living-waters-layout';
import { GLUCOSE_PAVILION } from './glucose-layout';
import { STATION } from './station-layout';
import { TIME_TOWER } from './waterways';
import { terrainHeight } from './terrain';
import { pathKerbs } from './path-kerbs';
import { MOUNTAIN, TRAIL_GATE } from './mountain-layout';
import type { PathContour } from './path-network';

/** Mesh groups of WALKING_NETWORK: the town's routes, and the lake garden's paths (built by LivingWaters). */
export const TOWN_PAVING = 0, GARDEN_PAVING = 1;
/** Paving cell size (m): marching squares resolve the curved edges and fillets to millimetres at this step. */
export const PAVING_STEP = .5;

/** Paving surface: 13 cm over the town ground. The lake garden's paths stay level across its shallow basin. */
export function pavingHeight(x: number, z: number, group: number): number { return .13 + (group === GARDEN_PAVING ? 0 : terrainHeight(x, z)); }
/** Where paving runs on into a plaza, platform, hall apron or pavilion floor, or the Jepii Mici trail leaves it, kerbs stay open. */
export function kerbOpening(x: number, z: number): boolean {
  return z >= STATION.front - 1
    || Math.hypot(x - WINTER.plazaX, z - WINTER.z) < WINTER.plazaRadius + .5
    || Math.hypot(x - TIME_TOWER.x, z - TIME_TOWER.z) < TIME_TOWER.radius + .5
    || Math.hypot(x - GLUCOSE_PAVILION.x, z - GLUCOSE_PAVILION.z) < GLUCOSE_PAVILION.radius + .5
    || Math.hypot(x - GARDENS.x - GARDENS.pavilionX, z - GARDENS.z - GARDENS.pavilionZ) < 7
    || CIVIC_LANDMARKS.some(l => Math.hypot((x - l.x) / (1 + (l.stretch.x - 1) * .85), (z - l.z) / (1 + (l.stretch.z - 1) * .85)) < 10.9)
    || (MOUNTAIN && Math.hypot(x - TRAIL_GATE.x, z - TRAIL_GATE.z) < 1.4);
}

let built: { paving: THREE.BufferGeometry[]; contours: PathContour[] } | null = null;
const kerbs = new Map<boolean, THREE.BufferGeometry[]>();
/**
 * The whole walking network's paving and kerbs in world coordinates, one geometry per group (TOWN_PAVING, GARDEN_PAVING).
 * Built once per detail level; every caller gets its own copies.
 */
export function walkingSurface(reduced: boolean): { paving: THREE.BufferGeometry[]; kerbs: THREE.BufferGeometry[] } {
  const { paving, contours } = built ??= WALKING_NETWORK.surface(PAVING_STEP, pavingHeight, 2);
  let stones = kerbs.get(reduced);
  if (!stones) kerbs.set(reduced, stones = pathKerbs(contours, { surface: pavingHeight, edge: (x, z) => WALKING_NETWORK.edge(x, z, 1), open: kerbOpening, ends: WALKING_NETWORK.freeEnds, reduced, groups: 2 }));
  return { paving: paving.map(g => g.clone()), kerbs: stones.map(g => g.clone()) };
}
