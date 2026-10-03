// TSL counterparts of the onBeforeCompile / ShaderMaterial patches (WebGPU build only; node materials ignore onBeforeCompile).
// Node materials copy every MeshStandardMaterial property at construction, so the game code reads them through the classic
// type; only instanceof differs, which cpu-detail handles through isStandard().
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { Fn, If, abs, attribute, cameraViewMatrix, cos, dot, float, instancedBufferAttribute, length, max, mix, normalLocal, normalView, normalize, positionLocal, pow, sin, smoothstep, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { createNodeSky } from './webgpu-sky';
import type { NodePatches } from './types';

type V2 = Node<'vec2'>;
const asStandard = (material: THREE.NodeMaterial): THREE.MeshStandardMaterial => material as unknown as THREE.MeshStandardMaterial;
const luminance = (color: Node<'vec3'>) => dot(color, vec3(.2126, .7152, .0722));
/** A live uniform of the material's own Color, so later colour changes still apply (TSL types 'color' apart from vec3). */
const colorOf = (color: THREE.Color) => uniform(color) as unknown as Node<'vec3'>;
/** View-space normal tilted by a world-space offset, as the GLSL patches add mat3(viewMatrix) * offset to `normal`. */
const tilt = (offset: Node<'vec3'>) => normalize(normalView.add(cameraViewMatrix.mul(vec4(offset, 0)).xyz));

/** stone.ts: scanned mineral detail without the source map's rusty brown cast. */
function rockMaterial(mobile: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1 }), loader = new THREE.TextureLoader();
  loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-color.jpg', (map) => {
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 4;
    // .map stays set for cpu-detail's Lambert copy; colorNode replaces the plain map multiply.
    material.map = map; material.colorNode = colorOf(material.color).mul(mix(vec3(.55), vec3(1.05), luminance(texture(map).rgb))); material.needsUpdate = true;
  }, undefined, () => { /* Vertex colour keeps the stones usable without the optional surface map. */ });
  if (!mobile) loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-normal.jpg', (map) => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping; material.normalMap = map; material.normalScale.set(.65, .65); material.needsUpdate = true;
  }, undefined, () => { /* The silhouette remains modelled if relief cannot load. */ });
  return asStandard(material);
}

/** living-waters.ts: the lake's two-axis ripple; the shared {value} time object keeps feeding it. */
function lakeWater(source: THREE.MeshStandardMaterial, time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: source.color, vertexColors: source.vertexColors, metalness: source.metalness, roughness: source.roughness, envMapIntensity: source.envMapIntensity });
  const t = uniform(0).onRenderUpdate(() => time.value), p = positionLocal.xz;
  material.normalNode = tilt(vec3(sin(p.x.mul(2.8).add(p.y.mul(1.7)).sub(t.mul(.8))), 0, cos(p.y.mul(3.1).sub(p.x.mul(1.4)).sub(t.mul(.6)))).mul(.047));
  source.dispose(); return asStandard(material);
}

/**
 * Rain and drips: the Points stay the animated source of truth, but WebGPU point primitives are one pixel wide, so a child
 * sprite draws one round, size-attenuated quad per point from the same (now instanced) position array.
 */
function sizedPoints(points: THREE.Points): void {
  const source = points.geometry.getAttribute('position'), classic = points.material as THREE.PointsMaterial;
  const positions = new THREE.InstancedBufferAttribute(source.array as Float32Array, 3); positions.setUsage(THREE.DynamicDrawUsage); points.geometry.setAttribute('position', positions);
  const material = new THREE.PointsNodeMaterial({ color: classic.color, size: classic.size, transparent: classic.transparent, opacity: classic.opacity, sizeAttenuation: classic.sizeAttenuation, depthWrite: classic.depthWrite });
  material.positionNode = instancedBufferAttribute(positions);
  material.maskNode = length(uv().sub(.5).mul(vec2(1.8, .8))).lessThanEqual(.45);
  const sprite = new THREE.Sprite(material as unknown as THREE.SpriteMaterial); sprite.count = positions.count; sprite.frustumCulled = false; sprite.name = points.name || 'Sized points';
  // Hiding the Points (cpu-detail, reduced tiers) hides the sprite with it; the Points themselves no longer draw.
  classic.visible = false; points.add(sprite);
}

function lambertTerrain(source: THREE.Material, lambert: THREE.MeshLambertMaterial): THREE.Material {
  const material = new THREE.MeshLambertNodeMaterial(); THREE.MeshLambertMaterial.prototype.copy.call(material, lambert);
  material.colorNode = (source as THREE.NodeMaterial).colorNode; lambert.dispose(); return material;
}

export const nodePatches: NodePatches = {
  createSky: createNodeSky, rockMaterial, lakeWater, sizedPoints, lambertTerrain,
  isStandard: (material): material is THREE.MeshStandardMaterial => !!(material as THREE.MeshStandardNodeMaterial).isMeshStandardNodeMaterial,
};
