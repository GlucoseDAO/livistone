import { setCityHallCrystalQuality } from './world/city-hall';
import { nearbyArchitecture, storyFor } from './game/nearby';
import type { NearbyStory } from './game/nearby';
import { loadingStage } from './loading';
import './style.css';
import * as THREE from 'three';
import { RAILWAY, railwayCorridor } from './world/station-layout';
import { TOWN_BOUNDS } from './world/town-layout';
import { terrainHeight } from './world/terrain';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky, HORIZON_HAZE, HORIZON_RADIANCE, MOON_DIR, SKY_EXPOSURE, SUN_DIR } from './world/sky';
import type { SkyPhase } from './world/sky';
import { setGatewayQuality } from './world/gateway-materials';
import { setMitoringAmberQuality } from './world/mitoring-materials';
import { ShellMaterial } from './render/shell';
import { COLLECTION } from './game/exhibits';
import { Town } from './world/world';
import { UI } from './ui/ui';
import type { Mode } from './ui/ui';
import { Input } from './game/input';
import { Ambience } from './game/audio';
import { LANDMARKS, DISCOVERIES, SPAWN, readProgress, writeProgress } from './game/content';
import { graphicsProfile } from './game/graphics';
import { parseTimeOfDay, readTimeOfDay, resolveNight, saveTimeOfDay } from './game/daylight';
import type { TimeOfDay } from './game/daylight';
import { NightLighting } from './world/night-lighting';
import { SHADOW_LAYER } from './world/forest';
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

const WALK_FOG = { near: 42, far: 130 }, MAP_FOG = { near: 240, far: 630 };
// Dev-only ?look=a keeps the old hemisphere-heavy fill (sun and haze coherence only). b, the default, lets the baked sky
// carry more of the ambient light and gives heroEnv materials their own reflection strength.
const LOOK = import.meta.env.DEV && new URLSearchParams(location.search).get('light') === 'a' ? 'a' : 'b';
const FILL: Record<'a' | 'b', Record<SkyPhase, { environment: number; hemi: number }>> = {
  a: { day: { environment: .5, hemi: 1.2 }, night: { environment: .2, hemi: .28 } }, b: { day: { environment: .9, hemi: .55 }, night: { environment: .3, hemi: .22 } } };
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
  private readonly skies = new Map<boolean, ReturnType<typeof createSky>>();
  private nightLighting!: NightLighting;
  private timeOfDay: TimeOfDay = readTimeOfDay();
  private clockCheck = 0;
  // Past the walking fog's far distance a surface shows only haze, so the walk camera stops there and follows the fog if it
  // lengthens (sub-plan 25); ?budget=off keeps the earlier 150 m for review.
  private readonly walkCamera = new THREE.PerspectiveCamera(66, 1, 0.08, BUDGET_OFF ? 150 : WALK_FOG.far);
  private readonly mapCamera = new THREE.PerspectiveCamera(44, 1, 0.2, 800);
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
    // The night pool, hall and station lamps: room for the pool plus the fixed lamps (render/lighting.ts).
    this.renderer.lighting = new TownLighting({ maxPointLights: this.graphics.lights + 8 });
    this.renderScale = this.graphics.pixelRatio; this.scaler = new RenderScale(SCALE_RULES[this.graphics.tier], this.renderScale);
    if (import.meta.env.DEV) this.drawBudget = trackDraws(this.renderer.info, (object) => this.drawGroup(object));
    this.reduced = this.graphics.reduced; this.lowQuality = this.reduced;
    this.night = resolveNight(this.timeOfDay);
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = this.graphics.shadows; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The output pass (render/output.ts) applies the classic ACES fit at this exposure, except to display materials.
    this.renderer.toneMapping = THREE.NoToneMapping; this.renderer.toneMappingExposure = SKY_EXPOSURE[this.phase];
    this.setFog(MAP_FOG);
    this.hemi = new THREE.HemisphereLight(this.night ? '#8ea4c6' : '#e9f4f0', this.night ? '#121820' : '#73805c', this.fill.hemi);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(this.night ? '#c9d6ee' : '#fff0ce', this.night ? .32 : 2.4); this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(this.reduced ? 1024 : 2048); this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = SUN_DISTANCE * 2;
    // The shadow camera also draws the forest's shadow-only meshes, which the view cameras skip.
    this.sun.shadow.camera.layers.enable(SHADOW_LAYER);
    this.scene.add(this.sun, this.sun.target); installShadowFade(this.sun); this.aimSun();
    const sky = createSky(this.renderer, this.reduced, this.night, this.graphics.tier, LOOK === 'b'); this.skies.set(this.night, sky); this.skyBackground = sky.background; this.scene.background = sky.background; this.scene.environment = this.graphics.tier === 'cpu' ? null : sky.environment;
    this.scene.environmentIntensity = this.fill.environment;
    // The town and sun are static; refresh shadows only when scene visibility changes. WebGPU schedules shadows per light.
    this.sun.shadow.autoUpdate = false; this.sun.shadow.needsUpdate = true;
    this.output = new OutputPipeline(this.renderer, this.scene);
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
    document.querySelector<HTMLSelectElement>('#time-of-day')!.value = this.timeOfDay;
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
        snapshot: () => ({ ready: !!this.physics && this.mode !== 'welcome', night: this.night, timeOfDay: this.timeOfDay, mode: this.mode, position: this.position(), zone: this.zone, journey: null, yaw: this.input.yaw, pitch: this.input.pitch, fps: this.fps, ...this.view.stats(), interaction: this.interaction, progress: structuredClone(this.progress), selectedLandmark: this.selection, reducedGraphics: this.reduced, graphicsTier: this.graphics.tier, renderScale: this.renderer.getPixelRatio(), cpuGeometry: this.cpuGeometry, capture: this.capture, frames: this.frames, backend: view.backend, budget: this.drawBudget ? structuredClone(this.drawBudget()) : undefined }),
        teleport: (x: number, z: number, yaw = 0, y = 1.05, pitch = 0) => { this.physics?.teleport({ x, y, z }); this.input.yaw = yaw; this.input.pitch = pitch; this.accumulator = 0; },
      } });
    }
  }
  /** Dev-only: the top-level town group of a drawn object, or the frame's own passes outside the town. */
  private drawGroup(object: THREE.Object3D): string {
    let group = this.drawGroups.get(object); if (group) return group;
    let top = object; while (top.parent && top.parent !== this.town?.root) top = top.parent;
    group = top.parent ? top.name || object.name || 'Town · unnamed' : 'Frame · ' + (object.name || object.type);
    this.drawGroups.set(object, group); return group;
  }
  async load(): Promise<void> {
    this.town = await Town.create(this.reduced, loadingStage, this.graphics.tier); this.scene.add(this.town.root); this.scene.updateMatrixWorld(true);
    await loadingStage(70, 'Loading gallery images and woodland…');
    const assets = this.town.loadAssets();
    const { Physics } = await import('./game/physics');
    await loadingStage(78, 'Preparing walkable paths and interiors…');
    this.physics = await Physics.create(this.town.colliders);
    await assets;
    if (this.graphics.tier === 'cpu') {
      await loadingStage(86, 'Preparing the CPU graphics profile…');
      const { prepareCpuDetail } = await import('./world/cpu-detail'); this.cpuGeometry = await prepareCpuDetail(this.town.root, this.skyBackground);
    }
    this.pointReflections(this.skies.get(this.night)!);
    this.nightLighting = new NightLighting(this.town.root, this.scene, this.reduced, this.graphics.tier); this.nightLighting.setNight(this.night);
    document.querySelector<HTMLElement>('#graphics-profile')!.textContent = 'Device profile: ' + ({ gpu: 'GPU', mobile: 'Mobile / integrated GPU', cpu: 'CPU software renderer' }[this.graphics.tier]) + ({ webgpu: ' · WebGPU', 'webgl2-fallback': ' · WebGL 2' }[this.view.backend]);
    await loadingStage(92, 'Preparing your first view…');
    this.frameShadow(true);
    this.town.update(this.elapsed, this.mapCamera, MAP_FOG.far, true, this.sun.shadow);
    this.walkCamera.position.set(SPAWN.x, this.eyeHeight(SPAWN), SPAWN.z); this.walkCamera.rotation.set(0, SPAWN.yaw, 0, 'YXZ');
    // Build every shader now, culled or not, and the shadow pass with one rendered frame: on WebGPU each shader costs a
    // synchronous node build, which would otherwise stall the first frames that show a new object.
    this.town.warmUp(true);
    await this.output.compile(this.walkCamera, [...this.town.root.children, ...this.scene.children.filter(child => child !== this.town.root && !(child as THREE.Light).isLight)]);
    if (this.graphics.shadows) { this.sun.shadow.needsUpdate = true; this.render(this.walkCamera); }
    this.town.warmUp(false); this.town.update(this.elapsed, this.walkCamera, WALK_FOG.far, false, this.sun.shadow);
    await loadingStage(100, 'Welcome to Livistone');
    this.lastTime = performance.now(); this.frameId = requestAnimationFrame(this.frame);
    this.ui.ready(); this.returnMode = 'walking'; this.setMode('walking'); this.updateWalking(0); this.findInteraction(); this.findLocation(); this.render(this.walkCamera);
  }
  private get phase(): SkyPhase { return this.night ? 'night' : 'day'; }
  /** The walking eye stands .78 m above the capsule's centre, which is .82 m above its feet. */
  private eyeHeight(p: { x: number; y: number; z: number }): number { return this.eye === null ? p.y + .78 : Math.max(p.y - .82, terrainHeight(p.x, p.z)) + this.eye; }
  private render(camera: THREE.Camera): void { this.view.beginFrame(); this.output.render(camera); }
  /** The output pass fogs every surface toward the displayed horizon after tone mapping, as the classic renderer did. */
  private setFog(range: { near: number; far: number }): void {
    displayFog.color.value.copy(HORIZON_HAZE[this.phase]); displayFog.near.value = range.near; displayFog.far.value = range.far;
  }
  // CPU has no PMREM environment to take over the fill, so its hemisphere keeps the full share.
  private get fill(): { environment: number; hemi: number } { return FILL[this.graphics.tier === 'cpu' ? 'a' : LOOK][this.phase]; }
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
    this.scene.background = this.mapView ? HORIZON_RADIANCE[this.phase].clone() : this.skyBackground; this.setFog(this.mapView ? MAP_FOG : WALK_FOG);
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
    } else if (action.startsWith('time-of-day:')) { this.timeOfDay = parseTimeOfDay(action.split(':')[1]); saveTimeOfDay(this.timeOfDay); this.applyTimeOfDay(); }
    else if (action.startsWith('quality:')) this.quality(action.split(':')[1] === 'low');
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
  private applyTimeOfDay(): void {
    const night = resolveNight(this.timeOfDay); if (night === this.night) return; this.night = night;
    let sky = this.skies.get(night); if (!sky) { sky = createSky(this.renderer, this.reduced, night, this.graphics.tier, LOOK === 'b'); this.skies.set(night, sky); }
    this.skyBackground = sky.background; this.scene.environment = this.graphics.tier === 'cpu' ? null : sky.environment;
    this.pointReflections(sky); this.scene.environmentIntensity = this.fill.environment;
    this.renderer.toneMappingExposure = SKY_EXPOSURE[this.phase];
    this.hemi.color.set(night ? '#8ea4c6' : '#e9f4f0'); this.hemi.groundColor.set(night ? '#121820' : '#73805c'); this.hemi.intensity = this.fill.hemi;
    this.sun.color.set(night ? '#c9d6ee' : '#fff0ce'); this.sun.intensity = night ? .32 : 2.4;
    this.aimSun();
    this.scene.background = this.mapView ? HORIZON_RADIANCE[this.phase].clone() : this.skyBackground; this.setFog(this.mapView ? MAP_FOG : WALK_FOG);
    this.nightLighting.setNight(night); this.sun.shadow.needsUpdate = true;
  }
  /** r186 gives any material without its own envMap scene.environmentIntensity instead of its envMapIntensity, so heroEnv
   *  materials carry the sky explicitly (look b). CPU Lambert metals sample the plain cube instead; no PMREM exists there. */
  private pointReflections(sky: ReturnType<typeof createSky>): void {
    const cpu = this.graphics.tier === 'cpu'; if (!cpu && LOOK === 'a') return;
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (cpu) { if (material instanceof THREE.MeshLambertMaterial && material.envMap) material.envMap = sky.background; }
        else if (material.userData.heroEnv && (material instanceof THREE.MeshStandardMaterial || (material as THREE.MeshStandardNodeMaterial).isMeshStandardNodeMaterial)) (material as THREE.MeshStandardMaterial).envMap = sky.environment;
      }
    });
  }
  private aimSun(): void { this.sunDirection.copy(this.night ? MOON_DIR : SUN_DIR); this.frameShadow(true); }
  /** Fit the sun's shadow box to the view and re-bake only when forced or after the box centre drifts a quarter box, so standing still costs no shadow pass. */
  private frameShadow(force = false): void {
    const camera = this.sun.shadow.camera, size = this.sun.shadow.mapSize.x;
    const walking = !this.mapView && !!this.physics, half = walking ? (size >= 2048 ? SHADOW.walk : SHADOW.walkReduced) : SHADOW.map;
    if (walking) { const p = this.physics!.position(), lead = half * SHADOW.lead; this.shadowAim.set(p.x - Math.sin(this.input.yaw) * lead, p.y, p.z - Math.cos(this.input.yaw) * lead); }
    else this.shadowAim.copy(SHADOW_TARGET);
    if (!force && half === this.shadowHalf && this.shadowAim.distanceTo(this.shadowCenter) < half / 4) return;
    this.shadowCenter.copy(this.shadowAim); this.shadowHalf = half;
    const frame = shadowFrame(this.shadowAim, half, size, this.sunDirection);
    camera.left = frame.left; camera.right = frame.right; camera.top = frame.top; camera.bottom = frame.bottom; camera.updateProjectionMatrix();
    this.sun.target.position.set(frame.target.x, frame.target.y, frame.target.z); this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, SUN_DISTANCE);
    this.sun.shadow.normalBias = frame.texel * SHADOW.normalBias; this.sun.shadow.bias = -SHADOW.bias / (camera.far - camera.near);
    shadowFade.value.set(walking ? half * SHADOW.fade[0] : 0, walking ? half * SHADOW.fade[1] : 0);
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
      for (const material of materials) if (material instanceof ShellMaterial) {
        if (material.userData.mitoringAmber) setMitoringAmberQuality(material, low);
        if (material.userData.cityHallCrystal) setCityHallCrystalQuality(material, low);
      } else if (material instanceof THREE.MeshPhysicalMaterial) {
        if (material.userData.myceliumOpal) { material.iridescence = low ? .35 : 1; material.needsUpdate = true; continue; }
        if (material.userData.gatewayGem) { setGatewayQuality(material, low); continue; }
        if (material.userData.pavilionGem) { material.transmission = low ? 0 : .42; material.opacity = low ? .45 : .7; material.needsUpdate = true; continue; }
        // Only hall glazing and station amber follow the generic switch; the river and Future House glass keep their own optics.
        if (!material.userData.hallGlass && !material.userData.stationAmber) continue;
        material.transmission = low ? 0 : material.userData.stationAmber ? .8 : .45;
        material.opacity = material.userData.stationAmber ? 1 : material.userData.clearGallery ? (low ? .18 : .26) : (low ? .32 : .65); if (material.userData.stationAmber) material.emissiveIntensity = low ? .23 : .2; material.needsUpdate = true;
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
    if (pos.y < -.5 || ((pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ) && !railwayCorridor(pos.x, pos.z))) { this.physics.teleport(SPAWN); this.input.yaw = SPAWN.yaw; this.ui.toast('Back on the station garden path.'); }
    this.ambience.setGarden(pos.z < -60);

    const current = this.physics.position(); this.walkCamera.position.set(current.x, this.eyeHeight(current), current.z); this.walkCamera.rotation.set(this.input.pitch, this.input.yaw, 0, 'YXZ');
    this.updateClock += dt;
    if (this.updateClock > 0.12) { this.updateClock = 0; this.findInteraction(); this.findLocation(); this.cursorDirty = true; }
  }
  private findLocation(): void {
    const p = this.physics!.position();
    const inside = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 7.1);
    if (inside) {
      this.ui.setLocation(inside.name);
      if (!this.progress.visited.includes(inside.id)) { this.progress.visited.push(inside.id); writeProgress(this.progress); this.ui.toast('Welcome to ' + inside.name + '.'); }
    } else if (p.z < -60) this.ui.setLocation('Living Waters · Town Gardens');
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
    // Walking re-bakes when near shrubs or tree detail change, so their shadows appear with them; the map keeps its one bake.
    if (this.town.update(this.elapsed, camera, this.mapView ? MAP_FOG.far : WALK_FOG.far, this.mapView, this.graphics.shadows ? this.sun.shadow : undefined) && !this.mapView && this.graphics.shadows) this.sun.shadow.needsUpdate = true;
    this.updateExhibitionControls();
    this.clockCheck += rawDt; if (this.clockCheck > 30) { this.clockCheck = 0; if (this.timeOfDay === 'auto') this.applyTimeOfDay(); }
    this.nightLighting.update(camera); this.render(camera);
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
