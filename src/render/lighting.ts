// Shadowless lights through r186's DynamicLighting: the night pool and the hall and station lamps share one shader loop over
// uniform arrays instead of one unrolled block per light, which with sixteen lamps was most of the generated shader code and
// shader-build time. The count is a uniform, so lamps switching on or off never rebuild a shader.
import * as THREE from 'three';
import type { LightingNode, NodeBuilder } from 'three/webgpu';
import { DynamicLighting } from 'three/addons/lighting/DynamicLighting.js';
import DynamicLightsNode from 'three/addons/tsl/lighting/DynamicLightsNode.js';

// r186's DynamicLightsNode rebuilds the light list from the scene lights alone and drops the material lightings LightsNode
// adds (sky environment, ambient occlusion, light maps), which left every lit surface without its image-based light.
class TownLightsNode extends DynamicLightsNode {
  setupLightsNode(builder: NodeBuilder): LightingNode[] {
    const materialLightings = (builder.context as { materialLightings?: LightingNode[] }).materialLightings ?? [];
    return [...materialLightings, ...(super.setupLightsNode(builder) as LightingNode[])];
  }
}

// The batching finds each light's data node by constructor.name, and the production build renames three's classes (a
// minified PointLight is `_c`), which would quietly fall back to one shader block per lamp. Pin the names it expects.
for (const [type, name] of [[THREE.PointLight, 'PointLight'], [THREE.SpotLight, 'SpotLight'], [THREE.DirectionalLight, 'DirectionalLight'], [THREE.HemisphereLight, 'HemisphereLight'], [THREE.AmbientLight, 'AmbientLight']] as const) Object.defineProperty(type, 'name', { value: name });

export class TownLighting extends DynamicLighting {
  createNode(lights: THREE.Light[] = []): DynamicLightsNode { return new TownLightsNode(this.options).setLights(lights) as DynamicLightsNode; }
}
