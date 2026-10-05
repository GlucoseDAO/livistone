// Progressive loading: which parts of the town build before the first view and which after. DOM-free, so tests can ask it.
// A part declares where it stands (its footprint, from its own layout); anything the walking view cannot reach from the arrival
// point builds after the town is shown, nearest the player first. A part that declares nothing builds at loading, as before.
import type * as THREE from 'three';
import { SPAWN } from '../game/content';

/** A circle on the ground. */
export interface Circle { x: number; z: number; radius: number }
/** Circles that together hold everything a part builds (its meshes, colliders and planting reservations). */
export type Footprint = readonly Circle[];
/** Beyond the walking full-fog distance a surface is only sky; this much more covers footprints drawn a little tight. */
export const PART_MARGIN = 10;

/** One circle: a building round its centre. */
export const around = (x: number, z: number, radius: number): Footprint => [{ x, z, radius }];
/** A chain of circles along `points` (x, z), `margin` wide each side, for parts laid out along a line such as a trail. Every point lies within a spacing of a chained one, so each circle reaches margin + spacing. */
export function footprintOf(points: readonly { x: number; z: number }[], margin: number, spacing = margin / 2): Footprint {
  const circles: Circle[] = []; let last: { x: number; z: number } | null = null;
  for (const [i, p] of points.entries()) if (!last || Math.hypot(p.x - last.x, p.z - last.z) >= spacing || i === points.length - 1) { circles.push({ x: p.x, z: p.z, radius: margin + spacing }); last = p; }
  return circles;
}
/** How far the footprint's nearest edge lies from a point (negative inside it). */
export function footprintDistance(footprint: Footprint, from: { x: number; z: number }): number {
  return Math.min(...footprint.map(circle => Math.hypot(circle.x - from.x, circle.z - from.z) - circle.radius));
}
/** How far the nearest of the footprint's circle centres lies: where a part mostly is, which orders the stream. */
export function footprintCentre(footprint: Footprint, from: { x: number; z: number }): number {
  return Math.min(...footprint.map(circle => Math.hypot(circle.x - from.x, circle.z - from.z)));
}
/** Whether a part must exist for the first view: its footprint comes within `fog` (+ PART_MARGIN) of the arrival point. */
export function neededAtArrival(footprint: Footprint, fog: number, arrival: { x: number; z: number } = SPAWN): boolean {
  return footprintDistance(footprint, arrival) <= fog + PART_MARGIN;
}

/** A part built after the first view: what main.ts takes into physics, reflections, lighting and the shader warm-up before showing it. */
export interface TownPart {
  name: string;
  footprint: Footprint;
  /** Everything the part added to the town's root, hidden until shown. */
  root: THREE.Group;
  /** What it added to the near-ground details (map mode hides that group), hidden until shown too. */
  details: THREE.Object3D[];
  colliders: import('../game/physics').ColliderSpec[];
  probeScopes: import('./probes').ProbeScope[];
  /** Its textures, models and posters: the part is shown, and its shaders built, once they are in. */
  ready: Promise<unknown>;
  shown: boolean;
  /** Ground its objects stand on, kept free of near grass once shown, and how many contact patches it added. */
  discs: import('./grass-field').GroundDisc[];
  contacts: number;
  /** Its build threw: it stays hidden, and nothing waits for it. */
  failed?: unknown;
}
