import './style.css';
import * as THREE from 'three';
import { RAILWAY, railwayCorridor } from './world/station-layout';
import { TOWN_BOUNDS } from './world/town-layout';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky } from './world/sky';
import { setGatewayQuality } from './world/gateway-materials';
import { COLLECTION } from './game/exhibits';
import { Town } from './world/world';
import { UI } from './ui/ui';
import type { Mode } from './ui/ui';
import { Input } from './game/input';
import { Ambience } from './game/audio';
import { LANDMARKS, DISCOVERIES, SPAWN, readProgress, writeProgress } from './game/content';
import { probeGraphics } from './game/graphics';
import { parseTimeOfDay, readTimeOfDay, resolveNight, saveTimeOfDay } from './game/daylight';
import type { TimeOfDay } from './game/daylight';
import { NightLighting } from './world/night-lighting';
import type { Physics } from './game/physics';

const WALK_FOG = { near: 42, far: 130 }, MAP_FOG = { near: 240, far: 630 };

class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private skyBackground: THREE.CubeTexture;
  private readonly skies = new Map<boolean, ReturnType<typeof createSky>>();
  private readonly nightLighting: NightLighting;
  private timeOfDay: TimeOfDay = readTimeOfDay();
  private clockCheck = 0;
  private readonly walkCamera = new THREE.PerspectiveCamera(66, 1, 0.08, 150);
  private readonly mapCamera = new THREE.PerspectiveCamera(44, 1, 0.2, 800);
  private readonly orbit: OrbitControls;
  private readonly town: Town;
  private readonly input: Input;
  private readonly ambience = new Ambience();
  private readonly sun: THREE.DirectionalLight;
  private readonly progress = readProgress();
  private readonly raycaster = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly graphics: { reduced: boolean; coarse: boolean; software: boolean };
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
  private updateClock = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;
  private frameId = 0;
  private lowQuality = false;
  private selection: string | null = null;
  private hoverPointer: { x: number; y: number; buttons: number } | null = null;
  private cursorDirty = false;
  constructor(private ui: UI) {
    this.ambience.onStateChange = enabled => this.ui.setSound(enabled);
    this.ui.setSound(this.ambience.enabled);
    this.ambience.start();
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !coarse, powerPreference: 'high-performance' });
    this.graphics = probeGraphics(this.renderer.getContext() as WebGL2RenderingContext);
    this.reduced = this.graphics.reduced; this.lowQuality = this.reduced;
    this.night = resolveNight(this.timeOfDay);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.reduced ? 1 : 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = this.night ? .72 : .96;
    const haze = this.night ? '#1a2433' : '#c3d8df';
    this.scene.fog = new THREE.Fog(haze, MAP_FOG.near, MAP_FOG.far);
    this.hemi = new THREE.HemisphereLight(this.night ? '#8ea4c6' : '#e9f4f0', this.night ? '#121820' : '#73805c', this.night ? .28 : 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(this.night ? '#c9d6ee' : '#fff0ce', this.night ? .32 : 2.4); this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(this.reduced ? 1024 : 2048);
    const shadow = this.reduced ? 90 : 160;
    this.sun.shadow.camera.left = -shadow; this.sun.shadow.camera.right = shadow; this.sun.shadow.camera.top = shadow; this.sun.shadow.camera.bottom = shadow;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 360; this.sun.shadow.normalBias = 0.035; this.sun.shadow.bias = -0.00015;
    this.sun.position.set(this.night ? 40 : -55, this.night ? 90 : 150, this.night ? -50 : 40); this.sun.target.position.set(0, 0, -60); this.scene.add(this.sun, this.sun.target);
    const sky = createSky(this.renderer, this.reduced, this.night); this.skies.set(this.night, sky); this.skyBackground = sky.background; this.scene.background = sky.background; this.scene.environment = sky.environment;
    this.scene.environmentIntensity = this.night ? 0.2 : 0.5;
    this.town = new Town(this.reduced); this.scene.add(this.town.root); this.scene.updateMatrixWorld(true);
    this.nightLighting = new NightLighting(this.town.root, this.scene, this.reduced); this.nightLighting.setNight(this.night);
    // The town and sun are static; refresh shadows only when scene visibility changes.
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
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
    ui.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); this.input.active = false; this.input.clear(); cancelAnimationFrame(this.frameId);
      ui.error('The graphics connection was interrupted. Reload to return to the town. Your discoveries are saved.');
    });
    this.resize(); this.frameId = requestAnimationFrame(this.frame);
    if (import.meta.env.DEV) {
      Object.assign(window, { __livistone: {
        snapshot: () => ({ ready: !!this.physics, night: this.night, timeOfDay: this.timeOfDay, mode: this.mode, position: this.position(), zone: this.zone, journey: null, yaw: this.input.yaw, pitch: this.input.pitch, fps: this.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, interaction: this.interaction, progress: structuredClone(this.progress), selectedLandmark: this.selection, reducedGraphics: this.reduced }),
        teleport: (x: number, z: number, yaw = 0, y = 1.05) => { this.physics?.teleport({ x, y, z }); this.input.yaw = yaw; this.input.pitch = 0; this.accumulator = 0; },
      } });
    }
  }
  async load(): Promise<void> {
    const assets = this.town.loadAssets();
    const { Physics } = await import('./game/physics');
    this.physics = await Physics.create(this.town.colliders);
    await assets;
    this.town.update(this.elapsed, this.mapCamera, MAP_FOG.far, true);
    this.renderer.shadowMap.needsUpdate = true;
    this.ui.ready(); this.returnMode = 'map'; this.resetMap(); this.setMode('map');
  }
  private get mapView(): boolean {
    return this.mode === 'map' || this.mode === 'welcome' || (['lore', 'journal', 'paused', 'gallery'].includes(this.mode) && this.returnMode === 'map');
  }
  private resize(): void {
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
    const haze = this.night ? '#1a2433' : '#c3d8df';
    this.scene.background = this.mapView ? new THREE.Color(haze) : this.skyBackground;
    const fog = this.mapView ? MAP_FOG : WALK_FOG;
    this.scene.fog = new THREE.Fog(haze, fog.near, fog.far);
    this.ui.setMode(mode, this.mapView); this.town.setMapMode(this.mapView); this.renderer.shadowMap.needsUpdate = true; this.resize();
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
    } else if (action === 'interact' && this.mode === 'walking' && this.interaction) {
      this.discover(this.interaction);
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
    let sky = this.skies.get(night); if (!sky) { sky = createSky(this.renderer, this.reduced, night); this.skies.set(night, sky); }
    this.skyBackground = sky.background; this.scene.environment = sky.environment; this.scene.environmentIntensity = night ? .2 : .5;
    this.renderer.toneMappingExposure = night ? .72 : .96;
    this.hemi.color.set(night ? '#8ea4c6' : '#e9f4f0'); this.hemi.groundColor.set(night ? '#121820' : '#73805c'); this.hemi.intensity = night ? .28 : 1.2;
    this.sun.color.set(night ? '#c9d6ee' : '#fff0ce'); this.sun.intensity = night ? .32 : 2.4;
    this.sun.position.set(night ? 40 : -55, night ? 90 : 150, night ? -50 : 40);
    const haze = night ? '#1a2433' : '#c3d8df', fog = this.mapView ? MAP_FOG : WALK_FOG;
    this.scene.background = this.mapView ? new THREE.Color(haze) : this.skyBackground; this.scene.fog = new THREE.Fog(haze, fog.near, fog.far);
    this.nightLighting.setNight(night); this.renderer.shadowMap.needsUpdate = true;
  }
  private quality(low: boolean): void {
    this.lowQuality = low; this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    this.sun.shadow.mapSize.setScalar(low ? 1024 : 2048); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshPhysicalMaterial) {
        if (material.userData.myceliumOpal) { material.iridescence = low ? .35 : 1; material.needsUpdate = true; continue; }
        if (material.userData.gatewayGem) { setGatewayQuality(material, low); continue; }
        if (material.userData.pavilionGem) { material.transmission = low ? 0 : .42; material.opacity = low ? .45 : .7; material.needsUpdate = true; continue; }
        material.transmission = low ? 0 : material.userData.stationAmber ? .8 : .45;
        material.opacity = material.userData.stationAmber ? 1 : material.userData.clearGallery ? (low ? .18 : .26) : (low ? .32 : .65); if (material.userData.stationAmber) material.emissiveIntensity = low ? .23 : .2; material.needsUpdate = true;
      }
    });
    this.nightLighting.setNight(this.night); this.resize(); this.ui.toast(low ? 'Gentle visual detail enabled.' : 'Rich visual detail enabled.');
  }
  private updateWalking(dt: number): void {
    if (!this.physics) return;
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.input.turn(1 / 60); const movement = this.input.direction();
      this.physics.step(movement.x * movement.speed, movement.z * movement.speed); this.accumulator -= 1 / 60;
    }
    const pos = this.physics.position();
    const b = TOWN_BOUNDS;
    if (pos.y < -.5 || ((pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ) && !railwayCorridor(pos.x, pos.z))) { this.physics.teleport(SPAWN); this.input.yaw = SPAWN.yaw; this.ui.toast('Back on the station garden path.'); }
    this.ambience.setGarden(pos.z < -60);

    const current = this.physics.position(); this.walkCamera.position.set(current.x, current.y + 0.78, current.z); this.walkCamera.rotation.set(this.input.pitch, this.input.yaw, 0, 'YXZ');
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
    for (const item of this.town.interactives) {
      const delta = item.position.clone().sub(camera.position); const distance = delta.length();
      if (distance > nearest || delta.normalize().dot(this.direction) < 0.78) continue;
      this.raycaster.set(camera.position, delta); this.raycaster.far = distance - 0.2;
      if (this.raycaster.intersectObjects(this.town.occluders, false).length > 0) continue;
      nearest = distance; candidate = item.id;
    }
    if (candidate !== this.interaction) { this.interaction = candidate; this.ui.setInteraction(candidate); }
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
    const rawDt = (now - this.lastTime) / 1000; const dt = Math.min(rawDt, 0.1); this.lastTime = now; this.elapsed += dt;
    if (this.mode === 'walking') this.updateWalking(dt);
    this.town.gardens.update(this.elapsed, this.mode === 'walking' ? dt : 0, matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.mode === 'map') { this.orbit.update(); this.updateMarkers(); }
    const camera = this.mapView ? this.mapCamera : this.walkCamera;
    this.town.update(this.elapsed, camera, this.mapView ? MAP_FOG.far : WALK_FOG.far, this.mapView);
    this.updateExhibitionControls();
    this.clockCheck += rawDt; if (this.clockCheck > 30) { this.clockCheck = 0; if (this.timeOfDay === 'auto') this.applyTimeOfDay(); }
    this.nightLighting.update(camera); this.renderer.render(this.scene, camera);
    if (this.cursorDirty) { this.cursorDirty = false; this.updateCursor(); }
    this.fpsFrames++; this.fpsTime += rawDt;
    if (this.fpsTime >= 1) { this.fps = Math.round(this.fpsFrames / this.fpsTime); this.fpsFrames = 0; this.fpsTime = 0; }
  };
}
let game: Game | undefined;
const ui = new UI((action) => { if (action === 'reload') location.reload(); else void game?.action(action); });
try {
  game = new Game(ui);
  game.load().catch((error: unknown) => { console.error('Town initialization failed', error); ui.error('The town could not finish loading. Check your connection and try again.'); });
} catch (error) {
  console.error('Graphics initialization failed', error);
  const detail = error instanceof Error && error.message ? ' ' + error.message : '';
  ui.error('Livistone needs a browser with WebGL 2 graphics enabled. Try an updated browser with hardware acceleration, then reload.' + detail);
}
