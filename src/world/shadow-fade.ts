import * as THREE from 'three';
import { PCFShadowFilter, mix, positionView, smoothstep, uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** View-distance band (start, end) in metres over which sun shadows fade out; an end of 0 keeps them at every distance. */
export const shadowFade = uniform(new THREE.Vector2());

// ShadowNode calls a light's filterNode with one object; @types/three r186 declares neither the property nor that argument.
type FilterInputs = { depthTexture: unknown; shadowCoord: Node<'vec3'>; shadow: THREE.LightShadow; depthLayer: number };
const pcf = PCFShadowFilter as unknown as (inputs: FilterInputs) => Node<'float'>;

/**
 * Fade sun shadows with view distance. The walking shadow box covers only the near town, so re-centring it would pop distant shadows in
 * and out; fading them out well inside the box hides both its edge and every re-bake. WebGPU has no shared shader chunks to patch, so
 * this wraps the light's own PCF filter: every receiving material compiles it, and all of them read the one `shadowFade` uniform.
 */
export function installShadowFade(light: THREE.DirectionalLight): void {
  // A plain function, not Fn: ShadowNode passes the filter inputs straight through, and PCFShadowFilter expects them as given.
  (light.shadow as unknown as { filterNode: (inputs: FilterInputs) => Node<'float'> }).filterNode = (inputs) =>
    mix(pcf(inputs), 1, shadowFade.y.greaterThan(0).select(smoothstep(shadowFade.x, shadowFade.y, positionView.length()), 0));
}
