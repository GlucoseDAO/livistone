// Reflection probes (realism sub-plan 07): each building-piece reflects its own surroundings instead of the bare baked sky.
// After the town is built, one cube per exterior site (with that building's envelope hidden) and one per hall interior is
// rendered and prefiltered with the node PMREMGenerator, once per sky phase, lazily on the first switch to a phase. gpu
// bakes 256 px exterior cubes, mobile 128; interiors (rough brass in a closed hall) take half. cpu has none. Dev-only
// `?probes=off` keeps the sky reflections for comparison.
import * as THREE from 'three';
import { mix, pmremTexture, texture, uniform } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { SkyPhase } from './sky';

export type ProbeKind = 'exterior' | 'interior';
/** Just past the walking full-fog distance (GraphicsProfile.fog, 130 m on gpu, 110 on mobile): beyond it a surface is all sky. */
const FAR = 140;
export interface ProbeSite { id: string; landmark: string; kind: ProbeKind; position: readonly [number, number, number] }

/**
 * Where each probe looks from. Exterior probes sit at a facade's mid-height on the building's axis, inside its hidden
 * envelope; the station's sits in its ring entrance, the gateway's in its arch. Interior probes stand at head height in a hall.
 * Coordinates follow the layouts: halls at their LANDMARKS centres, STATION's ring (entranceX, 6.45 m, entranceZ + half its
 * 4.4 m depth), GATEWAY, TIME_TOWER and FUTURE_HOUSE.
 */
export const PROBE_SITES: readonly ProbeSite[] = [
  { id: 'city-hall', landmark: 'city-hall', kind: 'exterior', position: [0, 5.9, -21] },
  { id: 'energy', landmark: 'energy', kind: 'exterior', position: [-29, 4.4, -9] },
  { id: 'science', landmark: 'science', kind: 'exterior', position: [29, 6.2, -11] },
  { id: 'station', landmark: 'station', kind: 'exterior', position: [0, 6.45, 62.2] },
  { id: 'gateway', landmark: 'gateway', kind: 'exterior', position: [0, 4.2, 40.2] },
  { id: 'timeface', landmark: 'timeface', kind: 'exterior', position: [17, 13.5, -39] },
  { id: 'future-house', landmark: 'future-house', kind: 'exterior', position: [-64, 9, -110] },
  { id: 'city-hall-inside', landmark: 'city-hall', kind: 'interior', position: [0, 2.4, -21] },
  { id: 'energy-inside', landmark: 'energy', kind: 'interior', position: [-29, 2.4, -9] },
  { id: 'science-inside', landmark: 'science', kind: 'interior', position: [29, 2.4, -11] },
  { id: 'station-concourse', landmark: 'station', kind: 'interior', position: [-14, 2.6, 68] },
];

/** Dev-only `?probes=off`: every surface keeps reflecting the baked sky, as before sub-plan 07. */
export function probesEnabled(): boolean {
  return !(import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('probes') === 'off');
}

/** A site and the town parts it serves: `objects` receive its reflections, `hide` vanish while it bakes (its own envelope). */
export interface ProbeScope { site: ProbeSite; objects: THREE.Object3D[]; hide: THREE.Object3D[] }

type PBR = THREE.MeshStandardMaterial & { envNode?: Node | null; transmission?: number };
const pbr = (material: THREE.Material): material is PBR => material instanceof THREE.MeshStandardMaterial || (material as THREE.MeshStandardNodeMaterial).isMeshStandardNodeMaterial === true;
/** Surfaces whose look is mostly reflection: tagged metals and gems, any metal, glazing and transmissive stone. Matte stone,
 *  paving and paper keep the sky's soft fill; a probe would mostly darken their ambient light. */
export function reflective(material: THREE.Material): boolean {
  if (!pbr(material) || material.userData.display) return false;
  return !!material.userData.heroEnv || material.metalness >= .5 || (material.transmission ?? 0) > 0 || !!material.userData.hallGlass || (material.transparent && material.roughness <= .2);
}

/** A copy for one scope. Material.copy JSON-clones userData, which may hold promises and uniforms; a shallow copy keeps them. */
function cloneFor(material: PBR): PBR {
  const data = material.userData; material.userData = {};
  const copy = material.clone() as PBR; material.userData = data; copy.userData = { ...data }; copy.name = material.name; return copy;
}

/** The output pipeline's scene target and MRT, whose layout the probe faces copy. */
export interface FaceSource { target: THREE.RenderTarget; mrt: Parameters<THREE.WebGPURenderer['setMRT']>[0] }

export class ReflectionProbes {
  /** One prefiltered-environment node per site, shared by its materials: a phase switch swaps the node's texture, so no shader rebuilds. */
  private readonly nodes = new Map<string, ReturnType<typeof pmremTexture>>();
  private readonly baked = new Map<SkyPhase, Map<string, THREE.RenderTarget>>();
  /** Materials without their own reflection strength (not heroEnv) keep the scene fill's share, scaled per phase. */
  private readonly filled = new Set<PBR>();
  readonly materials = new Set<PBR>();
  /** Milliseconds each phase's bake took on the main thread (the GPU finishes its share afterwards). */
  readonly timings: Partial<Record<SkyPhase, number>> = {};
  /** Per site, the drawables hidden while it bakes: its envelope's parts that rise above the ground. */
  private readonly envelopes = new Map<string, THREE.Object3D[]>();
  constructor(private readonly scopes: ProbeScope[], root: THREE.Object3D, sky: THREE.Texture, private readonly size: number) {
    // Floors, plazas and rims stay: hidden, they left the bare terrain below in view, and every lower face reflected soil.
    root.updateMatrixWorld(true); const box = new THREE.Box3();
    for (const scope of scopes) {
      const parts: THREE.Object3D[] = [];
      for (const object of scope.hide) object.traverse(child => {
        if ((child as THREE.Mesh).isMesh ? box.setFromObject(child).max.y - box.min.y >= .6 : (child as THREE.Sprite).isSprite) parts.push(child);
      });
      this.envelopes.set(scope.site.id, parts);
    }
    const scopeOf = new Map<THREE.Mesh, string>();
    // Interior scopes come second, so a hall's furnishings parented to its envelope (the Mitoring's membranes) take the hall's probe.
    for (const kind of ['exterior', 'interior'] as const) for (const scope of scopes) if (scope.site.kind === kind) for (const object of scope.objects) object.traverse(child => { if ((child as THREE.Mesh).isMesh) scopeOf.set(child as THREE.Mesh, scope.site.id); });
    const users = new Map<THREE.Material, Set<string>>();
    root.traverse(child => {
      const mesh = child as THREE.Mesh; if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { const set = users.get(material) ?? new Set<string>(); set.add(scopeOf.get(mesh) ?? ''); users.set(material, set); }
    });
    for (const site of PROBE_SITES) if (scopes.some(scope => scope.site.id === site.id)) this.nodes.set(site.id, pmremTexture(sky));
    const clones = new Map<string, PBR>();
    for (const [mesh, id] of scopeOf) {
      const take = (material: THREE.Material): THREE.Material => {
        if (!reflective(material) || Array.isArray(mesh.material)) return material;
        // A material shared with other buildings (the town brass, poster stands, station silver) gets one copy per scope.
        let own = material as PBR;
        if (users.get(material)!.size > 1) { const key = material.uuid + ':' + id; own = clones.get(key) ?? cloneFor(own); clones.set(key, own); }
        if (!this.materials.has(own)) this.attach(own, id, sky);
        return own;
      };
      mesh.material = take(mesh.material as THREE.Material);
    }
  }
  private attach(material: PBR, id: string, sky: THREE.Texture): void {
    // envNode decides what is reflected; an envMap (never changed afterwards) makes three apply the material's own
    // envMapIntensity instead of scene.environmentIntensity (r186 MaterialProperties).
    material.envNode = this.nodes.get(id)! as unknown as Node; material.envMap ??= sky;
    // three keys a material's node build by its structure and reduces node-valued properties to '{}', so two alike silvers
    // with different probes would share the first one's build, and its probe: the Time Tower reflected the Mitoring hall.
    const key = material.customProgramCacheKey.bind(material); material.customProgramCacheKey = () => key() + ',probe:' + id;
    material.userData.probe = id; this.materials.add(material);
    if (!material.userData.heroEnv) { this.filled.add(material); material.envMapIntensity = 1; }
    material.needsUpdate = true;
  }
  has(phase: SkyPhase): boolean { return this.baked.has(phase); }
  /** Point every site at the phase's probes (or at `fallback`, the phase's sky, before they exist). */
  show(phase: SkyPhase, fallback: THREE.Texture): void {
    const probes = this.baked.get(phase);
    for (const [id, node] of this.nodes) node.value = probes?.get(id)?.texture ?? fallback;
  }
  /** The scene fill a material without its own reflection strength received from the sky before it had a probe. */
  setFill(environment: number): void { for (const material of this.filled) material.envMapIntensity = environment; }
  /**
   * Bake every site for `phase`. Faces render through the output pipeline's own render target layout and MRT, so every
   * object reuses the render objects, node builds and pipelines that loading compiled: a new layout (a plain cube target)
   * would build each town shader again, seconds on an integrated GPU. A quad then copies each face into the cube.
   * Without `source` the faces get a plain half-float target: correct, but every shader then builds again for it.
   * `hidden` (the near-ground details) and each site's `hide` list vanish meanwhile; `visit` runs before a site renders.
   * `distant`, when the walking view has the distant ranges (sub-plan 26): exterior faces draw that scene first, as the output
   * pipeline's distant pass does, so silver facing the valley reflects the crests above the haze rather than bare sky.
   */
  bake(renderer: THREE.WebGPURenderer, scene: THREE.Scene, source: FaceSource | null, phase: SkyPhase, sky: { background: THREE.Texture; environment: THREE.Texture }, hidden: THREE.Object3D[], haze: THREE.Color, visit?: (position: THREE.Vector3) => void, distant?: { scene: THREE.Scene; far: number } | null): number {
    const start = performance.now();
    // Buildings already holding probes reflect the phase's sky while baking, never another phase's town.
    this.show(phase, sky.environment);
    const old = this.baked.get(phase); old?.forEach(target => target.dispose());
    const results = new Map<string, THREE.RenderTarget>();
    const layout = source?.target ?? new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType }), own = !source;
    // One face target, cube and copy per probe size; the walking fog, which the output pass mixes in after tone mapping, is
    // mixed into the copy toward the horizon's radiance: unfogged, the distant ridges' bare rock tinted every silver they
    // reached brown. The display attachment's green is each surface's fog factor.
    const targets = new Map<number, { face: THREE.RenderTarget; cube: THREE.CubeRenderTarget; quad: THREE.QuadMesh }>();
    const sized = (size: number) => {
      let target = targets.get(size); if (target) return target;
      const face = new THREE.RenderTarget(size, size, { count: layout.textures.length, type: layout.texture.type, samples: layout.samples, depthBuffer: layout.depthBuffer, stencilBuffer: layout.stencilBuffer });
      // MRT outputs find their attachment by texture name ('output', 'display').
      layout.textures.forEach((texture, i) => { face.textures[i].type = texture.type; face.textures[i].format = texture.format; face.textures[i].name = texture.name; });
      const display = face.textures.find(texture => texture.name === 'display'), copy = new THREE.MeshBasicNodeMaterial({ fog: false, depthTest: false, depthWrite: false });
      copy.colorNode = display ? mix(texture(face.textures[0]).rgb, uniform(haze), texture(display).g) : texture(face.textures[0]);
      target = { face, cube: new THREE.CubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }), quad: new THREE.QuadMesh(copy) };
      targets.set(size, target); return target;
    };
    const cameras = new THREE.CubeCamera(.1, FAR, new THREE.CubeRenderTarget(1)), pmrem = new THREE.PMREMGenerator(renderer);
    // The distant pass's cube: from just inside the town faces' far plane to the ranges' end, as main.ts's far camera.
    const far = distant ? new THREE.CubeCamera(FAR * .9, distant.far, cameras.renderTarget) : null;
    for (const cube of far ? [cameras, far] : [cameras]) { cube.coordinateSystem = renderer.coordinateSystem; cube.updateCoordinateSystem(); }
    const state = { background: scene.background, target: renderer.getRenderTarget(), mrt: renderer.getMRT(), clear: renderer.autoClearColor };
    const visible = new Map<THREE.Object3D, boolean>(), hide = (object: THREE.Object3D): void => { if (!visible.has(object)) visible.set(object, object.visible); object.visible = false; };
    scene.background = sky.background; hidden.forEach(hide); const always = new Set(visible.keys());
    // Photographs, captions and painted signs upload on first sight; drawn into a probe, every one in view of any site would
    // upload during loading (about a second here). Their plain paper frames and backing stay, as cream panels. Night halos
    // stay out too: each would build its pipeline for the probe target and copy the face behind it.
    scene.traverse(object => { const material = (object as THREE.Mesh).material as THREE.Material & { map?: THREE.Texture | null }; if (((object as THREE.Mesh).isMesh && !Array.isArray(material) && material.userData.display && material.map) || object.userData.nightGlow) { hide(object); always.add(object); } });
    try {
      for (const scope of this.scopes) {
        const { site } = scope, envelope = this.envelopes.get(site.id)!, { face, cube, quad } = sized(site.kind === 'exterior' ? this.size : this.size / 2); envelope.forEach(hide);
        cameras.position.set(...site.position); cameras.updateMatrixWorld(true);
        for (const camera of cameras.children as THREE.PerspectiveCamera[]) { camera.near = site.kind === 'exterior' ? .3 : .1; camera.updateProjectionMatrix(); }
        // Interiors look at their own hall: only exterior faces reach the ranges.
        const ranges = site.kind === 'exterior' && far && distant ? distant.scene : null;
        if (ranges) { far!.position.copy(cameras.position); far!.updateMatrixWorld(true); }
        visit?.(cameras.position);
        cameras.children.forEach((camera, i) => {
          renderer.setRenderTarget(face); renderer.setMRT(source?.mrt ?? null);
          if (ranges) {
            // The town then draws over the ranges and their sky with only the depth cleared (render/output.ts).
            renderer.render(ranges, far!.children[i] as THREE.Camera);
            scene.background = null; renderer.autoClearColor = false;
            renderer.render(scene, camera as THREE.Camera);
            scene.background = sky.background; renderer.autoClearColor = state.clear;
          } else renderer.render(scene, camera as THREE.Camera);
          renderer.setMRT(null); renderer.setRenderTarget(cube, i); quad.render(renderer);
        });
        // Back in view after its own site, unless hidden for the whole bake (a caption inside a hall's envelope).
        for (const object of envelope) object.visible = !always.has(object) && visible.get(object)!;
        results.set(site.id, pmrem.fromCubemap(cube.texture as THREE.CubeTexture));
      }
    } finally {
      for (const [object, shown] of visible) object.visible = shown;
      scene.background = state.background; renderer.autoClearColor = state.clear; renderer.setRenderTarget(state.target); renderer.setMRT(state.mrt);
      for (const { face, cube, quad } of targets.values()) { face.dispose(); cube.dispose(); (quad.material as THREE.Material).dispose(); }
      cameras.renderTarget.dispose(); pmrem.dispose(); if (own) layout.dispose();
    }
    this.baked.set(phase, results); this.show(phase, sky.environment);
    return this.timings[phase] = Math.round(performance.now() - start);
  }
}
