import './style.css';
import * as THREE from 'three';
import { RAILWAY, railwayCorridor } from './world/station-layout';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky } from './world/sky';
import { setGatewayQuality } from './world/gateway-materials';
import { textAction } from './world/exhibition-text';
import { COLLECTION, EXHIBITS } from './game/exhibits';
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
  private mode: Mode = 'welcome';
  private returnMode: 'walking' | 'map' = 'walking';
  private loreFromJournal = false;
  private galleryReturn: 'walking' | 'lore' = 'walking';
  private selectingPiece = false;
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
        snapshot: () => ({ ready: !!this.physics, mode: this.mode, position: this.physics?.position(), yaw: this.input.yaw, pitch: this.input.pitch, fps: this.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, interaction: this.interaction, progress: structuredClone(this.progress), selectedLandmark: this.selection }),
        teleport: (x: number, z: number, yaw = 0) => { this.physics?.teleport({ x, y: 1.05, z }); this.input.yaw = yaw; this.input.pitch = 0; this.accumulator = 0; },
      } });
    }
  }
  async load(): Promise<void> {
    const assets = this.town.loadAssets();
    const { Physics } = await import('./game/physics');
    this.physics = await Physics.create(this.town.colliders);
    await assets;
    this.renderer.shadowMap.needsUpdate = true;
    this.ui.ready();
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
    this.mode = mode; this.interaction = null; this.input.active = mode === 'walking'; this.input.clear(); this.accumulator = 0;
    this.orbit.enabled = mode === 'map';
    this.ui.setMode(mode); this.town.setMapMode(this.mapView); this.renderer.shadowMap.needsUpdate = true; this.resize();
    if (mode === 'walking') this.ui.canvas.focus({ preventScroll: true });
  }
  async action(action: string): Promise<void> {
    if (action === 'reload') { location.reload(); return; }
    if (!this.physics) return;
    if (action.startsWith('exhibit-key:') && this.mode === 'walking') {
      const p = this.physics.position(), landmark = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 6.7);
      if (landmark) await this.exhibitionAction(`exhibit:${action.split(':')[1]}:${landmark.id}`); return;
    }
    if (action.startsWith('exhibit:')) { await this.exhibitionAction(action); return; }
    if (action.startsWith('exhibit-photo:')) {
      const [, id, index] = action.split(':'); const exhibit = COLLECTION.find((e) => e.discovery === id);
      if (exhibit) { this.galleryReturn = this.mode === 'lore' ? 'lore' : 'walking'; this.ui.gallery.showPhoto(exhibit, Number(index)); this.setMode('gallery'); } return;
    }
    if (action.startsWith('tap:') && this.mode === 'walking') { this.clickPhoto(Number(action.split(':')[1]), Number(action.split(':')[2])); return; }
    if (this.mode === 'gallery' && !['escape', 'close'].includes(action)) return;
    if (action === 'enter' || action === 'walk') {
      this.returnMode = 'walking'; this.setMode('walking');  this.ambience.resume();
      if (action === 'enter') this.ui.toast('Follow the white bridge into the civic gardens.');
    } else if (action === 'map' || action === 'preview-map') {
      if (this.mode === 'map') { this.setMode('walking'); this.returnMode = 'walking';  }
      else { this.returnMode = 'map'; this.resetMap(); this.setMode('map'); }
    } else if (action === 'pause' || action === 'escape') {
      if (this.mode === 'welcome') return;
      if (['paused', 'lore', 'journal', 'gallery'].includes(this.mode)) { await this.action('close'); return; }
      this.returnMode = this.mode === 'map' ? 'map' : 'walking'; this.setMode('paused');
    } else if (action === 'close') {
      if (this.mode === 'gallery') { this.setMode(this.galleryReturn); return; }
      if (this.mode === 'lore' && this.loreFromJournal) { this.loreFromJournal = false; this.setMode('journal'); }
      else { this.setMode(this.returnMode);  }
    } else if (action === 'journal') {
      this.returnMode = this.mode === 'map' ? 'map' : 'walking'; this.setMode('journal');
    } else if (action === 'interact' && this.mode === 'walking' && this.interaction) {
      this.discover(this.interaction);
    } else if (action.startsWith('discovery:')) {
      const id = action.split(':')[1]; if (!this.progress.discovered.includes(id)) return;
      this.loreFromJournal = true; this.ui.showLore(DISCOVERIES.find((d) => d.id === id)!); this.setMode('lore');
    } else if (action.startsWith('activate:')) {
      this.town.activate(action.split(':')[1]); this.ui.toast('Photo cylinder rotation changed.');
    } else if (action.startsWith('landmark:')) {
      const landmark = LANDMARKS.find((l) => l.id === action.split(':')[1]); if (!landmark) return;
      this.selection = landmark.id; this.ui.selectLandmark(landmark);
      this.orbit.target.set(landmark.x * 0.55, 2, landmark.z); this.orbit.update();
    } else if (action === 'reset-map') this.resetMap();
    else if (action === 'zoom-in' || action === 'zoom-out') {
      const offset = this.mapCamera.position.clone().sub(this.orbit.target); const distance = THREE.MathUtils.clamp(offset.length() * (action === 'zoom-in' ? 0.82 : 1.2), 30, 170);
      this.mapCamera.position.copy(this.orbit.target).add(offset.setLength(distance)); this.orbit.update();
    } else if (action === 'reset-position') {
      this.physics.teleport(); this.input.yaw = 0; this.input.pitch = 0; this.returnMode = 'walking'; this.setMode('walking');  this.ui.toast('Back at the riverside entrance.');
    } else if (action === 'sound') {
      try { this.ui.setSound(await this.ambience.toggle()); } catch { this.ui.toast('Sound is unavailable in this browser.'); }
    } else if (action.startsWith('quality:')) this.quality(action.split(':')[1] === 'low');
  }
  private discover(id: string): void {
    const discovery = DISCOVERIES.find((d) => d.id === id); if (!discovery) return;
    if (!this.progress.discovered.includes(id)) { this.progress.discovered.push(id); writeProgress(this.progress); this.ui.progress(this.progress); }
    this.returnMode = 'walking'; this.loreFromJournal = false; this.ui.showLore(discovery, this.town.exhibitions.find((e) => EXHIBITS.find((original) => original.landmark === e.id)?.discovery === id)?.selected); this.setMode('lore');
  }
  private async exhibitionAction(action: string): Promise<void> {
    const [, command, hall, piece] = action.split(':'); const exhibition = this.town.exhibitions.find((e) => e.id === hall); if (!exhibition) return;
    if (command === 'info') { this.discover(EXHIBITS.find((e) => e.landmark === hall)!.discovery); }
    else if (command === 'lore') { this.discover(hall === 'city-hall' ? 'artifactor' : hall === 'energy' ? 'shelter' : 'connections'); }
    else if (command === 'browse') { this.galleryReturn = 'walking'; this.ui.gallery.showBrowse(hall, exhibition.selected); this.setMode('gallery'); }
    else if (command === 'photo') { this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(exhibition.selected); this.setMode('gallery'); }
    else if (command === 'pause') exhibition.paused = !exhibition.paused;
    else if (command === 'left' || command === 'right') exhibition.turn(command === 'left' ? -1 : 1);
    else if (command === 'select' && !this.selectingPiece) {
      const selected = COLLECTION.find((e) => e.discovery === piece); if (!selected) return;
      this.selectingPiece = true; this.ui.gallery.dialog.setAttribute('aria-busy', 'true');
      const success = await exhibition.select(selected); this.selectingPiece = false; this.ui.gallery.dialog.removeAttribute('aria-busy');
      if (this.mode === 'gallery') this.setMode('walking');
      this.ui.toast(success ? selected.title + ' is now on this cylinder.' : 'The photographs could not load. The previous piece is still on display.');
    }
  }
  private clickPhoto(x: number, y: number): void {
    this.raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), this.walkCamera); this.raycaster.far = 9;
    const hit = this.raycaster.intersectObjects(this.town.exhibitions.flatMap((e) => [...e.photos, ...e.textSurfaces]), false)[0]; if (!hit) return;
    const wall = this.raycaster.intersectObjects(this.town.occluders, false)[0]; if (wall && wall.distance < hit.distance) return;
    const exhibition = this.town.exhibitions.find((e) => e.id === hit.object.userData.exhibition)!;
    if (hit.object.userData.information && hit.uv) {
      const command = textAction(hit.uv.x, hit.uv.y); if (command) void this.exhibitionAction(`exhibit:${command}:${exhibition.id}`); return;
    }
    this.galleryReturn = 'walking'; this.ui.gallery.showPhoto(exhibition.selected, hit.object.userData.photoIndex as number); this.setMode('gallery');
  }
  private updateExhibitionControls(): void {
    const p = this.physics?.position(); this.ui.gallery.floating.hidden = true; if (!p || this.mode !== 'walking') return;
    const landmark = LANDMARKS.find((l) => Math.hypot((p.x - l.x) / l.stretch.x, (p.z - l.z) / l.stretch.z) < 6.7); if (!landmark) return;
    const exhibition = this.town.exhibitions.find((e) => e.id === landmark.id); if (!exhibition) return;
    this.ui.gallery.accessibleControls(exhibition.id, exhibition.selected, exhibition.paused);
  }
  private resetMap(): void {
    this.mapCamera.position.set(65, 82, 76); this.orbit.target.set(0, 1, -24); this.orbit.update();
  }
  private quality(low: boolean): void {
    this.lowQuality = low; this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    this.sun.shadow.mapSize.setScalar(low ? 1024 : 2048); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.renderer.shadowMap.needsUpdate = true;
    this.town.root.traverse((object) => {
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
    if (pos.y < -0.5 || ((Math.abs(pos.x) > 103 || Math.abs(pos.z) > 88) && !railwayCorridor(pos.x, pos.z))) { this.physics.teleport(); this.ui.toast('Let’s stay on the garden paths.'); }
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
    } else this.ui.setLocation(railwayCorridor(p.x, p.z) && Math.abs(p.x) > RAILWAY.portalX ? 'Dark Nut Mountain Passage' : p.z > 33 ? 'Riverside Gardens' : p.z > 16 ? 'The White Bridge' : 'The Civic Gardens');
  }
  private findInteraction(): void {
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
    for (const landmark of LANDMARKS) {
      this.point.set(landmark.x, 15, landmark.z).project(this.mapCamera);
      const marker = document.querySelector<HTMLElement>('#marker-' + landmark.id)!;
      marker.style.left = (this.point.x * 0.5 + 0.5) * width + 'px'; marker.style.top = (-this.point.y * 0.5 + 0.5) * height + 'px';
      marker.hidden = this.point.z > 1 || this.point.z < -1;
    }
    if (this.physics) {
      const pos = this.physics.position(); this.point.set(pos.x, 1, pos.z).project(this.mapCamera);
      const marker = document.querySelector<HTMLElement>('#player-marker')!; marker.style.left = (this.point.x * 0.5 + 0.5) * width + 'px'; marker.style.top = (-this.point.y * 0.5 + 0.5) * height + 'px'; marker.hidden = Math.abs(this.point.z) > 1;
    }
  }
  private frame = (now: number): void => {
    this.frameId = requestAnimationFrame(this.frame);
    if (document.hidden) { this.lastTime = now; return; }
    if (this.lowQuality && now - this.lastTime < 30) return;
    const rawDt = (now - this.lastTime) / 1000; const dt = Math.min(rawDt, 0.1); this.lastTime = now; this.elapsed += dt;
    if (this.mode === 'walking') this.updateWalking(dt);
    if (this.mode === 'map') { this.orbit.update(); this.updateMarkers(); }
    this.town.update(this.elapsed, this.mode === 'walking' ? dt : 0);
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
