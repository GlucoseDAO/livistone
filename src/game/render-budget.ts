import * as THREE from 'three';

export interface DrawCost { calls: number; triangles: number }

/**
 * Emulates the renderer's opaque/transparent list for one camera without a GPU: visibility inherited from parents, camera
 * layers, frustum culling against object or instance bounds, hidden materials, material groups and instance counts.
 * Calls and triangles follow `renderer.info.render` (sprites are two triangles per instance, points and lines none); passes
 * beyond the main one (shadows, two-sided glass) are not counted.
 * `classify` attributes each drawable to a named group; returning null leaves it out.
 */
export function drawCost(root: THREE.Object3D, camera?: THREE.Camera, classify: (object: THREE.Object3D) => string | null = () => 'all'): Record<string, DrawCost> {
  const result: Record<string, DrawCost> = {}, frustum = new THREE.Frustum();
  root.updateMatrixWorld(true);
  if (camera) { camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
  const add = (key: string, triangles: number): void => { const cost = result[key] ??= { calls: 0, triangles: 0 }; cost.calls++; cost.triangles += triangles; };
  const visit = (object: THREE.Object3D): void => {
    if (!object.visible) return;
    const drawable = object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite;
    if (drawable && (!camera || (object.layers.test(camera.layers) && (!object.frustumCulled || (object instanceof THREE.Sprite ? frustum.intersectsSprite(object) : frustum.intersectsObject(object)))))) {
      const key = classify(object);
      if (key) {
        const geometry = (object as THREE.Mesh).geometry, instances = object instanceof THREE.InstancedMesh ? object.count : Math.max(1, (object as { count?: number }).count ?? 1);
        const vertices = geometry.index?.count ?? geometry.getAttribute('position').count, range = Math.min(vertices, geometry.drawRange.count) - geometry.drawRange.start;
        const triangles = (count: number): number => object instanceof THREE.Sprite ? 2 * instances : object instanceof THREE.Mesh ? instances * Math.floor(count / 3) : 0;
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) { for (const group of geometry.groups) if (material[group.materialIndex ?? 0]?.visible) add(key, triangles(Math.min(group.count, range))); }
        else if (material.visible) add(key, triangles(range));
      }
    }
    for (const child of object.children) visit(child);
  };
  visit(root);
  return result;
}

/** Dev-only ?budget=off keeps sub-plan 25's runtime culls off (walk far plane, hall interiors, distant branches), for review. */
export const BUDGET_OFF = !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('budget') === 'off';

type DrawInfo = { update(object: THREE.Object3D, count: number, instanceCount: number): void; reset(): void };
/**
 * Dev-only: attribute every draw the renderer counts (all passes) to a named group, through the renderer's own `info`.
 * Returns the running table, which holds the last rendered frame between frames as `info.render` does.
 */
export function trackDraws(info: DrawInfo, groupOf: (object: THREE.Object3D) => string): () => Record<string, DrawCost> {
  let frame: Record<string, DrawCost> = {};
  const update = info.update.bind(info), reset = info.reset.bind(info);
  info.update = (object, count, instanceCount) => {
    update(object, count, instanceCount);
    const cost = frame[groupOf(object)] ??= { calls: 0, triangles: 0 }; cost.calls++;
    if ((object as THREE.Mesh).isMesh || (object as THREE.Sprite).isSprite) cost.triangles += instanceCount * count / 3;
  };
  info.reset = () => { reset(); frame = {}; };
  return () => frame;
}
