import { EYELENSE } from './eyelense-gate-layout';
// Reflection probes (realism sub-plan 07): each building-piece reflects its own surroundings instead of the bare baked sky.
// One cube per exterior site (with that building's envelope hidden) and one per hall interior is rendered and prefiltered with
// the node PMREMGenerator, once per sky phase. The bake runs after the town is ready, one cube face per frame (ProbeBake), so
// saved sets restore on approach; missing sets bake after ready, so until its site is baked a surface reflects the sky, as with `?probes=off`. gpu bakes 256 px
// exterior cubes, mobile 128; interiors (rough brass in a closed hall) take half. cpu has none. Dev-only `?probes=off` keeps
// the sky reflections for comparison.
import * as THREE from 'three';
import { mix, texture, uniform } from 'three/tsl';
import type { Node, NodeFrame } from 'three/webgpu';
import type { SkyPhase } from './sky';
import { untoneMapped } from '../render/output';
import { loadSavedProbes } from './saved-probes';

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
  { id: 'eyelense-gate', landmark: 'eyelense-gate', kind: 'exterior', position: [EYELENSE.x, 5, EYELENSE.z] },
  { id: 'winter-gate', landmark: 'winter-gate', kind: 'exterior', position: [-108, 9.12, -30] },
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

/** What the environment shows: the phase's sky, and each finished site's probe. */
export interface ProbeView { sky: THREE.Texture; probes: ReadonlyMap<string, THREE.Texture> }

/**
 * The prefiltered environment of every lit surface, one node for all of them: the scene's environment node and the `envNode` of
 * every reflective building material and heroEnv material. For each drawn object it takes the probe of the object's site
 * (`userData.probe`) from `view`, else the view's sky. The texture and its size uniforms are each object's own (object group),
 * so a phase switch or a finished probe changes what an object reflects without building a shader, and alike materials of
 * different buildings stay one material and one build. three uploads an object's own uniforms when its material has node
 * properties (every `envNode` material does) or when a watched material property changes: refreshEnvironment() makes the
 * second happen for every other material when the phase changes.
 */
export class ProbeEnvironment extends THREE.PMREMNode {
  static get type(): string { return 'ProbeEnvironmentNode'; }
  view: ProbeView;
  constructor(sky: THREE.Texture) { super(sky); this.updateBeforeType = THREE.NodeUpdateType.OBJECT; this.view = { sky, probes: new Map() }; }
  updateBefore(frame: NodeFrame): boolean | undefined {
    const id = frame.object?.userData.probe as string | undefined, chosen = (id !== undefined && this.view.probes.get(id)) || this.view.sky;
    if (chosen !== this.value) this.value = chosen;
    return super.updateBefore(frame);
  }
}

/** Every lit material under `roots`, which refreshEnvironment() reaches on each phase change. */
export function litMaterials(...roots: THREE.Object3D[]): THREE.Material[] {
  const found = new Set<THREE.Material>();
  for (const root of roots) root.traverse(object => { const material = (object as THREE.Mesh).material; if (material) for (const one of Array.isArray(material) ? material : [material]) if (pbr(one)) found.add(one); });
  return [...found];
}

/**
 * A phase change reaches every material: three re-uploads an object's own uniforms (the environment's texture and size, the
 * scene's environment intensity) only when its material has node properties or a watched property changed. The environment
 * rotation's order is watched; with zero angles it rotates nothing, so each phase gets its own order and every material
 * refreshes once.
 */
export function refreshEnvironment(materials: readonly THREE.Material[], phase: SkyPhase): void {
  const order = phase === 'night' ? 'YXZ' : 'XYZ';
  for (const material of materials) if (pbr(material) && material.envMapRotation.order !== order) material.envMapRotation.order = order;
}

/** The output pipeline's scene target and MRT, whose layout the probe faces copy. */
export interface FaceSource { target: THREE.RenderTarget; mrt: Parameters<THREE.WebGPURenderer['setMRT']>[0] }

/** What a bake step draws with, from main.ts: the town, its renderer and sky, and the hooks that move the town to a probe. */
export interface BakeContext {
  renderer: THREE.WebGPURenderer; scene: THREE.Scene; source: FaceSource | null;
  /** The near-ground details, hidden while baking. */
  hidden: THREE.Object3D[];
  /** Runs before a face renders: the night lamp pool and the trees as the probe sees them. */
  visit: (position: THREE.Vector3) => void;
  /**
   * The walking view's distant pass (sub-plan 26): its sky, and the ranges, which exterior faces draw too. Every face draws it
   * first, so the town never draws a background of its own in a bake: a background with the other phase's sky would build its
   * shader again on every step of a background bake.
   */
  distant: { scene: THREE.Scene; far: number; ranges: THREE.Object3D[] };
}

/** One face target, cube and copy per probe size, kept for every bake of the session. */
interface Sized { face: THREE.RenderTarget; cube: THREE.CubeRenderTarget; quad: THREE.QuadMesh; pmrem: THREE.PMREMGenerator }

export class ReflectionProbes {
  /** Per phase, each site's prefiltered cube once the whole phase has baked. */
  private readonly baked = new Map<SkyPhase, Map<string, THREE.RenderTarget>>();
  /** Phases baked in the background with their light unshadowed, to bake again once shown. */
  private readonly provisional = new Set<SkyPhase>();
  readonly materials = new Set<PBR>();
  /** Per phase, the bake's main-thread milliseconds over all its steps, and how many frames it took. */
  readonly timings: Partial<Record<SkyPhase, { ms: number; steps: number }>> = {};
  readonly loadedMs: Partial<Record<SkyPhase, number>> = {};
  readonly saved = new Set<SkyPhase>();
  private readonly pending = new Set<string>();
  private readonly retryAt = new Map<string, number>();
  async load(renderer: THREE.WebGPURenderer, phase: SkyPhase, position?: THREE.Vector3): Promise<void> {
    if (this.has(phase) && !this.saved.has(phase)) return;
    const ids = this.scopes.filter(({ site }) => !position || Math.hypot(site.position[0] - position.x, site.position[2] - position.z) < 80).map(scope => scope.site.id)
      .filter(id => !this.baked.get(phase)?.has(id) && !this.pending.has(`${phase}:${id}`) && performance.now() >= (this.retryAt.get(`${phase}:${id}`) ?? 0));
    if (!ids.length) return;
    ids.forEach(id => this.pending.add(`${phase}:${id}`));
    try {
      const start = performance.now(), probes = await loadSavedProbes(renderer, this.size, phase, ids);
      if (probes) {
        const all = this.baked.get(phase) ?? new Map<string, THREE.RenderTarget>(); for (const [id, target] of probes) all.set(id, target);
        this.baked.set(phase, all); this.saved.add(phase); this.loadedMs[phase] = Math.round(performance.now() - start);
      } else for (const id of ids) this.retryAt.set(`${phase}:${id}`, performance.now() + 30000);
    } finally { ids.forEach(id => this.pending.delete(`${phase}:${id}`)); }
  }
  /** Dev generator only: read filtered atlases; ordinary visitors never read GPU pixels. */
  async export(renderer: THREE.WebGPURenderer, phase: SkyPhase): Promise<{ id: string; width: number; height: number; data: Uint16Array }[]> {
    const result = [];
    for (const [id, target] of this.baked.get(phase) ?? []) {
      const data = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
      if (!(data instanceof Uint16Array)) throw new Error('Expected half-float reflection atlas');
      result.push({ id, width: target.width, height: target.height, data });
    }
    return result;
  }
  /** Per site, the drawables hidden while it bakes: its envelope's parts that rise above the ground. */
  private readonly envelopes = new Map<string, THREE.Object3D[]>();
  private readonly sizes = new Map<number, Sized>();
  private readonly cameras = new THREE.CubeCamera(.1, FAR, new THREE.CubeRenderTarget(1));
  private far: THREE.CubeCamera | null = null;
  private readonly haze = uniform(new THREE.Color());
  constructor(readonly scopes: ProbeScope[], root: THREE.Object3D, readonly environment: ProbeEnvironment, private readonly size: number) {
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
    for (const [mesh, id] of scopeOf) {
      const material = mesh.material; if (Array.isArray(material) || !reflective(material)) continue;
      // The object picks its probe; its material, shared or not, takes the environment as a node property, which also has
      // three refresh the object's environment uniforms every frame, as a probe arriving needs.
      mesh.userData.probe = id; this.materials.add(material as PBR);
      if ((material as PBR).envNode !== environment) { (material as PBR).envNode = environment as unknown as Node; material.needsUpdate = true; }
    }
  }
  has(phase: SkyPhase): boolean { return this.baked.has(phase); }
  /** Baked under its own light's shadows, not provisionally in the background. */
  settled(phase: SkyPhase): boolean { return this.baked.has(phase) && !this.provisional.has(phase); }
  /** The finished probes of `phase` by site, or none. */
  probes(phase: SkyPhase): ReadonlyMap<string, THREE.Texture> {
    return new Map([...this.baked.get(phase) ?? []].map(([id, target]) => [id, target.texture]));
  }
  /** Start baking `phase`; `sky` is that phase's sky (the distant pass shows its background), `haze` its horizon radiance (HORIZON_RADIANCE). */
  bake(phase: SkyPhase, sky: { environment: THREE.Texture }, haze: THREE.Color): ProbeBake {
    return new ProbeBake(this, phase, sky, haze);
  }
  /** @internal ProbeBake's finished phase. */
  finish(phase: SkyPhase, results: Map<string, THREE.RenderTarget>, ms: number, steps: number, provisional: boolean): void {
    this.baked.get(phase)?.forEach(target => target.dispose()); this.baked.set(phase, results);
    if (provisional) this.provisional.add(phase); else this.provisional.delete(phase);
    this.timings[phase] = { ms: Math.round(ms), steps };
  }
  /** Release the bake's targets and generators once every phase that will be shown has its probes. */
  release(): void {
    for (const { face, cube, quad, pmrem } of this.sizes.values()) { face.dispose(); cube.dispose(); (quad.material as THREE.Material).dispose(); pmrem.dispose(); }
    this.sizes.clear();
  }
  /**
   * One face of `site` for `phase`. Faces render through the output pipeline's own render target layout and MRT, so every
   * object reuses the render objects, node builds and pipelines that loading compiled: a new layout (a plain cube target)
   * would build each town shader again, seconds on an integrated GPU. A quad then copies the face into the cube. Without a
   * source the faces get a plain half-float target: correct, but every shader then builds again for it. `hidden` (the
   * near-ground details), the site's envelope and `extra` (photographs, captions, signs and night halos) vanish meanwhile.
   * Every face draws the distant pass first, as the output pipeline does, then the town over it with only the depth cleared:
   * exterior faces with the ranges, so silver facing the valley reflects the crests above the haze rather than bare sky,
   * interior faces with the sky alone.
   * @internal
   */
  renderFace(context: BakeContext, scope: ProbeScope, index: number, haze: THREE.Color, extra: THREE.Object3D[]): void {
    const { renderer, scene, source, distant } = context, { site } = scope, exterior = site.kind === 'exterior';
    const { face, cube, quad } = this.sized(context, exterior ? this.size : this.size / 2);
    const cameras = this.cameras, camera = cameras.children[index] as THREE.PerspectiveCamera;
    if (cameras.coordinateSystem !== renderer.coordinateSystem) { cameras.coordinateSystem = renderer.coordinateSystem; cameras.updateCoordinateSystem(); }
    cameras.position.set(...site.position); cameras.updateMatrixWorld(true);
    camera.near = exterior ? .3 : .1; camera.updateProjectionMatrix();
    // The distant pass's cube: from just inside the town faces' far plane to the ranges' end, as main.ts's far camera.
    if (!this.far) { this.far = new THREE.CubeCamera(FAR * .9, distant.far, cameras.renderTarget); this.far.coordinateSystem = renderer.coordinateSystem; this.far.updateCoordinateSystem(); }
    this.far.position.copy(cameras.position); this.far.updateMatrixWorld(true);
    context.visit(cameras.position);
    const state = { background: scene.background, target: renderer.getRenderTarget(), mrt: renderer.getMRT(), clear: renderer.autoClearColor };
    const hidden = [...new Set([...context.hidden, ...this.envelopes.get(site.id)!, ...extra, ...exterior ? [] : distant.ranges])], shown = hidden.map(object => object.visible);
    hidden.forEach(object => { object.visible = false; }); this.haze.value.copy(haze);
    try {
      renderer.setRenderTarget(face); renderer.setMRT(source?.mrt ?? null);
      renderer.render(distant.scene, this.far.children[index] as THREE.Camera);
      scene.background = null; renderer.autoClearColor = false;
      renderer.render(scene, camera);
      renderer.setMRT(null); renderer.setRenderTarget(cube, index); quad.render(renderer);
    } finally {
      hidden.forEach((object, i) => { object.visible = shown[i]; });
      scene.background = state.background; renderer.autoClearColor = state.clear; renderer.setRenderTarget(state.target); renderer.setMRT(state.mrt);
    }
  }
  /** @internal The prefiltered environment of a site's six finished faces. */
  prefilter(context: BakeContext, scope: ProbeScope): THREE.RenderTarget {
    const { cube, pmrem } = this.sized(context, scope.site.kind === 'exterior' ? this.size : this.size / 2);
    return pmrem.fromCubemap(cube.texture as THREE.CubeTexture);
  }
  private sized({ renderer, source }: BakeContext, size: number): Sized {
    let target = this.sizes.get(size); if (target) return target;
    const layout = source?.target ?? new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType });
    const face = new THREE.RenderTarget(size, size, { count: layout.textures.length, type: layout.texture.type, samples: layout.samples, depthBuffer: layout.depthBuffer, stencilBuffer: layout.stencilBuffer });
    // MRT outputs find their attachment by texture name ('output', 'display').
    layout.textures.forEach((texture, i) => { face.textures[i].type = texture.type; face.textures[i].format = texture.format; face.textures[i].name = texture.name; });
    if (!source) layout.dispose();
    // The town fogs itself (the walking aerial haze, render/aerial.ts, seen from the probe); the fog the output pass mixes in
    // after tone mapping (the ranges' valley mist, the sky below the horizon; the display attachment's green) is mixed into the
    // copy toward the horizon's radiance. Display pixels (red) hold colours as shown, outside tone mapping: the copy turns them
    // back into the radiance the output pass shows as that colour, so a reflected cream panel keeps its brightness under the
    // final tone mapping.
    const display = face.textures.find(texture => texture.name === 'display'), copy = new THREE.MeshBasicNodeMaterial({ fog: false, depthTest: false, depthWrite: false });
    const colour = texture(face.textures[0]).rgb as unknown as Node<'vec3'>, shown = texture(display ?? face.textures[0]);
    copy.colorNode = display ? mix(mix(colour, untoneMapped(colour), shown.r), this.haze, shown.g) : colour;
    // One generator per size, kept: its blur shaders build once, and a generator rebuilds them whenever the cube size changes.
    target = { face, cube: new THREE.CubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }), quad: new THREE.QuadMesh(copy), pmrem: new THREE.PMREMGenerator(renderer) };
    this.sizes.set(size, target); return target;
  }
}

/**
 * One phase's bake, a face per step(): eleven sites of six faces, and each site's prefilter as a step of its own, which costs
 * an integrated GPU about as much as a face. Every face sees the other buildings reflect the phase's sky, as a bake in one
 * piece did; the finished phase replaces the probes shown.
 */
export class ProbeBake {
  private site = 0;
  private face = 0;
  private cancelled = false;
  /** Some face was drawn with its light unshadowed (a background bake of the phase not shown): bake again once shown. */
  unshadowed = false;
  private ms = 0;
  private steps = 0;
  private extra: THREE.Object3D[] | null = null;
  private readonly results = new Map<string, THREE.RenderTarget>();
  /** What every face reflects while baking: the sky alone. */
  readonly view: ProbeView;
  constructor(private readonly probes: ReflectionProbes, readonly phase: SkyPhase, sky: { environment: THREE.Texture }, private readonly haze: THREE.Color) {
    this.view = { sky: sky.environment, probes: new Map() };
  }
  get done(): boolean { return this.cancelled || this.site >= this.probes.scopes.length; }
  /** How many sites are finished. */
  get count(): number { return this.results.size; }
  /** The sites finished so far, for the probes shown while the bake goes on. */
  finished(): ReadonlyMap<string, THREE.Texture> { return new Map([...this.results].map(([id, target]) => [id, target.texture])); }
  /** Bake the next face, or prefilter the site whose six faces are in; true once the phase is complete (and handed to the probes). */
  step(context: BakeContext): boolean {
    if (this.done) return true;
    const start = performance.now();
    // Photographs, captions and painted signs upload on first sight; drawn into a probe, every one in view of any site would
    // upload now. Their plain paper frames and backing stay, as cream panels. Night halos stay out too: each would build its
    // pipeline for the probe target and copy the face behind it.
    this.extra ??= ((found: THREE.Object3D[]) => { context.scene.traverse(object => { const material = (object as THREE.Mesh).material as THREE.Material & { map?: THREE.Texture | null }; if (((object as THREE.Mesh).isMesh && !Array.isArray(material) && material.userData.display && material.map) || object.userData.nightGlow || object.name.startsWith('Featured jewelry · ')) found.push(object); }); return found; })([]);
    const scope = this.probes.scopes[this.site];
    if (this.face === 6) { this.results.set(scope.site.id, this.probes.prefilter(context, scope)); this.face = 0; this.site++; }
    else { this.probes.renderFace(context, scope, this.face, this.haze, this.extra); this.face++; }
    this.ms += performance.now() - start; this.steps++;
    if (this.site >= this.probes.scopes.length) this.probes.finish(this.phase, this.results, this.ms, this.steps, this.unshadowed);
    return this.done;
  }
  /** Drop a bake that will not finish (the phase changed): its finished sites are disposed. */
  cancel(): void { if (!this.done) { this.results.forEach(target => target.dispose()); this.results.clear(); this.cancelled = true; } }
}
