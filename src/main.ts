import { setCityHallCrystalQuality } from './world/city-hall';
import { nearbyArchitecture, storyFor } from './game/nearby';
import type { NearbyStory } from './game/nearby';
import { loadingStage } from './loading';
import './style.css';
import * as THREE from 'three';
import { RAILWAY, railwayCorridor } from './world/station-layout';
import { TOWN_BOUNDS, FALL_FLOOR } from './world/town-layout';
import { mountainPlace, trailCorridor } from './world/mountain-layout';
import { ridgesLook, terrainHeight } from './world/terrain';
import { FAR_LAYER, FAR_VIEW, setDistantPhase } from './world/far-landscape';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky, HORIZON_HAZE, HORIZON_RADIANCE, MOON_DIR, SKY_EXPOSURE, SUN_DIR, skyBake, skyLook } from './world/sky';
import type { Sky, SkyPhase } from './world/sky';
import { setGatewayQuality } from './world/gateway-materials';
import { setMitoringAmberQuality } from './world/mitoring-materials';
import { setStationAmberQuality } from './world/station-amber';
import { ShellMaterial } from './render/shell';
import { COLLECTION } from './game/exhibits';
import { Town } from './world/world';
import { UI } from './ui/ui';
import type { Mode } from './ui/ui';
import { Input } from './game/input';
import { Ambience } from './game/audio';
import { LANDMARKS, DISCOVERIES, SPAWN, readProgress, writeProgress } from './game/content';
import { graphicsProfile } from './game/graphics';
import type { PostMode } from './game/graphics';
import { nextTimeOfDay, parseTimeOfDay, readTimeOfDay, resolveNight, saveTimeOfDay } from './game/daylight';
import type { TimeOfDay } from './game/daylight';
import { NightLighting } from './world/night-lighting';
import { FOREST_DETAIL, SHADOW_LAYER } from './world/forest';
import { shadowFrame } from './game/shadow-frame';
import { installShadowFade, shadowFade } from './world/shadow-fade';
import type { Physics } from './game/physics';
import { createRenderer } from './render/renderer';
import type { RenderView } from './render/renderer';
import { OutputPipeline, displayFog } from './render/output';
import { TownLighting } from './render/lighting';
import { RenderScale, SCALE_RULES } from './game/render-scale';
import { BUDGET_OFF, trackDraws } from './game/render-budget';
import type { DrawCost } from './game/render-budget';
import { aerialFogNode, aerialParams, setAerial } from './render/aerial';
import { cubeTexture } from 'three/tsl';
import { ProbeEnvironment, ReflectionProbes, litMaterials, probesEnabled, refreshEnvironment } from './world/probes';
import type { ProbeBake } from './world/probes';

// The map's range fog; walking, the cpu tier fogs linearly from CPU_FOG_NEAR to its full-fog distance (GraphicsProfile.fog).
const MAP_FOG = { near: 240, far: 630 }, CPU_FOG_NEAR = 42;
// Walking with the distant ranges (sub-plan 26): the valley mist's altitude band on them in metres, and their haze per metre.
const MIST = { low: 25, high: 150, aerial: 1.2e-4 };
// On the cpu tier the eye sits this far ahead of the capsule axis. Standing exactly over a terrain grid vertex (map arrivals
// and teleports use whole-metre positions) put that vertex on the camera plane, and SwiftShader then smeared its attributes
// over the adjoining near triangles as one flat colour, in classic as in WebGPU. Two millimetres keep it clipped; hardware
// rasterizers clip it correctly, so the other tiers keep the eye on the axis.
const EYE_LEAD = .002;
// Dev-only ?light=a keeps 02's old hemisphere-heavy fill (sun and haze coherence only). b, the default, lets the baked sky
// carry the ambient light and gives heroEnv materials their own reflection strength.
const LOOK = import.meta.env.DEV && new URLSearchParams(location.search).get('light') === 'a' ? 'a' : 'b';
// Dev-only ?post=off|ao|gi overrides the tier's screen-space stages (sub-plan 18): none, occlusion with bloom, or the SSGI experiment.
const POST = ((value: string | null) => import.meta.env.DEV && (value === 'off' || value === 'ao' || value === 'gi') ? value : null)(new URLSearchParams(location.search).get('post'));
// The physical day sky (sub-plan 26) lights about a quarter less than the painted one, its zenith being a deeper blue: this
// keeps the town's shade as bright as before (arrival-meadow and meadow-ground matched within one grey level).
const PHYSICAL_DAY_FILL = 1.35;
// Sub-plan 21 (the owner chose its moderate contrast): a stronger sun against a weaker sky fill, so cast shadows read as
// shadows. Horizontal sunlit ground keeps its old brightness while shade loses about a third: sunlit to shaded about 2.8:1,
// from 1.8:1. Moonlight is rebalanced the same way at the same overall level; emissions are untouched.
type Light = { sun: number; environment: number; hemi: number };
const LIGHT: Record<SkyPhase, Light> = { day: { sun: 3.35, environment: .6, hemi: .36 }, night: { sun: .42, environment: .24, hemi: .17 } };
// The cpu tier has no environment light and no shadows: its hemisphere carries the fill, and the contrast shows in form shading.
const CPU_LIGHT: Record<SkyPhase, Light> = { day: { sun: 2.75, environment: 0, hemi: .92 }, night: { sun: .38, environment: 0, hemi: .22 } };
// 02's look a, before the sky carried the fill.
const LEGACY_LIGHT: Record<SkyPhase, Light> = { day: { sun: 2.4, environment: .5, hemi: 1.2 }, night: { sun: .32, environment: .2, hemi: .28 } };
// The map shadow box stays on the town centre; walking boxes follow the player.
const SHADOW_TARGET = new THREE.Vector3(0, 0, -60);
// Far enough along the light that the ±160 m map box keeps every caster and receiver between near and far for suns above ~20°.
const SUN_DISTANCE = 400;
// Walking boxes trade reach for ~5 cm (2048) and ~8 cm (1024) texels, led ahead of the view so the edge falls into the fog; the map keeps the whole town.
// The depth bias is a fixed few centimetres in world units; the normal offset follows texel size.
// Shadows fade out between 72% and 90% of the walking half-size: with the lead and the quarter-box re-bake drift, that band stays inside the box across the whole view.
const SHADOW = { walk: 50, walkReduced: 40, map: 160, lead: .3, fade: [.72, .9], bias: .05, normalBias: .6 };

class Game {
  private readonly renderer: THREE.WebGPURenderer;
  private readonly output: OutputPipeline;
  private readonly scene = new THREE.Scene();
  private skyBackground: THREE.CubeTexture;
  private readonly skies = new Map<boolean, Sky>();
  private nightLighting!: NightLighting;
  /** Sub-plan 07's reflection probes; none on the cpu tier or with dev-only ?probes=off. */
  private probes: ReflectionProbes | null = null;
  /** The environment every lit surface samples on gpu and mobile: the phase's sky, or a building's probe once baked. */
  private environment: ProbeEnvironment | null = null;
  /** The probe bake in progress, a face per frame after the town is ready; frames to wait before its first step. */
  private bake: ProbeBake | null = null;
  private bakeWait = 0;
  /** A phase's sky baking in steps before its probes can (the night, prebaked in the background). */
  private skyBaking: { night: boolean; steps: Generator<void, Sky> } | null = null;
  /** Every lit material, which a phase change refreshes (refreshEnvironment). */
  private litMaterials: THREE.Material[] = [];
  /** The loading map's view, from which the bakes see the town (planting and grove detail follow a camera). */
  private readonly bakeCamera = new THREE.PerspectiveCamera(44, 1, 0.2, 800);
  /** Dev-only: when each phase's bake started, finished and was drawn by the GPU, in page milliseconds (snapshot().probes). */
  private readonly probeTimes: Record<string, number> = {};
  /** Dev-only: when each loading step finished, in page milliseconds (snapshot().load); `…Gpu` when the GPU had finished its work. */
  private readonly loadTimes: Record<string, number> = {};
  /** Stands at each probe while it bakes, so the night lamp pool lights that building. */
  private readonly probeEye = new THREE.PerspectiveCamera();
  private timeOfDay: TimeOfDay = readTimeOfDay();
  /** A phase switch is under way (followTimeOfDay); it follows any later choice before it settles. */
  private switching = false;
  private clockCheck = 0;
  // Past the walking fog's full distance (GraphicsProfile.fog) a surface is only sky, so the walk camera stops there and follows
  // the fog if it lengthens (sub-plans 25 and 21); ?budget=off keeps the earlier 150 m for review. Set once the tier is known.
  private readonly walkCamera = new THREE.PerspectiveCamera(66, 1, 0.08, 150);
  private readonly mapCamera = new THREE.PerspectiveCamera(44, 1, 0.2, 800);
  /** The distant pass (render/output.ts): the sky and the ranges, from just inside the walking far plane to the ranges' end. */
  private readonly farCamera = new THREE.PerspectiveCamera(66, 1, 135, FAR_VIEW);
  private readonly distant = new THREE.Scene();
  /** The distant pass's sky, one node for the session: a phase switch, or a bake of the other phase, swaps its cube. */
  private readonly distantSky: ReturnType<typeof cubeTexture>;
  /** The distant pass's copies of the ranges, which interior probe faces leave out. */
  private readonly distantRanges: THREE.Mesh[] = [];
  // The distant pass's own sun (or moon) and sky light, kept in step with the town's; the ranges cast and take no shadows.
  private readonly distantSun = new THREE.DirectionalLight();
  private readonly distantHemi = new THREE.HemisphereLight();
  /** The distant ranges and their pass: gpu and mobile, unless ?ridges=classic (world/far-landscape.ts). */
  private ranges = false;
  private readonly orbit: OrbitControls;
  private town!: Town;
  private readonly input: Input;
  private readonly ambience = new Ambience();
  private readonly sun: THREE.DirectionalLight;
  /** Unit vector from the shadow target toward the sun or moon; the light always sits SUN_DISTANCE along it. */
  private readonly sunDirection = new THREE.Vector3();
  private readonly shadowAim = new THREE.Vector3();
  private readonly shadowCenter = new THREE.Vector3(Infinity, 0, 0);
  private shadowHalf = 0;
  /** The light direction and map size the shadow map was last framed for. */
  private readonly shadowLight = new THREE.Vector3();
  private shadowSize = 0;
  private readonly progress = readProgress();
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly graphics: RenderView['graphics'];
  private renderScale: number;
  private scaler: RenderScale;
  /** Dev-only: draws of the last frame by top-level town group, all passes (snapshot().budget). */
  private drawBudget: (() => Record<string, DrawCost>) | null = null;
  private readonly drawGroups = new WeakMap<THREE.Object3D, string>();
  // Dev-only ?capture=1: frozen animation time and render scale so before/after screenshots match.
  private readonly capture = import.meta.env.DEV && new URLSearchParams(location.search).has('capture');
  // Dev-only ?eye=<metres>: camera height above the ground under the player, for low ground captures (realism 13). Measured
  // from the terrain too, because a capture teleport can leave the capsule partly sunk into a meadow roll.
  private readonly eye = ((value: number) => import.meta.env.DEV && Number.isFinite(value) ? value : null)(parseFloat(new URLSearchParams(location.search).get('eye') ?? ''));
  private frames = 0;
  private cpuGeometry = { before: 0, after: 0 };
  private readonly reduced: boolean;
  private readonly post: PostMode;
  private night: boolean;
  private readonly hemi: THREE.HemisphereLight;
  private physics?: Physics;
  private readonly zone = 'town';

  private mode: Mode = 'welcome';
  private returnMode: 'walking' | 'map' = 'walking';
  private loreFromJournal = false;
  private galleryReturn: 'walking' | 'lore' | 'journal' = 'walking';
  private accumulator = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private interaction: string | null = null;
  private nearby: NearbyStory | null = null;
  private updateClock = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private frameId = 0;
  private lowQuality = false;
  private selection: string | null = null;
  private hoverPointer: { x: number; y: number; buttons: number } | null = null;
  private cursorDirty = false;
  constructor(private ui: UI, private readonly view: RenderView) {
    this.ambience.onStateChange = enabled => this.ui.setSound(enabled);
    this.ui.setSound(this.ambience.enabled);
    this.ambience.start();
    this.renderer = view.renderer; this.graphics = view.graphics;
    if (import.meta.env.DEV) {
      const override = new URLSearchParams(location.search).get('graphics');
      if (override === 'cpu' || override === 'mobile' || override === 'gpu') Object.assign(this.graphics, graphicsProfile(override));
    }
    this.walkCamera.far = BUDGET_OFF ? 150 : this.graphics.fog; this.farCamera.near = this.walkCamera.far * .9;
    this.walkCamera.updateProjectionMatrix(); this.farCamera.updateProjectionMatrix();
    // The night pool, hall and station lamps: room for the pool plus the fixed lamps (render/lighting.ts).
    this.renderer.lighting = new TownLighting({ maxPointLights: this.graphics.lights + 8 });
    this.renderScale = this.graphics.pixelRatio; this.scaler = new RenderScale(SCALE_RULES[this.graphics.tier], this.renderScale);
    if (import.meta.env.DEV) this.drawBudget = trackDraws(this.renderer.info, (object) => this.drawGroup(object));
    this.reduced = this.graphics.reduced; this.lowQuality = this.reduced;
    this.ranges = this.graphics.tier !== 'cpu' && ridgesLook() === 'ranges'; if (this.ranges) this.mapCamera.layers.enable(FAR_LAYER);
    this.distant.add(this.distantSun, this.distantHemi);
    this.night = resolveNight(this.timeOfDay); setDistantPhase(this.night);
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = this.graphics.shadows; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The output pass (render/output.ts) applies Khronos PBR Neutral (render/tone.ts) at this exposure, except to display materials.
    this.renderer.toneMapping = THREE.NoToneMapping; this.renderer.toneMappingExposure = SKY_EXPOSURE[this.phase];
    this.hemi = new THREE.HemisphereLight(this.night ? '#8ea4c6' : '#e9f4f0', this.night ? '#121820' : '#73805c', this.light.hemi);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(this.night ? '#c9d6ee' : '#fff0ce', this.light.sun); this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(this.reduced ? 1024 : 2048); this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = SUN_DISTANCE * 2;
    // The shadow camera also draws the forest's shadow-only meshes, which the view cameras skip.
    this.sun.shadow.camera.layers.enable(SHADOW_LAYER);
    this.scene.add(this.sun, this.sun.target); installShadowFade(this.sun); this.aimSun();
    const sky = createSky(this.renderer, this.reduced, this.night, this.graphics.tier, LOOK === 'b'); this.skies.set(this.night, sky); this.skyBackground = sky.background; this.scene.background = sky.background;
    // One environment node for the whole session (sub-plan 07): a phase switch swaps its textures, where a new scene.environment
    // texture would have rebuilt every lit material's shader, and the probes bake later with nothing to build.
    if (this.graphics.tier !== 'cpu') {
      this.environment = new ProbeEnvironment(sky.environment);
      for (const scene of [this.scene, this.distant]) (scene as THREE.Scene & { environmentNode: unknown }).environmentNode = this.environment;
    }
    this.distantSky = cubeTexture(sky.background); (this.distant as THREE.Scene & { backgroundNode: unknown }).backgroundNode = this.distantSky;
    this.scene.environmentIntensity = this.light.environment; this.syncDistant();
    // Set once, before any shader is built: a different fog node would rebuild every material. Uniforms switch it per view.
    if (this.graphics.tier !== 'cpu') (this.scene as THREE.Scene & { fogNode: unknown }).fogNode = aerialFogNode;
    this.setFog();
    // The town and sun are static; refresh shadows only when scene visibility changes. WebGPU schedules shadows per light.
    this.sun.shadow.autoUpdate = false; this.sun.shadow.needsUpdate = true;
    this.post = POST ?? this.graphics.post; this.output = new OutputPipeline(this.renderer, this.scene, this.post, this.walkCamera);
    this.mapCamera.position.set(62, 44, 69); this.mapCamera.lookAt(0, 2, -13);
    this.orbit = new OrbitControls(this.mapCamera, ui.canvas); this.orbit.target.set(0, 1, -12); this.orbit.enabled = false;
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08; this.orbit.minDistance = 30; this.orbit.maxDistance = 410;
    this.orbit.minPolarAngle = 0.16; this.orbit.maxPolarAngle = Math.PI * 0.44;
    this.input = new Input(ui.canvas, ui.joystick, (action) => void this.action(action));
    // Mouse hover only: a hand over anything that responds to a click. Evaluated once per frame.
    ui.canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.hoverPointer = { x: e.clientX, y: e.clientY, buttons: e.buttons }; this.cursorDirty = true; } });
    ui.canvas.addEventListener('pointerleave', () => { this.hoverPointer = null; this.cursorDirty = true; });
    document.addEventListener('pointerup', (e) => { if (this.hoverPointer && e.pointerType === 'mouse') { this.hoverPointer.buttons = e.buttons; this.cursorDirty = true; } });
    ui.setLookHint('Hold left mouse to look');
    ui.progress(this.progress); ui.setMode('welcome');
    ui.setTimeOfDay(this.timeOfDay, this.night);
    document.querySelector<HTMLSelectElement>('#quality')!.value = this.reduced ? 'low' : 'high';
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.lastTime = performance.now(); this.accumulator = 0;
      if (document.hidden) { this.input.clear(); this.ambience.suspend(); }
      else this.ambience.resume();
    });
    view.onLost(() => {
      this.input.active = false; this.input.clear(); cancelAnimationFrame(this.frameId);
      ui.error('The graphics connection was interrupted. Reload to return to the town. Your discoveries are saved.');
    });
    this.resize();
    if (import.meta.env.DEV) {
      Object.assign(window, { __livistone: {
        snapshot: () => ({ ready: !!this.physics && this.mode !== 'welcome', night: this.night, timeOfDay: this.timeOfDay, mode: this.mode, position: this.position(), zone: this.zone, journey: null, yaw: this.input.yaw, pitch: this.input.pitch, fps: this.fps, ...this.view.stats(), interaction: this.interaction, progress: structuredClone(this.progress), selectedLandmark: this.selection, reducedGraphics: this.reduced, graphicsTier: this.graphics.tier, renderScale: this.renderer.getPixelRatio(), cpuGeometry: this.cpuGeometry, capture: this.capture, frames: this.frames, backend: view.backend, post: this.post, budget: this.drawBudget ? structuredClone(this.drawBudget()) : undefined, probes: this.probes ? { ...this.probeTimes, ...Object.fromEntries(Object.entries(this.probes.timings).flatMap(([phase, time]) => [[phase, time.ms], [phase + 'Steps', time.steps]])), materials: this.probes.materials.size, baking: this.bake?.phase ?? (this.skyBaking ? this.skyBaking.night ? 'night' : 'day' : null) } : null, load: { ...this.loadTimes }, shaders: view.shaders() }),
        teleport: (x: number, z: number, yaw = 0, y = 1.05, pitch = 0) => { this.physics?.teleport({ x, y, z }); this.input.yaw = yaw; this.input.pitch = pitch; this.accumulator = 0; },
        // The capture harness stands on whatever lies under a view, ground, deck or floor, looking from 2.2 m above the terrain.
        standingHeight: (x: number, z: number) => this.physics?.standingHeight(x, z, terrainHeight(x, z) + 2.2) ?? null,
      } });
      // Dev-only, beside the stable hook: poster texture residency (sub-plan 12) with the renderer's texture memory and the
      // count of node builds and shader programs, so a test can see that swapping poster maps builds nothing.
      // Dev-only: each building's hovering model this hour, where it hangs and which way its poster faces (capture poses).
      Object.assign(window, { __featured: () => this.town?.exhibitions.map((exhibition) => {
        const mesh = exhibition.featured; if (!exhibition.featuredPiece || !mesh.parent) return { id: exhibition.id, piece: null };
        mesh.updateWorldMatrix(true, false); const at = mesh.getWorldPosition(new THREE.Vector3()), facing = new THREE.Vector3(0, 0, 1).transformDirection(mesh.parent.matrixWorld);
        return { id: exhibition.id, piece: exhibition.featuredPiece, position: [at.x, at.y, at.z], facing: [facing.x, facing.z], visible: mesh.visible };
      }) });
      Object.assign(window, { __posters: () => this.town && ({ ...this.town.posters.report(), gpu: { textures: this.renderer.info.memory.textures, bytes: this.renderer.info.memory.texturesSize, programs: this.renderer.info.memory.programs, builds: (this.renderer as unknown as { _nodes?: { nodeBuilderCache?: Map<unknown, unknown> } })._nodes?.nodeBuilderCache?.size ?? 0 } }) });
    }
  }
  /** Dev-only: the top-level town group of a drawn object, or the frame's own passes outside the town. */
  private drawGroup(object: THREE.Object3D): string {
    let group = this.drawGroups.get(object); if (group) return group;
    let top = object; while (top.parent && top.parent !== this.town?.root) top = top.parent;
    group = top.parent ? top.name || object.name || 'Town · unnamed' : 'Frame · ' + (object.name || object.type);
    this.drawGroups.set(object, group); return group;
  }
  /** Dev-only: note when a loading step finished and, with `gpu`, when the GPU has also finished the work submitted so far. */
  private mark(step: string, gpu = false): void {
    if (!import.meta.env.DEV) return;
    this.loadTimes[step] = Math.round(performance.now());
    const device = (this.renderer.backend as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device;
    if (gpu && device) void device.queue.onSubmittedWorkDone().then(() => { this.loadTimes[step + 'Gpu'] = Math.round(performance.now()); });
  }
  async load(): Promise<void> {
    // Leaf cards smooth their cut-out edges by alpha-to-coverage wherever the frame is multisampled (fine pointers).
    FOREST_DETAIL.coverage = this.renderer.samples > 1;
    this.mark('start', true);
    this.town = await Town.create(this.reduced, loadingStage, this.graphics.tier); this.scene.add(this.town.root); this.scene.updateMatrixWorld(true);
    this.mark('town');
    await loadingStage(70, 'Loading gallery images and woodland…');
    const assets = this.town.loadAssets();
    const { Physics } = await import('./game/physics');
    await loadingStage(78, 'Preparing walkable paths and interiors…');
    this.physics = await Physics.create(this.town.colliders);
    await assets; this.mark('assets');
    if (this.graphics.tier === 'cpu') {
      await loadingStage(86, 'Preparing the CPU graphics profile…');
      const { prepareCpuDetail } = await import('./world/cpu-detail'); this.cpuGeometry = await prepareCpuDetail(this.town.root, this.skyBackground);
    }
    // Probe surfaces take the environment node before the precompile, so their shaders build once, with every other one.
    if (this.environment && probesEnabled()) this.probes = new ReflectionProbes(this.town.probeScopes(), this.town.root, this.environment, this.graphics.tier === 'gpu' ? 256 : 128);
    this.pointReflections(this.skies.get(this.night)!); if (this.environment) this.litMaterials = litMaterials(this.scene, this.distant);
    this.nightLighting = new NightLighting(this.town.root, this.scene, this.reduced, this.graphics.tier); this.nightLighting.setNight(this.night);
    // The distant pass draws its own copies of the ranges, which the map sees in the town (FAR_LAYER).
    if (this.ranges) for (const mesh of this.town.root.getObjectsByProperty('name', 'Distant ranges') as THREE.Mesh[]) { const copy = new THREE.Mesh(mesh.geometry, mesh.material); copy.name = mesh.name; this.distant.add(copy); this.distantRanges.push(copy); }
    document.querySelector<HTMLElement>('#graphics-profile')!.textContent = 'Device profile: ' + ({ gpu: 'GPU', mobile: 'Mobile / integrated GPU', cpu: 'CPU software renderer' }[this.graphics.tier]) + ({ webgpu: ' · WebGPU', 'webgl2-fallback': ' · WebGL 2' }[this.view.backend]);
    await loadingStage(92, 'Preparing your first view…');
    this.frameShadow(true);
    this.town.update(this.elapsed, this.mapCamera, MAP_FOG.far, true, this.sun.shadow);
    this.walkCamera.position.set(SPAWN.x, this.eyeHeight(SPAWN), SPAWN.z); this.walkCamera.rotation.set(0, SPAWN.yaw, 0, 'YXZ');
    // Build every shader now, culled or not, and the shadow pass with one rendered frame: on WebGPU each shader costs a
    // synchronous node build, which would otherwise stall the first frames that show a new object.
    this.town.warmUp(true); this.mark('prepared', true);
    await this.output.compile(this.walkCamera, [...this.town.root.children, ...this.scene.children.filter(child => child !== this.town.root && !(child as THREE.Light).isLight)]);
    this.mark('compiled', true);
    if (this.ranges) await this.output.compile(this.syncFar(), [...this.distant.children], 6, this.distant);
    // three leaves needsUpdate set after a first render into a new depth texture, which would draw the map again at the first
    // walking frame; this one, every tree and building drawn, is the whole-town box a probe bake holds (frameShadow).
    if (this.graphics.shadows) { this.sun.shadow.needsUpdate = true; this.render(this.walkCamera); this.sun.shadow.needsUpdate = false; }
    this.mark('shadowed', true);
    this.town.warmUp(false); this.town.update(this.elapsed, this.walkCamera, this.graphics.fog, false, this.sun.shadow);
    // The probes bake once the town is walkable, from the loading map's view and under the shadow box rendered just now.
    this.bakeCamera.copy(this.mapCamera); this.startBake();
    this.mark('baked', true);
    await loadingStage(100, 'Welcome to Livistone');
    this.lastTime = performance.now(); this.frameId = requestAnimationFrame(this.frame);
    this.ui.ready(); this.returnMode = 'walking'; this.setMode('walking'); this.updateWalking(0); this.findInteraction(); this.findLocation(); this.render(this.walkCamera);
    this.mark('ready', true);
  }
  private get phase(): SkyPhase { return this.night ? 'night' : 'day'; }
  /** The walking eye stands .78 m above the capsule's centre, which is .82 m above its feet. */
  private eyeHeight(p: { x: number; y: number; z: number }): number { return this.eye === null ? p.y + .78 : Math.max(p.y - .82, terrainHeight(p.x, p.z)) + this.eye; }
  // Gentle visual detail goes without ambient occlusion; bloom stays so night looks the same at either setting.
  private render(camera: THREE.Camera): void { this.view.beginFrame(); this.output.render(camera, !this.lowQuality, this.ranges && camera === this.walkCamera ? { scene: this.distant, camera: this.syncFar() } : undefined); }
  /** The distant scene follows the phase: its sky, reflections and the town's sun or moon and sky light. */
  private syncDistant(): void {
    this.distantSky.value = this.skyBackground; if (!this.ranges) return;
    this.distant.environmentIntensity = this.scene.environmentIntensity;
    this.distantSun.color.copy(this.sun.color); this.distantSun.intensity = this.sun.intensity; this.distantSun.position.copy(this.sunDirection).multiplyScalar(100);
    this.distantHemi.color.copy(this.hemi.color); this.distantHemi.groundColor.copy(this.hemi.groundColor); this.distantHemi.intensity = this.hemi.intensity;
  }
  /** The distant pass looks where the walking eye looks. */
  private syncFar(): THREE.PerspectiveCamera {
    const far = this.farCamera, walk = this.walkCamera;
    far.position.copy(walk.position); far.quaternion.copy(walk.quaternion);
    if (far.aspect !== walk.aspect || far.fov !== walk.fov) { far.aspect = walk.aspect; far.fov = walk.fov; far.updateProjectionMatrix(); }
    return far;
  }
  /**
   * Walking on the gpu and mobile tiers, the aerial perspective (render/aerial.ts) fogs every town surface in linear light toward
   * the sky behind it, complete at GraphicsProfile.fog. The map, and the cpu tier while walking, keep a range fog that the output
   * pass mixes toward the displayed horizon after tone mapping, as the classic renderer did. Walking, the distant ranges keep
   * sub-plan 26's valley mist and haze in the output pass; at their distance the town's own fog is complete. `walking` forces
   * the walking fog for a probe bake step, which also runs while the map is up.
   */
  private setFog(walking = !this.mapView): void {
    const aerial = walking && this.graphics.tier !== 'cpu', range = walking ? { near: CPU_FOG_NEAR, far: this.graphics.fog } : MAP_FOG;
    setAerial(this.skies.get(this.night)!.haze, aerial ? aerialParams(this.graphics.tier) : null);
    displayFog.amount.value = aerial ? 0 : 1; displayFog.color.value.copy(HORIZON_HAZE[this.phase]); displayFog.near.value = range.near; displayFog.far.value = range.far;
    const mist = this.ranges && walking; displayFog.mist.value.set(mist ? MIST.low : 1e6, mist ? MIST.high : 2e6); displayFog.aerial.value = mist ? MIST.aerial : 0;
  }
  /** Sun (or moon), sky environment and hemisphere strengths for this phase. CPU has no PMREM environment: its hemisphere fills. */
  private get light(): Light {
    const light = (this.graphics.tier === 'cpu' ? CPU_LIGHT : LOOK === 'a' ? LEGACY_LIGHT : LIGHT)[this.phase];
    return this.night || skyLook() === 'classic' ? light : { ...light, environment: light.environment * PHYSICAL_DAY_FILL };
  }
  private get mapView(): boolean {
    return this.mode === 'map' || this.mode === 'welcome' || (['lore', 'journal', 'paused', 'gallery'].includes(this.mode) && this.returnMode === 'map');
  }
  private pixelRatio(): number {
    const cap = this.graphics.tier === 'cpu' ? Math.sqrt(180000 / (window.innerWidth * window.innerHeight)) : Infinity;
    return Math.min(devicePixelRatio, this.renderScale, cap);
  }
  private resize(): void {
    this.renderer.setPixelRatio(this.pixelRatio());
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height); this.walkCamera.aspect = width / height; this.walkCamera.updateProjectionMatrix();
    this.mapCamera.aspect = width / height; this.mapCamera.fov = width < 650 ? 72 : 44;
    this.mapCamera.clearViewOffset();
    if (this.mode === 'map') {
      if (width < 650) this.mapCamera.setViewOffset(width, height, 0, height * 0.2, width, height);
      else this.mapCamera.setViewOffset(width, height, width * 0.13, 0, width, height);
    }
    this.mapCamera.updateProjectionMatrix();
  }
  private setMode(mode: Mode): void {
    this.mode = mode; this.interaction = null; this.input.active = mode === 'walking'; this.input.clear(); this.accumulator = 0;
    this.orbit.enabled = mode === 'map';
    this.scene.background = this.mapView ? HORIZON_RADIANCE[this.phase].clone() : this.skyBackground; this.setFog();
    this.ui.setMode(mode, this.mapView); this.town.setMapMode(this.mapView); this.frameShadow(true); this.resize();
    this.cursorDirty = true;
    if (mode === 'walking') this.ui.canvas.focus({ preventScroll: true });
  }
  async action(action: string): Promise<void> {
    if (action === 'reload') { location.reload(); return; }
    if (!this.physics || this.mode === 'welcome') return;
    if (action === 'map' || action === 'open-map' || action === 'walk') {
      const next = action === 'open-map' || (action === 'map' && !this.mapView) ? 'map' : 'walking';
      this.returnMode = next; this.loreFromJournal = false;
      if (next === 'map') this.resetMap();
      this.setMode(next); if (next === 'walking') this.ambience.resume(); return;
    }
    if (action === 'journal' || action === 'pause') {
      const next = action === 'journal' ? 'journal' : 'paused';
      if (this.mode === next) { this.setMode(this.returnMode); return; }
      if (this.mode === 'walking' || this.mode === 'map') this.returnMode = this.mode;
      this.loreFromJournal = false; this.setMode(next); return;
    }
    if (action.startsWith('time-of-day:')) {
      const value = action.split(':')[1], next = value === 'next';
      this.timeOfDay = next ? nextTimeOfDay(this.timeOfDay) : parseTimeOfDay(value); saveTimeOfDay(this.timeOfDay);
      // The menu's select switches within its change event, as it always has; the button and T paint their pending state first.
      if (!next) this.applyTimeOfDay();
      void this.followTimeOfDay(); return;
    }
    if (action.startsWith('exhibit-key:') && this.mode === 'walking') {
      const p = this.physics.position(), landmark = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 6.7);
      if (landmark) await this.exhibitionAction(`exhibit:${action.split(':')[1]}:${landmark.id}`); return;
    }
    if (action.startsWith('exhibit:')) { await this.exhibitionAction(action); return; }
    if (action === 'catalogue') { this.galleryReturn = this.mode === 'journal' ? 'journal' : this.mode === 'lore' ? 'lore' : 'walking'; this.ui.gallery.showCatalogue(); this.setMode('gallery'); return; }
    if (action.startsWith('exhibit-photo:')) {
      const [, id, index] = action.split(':'); const exhibit = COLLECTION.find((e) => e.discovery === id);
      if (exhibit) { if (this.mode !== 'gallery') this.galleryReturn = this.mode === 'lore' ? 'lore' : 'walking'; this.ui.gallery.showPhoto(exhibit, Number(index)); this.setMode('gallery'); } return;
    }
    if (action.startsWith('tap:') && this.mode === 'walking') { this.clickPhoto(Number(action.split(':')[1]), Number(action.split(':')[2])); return; }
    if (this.mode === 'gallery' && !['escape', 'close'].includes(action)) return;
    if (action === 'escape') {
      if (['paused', 'lore', 'journal', 'gallery'].includes(this.mode)) { await this.action('close'); return; }
      this.returnMode = this.mode === 'map' ? 'map' : 'walking'; this.setMode('paused');
    } else if (action === 'close') {
      if (this.mode === 'gallery') { this.setMode(this.galleryReturn); return; }
      if (this.mode === 'lore' && this.loreFromJournal) { this.loreFromJournal = false; this.setMode('journal'); }
      else { this.setMode(this.returnMode);  }
    } else if ((action === 'interact' || action === 'nearby-story') && this.mode === 'walking') {
      const id = action === 'interact' ? this.interaction ?? this.nearby?.id : this.nearby?.id;
      if (id) this.discover(id);
    } else if (action.startsWith('discovery:')) {
      this.discover(action.split(':')[1], true);

    } else if (action.startsWith('landmark:')) {
      await this.visitLandmark(action.split(':')[1]);
    } else if (action === 'reset-map') this.resetMap();
    else if (action === 'zoom-in' || action === 'zoom-out') {
      const offset = this.mapCamera.position.clone().sub(this.orbit.target); const distance = THREE.MathUtils.clamp(offset.length() * (action === 'zoom-in' ? 0.82 : 1.2), 30, 410);
      this.mapCamera.position.copy(this.orbit.target).add(offset.setLength(distance)); this.orbit.update();
    } else if (action === 'slide-prev' || action === 'slide-next') {
      if (this.mode === 'lore') this.ui.turnSlide(action === 'slide-next' ? 1 : -1);
    } else if (action === 'reset-position') {
      this.physics.teleport(); this.input.yaw = SPAWN.yaw; this.input.pitch = 0; this.returnMode = 'walking'; this.setMode('walking');  this.ui.toast('Back at the station exit, facing the city gate.');
    } else if (action === 'jump') {
      this.input.requestJump();
    } else if (action === 'sound') {
      try { this.ui.setSound(await this.ambience.toggle()); } catch { this.ui.toast('Sound is unavailable in this browser.'); }
    } else if (action.startsWith('quality:')) this.quality(action.split(':')[1] === 'low');
  }
  private visitLandmark(id: string): void {
    const landmark = LANDMARKS.find(place => place.id === id); if (!landmark || this.mode !== 'map') return;
    this.physics!.teleport(landmark.entrance);
    this.input.yaw = landmark.entrance.yaw; this.input.pitch = 0; this.selection = landmark.id;
    this.returnMode = 'walking'; this.loreFromJournal = false; this.setMode('walking'); this.updateWalking(0); this.ambience.resume();
    this.ui.toast(landmark.name + ' · walk forward to explore.');
  }
  private discover(id: string, fromJournal = false): void {
    const discovery = DISCOVERIES.find((d) => d.id === id); if (!discovery) return;
    if (!this.progress.discovered.includes(id)) { this.progress.discovered.push(id); writeProgress(this.progress); this.ui.progress(this.progress); }
    if (!fromJournal) this.returnMode = 'walking';
    this.loreFromJournal = fromJournal; this.ui.showLore(discovery, COLLECTION.find((piece) => piece.discovery === id)); this.setMode('lore');
  }
  private async exhibitionAction(action: string): Promise<void> {
    const [, command, hall, piece] = action.split(':'); const exhibition = this.town.exhibitions.find((e) => e.id === hall); if (!exhibition) return;
    if (command === 'info') { this.discover(exhibition.selected.discovery); }
    else if (command === 'lore') { this.discover(hall === 'city-hall' ? 'artifactor' : hall === 'energy' ? 'shelter' : hall === 'station' ? 'embryo-station' : hall === 'future-house' ? 'future-house-story' : hall === 'timeface' ? 'timeface' : 'connections'); }
    else if (command === 'browse') { this.galleryReturn = 'walking'; this.ui.gallery.showBrowse(hall, exhibition.selected); this.setMode('gallery'); }
    else if (command === 'photo') { this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(exhibition.selected); this.setMode('gallery'); }
    else if (command === 'left' || command === 'right') exhibition.turn(command === 'left' ? -1 : 1);
    else if (command === 'select') {
      const selected = COLLECTION.find((e) => e.discovery === piece); if (!selected || !exhibition.select(selected)) return;
      this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(selected); this.setMode('gallery');
    }
  }

  /** The poster, photo or caption a click at this screen point would act on; hover uses the same test for its cursor. */
  private clickTarget(x: number, y: number): THREE.Intersection | undefined {
    this.raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), this.walkCamera); this.raycaster.far = 9;
    const hit = this.raycaster.intersectObjects([...this.town.researchPanels, ...this.town.exhibitions.flatMap((e) => [...e.photos, ...e.textSurfaces])], false)[0]; if (!hit) return;
    const wall = this.raycaster.intersectObjects(this.town.occluders, false)[0]; if (wall && wall.distance < hit.distance) return;
    const data = hit.object.userData; return data.href || data.discovery || COLLECTION.some((p) => p.discovery === data.piece) ? hit : undefined;
  }
  private updateCursor(): void {
    const pointer = this.hoverPointer, target = !!pointer && this.mode === 'walking' && !(pointer.buttons & 1) && !!this.physics && !!this.clickTarget(pointer.x, pointer.y);
    this.ui.canvas.style.cursor = target ? 'pointer' : '';
  }
  private clickPhoto(x: number, y: number): void {
    const hit = this.clickTarget(x, y); if (!hit) return;
    if (hit.object.userData.href) { window.open(hit.object.userData.href as string, '_blank', 'noopener,noreferrer'); return; }
    const piece = COLLECTION.find((p) => p.discovery === hit.object.userData.piece);
    if (piece && !hit.object.userData.posterInfo && hit.object.userData.kind !== 'caption') {
      this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(piece, hit.object.userData.photoIndex as number ?? 0); this.setMode('gallery'); return;
    }
    if (hit.object.userData.discovery) { this.discover(hit.object.userData.discovery as string); return; }
    if (!piece) return;
    if (hit.object.userData.posterInfo) { this.discover(piece.discovery); return; }
    this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(piece, hit.object.userData.photoIndex as number); this.setMode('gallery');
  }
  private updateExhibitionControls(): void {
    const p = this.physics?.position(); this.ui.gallery.floating.hidden = true; if (!p || this.mode !== 'walking') return;
    const landmark = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 6.7); if (!landmark) return;
    const exhibition = this.town.exhibitions.find((e) => e.id === landmark.id); if (!exhibition) return;
    this.ui.gallery.accessibleControls(exhibition.id, exhibition.selected);
  }
  private position(): { x: number; y: number; z: number } | undefined { return this.physics?.position(); }
  private resetMap(): void {
    this.mapCamera.position.set(160, 224, 192); this.orbit.target.set(0, 1, -53); this.orbit.update();
  }
  /**
   * Brings the scene to the chosen time of day and shows the choice on the top-bar button and the menu's select. A switch holds
   * the main thread and the GPU for seconds (the first one per phase bakes its sky and reflection probes), so the button shows
   * it as pending: that state is painted before the switch blocks the main thread, and clears once a frame of the new phase has
   * finished on the GPU, i.e. when it can be on screen.
   */
  private async followTimeOfDay(): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    try {
      while (resolveNight(this.timeOfDay) !== this.night) {
        this.ui.setTimeOfDay(this.timeOfDay, resolveNight(this.timeOfDay), true);
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));
        this.applyTimeOfDay(); await this.presented();
      }
    } finally { this.switching = false; this.ui.setTimeOfDay(this.timeOfDay, this.night); }
  }
  /** Resolves once a frame rendered after the call has finished on the GPU. */
  private async presented(): Promise<void> {
    const frame = this.frames; while (this.frames === frame) await new Promise(resolve => requestAnimationFrame(resolve));
    const backend = this.renderer.backend as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } }; gl?: WebGL2RenderingContext };
    if (backend.device) { await backend.device.queue.onSubmittedWorkDone(); return; }
    const gl = backend.gl; if (!gl) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); if (!sync) return;
    // WebGL 2 updates a fence's status only between tasks, so it is polled rather than waited on.
    gl.flush(); while (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED && !gl.isContextLost()) await new Promise(resolve => setTimeout(resolve, 16));
    gl.deleteSync(sync);
  }
  private applyTimeOfDay(): void {
    const night = resolveNight(this.timeOfDay); if (night === this.night) return; this.night = night;
    // A sky still baking in the background finishes now (or is dropped if it is the other phase's).
    if (this.skyBaking) { const { night: baking, steps } = this.skyBaking; this.skyBaking = null; if (baking === night) { let step = steps.next(); while (!step.done) step = steps.next(); this.skies.set(night, step.value); } }
    if (!this.skies.has(night)) this.skies.set(night, createSky(this.renderer, this.reduced, night, this.graphics.tier, LOOK === 'b'));
    // A bake of the other phase stops; this phase bakes now if it has no probes yet (none prebaked), before the sun re-frames
    // its shadow box, which then holds the whole town for the bake.
    if (this.bake && this.bake.phase !== this.phase) { this.bake.cancel(); this.bake = null; }
    this.startBake(); this.phaseState(); this.aimSun(); this.showProbes();
  }
  /**
   * Sky, light, fog, emissions, exposure and the distant pass for the current phase, switched without building a shader. A bake
   * of the other phase calls it around each of its steps, so it neither re-frames the shadow box nor moves the player.
   */
  private phaseState(): void {
    const night = this.night, sky = this.skies.get(night)!;
    this.skyBackground = sky.background; if (!this.environment) this.pointReflections(sky);
    this.scene.environmentIntensity = this.light.environment; if (this.environment) refreshEnvironment(this.litMaterials, this.phase);
    this.renderer.toneMappingExposure = SKY_EXPOSURE[this.phase];
    this.hemi.color.set(night ? '#8ea4c6' : '#e9f4f0'); this.hemi.groundColor.set(night ? '#121820' : '#73805c'); this.hemi.intensity = this.light.hemi;
    this.sun.color.set(night ? '#c9d6ee' : '#fff0ce'); this.sun.intensity = this.light.sun;
    // The light turns to the sun or moon about its shadow box's target; aimSun() then fits the box (its shadow map is the sun's
    // or the moon's only once rendered again).
    this.sunDirection.copy(night ? MOON_DIR : SUN_DIR); this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, SUN_DISTANCE); this.sun.updateMatrixWorld();
    this.scene.background = this.mapView ? HORIZON_RADIANCE[this.phase].clone() : this.skyBackground; this.setFog();
    this.nightLighting.setNight(night); setDistantPhase(night); this.syncDistant();
  }
  /** Every surface reflects the phase's sky, and each building its own probe once that phase's probe exists. */
  private showProbes(): void {
    if (!this.environment) return;
    // A bake of the shown phase replaces its provisional probes site by site.
    const probes = new Map([...this.probes?.probes(this.phase) ?? [], ...this.bake?.phase === this.phase ? this.bake.finished() : []]);
    this.environment.view = { sky: this.skies.get(this.night)!.environment, probes };
  }
  /**
   * Bake a phase's probes from the next frames on: the shown one after loading or a switch if not yet baked under its own
   * shadows (a provisional night is baked again), and the night after the day.
   */
  private startBake(phase = this.phase): void {
    if (!this.probes || this.probes.settled(phase) || (phase !== this.phase && this.probes.has(phase)) || this.bake || this.skyBaking) return;
    const night = phase === 'night', sky = this.skies.get(night); this.bakeWait = 2;
    if (sky) this.bake = this.probes.bake(phase, sky, HORIZON_RADIANCE[phase]);
    else this.skyBaking = { night, steps: skyBake(this.renderer, this.reduced, night, this.graphics.tier, LOOK === 'b') };
    if (import.meta.env.DEV) this.probeTimes[phase + 'Start'] = Math.round(performance.now());
  }
  /**
   * One step of the probe bake, after the frame has rendered: one face, or one site's prefilter. The bake sees the town as the
   * loading map did: every forest cell and room drawn, with the walking fog, the near details hidden and the sky in every other
   * building's reflection; a bake of the shown phase under the whole-town shadow box that frameShadow holds meanwhile. Night
   * bakes in the background after the day's, so the first switch to night only swaps textures: the scene takes the night's
   * state around each of its steps, its moon unshadowed, because the shadow map holds the sun's box for the walking view. The
   * next frame's town update hands everything back to the walking view.
   */
  private bakeStep(): void {
    if (this.bakeWait > 0) { this.bakeWait--; return; }
    // The phase's sky first, a face or its prefilter a step, as the starting phase's was baked in one piece.
    if (this.skyBaking) {
      const { night, steps } = this.skyBaking, step = steps.next(); if (!step.done) return;
      this.skies.set(night, step.value); this.skyBaking = null; this.startBake(night ? 'night' : 'day'); this.bakeWait = 0; return;
    }
    const bake = this.bake!;
    const other = bake.phase !== this.phase, count = bake.count;
    if (other) { this.night = !this.night; this.phaseState(); this.sun.shadow.intensity = 0; bake.unshadowed = true; }
    const environment = this.environment!, view = environment.view, fade = shadowFade.value.clone();
    // A bake seen from the map's menu would otherwise draw empty halls: the map hides interiors and contact shadows.
    const map = this.mapView; if (map) this.town.setMapMode(false);
    // Game time 0, as loading saw it: the trees' sway and the water's ripples then match from one bake to the next.
    this.town.update(0, this.bakeCamera, MAP_FOG.far, true, this.graphics.shadows ? this.sun.shadow : undefined); this.setFog(true);
    shadowFade.value.set(0, 0); environment.view = bake.view;
    // The output pipeline's scene target and MRT (render/output.ts), so the bake reuses every compiled shader.
    const { target, targets } = this.output as unknown as { target?: THREE.RenderTarget; targets?: Parameters<THREE.WebGPURenderer['setMRT']>[0] };
    // The frame's draw counts (snapshot().calls, triangles and budget) stay the walking view's; the call counters, which three
    // keys per-render caches by, run on.
    const info = this.renderer.info.render, counts = { drawCalls: info.drawCalls, triangles: info.triangles, points: info.points, lines: info.lines };
    const budget = this.drawBudget?.(), kept = budget && structuredClone(budget);
    try {
      bake.step({ renderer: this.renderer, scene: this.scene, source: target ? { target, mrt: targets ?? null } : null, hidden: [this.town.details], distant: { scene: this.distant, far: FAR_VIEW, ranges: this.distantRanges },
        visit: position => { this.probeEye.position.copy(position); this.nightLighting.update(this.probeEye); this.town.surround(position); } });
    } finally {
      Object.assign(info, counts); if (budget && kept) { for (const group of Object.keys(budget)) if (!(group in kept)) delete budget[group]; Object.assign(budget, kept); }
      environment.view = view; shadowFade.value.copy(fade); this.setFog(); if (map) this.town.setMapMode(true);
      if (other) { this.sun.shadow.intensity = 1; this.night = !this.night; this.phaseState(); }
    }
    if (!bake.done) { if (!other && bake.count !== count) this.showProbes(); return; }
    this.bake = null; this.showProbes(); if (!other) this.frameShadow(true);
    if (import.meta.env.DEV) {
      const phase = bake.phase, device = (this.renderer.backend as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device;
      this.probeTimes[phase + 'End'] = Math.round(performance.now());
      if (device) void device.queue.onSubmittedWorkDone().then(() => { this.probeTimes[phase + 'Gpu'] = Math.round(performance.now()); });
    }
    // Night next, in the background and provisional (its moon unshadowed), baked again under the moon once shown; the day only
    // once shown, because its sun cannot go unshadowed. Nothing more to bake, the bake's targets and generators go (a later
    // bake makes them again).
    if (!this.probes!.has('night')) this.startBake('night');
    else this.startBake();
    if (!this.bake && !this.skyBaking) this.probes!.release();
  }
  /** r186 gives any material without its own envMap scene.environmentIntensity instead of its envMapIntensity, so heroEnv
   *  materials keep an envMap for their own strength (look b) and sample the environment node, which follows the phase without
   *  a rebuild. CPU Lambert metals sample the plain cube instead; no PMREM exists there. */
  private pointReflections(sky: Sky): void {
    const cpu = this.graphics.tier === 'cpu'; if (!cpu && (LOOK === 'a' || !this.environment)) return;
    const environment = this.environment as unknown as THREE.Node;
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (cpu) { if (material instanceof THREE.MeshLambertMaterial && material.envMap) material.envMap = sky.background; }
        else if (material.userData.heroEnv && (material instanceof THREE.MeshStandardMaterial || (material as THREE.MeshStandardNodeMaterial).isMeshStandardNodeMaterial)) {
          // Probe surfaces already hold the node; every heroEnv one still needs its envMap.
          const standard = material as THREE.MeshStandardMaterial & { envNode?: THREE.Node | null };
          if (standard.envNode !== environment || !standard.envMap) { standard.envNode = environment; standard.envMap ??= sky.environment; standard.needsUpdate = true; }
        }
      }
    });
  }
  private aimSun(): void { this.sunDirection.copy(this.night ? MOON_DIR : SUN_DIR); this.frameShadow(true); }
  /** Fit the sun's shadow box to the view and re-bake only when forced or after the box centre drifts a quarter box, so standing still costs no shadow pass. */
  private frameShadow(force = false, map = this.mapView): void {
    const camera = this.sun.shadow.camera, size = this.sun.shadow.mapSize.x, walkHalf = size >= 2048 ? SHADOW.walk : SHADOW.walkReduced;
    // While probes bake (sub-plan 07) the map's whole-town box stays: the bake's faces need every building's shadow, which the
    // walking box would leave out. Walking frames take it with their own fade; it renders again only for a new light direction
    // or map size, so each probe sees the shadows the first one did.
    const held = !!this.bake && this.bake.phase === this.phase, walking = !map && !!this.physics, half = walking && !held ? walkHalf : SHADOW.map;
    if (walking && !held) { const p = this.physics!.position(), lead = half * SHADOW.lead; this.shadowAim.set(p.x - Math.sin(this.input.yaw) * lead, p.y, p.z - Math.cos(this.input.yaw) * lead); }
    else this.shadowAim.copy(SHADOW_TARGET);
    if (held) shadowFade.value.set(walking ? walkHalf * SHADOW.fade[0] : 0, walking ? walkHalf * SHADOW.fade[1] : 0);
    const kept = half === this.shadowHalf && this.shadowAim.distanceTo(this.shadowCenter) < half / 4;
    if (kept && (!force || (held && this.shadowLight.equals(this.sunDirection) && this.shadowSize === size))) return;
    this.shadowCenter.copy(this.shadowAim); this.shadowHalf = half; this.shadowLight.copy(this.sunDirection); this.shadowSize = size;
    const frame = shadowFrame(this.shadowAim, half, size, this.sunDirection);
    camera.left = frame.left; camera.right = frame.right; camera.top = frame.top; camera.bottom = frame.bottom; camera.updateProjectionMatrix();
    this.sun.target.position.set(frame.target.x, frame.target.y, frame.target.z); this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, SUN_DISTANCE);
    this.sun.shadow.normalBias = frame.texel * SHADOW.normalBias; this.sun.shadow.bias = -SHADOW.bias / (camera.far - camera.near);
    shadowFade.value.set(walking ? walkHalf * SHADOW.fade[0] : 0, walking ? walkHalf * SHADOW.fade[1] : 0);
    // The forest culls its shadow casters against this frustum before the next bake.
    this.sun.updateMatrixWorld(); this.sun.target.updateMatrixWorld(); this.sun.shadow.updateMatrices(this.sun);
    this.sun.shadow.needsUpdate = true;
  }
  private quality(low: boolean): void {
    this.lowQuality = low || this.graphics.tier === 'cpu'; this.renderScale = Math.min(low ? 1 : 1.5, this.graphics.pixelRatio); this.scaler = new RenderScale(SCALE_RULES[this.graphics.tier], this.renderScale); this.renderer.setPixelRatio(this.pixelRatio());
    // WebGPU resizes the light's shadow target to mapSize on its next render; frameShadow requests that render.
    this.sun.shadow.mapSize.setScalar(low ? 1024 : 2048); this.frameShadow(true);
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshPhysicalNodeMaterial && material.userData.stationAmber) setStationAmberQuality(material, low);
      else if (material instanceof ShellMaterial) {
        if (material.userData.mitoringAmber) setMitoringAmberQuality(material, low);
        if (material.userData.cityHallCrystal) setCityHallCrystalQuality(material, low);
      } else if (material instanceof THREE.MeshPhysicalMaterial) {
        if (material.userData.myceliumOpal) { material.iridescence = low ? .35 : 1; material.needsUpdate = true; continue; }
        if (material.userData.gatewayGem) { setGatewayQuality(material, low); continue; }
        if (material.userData.pavilionGem) { material.transmission = low ? 0 : .42; material.opacity = low ? .45 : .7; material.needsUpdate = true; continue; }
        // Only hall glazing follows the generic switch; the station amber, river and Future House glass keep their own optics.
        if (!material.userData.hallGlass) continue;
        material.transmission = low ? 0 : .45;
        material.opacity = material.userData.clearGallery ? (low ? .18 : .26) : (low ? .32 : .65); material.needsUpdate = true;
      }
    });
    this.nightLighting.setNight(this.night); this.resize(); this.ui.toast(low ? 'Gentle visual detail enabled.' : 'Rich visual detail enabled.');
  }
  private updateWalking(dt: number): void {
    if (!this.physics) return;
    // Capture mode takes exactly one step per frame: wall-clock jitter would otherwise change how far a teleported capsule settles.
    this.accumulator = this.capture ? 1 / 60 : Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.input.turn(1 / 60); const movement = this.input.direction();
      this.physics.step(movement.x * movement.speed, movement.z * movement.speed, 1 / 60, this.input.consumeJump()); this.accumulator -= 1 / 60;
    }
    const pos = this.physics.position();
    const b = TOWN_BOUNDS;
    // The railway corridor and the Jepii Mici climb and plateau (sub-plan 27) reach past the town's walking bounds. Dev captures
    // (?capture=1) stand where they are placed, so a view past the bounds compares with ?mountain=off, where no corridor exists.
    if (pos.y < FALL_FLOOR || (!this.capture && (pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ) && !railwayCorridor(pos.x, pos.z) && !trailCorridor(pos.x, pos.z))) { this.physics.teleport(SPAWN); this.input.yaw = SPAWN.yaw; this.ui.toast('Back on the station garden path.'); }
    this.ambience.setGarden(pos.z < -60);

    const current = this.physics.position(), yaw = this.input.yaw, lead = this.graphics.tier === 'cpu' ? EYE_LEAD : 0;
    this.walkCamera.position.set(current.x - Math.sin(yaw) * lead, this.eyeHeight(current), current.z - Math.cos(yaw) * lead); this.walkCamera.rotation.set(this.input.pitch, yaw, 0, 'YXZ');
    this.updateClock += dt;
    if (this.updateClock > 0.12) { this.updateClock = 0; this.findInteraction(); this.findLocation(); this.cursorDirty = true; }
  }
  private findLocation(): void {
    const p = this.physics!.position();
    const inside = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 7.1);
    if (inside) {
      this.ui.setLocation(inside.name);
      if (!this.progress.visited.includes(inside.id)) { this.progress.visited.push(inside.id); writeProgress(this.progress); this.ui.toast('Welcome to ' + inside.name + '.'); }
    } else if (mountainPlace(p.x, p.z)) this.ui.setLocation(mountainPlace(p.x, p.z)!);
    else if (p.z < -60) this.ui.setLocation('Living Waters · Town Gardens');
    else this.ui.setLocation(railwayCorridor(p.x, p.z) && Math.abs(p.x) > RAILWAY.portalX ? 'Dark Nut Mountain Passage' : p.z > 33 ? 'Riverside Gardens' : p.z > 16 ? 'The White Bridge' : 'The Civic Gardens');
  }
  private findInteraction(): void {
    const p = this.physics!.position();
    const camera = this.walkCamera; camera.getWorldDirection(this.direction); let candidate: string | null = null, nearest = 4.8;
    let nearbyId: string | null = null, nearbyDistance = 4.8;
    for (const item of this.town.interactives) {
      const delta = item.position.clone().sub(camera.position), distance = delta.length();
      if (distance > 4.8) continue; delta.normalize();
      this.raycaster.set(camera.position, delta); this.raycaster.far = distance - 0.2;
      if (this.raycaster.intersectObjects(this.town.occluders, false).length > 0) continue;
      if (distance < nearbyDistance) { nearbyDistance = distance; nearbyId = item.id; }
      if (distance < nearest && delta.dot(this.direction) >= .78) { nearest = distance; candidate = item.id; }
    }
    if (candidate !== this.interaction) { this.interaction = candidate; this.ui.setInteraction(candidate); }
    this.nearby = storyFor(candidate ?? nearbyId ?? '') ?? nearbyArchitecture(p.x, p.z); this.ui.setNearby(this.nearby);
  }

  private updateMarkers(): void {
    const width = window.innerWidth, height = window.innerHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const markers = LANDMARKS.map(landmark => {
      this.point.set(landmark.x, 15, landmark.z).project(this.mapCamera);
      const marker = document.querySelector<HTMLElement>('#marker-' + landmark.id)!;
      return { marker, x: (this.point.x * .5 + .5) * width, y: (-this.point.y * .5 + .5) * height, hidden: Math.abs(this.point.z) > 1, w: marker.offsetWidth || 44, h: marker.offsetHeight || 44 };
    });
    // The larger shared map packs civic labels closely; keep every destination independently clickable.
    for (const item of markers) {
      let y = item.y;
      if (!item.hidden) {
        for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
          const candidate = item.y + offset * (item.h + 8);
          if (!placed.some(p => Math.abs(p.x - item.x) < (p.w + item.w) / 2 + 6 && candidate > p.y - p.h - 6 && candidate - item.h < p.y + 6)) { y = candidate; break; }
        }
        placed.push({ x: item.x, y, w: item.w, h: item.h });
      }
      item.marker.style.left = item.x + 'px'; item.marker.style.top = y + 'px'; item.marker.hidden = item.hidden;
    }
    if (this.physics) {
      const pos = this.position()!; this.point.set(pos.x, 1, pos.z).project(this.mapCamera);
      const marker = document.querySelector<HTMLElement>('#player-marker')!; marker.style.left = (this.point.x * 0.5 + 0.5) * width + 'px'; marker.style.top = (-this.point.y * 0.5 + 0.5) * height + 'px'; marker.hidden = Math.abs(this.point.z) > 1;
    }
  }
  private frame = (now: number): void => {
    this.frameId = requestAnimationFrame(this.frame);
    if (document.hidden) { this.lastTime = now; return; }
    if (this.lowQuality && now - this.lastTime < 30) return;
    // A queued animation frame can predate the startup or visibility timestamp.
    const rawDt = Math.max(0, (now - this.lastTime) / 1000); const dt = Math.min(rawDt, 0.1); this.lastTime = now; this.elapsed = this.capture ? 12 : this.elapsed + dt;
    if (this.mode === 'walking') this.updateWalking(dt);
    if (this.graphics.tier !== 'cpu') this.town.gardens.update(this.elapsed, this.mode === 'walking' && !this.capture ? dt : 0, matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.mode === 'map') { this.orbit.update(); this.updateMarkers(); }
    const camera = this.mapView ? this.mapCamera : this.walkCamera;
    // The shadow box first: the forest picks its shadow casters from the frustum this frame bakes with.
    if (this.graphics.shadows) this.frameShadow();
    // Walking re-bakes when near shrubs or tree detail change, so their shadows appear with them; the map keeps its one bake, and
    // so does a probe bake, whose whole-town box already holds every tree.
    if (this.town.update(this.elapsed, camera, this.mapView ? MAP_FOG.far : this.graphics.fog, this.mapView, this.graphics.shadows ? this.sun.shadow : undefined) && !this.mapView && this.graphics.shadows && this.bake?.phase !== this.phase) this.sun.shadow.needsUpdate = true;
    this.updateExhibitionControls();
    this.clockCheck += rawDt; if (this.clockCheck > 30) { this.clockCheck = 0; if (this.timeOfDay === 'auto') void this.followTimeOfDay(); }
    this.nightLighting.update(camera); this.render(camera);
    if (this.bake || this.skyBaking) this.bakeStep();
    if (this.cursorDirty) { this.cursorDirty = false; this.updateCursor(); }
    this.frames++; this.fpsFrames++; this.fpsTime += rawDt;
    if (this.fpsTime >= 1) { this.fps = Math.round(this.fpsFrames / this.fpsTime);
      // Adaptive resolution (render-scale.ts); ?capture=1 keeps the scale fixed so captures stay comparable.
      if (!this.capture) { const scale = this.scaler.sample(this.fps, this.fpsTime); if (scale !== this.renderScale) { this.renderScale = scale; this.renderer.setPixelRatio(this.pixelRatio()); } }
      this.fpsFrames = 0; this.fpsTime = 0; }
  };
}
let game: Game | undefined;
const ui = new UI((action) => { if (action === 'reload') location.reload(); else void game?.action(action); });
try {
  await loadingStage(12, 'Preparing the sky and light…');
  game = new Game(ui, await createRenderer(ui.canvas, !matchMedia('(pointer: coarse)').matches));
  game.load().catch((error: unknown) => { console.error('Town initialization failed', error); ui.error('The town could not finish loading. Check your connection and try again.'); });
} catch (error) {
  console.error('Graphics initialization failed', error);
  const detail = error instanceof Error && error.message ? ' ' + error.message : '';
  ui.error('Livistone needs a browser with WebGPU or WebGL 2 graphics enabled. Try an updated browser with hardware acceleration, then reload.' + detail);
}
