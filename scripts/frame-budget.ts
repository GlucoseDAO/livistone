// Draw calls and triangles of the Living Waters, Glucose Commons and Enhancement hill groups, built in memory (sub-plan 25).
// Usage: bun scripts/frame-budget.ts [--json]. No browser: drawCost() replays the walking camera's frustum culling over the
// realism capture poses, so the numbers cover the main pass only (no shadow or transmission passes) and are not device timings.
import * as THREE from 'three';
import { LivingWaters } from '../src/world/living-waters';
import { createGlucoseStructure } from '../src/world/glucose-pavilion';
import { createEnhancementHill } from '../src/world/enhancement';
import { terrainHeight } from '../src/world/terrain';
import { graphicsProfile } from '../src/game/graphics';
import type { GraphicsTier } from '../src/game/graphics';
import { drawCost } from '../src/game/render-budget';
import type { DrawCost } from '../src/game/render-budget';
import type { ColliderSpec } from '../src/game/physics';

// The capture poses of scripts/screenshot-realism.ts (name, x, z, yaw, pitch); keep the two lists in step.
export const VIEWS: [string, number, number, number, number?][] = [
  ['station-arrival', 0, 58, 0], ['arrival-meadow', 10, 52, -.9], ['garden-overview', 0, 52, 0], ['gateway-front', 0, 52, 0, .18],
  ['gateway-side', 9, 47, .92, .26], ['bridge-crossing', 0, 36, 0], ['garden-path', -14, 8, 1.2],
  ['city-hall-front', 0, 4, 0], ['energy-front', -29, 12, 0], ['energy-side', -4, -9, Math.PI / 2], ['science-front', 29, 14, 0], ['science-side', 6, -11, -Math.PI / 2],
  ['time-tower', 17, -15, 0, .4], ['embryo-station-front', 0, 43, Math.PI, .31], ['glucose-pavilion', 38, -23, 0, .23], ['railway-east-portal', 130, 79, -Math.PI / 2, .13],
  ['north-meadow', 0, -42, 0], ['meadow-ground', 10, 52, -.9, -.38], ['path-edge', -14, 8, 1.2, -.42], ['woodland-edge', -46, -12, Math.PI / 2, .12],
  ['bridge-bank', 14, 36, 1.0], ['shore-closeup', 14, 36, 1.0, -.34], ['east-tributary', 67, -5, .8, .08], ['west-tributary', -46, -12, Math.PI / 2],
  ['vittoria-lake', -18, -64, 0, .08], ['mycelium-grove', 74, -138, Math.PI, .18],
  ['city-hall-gallery', -2.4, -24, -.23], ['energy-gallery', -31.4, -10.5, -.28], ['science-gallery', 26.6, -12.2, -.28], ['energy-inside', -29, -5, 0], ['science-inside', 29, -7, 0],
  ['catalogue-poster', 2.51, -18.21, -2.409], ['embryo-station-platform', 0, 73, Math.PI - 1.1],
];
export const WALK_FAR = 130;

export function walkCamera(x: number, z: number, yaw: number, pitch = 0): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(66, 1280 / 800, .08, 150);
  camera.position.set(x, terrainHeight(x, z) + 1.83, z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return camera;
}
export interface Group { name: string; root: THREE.Object3D; classify: (object: THREE.Object3D) => string | null; prepare?: (camera: THREE.Camera) => void }
export interface Report { static: Record<string, DrawCost>; perView: Record<string, DrawCost & { views: number; maxCalls: number; maxTriangles: number }> }

export function measure(group: Group): Report {
  const report: Report = { static: drawCost(group.root, undefined, group.classify), perView: {} };
  // The static total is everything as built; a detail update would hide part of it, so take it first.
  for (const [, x, z, yaw, pitch] of VIEWS) {
    const camera = walkCamera(x, z, yaw, pitch); group.prepare?.(camera);
    for (const [key, cost] of Object.entries(drawCost(group.root, camera, group.classify))) {
      const sum = report.perView[key] ??= { calls: 0, triangles: 0, views: 0, maxCalls: 0, maxTriangles: 0 };
      sum.calls += cost.calls; sum.triangles += cost.triangles; if (cost.calls) sum.views++;
      sum.maxCalls = Math.max(sum.maxCalls, cost.calls); sum.maxTriangles = Math.max(sum.maxTriangles, cost.triangles);
    }
  }
  for (const sum of Object.values(report.perView)) { sum.calls /= VIEWS.length; sum.triangles /= VIEWS.length; }
  return report;
}

/** Builds the three groups for one tier; night halos are left out because they draw only after dark. */
export function budgetGroups(tier: GraphicsTier): Group[] {
  const mobile = tier !== 'gpu', range = Math.min(WALK_FAR, graphicsProfile(tier).forest);
  const day = (object: THREE.Object3D): boolean => !object.userData.nightGlow;
  const gardens = new LivingWaters(mobile) as LivingWaters & { updateDetail?: (camera: THREE.Camera, range: number, mapView: boolean) => boolean };
  const glucose = new THREE.Group(), hill = new THREE.Group(), colliders: ColliderSpec[] = [];
  createGlucoseStructure(glucose, colliders, mobile, new THREE.MeshStandardMaterial());
  createEnhancementHill(hill, colliders);
  const marker = (object: THREE.Object3D): boolean => /arrow|marker/i.test(object.name) || (object as THREE.Mesh).geometry?.type === 'IcosahedronGeometry';
  return [
    { name: 'Living Waters', root: gardens.root, classify: (o) => !day(o) ? null : o.name.startsWith('Mycelium') ? 'mycelium grove' : 'lake, paths, pavilion', prepare: (camera) => gardens.updateDetail?.(camera, range, false) },
    { name: 'Glucose Commons', root: glucose, classify: (o) => day(o) ? 'structure and posters' : null },
    { name: 'Enhancement hill', root: hill, classify: (o) => !day(o) ? null : marker(o) ? 'climb markers' : 'shell, ramp, figure' },
  ];
}

if (import.meta.main) {
  const json = process.argv.includes('--json'), out: Record<string, Record<string, Report>> = {};
  for (const tier of ['gpu', 'mobile'] as const) for (const group of budgetGroups(tier)) (out[tier] ??= {})[group.name] = measure(group);
  if (json) console.log(JSON.stringify(out, null, 2));
  else for (const [tier, groups] of Object.entries(out)) {
    console.log(`\n${tier}`);
    for (const [name, report] of Object.entries(groups)) for (const key of Object.keys(report.static)) {
      const s = report.static[key], v = report.perView[key] ?? { calls: 0, triangles: 0, views: 0, maxCalls: 0, maxTriangles: 0 };
      console.log(`  ${(name + ' · ' + key).padEnd(48)} built ${String(s.calls).padStart(4)} calls ${String(s.triangles).padStart(9)} tris | per view ${v.calls.toFixed(1).padStart(6)} calls ${Math.round(v.triangles).toString().padStart(9)} tris, drawn in ${v.views}/${VIEWS.length}, max ${v.maxCalls} / ${v.maxTriangles}`);
    }
  }
}
