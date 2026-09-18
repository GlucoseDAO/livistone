import './style.css';
import * as THREE from 'three';
import { Journey } from './game/journey';
import { GARDENS } from './world/living-waters-layout';
import type { LivingWaters } from './world/living-waters';
import { RAILWAY, railwayCorridor } from './world/station-layout';
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
import type { Physics } from './game/physics';

class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly walkCamera = new THREE.PerspectiveCamera(66, 1, 0.08, 700);
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
  private readonly coarse = matchMedia('(pointer: coarse)').matches;
  private physics?: Physics;
  private townPhysics?: Physics;
  private gardenPhysics?: Physics;
  private gardens?: LivingWaters;
  private gardenLoad?: Promise<void>;
  private zone: 'town' | 'gardens' = 'town';
  private trip?: { journey: Journey; passenger: { x: number; y: number; z: number }; ready: boolean };

  private mode: Mode = 'welcome';
  private returnMode: 'walking' | 'map' | 'travel' = 'walking';
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
  private lowQuality = this.coarse;
  private selection: string | null = null;
  private navigationRequest = 0;
  constructor(private ui: UI) {
    this.renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: !this.coarse, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.coarse ? 1 : 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.96;
    this.scene.fog = new THREE.Fog('#c3d8df', 150, 640);
    this.scene.add(new THREE.HemisphereLight('#e9f4f0', '#73805c', 1.2));
    this.sun = new THREE.DirectionalLight('#fff0ce', 2.4); this.sun.position.set(-35, 70, 35); this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(this.coarse ? 1024 : 2048);
    this.sun.shadow.camera.left = -75; this.sun.shadow.camera.right = 75; this.sun.shadow.camera.top = 65; this.sun.shadow.camera.bottom = -65;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 170; this.sun.shadow.normalBias = 0.035; this.sun.shadow.bias = -0.00015;
    this.scene.add(this.sun);
    const sky = createSky(this.renderer, this.coarse); this.scene.background = sky.background; this.scene.environment = sky.environment;
    this.scene.environmentIntensity = 0.5;
    this.town = new Town(this.coarse); this.scene.add(this.town.root); this.scene.updateMatrixWorld(true);
    // The town and sun are static; refresh shadows only when scene visibility changes.
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    this.mapCamera.position.set(62, 44, 69); this.mapCamera.lookAt(0, 2, -13);
    this.orbit = new OrbitControls(this.mapCamera, ui.canvas); this.orbit.target.set(0, 1, -12); this.orbit.enabled = false;
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08; this.orbit.minDistance = 30; this.orbit.maxDistance = 170;
    this.orbit.minPolarAngle = 0.16; this.orbit.maxPolarAngle = Math.PI * 0.44;
    this.input = new Input(ui.canvas, ui.joystick, (action) => void this.action(action));
    ui.setLookHint('Hold left mouse to look');
    ui.progress(this.progress); ui.setMode('welcome');
    document.querySelector<HTMLSelectElement>('#quality')!.value = this.coarse ? 'low' : 'high';
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
        snapshot: () => ({ ready: !!this.physics, mode: this.mode, position: this.position(), zone: this.zone, journey: this.trip?.journey.phase ?? null, yaw: this.input.yaw, pitch: this.input.pitch, fps: this.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, interaction: this.interaction, progress: structuredClone(this.progress), selectedLandmark: this.selection }),
        teleport: (x: number, z: number, yaw = 0) => { this.physics?.teleport({ x, y: 1.05, z }); this.input.yaw = yaw; this.input.pitch = 0; this.accumulator = 0; },
      } });
    }
  }
  async load(): Promise<void> {
    const assets = this.town.loadAssets();
    const { Physics } = await import('./game/physics');
    this.physics = await Physics.create(this.town.colliders); this.townPhysics = this.physics;
    await assets;
    this.renderer.shadowMap.needsUpdate = true;
    this.ui.ready(); this.returnMode = 'map'; this.resetMap(); this.setMode('map');
  }
  private get mapView(): boolean {
    return this.mode === 'map' || this.mode === 'welcome' || (['lore', 'journal', 'paused', 'gallery'].includes(this.mode) && this.returnMode === 'map');
  }
  private resize(): void {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height); this.walkCamera.aspect = width / height; this.walkCamera.updateProjectionMatrix();
    this.mapCamera.aspect = width / height;
    this.mapCamera.clearViewOffset();
    if (this.mode === 'map') {
      if (width < 650) this.mapCamera.setViewOffset(width, height, 0, height * 0.2, width, height);
      else this.mapCamera.setViewOffset(width, height, width * 0.13, 0, width, height);
    }
    this.mapCamera.updateProjectionMatrix();
  }
  private setMode(mode: Mode): void {
    this.navigationRequest++; this.mode = mode; this.interaction = null; this.input.active = mode === 'walking'; this.input.clear(); this.accumulator = 0;
    this.orbit.enabled = mode === 'map';
    this.ui.setMode(mode, this.mapView); this.town.setMapMode(this.mapView); this.renderer.shadowMap.needsUpdate = true; this.resize();
    if (mode === 'walking') this.ui.canvas.focus({ preventScroll: true });
  }
  async action(action: string): Promise<void> {
    if (action === 'reload') { location.reload(); return; }
    if (!this.physics || this.mode === 'welcome') return;
    if (action === 'map' || action === 'open-map' || action === 'walk') {
      const next = action === 'open-map' || (action === 'map' && !this.mapView) ? 'map' : this.trip ? 'travel' : 'walking';
      this.returnMode = next; this.loreFromJournal = false;
      if (next === 'map') this.resetMap();
      this.setMode(next); if (next === 'walking') this.ambience.resume(); return;
    }
    if (action === 'journal' || action === 'pause') {
      const next = action === 'journal' ? 'journal' : 'paused';
      if (this.mode === next) { this.setMode(this.returnMode); return; }
      if (this.mode === 'walking' || this.mode === 'map' || this.mode === 'travel') this.returnMode = this.mode;
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
      this.returnMode = this.mode === 'map' ? 'map' : this.trip ? 'travel' : 'walking'; this.setMode('paused');
    } else if (action === 'close') {
      if (this.mode === 'gallery') { this.setMode(this.galleryReturn); return; }
      if (this.mode === 'lore' && this.loreFromJournal) { this.loreFromJournal = false; this.setMode('journal'); }
      else { this.setMode(this.returnMode);  }
    } else if (action === 'interact' && this.mode === 'walking' && this.interaction) {
      if (this.interaction.startsWith('travel:')) this.beginTrip(); else this.discover(this.interaction);
    } else if (action.startsWith('discovery:')) {
      this.discover(action.split(':')[1], true);

    } else if (action.startsWith('landmark:')) {
      await this.visitLandmark(action.split(':')[1]);
    } else if (action === 'reset-map') this.resetMap();
    else if (action === 'zoom-in' || action === 'zoom-out') {
      const offset = this.mapCamera.position.clone().sub(this.orbit.target); const distance = THREE.MathUtils.clamp(offset.length() * (action === 'zoom-in' ? 0.82 : 1.2), 30, 170);
      this.mapCamera.position.copy(this.orbit.target).add(offset.setLength(distance)); this.orbit.update();
    } else if (action === 'reset-position') {
      this.trip = undefined; this.town.train.position.x = 0; if (this.gardens) this.gardens.train.position.x = 0; this.switchZone('town'); this.physics.teleport(); this.input.yaw = 0; this.input.pitch = 0; this.returnMode = 'walking'; this.setMode('walking');  this.ui.toast('Back at the riverside entrance.');
    } else if (action === 'sound') {
      try { this.ui.setSound(await this.ambience.toggle()); } catch { this.ui.toast('Sound is unavailable in this browser.'); }
    } else if (action.startsWith('quality:')) this.quality(action.split(':')[1] === 'low');
  }
  private async visitLandmark(id: string): Promise<void> {
    const landmark = LANDMARKS.find((place) => place.id === id); if (!landmark || this.mode !== 'map') return;
    const request = ++this.navigationRequest, zone = landmark.zone ?? 'town';
    this.ui.mapStatus('Opening ' + landmark.name + '…');
    try {
      if (zone === 'gardens') await this.loadGardens();
      // A later destination or a mode change cancels an arrival still loading.
      if (request !== this.navigationRequest) return;
      this.trip = undefined; this.town.train.position.x = 0; if (this.gardens) this.gardens.train.position.x = 0;
      this.switchZone(zone); this.physics!.teleport(landmark.entrance);
      this.input.yaw = landmark.entrance.yaw; this.input.pitch = 0; this.selection = landmark.id;
      this.returnMode = 'walking'; this.loreFromJournal = false; this.setMode('walking'); this.updateWalking(0); this.ambience.resume();
      this.ui.toast(landmark.name + ' · walk forward to explore.');
    } catch (error) {
      console.error('Destination loading failed', error);
      if (request === this.navigationRequest) this.ui.mapStatus('Could not open ' + landmark.name + '. Choose its label to try again.');
    }
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
    else if (command === 'lore') { this.discover(hall === 'city-hall' ? 'artifactor' : hall === 'energy' ? 'shelter' : hall === 'station' ? 'embryo-station' : 'connections'); }
    else if (command === 'browse') { this.galleryReturn = 'walking'; this.ui.gallery.showBrowse(hall, exhibition.selected); this.setMode('gallery'); }
    else if (command === 'photo') { this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(exhibition.selected); this.setMode('gallery'); }
    else if (command === 'left' || command === 'right') exhibition.turn(command === 'left' ? -1 : 1);
    else if (command === 'select') {
      const selected = COLLECTION.find((e) => e.discovery === piece); if (!selected || !exhibition.select(selected)) return;
      this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(selected); this.setMode('gallery');
    }
  }

  private clickPhoto(x: number, y: number): void {
    this.raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), this.walkCamera); this.raycaster.far = 9;
    const hit = this.raycaster.intersectObjects(this.zone === 'gardens' ? this.gardens!.panels : [...this.town.researchPanels, ...this.town.exhibitions.flatMap((e) => [...e.photos, ...e.textSurfaces])], false)[0]; if (!hit) return;
    const wall = this.raycaster.intersectObjects(this.zone === 'town' ? this.town.occluders : [], false)[0]; if (wall && wall.distance < hit.distance) return;
    if (hit.object.userData.discovery) { this.discover(hit.object.userData.discovery as string); return; }
    const piece = COLLECTION.find((p) => p.discovery === hit.object.userData.piece); if (!piece) return;
    if (hit.object.userData.posterInfo) { this.discover(piece.discovery); return; }
    this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(piece, hit.object.userData.photoIndex as number); this.setMode('gallery');
  }
  private updateExhibitionControls(): void {
    const p = this.physics?.position(); this.ui.gallery.floating.hidden = true; if (!p || this.mode !== 'walking') return;
    const landmark = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 6.7); if (!landmark) return;
    const exhibition = this.town.exhibitions.find((e) => e.id === landmark.id); if (!exhibition) return;
    this.ui.gallery.accessibleControls(exhibition.id, exhibition.selected);
  }
  private position(): { x: number; y: number; z: number } | undefined {
    if (!this.trip) return this.physics?.position();
    const p = this.trip.passenger; return { x: p.x + (this.zone === 'gardens' ? GARDENS.x : 0) + this.trip.journey.offset, y: p.y, z: p.z };
  }
  private switchZone(zone: 'town' | 'gardens'): void {
    this.zone = zone; this.town.root.visible = zone === 'town'; if (this.gardens) this.gardens.root.visible = zone === 'gardens';
    this.physics = zone === 'town' ? this.townPhysics : this.gardenPhysics;
    this.sun.position.set((zone === 'town' ? 0 : GARDENS.x) - 35, 70, 35); this.sun.target.position.set(zone === 'town' ? 0 : GARDENS.x + 20, 0, 0); this.sun.target.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate = true; this.accumulator = 0;
    this.ambience.setGarden(zone === 'gardens');
  }
  private async loadGardens(): Promise<void> {
    if (this.gardens) return; if (this.gardenLoad) return this.gardenLoad;
    this.gardenLoad = (async () => {
      const [{ LivingWaters }, { Physics }] = await Promise.all([import('./world/living-waters'), import('./game/physics')]);
      const gardens = new LivingWaters(this.coarse); let physics: Physics | undefined;
      try {
        gardens.addInterpretation('living-vittoria', 'Living Waters · Garden Stop', 'Two paths lead from the platform: Vittoria Lake ahead, Mycelium Rain Garden to the east. The return train waits here. Board either open bay, then press E or tap Return.', -19, -68);
        gardens.addInterpretation('living-vittoria', 'Vittoria Lake', 'Silver nerves, shallow water eyes and a blue center. An imagined landscape from Livia’s silver and aquamarine pendant. The return train waits at the garden stop.', -16, -48);
        gardens.addInterpretation('living-dewdrop', 'Two stones, one pavilion', 'Vittoria supplies the aquamarine identity. Dewdrop supplies a faceted droplet and open silver embrace. Dewdrop’s real stone is treated Swiss blue topaz.', -13, -1.5);
        gardens.addInterpretation('living-mycelium', 'The rain garden', 'Mycelium’s folded setting was designed to drain water away from porous opal. Follow the umbrella crowns, silver rills and dry loop back to the platform.', 70, -23);
        physics = await Physics.create(gardens.colliders); await gardens.loadAssets();
        this.gardens = gardens; this.gardenPhysics = physics; gardens.root.visible = false; this.scene.add(gardens.root);
      } catch (error) { physics?.dispose(); gardens.dispose(); throw error; }
    })();
    try { await this.gardenLoad; } finally { this.gardenLoad = undefined; }
  }
  private beginTrip(): void {
    if (this.trip || !this.physics) return;
    const p = this.physics.position(), outbound = this.zone === 'town';
    const trip = { journey: new Journey(outbound), passenger: { x: p.x - (outbound ? 0 : GARDENS.x), y: p.y, z: p.z }, ready: !outbound || !!this.gardens };
    this.trip = trip; this.returnMode = 'travel'; this.setMode('travel');
    if (outbound && !trip.ready) void this.loadGardens().then(() => { trip.ready = true; }).catch((error: unknown) => {
      console.error('Garden loading failed', error); if (this.trip !== trip) return;
      this.trip = undefined; this.town.train.position.x = 0; this.returnMode = 'walking'; this.setMode('walking'); this.ui.toast('The gardens could not load. You are safely aboard at Embryo Station. Press E or tap Travel to retry.');
    });
  }
  private updateTrip(dt: number): void {
    const trip = this.trip; if (!trip) return;
    this.accumulator = Math.min(this.accumulator + dt, .1);
    while (this.accumulator >= 1 / 60) {
      this.accumulator -= 1 / 60; const event = trip.journey.step(1 / 60, trip.ready);
      if (event === 'transfer') { (this.zone === 'town' ? this.town.train : this.gardens!.train).position.x = 0; this.switchZone(trip.journey.outbound ? 'gardens' : 'town'); }
      if (event === 'complete') {
        (this.zone === 'town' ? this.town.train : this.gardens!.train).position.x = 0;
        this.physics!.teleport({ ...trip.passenger, x: trip.passenger.x + (this.zone === 'gardens' ? GARDENS.x : 0) });
        this.trip = undefined; this.returnMode = 'walking'; this.setMode('walking'); this.ui.toast(this.zone === 'gardens' ? 'Living Waters. Step through either open boarding bay; the return train is always here.' : 'Welcome back to Embryo Station.'); return;
      }
    }
    const train = this.zone === 'town' ? this.town.train : this.gardens!.train; train.position.x = trip.journey.offset;
    const p = this.position()!; this.walkCamera.position.set(p.x, p.y + .78, p.z); this.walkCamera.rotation.set(this.input.pitch, this.input.yaw, 0, 'YXZ');
    this.ui.journey(trip.journey.phase === 'waiting' ? 'In the tunnel · preparing the gardens…' : `${trip.journey.phase === 'arriving' ? 'Arriving at' : 'Departing for'} ${trip.journey.outbound ? 'Living Waters' : 'Embryo Station'}`, trip.journey.darkness);
  }
  private resetMap(): void {
    if (this.zone === 'gardens') { this.mapCamera.position.set(GARDENS.x + 90, 115, 98); this.orbit.target.set(GARDENS.x + 25, 1, -5); }
    else { this.mapCamera.position.set(65, 82, 76); this.orbit.target.set(0, 1, -24); } this.orbit.update();
  }
  private quality(low: boolean): void {
    this.lowQuality = low; this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    this.sun.shadow.mapSize.setScalar(low ? 1024 : 2048); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshPhysicalMaterial) {
        if (material.userData.gatewayGem) { setGatewayQuality(material, low); continue; }
        material.transmission = low ? 0 : material.userData.stationAmber ? .8 : .45;
        material.opacity = material.userData.stationAmber ? 1 : material.userData.clearGallery ? (low ? .18 : .26) : (low ? .32 : .65); if (material.userData.stationAmber) material.emissiveIntensity = low ? .23 : .2; material.needsUpdate = true;
      }
    });
    this.resize(); this.ui.toast(low ? 'Gentle visual detail enabled.' : 'Rich visual detail enabled.');
  }
  private updateWalking(dt: number): void {
    if (!this.physics) return;
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.input.turn(1 / 60); const movement = this.input.direction();
      this.physics.step(movement.x * movement.speed, movement.z * movement.speed); this.accumulator -= 1 / 60;
    }
    const pos = this.physics.position();
    if (pos.y < -0.5 || (this.zone === 'town' ? ((Math.abs(pos.x) > 103 || Math.abs(pos.z) > 88) && !railwayCorridor(pos.x, pos.z)) : (pos.x < GARDENS.x - 80 || pos.x > GARDENS.x + 130 || pos.z < -90 || pos.z > 70))) { this.physics.teleport(this.zone === 'town' ? SPAWN : { x: GARDENS.x - 14, y: 1.05, z: -70 }); this.ui.toast('Back on the garden path.'); }
    const current = this.physics.position(); this.walkCamera.position.set(current.x, current.y + 0.78, current.z); this.walkCamera.rotation.set(this.input.pitch, this.input.yaw, 0, 'YXZ');
    this.updateClock += dt;
    if (this.updateClock > 0.12) { this.updateClock = 0; this.findInteraction(); this.findLocation(); }
  }
  private findLocation(): void {
    const p = this.physics!.position();
    const inside = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 7.1);
    if (inside) {
      this.ui.setLocation(inside.name);
      if (!this.progress.visited.includes(inside.id)) { this.progress.visited.push(inside.id); writeProgress(this.progress); this.ui.toast('Welcome to ' + inside.name + '.'); }
    } else if (this.zone === 'gardens') this.ui.setLocation('Living Waters · Garden Stop');
    else this.ui.setLocation(railwayCorridor(p.x, p.z) && Math.abs(p.x) > RAILWAY.portalX ? 'Dark Nut Mountain Passage' : p.z > 33 ? 'Riverside Gardens' : p.z > 16 ? 'The White Bridge' : 'The Civic Gardens');
  }
  private findInteraction(): void {
    const p = this.physics!.position(), cabinX = p.x - (this.zone === 'gardens' ? GARDENS.x : 0);
    if (cabinX > -22 && cabinX < 18 && Math.abs(p.z + 79) < .75 && p.y > 1.35) { this.interaction = this.zone === 'town' ? 'travel:gardens' : 'travel:town'; this.ui.setInteraction(this.interaction); return; }
    const camera = this.walkCamera; camera.getWorldDirection(this.direction); let candidate: string | null = null, nearest = 4.8;
    for (const item of this.zone === 'town' ? this.town.interactives : this.gardens!.interactives) {
      const delta = item.position.clone().sub(camera.position); const distance = delta.length();
      if (distance > nearest || delta.normalize().dot(this.direction) < 0.78) continue;
      this.raycaster.set(camera.position, delta); this.raycaster.far = distance - 0.2;
      if (this.raycaster.intersectObjects(this.zone === 'town' ? this.town.occluders : [], false).length > 0) continue;
      nearest = distance; candidate = item.id;
    }
    if (candidate !== this.interaction) { this.interaction = candidate; this.ui.setInteraction(candidate); }
  }
  private updateMarkers(): void {
    const width = window.innerWidth, height = window.innerHeight;
    for (const landmark of LANDMARKS) {
      this.point.set(landmark.x, 15, landmark.z).project(this.mapCamera);
      const marker = document.querySelector<HTMLElement>('#marker-' + landmark.id)!;
      marker.style.left = (this.point.x * 0.5 + 0.5) * width + 'px'; marker.style.top = (-this.point.y * 0.5 + 0.5) * height + 'px';
      marker.hidden = (landmark.zone ?? 'town') !== this.zone || this.point.z > 1 || this.point.z < -1;
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
    if (this.mode === 'travel') this.updateTrip(dt);
    if (this.zone === 'gardens') this.gardens!.update(this.elapsed, this.mode === 'walking' ? dt : 0, matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.mode === 'map') { this.orbit.update(); this.updateMarkers(); }
    this.town.update(this.elapsed);
    this.updateExhibitionControls();
    const camera = this.mapView ? this.mapCamera : this.walkCamera;
    this.renderer.render(this.scene, camera);
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
  ui.error('Livistone needs a browser with WebGL 2 graphics enabled. Try an updated browser with hardware acceleration, then reload.');
}
