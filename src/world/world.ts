import { createGatePoster } from './gate-posters';
import { createConceptRotunda } from './concept-rotunda';
import { TrailFireflies } from './trail-fireflies';
import { gateFittingsEnabled } from './gate-lamps';
import { EYELENSE_POSTER } from './eyelense-gate-layout';
import { WINTER_POSTER } from './winter-gate-layout';
import { loadEyelenseGate } from './eyelense-gate';
import { TREE_REACH, graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';
import { hazeLook } from '../render/aerial';
import { loadWinterGate } from './winter-gate';
import type { WinterGate } from './winter-gate';
import { createIntroduction } from './introduction';
import { createEnhancementHill, createEnhancementPanel } from './enhancement';
import { createEnhancementGallery } from './enhancement-gallery';
import * as THREE from 'three';
import { addGlow, nightEmission } from './night-lighting';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { mitoringCage, nanotCage, ENERGY_HALL } from './jewelry';
import { FOREST_DETAIL, Forest, forestCells } from './forest';
import { DWARF_PINE, forestSites } from './forest-layout';
import { createContactShadows, objectContactSites, rockContactSites, TOWN_SHADE_FOOTPRINTS, treeContactSites, treeShadeDiscs } from './contact-shadows';
import type { ContactShadows } from './contact-shadows';
import { groundShadeField } from './ground-cover';
import { createBridge, createGardenBridge } from './bridge';
import { createGateway } from './gateway';
import { createGatewayPoster } from './gateway-poster';
import { createPlanting } from './planting';
import { createGrassField } from './grass-field';
import type { GrassShade } from './ground-material';
import { WIND_OFF, updateWind } from './wind';
import type { Planting } from './planting';
import { TOWN_PAVING, walkingSurface } from './walking-surface';
import { Mountains } from './mountains';
import { PlanarExhibition, PosterResidency } from './planar-exhibition';
import { GARDEN_BRIDGES, riverCenter } from './waterways';
import { createTimeTower } from './time-tower';
import { createFutureHouse } from './future-house';
import { cpuWaterColour, waterMaterial } from './water-material';
import { waterSurfaceGeometry } from './water-surface';
import type { RockSite } from './water-surface';
import { pavingMaterial, riverRockSites, rockMaterial } from './stone';
import { createRiverRocks, rockColliders } from './river-rocks';
import { createPebbles } from './pebbles';
import { shoreTime } from './shore-nodes';
import type { ShorePebbles } from './pebbles';
import { createCityHallFacade, loadCityHallTextures } from './city-hall';
import { mitoringAmberMaterial, loadMitoringAmberTextures, loadMitoringSilverTexture } from './mitoring-materials';
import { CIVIC_LANDMARKS, SPAWN } from '../game/content';
import { createStation } from './station';
import { LivingWaters, createGardenPaths } from './living-waters';
import { terrainHeight, terrainVertexHeight, townTerrainGeometry } from './terrain';
import { LAMP_POSTS, transformColliders } from './town-layout';
import { createRailwayStructure, loadRailwayTextures } from './railway';
import { createGlucosePavilion } from './glucose-pavilion';
import { activateSurfaces, bakeMasonry } from './surfaces';
import type { Surfaces } from './surfaces';
import { BUDGET_OFF } from '../game/render-budget';
import { PROBE_SITES } from './probes';
import type { ProbeScope } from './probes';
import { MOUNTAIN, snowCover } from './mountain-layout';
import { createTrailSigns, paintTrailSigns, trailBoulders } from './mountain-trail';
import { createAlpinePlants } from './alpine-plants';
import { CRAGS, CragGround, cragObstacles, cragSites, createCrags, useCragMaps } from './crags';
import type { Crags } from './crags';
import { brookGround, createGorgeWater } from './mountain-water';
import { around, footprintCentre, footprintDistance, footprintOf, neededAtArrival } from './town-parts';
import type { Footprint, TownPart } from './town-parts';
import type { GroundDisc } from './grass-field';
import { GARDENS } from './living-waters-layout';
import { FUTURE_HOUSE } from './elevated-layout';
import { ROTUNDA } from './concept-rotunda-layout';
import { EYELENSE } from './eyelense-gate-layout';
import { ENHANCEMENT } from './enhancement-layout';
import { WINTER } from './winter-gate-layout';
import { GORGE_STREAM, PLATEAU_OUTLINE, PLATEAU_STREAM, TRAIL_SAMPLES, WATERFALL } from './mountain-layout';
import type { ContactSite } from './contact-shadows';

// Sub-plan 27's parts along the Jepii Mici trail, each round what it builds: the crags line the gorge and the ridge's crest band
// well beside the trail; the signs, boulders, fence and lights keep to it; the alpine plants to the plateau; the water to its
// streams, waterfall and cave.
const PLATEAU = PLATEAU_OUTLINE.map(([x, z]) => ({ x, z }));
const TRAIL_FOOTPRINT = footprintOf(TRAIL_SAMPLES, 12), CRAGS_FOOTPRINT = footprintOf(TRAIL_SAMPLES, 60);
const SIGNS_FOOTPRINT = [...TRAIL_FOOTPRINT, ...footprintOf(PLATEAU, 12)], PLATEAU_FOOTPRINT = footprintOf(PLATEAU, 25);
const WATER_FOOTPRINT = footprintOf([...GORGE_STREAM, WATERFALL.foot, WATERFALL.lip, ...PLATEAU_STREAM], 15);
/** Culling flags saved while Town.warmUp() draws everything. */
const warmCulled = new WeakMap<THREE.Object3D, boolean>();
/** Within this many metres of its centre an enclosed collection draws; farther, glazing and haze leave its posters faint specks. */
export const ROOM_RANGE = 50;
import type { Landmark } from '../game/content';

export interface Interactive { id: string; object: THREE.Object3D; position: THREE.Vector3; }
// Dev-only ?contact=off leaves out the contact-shadow decals and the baked ground shade, for sub-plan 16's before/after review.
const CONTACT_OFF = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('contact') === 'off';
const HAZE_CLASSIC = hazeLook() === 'classic';
const TAU = Math.PI * 2;
function seeded(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
export { riverCenter } from './waterways';
export { terrainHeight } from './terrain';
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function lineTube(points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D, smooth = true): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, smooth ? 'centripetal' : 'catmullrom', smooth ? 0.5 : 0.02);
  return mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 5), radius, 6, false), material, parent);
}
/** Footprint scale of a landmark's surroundings; k < 1 stretches gardens less than the shell itself. */
function spread(l: Landmark, k = 1): { x: number; z: number } { return { x: 1 + (l.stretch.x - 1) * k, z: 1 + (l.stretch.z - 1) * k }; }
function texture(kind: 'walnut' | 'stone'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!; const rand = seeded(112);
  ctx.fillStyle = kind === 'walnut' ? '#8c603e' : '#d4cfbb'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const val = rand(); ctx.fillStyle = kind === 'walnut' ? 'rgba(' + (val > 0.5 ? '55,30,15,' : '192,145,90,') + (rand() * 0.22) + ')' : 'rgba(80,78,56,' + rand() * 0.08 + ')';
    ctx.fillRect(rand() * 256, rand() * 256, kind === 'walnut' ? 1 + rand() * 3 : 2, kind === 'walnut' ? 10 + rand() * 40 : 2);
  }
  const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(kind === 'walnut' ? 4 : 6, 2); return tex;
}

export class Town {
  readonly root = new THREE.Group();
  readonly interiors = new THREE.Group();
  readonly details = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly interactives: Interactive[] = [];
  readonly occluders: THREE.Object3D[] = [];
  readonly water: THREE.Material;
  readonly exhibitions: PlanarExhibition[] = [];
  /** Full poster photographs and captions only for the collections most recently approached (sub-plan 12). */
  readonly posters = new PosterResidency(this.exhibitions);
  train!: THREE.Object3D;
  /** Living Waters, once built (a distant part on most tiers: see place()). */
  gardens?: LivingWaters;
  readonly researchPanels: THREE.Mesh[] = [];
  private mountains!: Mountains;
  private railway!: THREE.Group;
  private researchReady!: Promise<void>;
  private readonly jewelryReady: Promise<void>[] = [];
  private fireflies?: TrailFireflies;
  private streaming = false;
  private readonly white = new THREE.MeshStandardMaterial({ color: '#f4f0df', roughness: 0.57, metalness: 0.07 });
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#e2e7dd', roughness: 0.26, metalness: 0.65 });
  private readonly gold = new THREE.MeshStandardMaterial({ color: '#b99a55', roughness: 0.3, metalness: 0.7 });
  private readonly wood = new THREE.MeshStandardMaterial({ color: '#d1a37d', roughness: 0.8, map: texture('walnut') });
  private readonly paving: THREE.MeshStandardMaterial;
  private planting?: Planting;
  private readonly dark = new THREE.MeshStandardMaterial({ color: '#3e5550', roughness: 0.25, metalness: 0.35 });
  private readonly sphere = new THREE.SphereGeometry(1, 16, 12);
  private rocks: RockSite[] = [];
  /** Sub-plan 27: the Jepii Mici trail's boulders (in the river rocks' collider) and its sign posts' contact patches. */
  private boulders: RockSite[] = [];
  /** Contact patches and grass discs that parts give the town's shared batches: the contact shadows and the near grass bake. */
  private readonly contactSites: ContactSite[] = [];
  private readonly groundDiscs: GroundDisc[] = [];
  private grass: ReturnType<typeof createGrassField> = null;
  /** Progressive loading (town-parts.ts): parts beyond the walking view from the arrival point, built after the first view. */
  private readonly waiting: { name: string; footprint: Footprint; build: () => void | Promise<void> }[] = [];
  /** Distant parts built so far, shown or still preparing. */
  readonly parts: TownPart[] = [];
  /** Dev-only: main-thread milliseconds each labelled producer took to build (snapshot().load.parts). */
  readonly buildTimes: Record<string, number> = {};
  private mark = 0;
  private markTime = 0;
  /** Sub-plan 27 round 2: the mountain's limestone crags (one mesh, one collider), shaded once the mountains' rock maps load. */
  private crags: Crags | null = null;
  private cragsReady: Promise<void> = Promise.resolve();
  /** Hall interiors and enclosed collections, whose meshes (never their lights, which WebGPU builds into shaders) hide beyond ROOM_RANGE. */
  private readonly rooms: { center: THREE.Vector3; parts: THREE.Object3D[]; shown: boolean | null; held?: boolean }[] = [];
  private contactShadows!: ContactShadows;
  private pebbles: ShorePebbles | null = null;
  /** Sub-plan 24's mapped ashlar, terrazzo and brass; null with ?surfaces=off, which keeps the flat white and gold below. */
  private readonly surfaces: Surfaces | null;
  private readonly masonry: THREE.Material;
  private readonly brass: THREE.Material;
  /** The walking terrain's vertices (terrain.ts TERRAIN_GRID): the grass field reads its heights instead of recomputing them. */
  private terrainVertices = new Float32Array(0);
  private grassShade?: GrassShade;
  private groundOcclusion?: (x: number, z: number) => number;
  /** Plants sway (wind.ts) on the gpu and mobile tiers; the cpu tier and dev-only ?wind=off keep them still. */
  private get wind(): boolean { return this.tier !== 'cpu' && !WIND_OFF; }
  /** Sub-plan 07: per probe site, the parts that reflect it and the envelope hidden while it bakes. */
  private readonly probeParts = new Map<string, { objects: THREE.Object3D[]; hide: THREE.Object3D[] }>();
  private winter?: WinterGate;
  private constructor(private mobile: boolean, private tier: GraphicsTier, private readonly progressive: boolean) {
    this.water = waterMaterial(tier); this.paving = pavingMaterial(mobile);
    this.surfaces = activateSurfaces(tier); this.masonry = this.surfaces?.masonry ?? this.white; this.brass = this.surfaces?.gold ?? this.gold;
  }
  /** `progressive` builds the distant parts after the first view (buildNext); without it, as for captures and probe bakes, all now. */
  static async create(mobile: boolean, stage: (value: number, label: string) => Promise<void>, tier: GraphicsTier = mobile ? 'mobile' : 'gpu', progressive = false): Promise<Town> {
    const town = new Town(mobile, tier, progressive); await town.build(stage); return town;
  }
  /** Names this producer's unnamed top-level objects for the dev budget breakdown (snapshot().budget) and times it. */
  private label(name: string): void {
    for (const child of this.root.children.slice(this.mark)) if (!child.name) child.name = name;
    this.mark = this.root.children.length;
    if (import.meta.env.DEV) { const now = performance.now(); this.buildTimes[name] = (this.buildTimes[name] ?? 0) + Math.round(now - this.markTime); this.markTime = now; }
  }
  /**
   * A part of the town standing within `footprint` (its own layout's centre and reach). When the town is progressive and the
   * walking view cannot reach the footprint from the arrival point, the part waits for buildNext() after the first view;
   * otherwise it builds now. A part writes into the town as every producer does (root children, colliders, interactives,
   * panels, exhibitions, rooms, probe parts, `jewelryReady`, ground discs and contact sites); buildNext() takes what it added
   * by difference, so a new building needs nothing but its footprint here.
   */
  private async place(name: string, footprint: Footprint, build: () => void | Promise<void>): Promise<void> {
    if (!this.progressive || neededAtArrival(footprint, graphicsProfile(this.tier).fog)) { await build(); this.label(name); return; }
    this.waiting.push({ name, footprint, build });
  }
  /**
   * Whether distant parts are still waiting or preparing within `radius` of a point. A teleport waits for those within half the
   * walking view, so what stands round the arrival is there; farther parts finish in the haze soon after, nearest first.
   */
  pending(x: number, z: number, radius = graphicsProfile(this.tier).fog / 2): boolean {
    return [...this.waiting, ...this.parts.filter(part => !part.shown && !part.failed)].some(part => footprintDistance(part.footprint, { x, z }) <= radius);
  }
  /** Distant parts not yet built. */
  get waitingParts(): number { return this.waiting.length; }
  /**
   * Build the waiting part nearest `position`, hidden: main.ts gives it its colliders, reflections and lights, builds its
   * shaders and then calls show(). Null once every part is built. A part whose build threw comes back with `failed`, hidden.
   */
  async buildNext(position: { x: number; z: number }): Promise<TownPart | null> {
    if (!this.waiting.length) return null;
    this.waiting.sort((a, b) => footprintCentre(a.footprint, position) - footprintCentre(b.footprint, position));
    const next = this.waiting.shift()!, probes = new Set(this.probeParts.keys());
    const before = { root: this.root.children.length, details: this.details.children.length, colliders: this.colliders.length, exhibitions: this.exhibitions.length, ready: this.jewelryReady.length, discs: this.groundDiscs.length, contacts: this.contactSites.length };
    this.markTime = performance.now(); this.mark = before.root;
    let failed: unknown; try { await next.build(); } catch (error) { failed = error ?? new Error(next.name); }
    this.label(next.name);
    const root = new THREE.Group(); root.name = next.name; root.visible = false;
    // A part may add nothing on a tier (the cpu tier has no alpine plants); add() with no argument would complain.
    const added = this.root.children.slice(before.root); if (added.length) root.add(...added); this.root.add(root); this.mark = this.root.children.length;
    // Its near-ground details wait inside the hidden part too, and join the details group (which map mode hides) when shown.
    const details = this.details.children.slice(before.details); if (details.length) root.add(...details);
    const exhibitions = this.exhibitions.slice(before.exhibitions);
    const part: TownPart = {
      name: next.name, footprint: next.footprint, root, details, colliders: this.colliders.slice(before.colliders),
      probeScopes: PROBE_SITES.flatMap(site => { const parts = probes.has(site.id) ? undefined : this.probeParts.get(site.id); return parts ? [{ site, ...parts }] : []; }),
      ready: Promise.all([...this.jewelryReady.slice(before.ready), ...exhibitions.map(exhibition => exhibition.ready)]), shown: false, failed,
      discs: this.groundDiscs.slice(before.discs), contacts: this.contactSites.length - before.contacts,
    };
    if (import.meta.env.DEV && !failed) this.checkFootprint(part);
    this.parts.push(part); return part;
  }
  /** A prepared part joins the town: shown, its ground discs keep the near grass off, its contact patches drawn. */
  show(part: TownPart): void {
    if (part.details.length) this.details.add(...part.details); part.root.visible = true; part.shown = true;
    if (part.discs.length) this.grass?.stamp(part.discs);
    // The batch rebuilds (tens to hundreds of milliseconds) only for a part that brought patches of its own.
    if (part.contacts) this.refreshContacts();
  }
  /** Dev-only: a part drawn nearer the arrival point than its footprint allowed would pop into the first view. */
  private checkFootprint(part: TownPart): void {
    const fog = graphicsProfile(this.tier).fog, sphere = new THREE.Sphere(); let nearest = Infinity, near = '';
    part.root.updateMatrixWorld(true);
    // Visible meshes only: a featured model's placeholder waits hidden at the origin until its collection places it.
    for (const child of part.root.children) child.traverseVisible(object => {
      const geometry = (object as THREE.Mesh).geometry; if (!geometry?.attributes.position || (object as THREE.InstancedMesh).isInstancedMesh) return;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere(); sphere.copy(geometry.boundingSphere!).applyMatrix4(object.matrixWorld);
      let reach = Math.hypot(sphere.center.x - SPAWN.x, sphere.center.z - SPAWN.z) - sphere.radius; if (reach >= nearest || reach > fog) return;
      // A merged mesh's sphere reaches far past its shape: measure its vertices.
      const position = geometry.attributes.position, point = new THREE.Vector3(); reach = Infinity;
      for (let i = 0; i < position.count; i++) { point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld); reach = Math.min(reach, Math.hypot(point.x - SPAWN.x, point.z - SPAWN.z)); }
      if (reach < nearest) { nearest = reach; near = object.name || object.parent?.name || object.type; }
    });
    if (nearest <= fog) console.warn(`Livistone: part "${part.name}" reaches ${Math.round(nearest)} m from the arrival point (${near}), inside the ${fog} m walking view; enlarge its footprint so it builds at loading.`);
  }
  private async build(stage: (value: number, label: string) => Promise<void>): Promise<void> {
    const mobile = this.mobile;
    await stage(20, 'Shaping the river, bridge and town entrance…');
    this.root.name = 'Livistone'; this.interiors.name = 'Hall interiors'; this.details.name = 'Meadow grass details'; this.root.add(this.interiors, this.details);
    // Dev budget breakdown (snapshot().budget): each producer names its unnamed top-level objects.
    this.mark = this.root.children.length; this.markTime = performance.now(); const label = (name: string): void => this.label(name);
    this.createTerrain(); this.createPaths(); label('Paths and civic paving'); createBridge(this.root, this.colliders, this.masonry, this.paving, this.brass); label('Livistone bridge');
    const gateway = createGateway(this.root, this.colliders, mobile, this.paving); label('Gateway'); this.probeParts.set('gateway', { objects: [gateway], hide: [gateway] });
    const gatewayPoster = createGatewayPoster(this.root, this.colliders); this.researchPanels.push(...gatewayPoster.panels); this.interactives.push({ id: 'kings-chapel', object: gatewayPoster.panels[0], position: gatewayPoster.position });
    label('Gateway poster');
    const introduction = createIntroduction(this.root, this.colliders); this.researchPanels.push(...introduction.panels); this.interactives.push({ id: 'about-livistone', object: introduction.panels[0], position: introduction.position });
    label('Introduction sign');
    await stage(28, 'Turning jewellery into civic buildings…');
    for (const landmark of CIVIC_LANDMARKS) landmark.id === 'energy' ? this.createEnergyHall(landmark.x, landmark.z) : this.createLandmark(landmark.id, landmark.x, landmark.z);
    label('Hall paving');
    await stage(38, 'Building Embryo Station and its train…');
    const arrival = new THREE.Group(), stationColliders: ColliderSpec[] = [], stationInteractions: Interactive[] = [];
    const station = createStation(arrival, stationColliders, mobile, this.paving);
    stationInteractions.push({ id: 'embryo-station', object: station.object, position: station.position });
    for (const panel of station.posters) {
      panel.updateWorldMatrix(true, false);
      stationInteractions.push({ id: panel.userData.discovery as string, object: panel, position: panel.getWorldPosition(new THREE.Vector3()) });
    }
    this.researchPanels.push(...station.posters);
    const gallery = new THREE.Group(); arrival.add(gallery);
    this.exhibitions.push(new PlanarExhibition('station', gallery, 0, 0, stationColliders, stationInteractions, this.tier));
    arrival.rotation.y = Math.PI; arrival.position.x = -16; arrival.updateMatrix(); arrival.name = 'Embryo Station and train'; this.root.add(arrival);
    this.addRoom(this.exhibitions[this.exhibitions.length - 1], arrival.matrix);
    this.colliders.push(...transformColliders(stationColliders, arrival.matrix, Math.PI));
    this.interactives.push(...stationInteractions.map(item => ({ ...item, position: item.position.applyMatrix4(arrival.matrix) })));
    this.train = arrival.getObjectByName('Panoramic maglev')!;
    // The ring, its prongs and jambs and the amber are the station's envelope, reflecting the town from the ring entrance;
    // the foyer, platform, train and posters below the amber reflect the concourse.
    const envelope = ['Sculpted amber body', 'Amber resin core', 'Pierced ring and clasping silver prongs', 'Ring foyer vault'].map(name => arrival.getObjectByName(name)).filter((part): part is THREE.Object3D => !!part);
    const structure = arrival.getObjectByName('Embryo Station')!;
    this.probeParts.set('station', { objects: [arrival], hide: envelope });
    this.probeParts.set('station-concourse', { objects: [gallery, ...structure.children.filter(part => !envelope.includes(part))], hide: [] });
    label('Embryo Station and train'); this.railway = createRailwayStructure(this.root, this.colliders, mobile); label('Mountain railway');
    await stage(46, 'Growing the lake gardens and elevated galleries…');
    // The garden's paths reach toward the civic gardens, into the first view; the garden itself may come after it.
    createGardenPaths(this.root, this.colliders, this.paving, mobile); label('Lake walking network');
    await this.place('Living Waters · town gardens', around(GARDENS.x, GARDENS.z, GARDENS.radius), async () => {
      const gardens = this.gardens = new LivingWaters(mobile, this.paving, this.wind, false); this.root.add(gardens.root);
      gardens.presentLakeJewelry(); this.jewelryReady.push(gardens.presentMyceliumRing());
      await gardens.presentDewdropSilver();
      gardens.addInterpretation('living-mycelium', 'Mycelium Rain Garden', 'The Mycelium grove', 'Curled, open silver gills surround opal hearts, following the Mycelium ring. Tall crowns and lower ring-scale shrubs share the same folds. Its setting was designed to drain water away from porous opal. Follow the dry loop and silver rill to the lake.');
      this.colliders.push(...gardens.colliders); this.interactives.push(...gardens.interactives); this.researchPanels.push(...gardens.panels); this.groundDiscs.push(...gardens.stems);
    });
    await stage(50, 'Building the two-stone Eye of Winter…');
    await this.place('Eye of Winter', around(WINTER.x, WINTER.z, 40), async () => {
      const winter = this.winter = await loadWinterGate(mobile, this.paving);
      this.root.add(winter.root); this.colliders.push(...winter.colliders);
      this.probeParts.set('winter-gate', { objects: [winter.root], hide: [winter.root] });
      const poster = gateFittingsEnabled() ? createGatePoster(this.root, this.colliders, WINTER_POSTER, 'eye-of-winter', 'winter-gate-story', 'Eye of Winter') : null;
      if (poster) { this.researchPanels.push(...poster.panels); this.interactives.push({ id: 'winter-gate-story', object: poster.panels[0], position: poster.position }); this.jewelryReady.push(poster.ready); }
    });
    await stage(52, 'Opening the Eyelense red bead passage…');
    await this.place('Eyelense Gate', around(EYELENSE.x, EYELENSE.z, 20), async () => {
      const eyelense = await loadEyelenseGate(mobile, this.paving);
      this.root.add(eyelense.root); this.colliders.push(...eyelense.colliders);
      this.probeParts.set('eyelense-gate', { objects: [eyelense.root], hide: eyelense.root.children.filter(part => part instanceof THREE.Mesh && !Array.isArray(part.material) && part.material.userData.heroEnv) });
      const poster = gateFittingsEnabled() ? createGatePoster(this.root, this.colliders, EYELENSE_POSTER, 'eyelense', 'eyelense-gate-story', 'Eyelense') : null;
      if (poster) { this.researchPanels.push(...poster.panels); this.interactives.push({ id: 'eyelense-gate-story', object: poster.panels[0], position: poster.position }); this.jewelryReady.push(poster.ready); }
    });
    await this.place('Concept rotunda', around(ROTUNDA.x, ROTUNDA.z, ROTUNDA.radius + 6), () => {
      const concepts = createConceptRotunda(this.root, this.colliders, mobile); this.researchPanels.push(...concepts.panels); this.jewelryReady.push(concepts.ready);
    });
    await this.place('Jepii Mici · drifting lights', TRAIL_FOOTPRINT, () => { this.fireflies = new TrailFireflies(this.root, mobile); });
    for (const bridge of GARDEN_BRIDGES) createGardenBridge(this.root, this.colliders, this.masonry, this.paving, this.brass, bridge);
    label('Garden bridges'); const first = this.root.children.length; createTimeTower(this.root, this.colliders, this.mobile); label('Time tower');
    const tower = this.root.children.slice(first);
    // Timeface hangs its posters on the open gallery, seen across town; the tower's posters vanish with its envelope.
    this.exhibitions.push(new PlanarExhibition('timeface', this.root, 0, 0, this.colliders, this.interactives, this.tier)); label('Posters · timeface');
    const timeface = this.exhibitions[this.exhibitions.length - 1].objects; this.probeParts.set('timeface', { objects: [...tower, ...timeface], hide: [...tower, ...timeface] });
    await this.place('Future House', around(FUTURE_HOUSE.x, FUTURE_HOUSE.z, 32), () => {
      const first = this.root.children.length; createFutureHouse(this.root, this.colliders, this.mobile); const house = this.root.children.slice(first);
      // The house keeps its three posters inside the cabin, an enclosed room that hides with distance and with the envelope.
      const exhibition = new PlanarExhibition('future-house', this.root, 0, 0, this.colliders, this.interactives, this.tier); this.exhibitions.push(exhibition);
      this.probeParts.set('future-house', { objects: [...house, ...exhibition.objects], hide: [...house, ...exhibition.objects] }); this.addRoom(exhibition);
    });
    await stage(54, 'Making room for science and bioart…');
    await this.place('Enhancement hill', around(ENHANCEMENT.x, ENHANCEMENT.z, 45), () => {
      createEnhancementHill(this.root, this.colliders);
      const sign = createEnhancementPanel(this.root, this.colliders); this.researchPanels.push(...sign.panels); this.interactives.push({ id: 'materialized-enhancements', object: sign.panels[0], position: sign.position });
      const gallery = createEnhancementGallery(this.root, this.colliders); this.researchPanels.push(...gallery.panels); this.interactives.push(...gallery.interactives); this.jewelryReady.push(gallery.ready);
    });
    label('Glucose Commons');
    const research = createGlucosePavilion(this.root, this.colliders, mobile, this.paving); this.researchPanels.push(...research.panels); this.interactives.push(...research.interactives);
    this.researchReady = Promise.all([research.ready, gatewayPoster.ready]).then(() => undefined);
    await stage(62, 'Planting the woodland and mountain slopes…');
    label('Glucose Commons'); this.createTrees(); await this.createGardens(); this.createContactShadows(); label('River rocks and lamps');
    for (const landmark of CIVIC_LANDMARKS) {
      const color = landmark.id === 'energy' ? '#ffbf66' : landmark.id === 'science' ? '#99ded7' : '#ffe0a3';
      addGlow(this.root, new THREE.Vector3(landmark.x, 6, landmark.z), color, 25, 90, 24, .3);
      for (const side of [-1, 1]) addGlow(this.root, new THREE.Vector3(landmark.x + side * 5, 2.5, landmark.z + 7), color, 8, 65, 15, .24);
    }
    // The concourse glows stay a quarter below their first strength, so the platform lamps' own pools read at night (sub-plan 28).
    for (const x of [-20, 0, 20]) addGlow(arrival, new THREE.Vector3(x, 4.3, -68), '#ffd28a', 12, 50, 17, .22);
    this.mountains = new Mountains(mobile, this.tier, this.groundOcclusion, this.grassShade); this.root.add(this.mountains);
    if (this.crags) this.cragsReady = this.cragMaps(this.crags);
  }
  private createTerrain(): void {
    const geo = townTerrainGeometry(); this.terrainVertices = new Float32Array(geo.getAttribute('position').array);
    this.colliders.push({ type: 'mesh', vertices: this.terrainVertices, indices: new Uint32Array(geo.index!.array) }); geo.dispose();
    // One clipped sheet carries flow, depth and rock proximity; CPU bakes its absorption colour instead of blending.
    this.rocks = riverRockSites(this.mobile);
    const cpu = this.tier === 'cpu', water = mesh(waterSurfaceGeometry(this.rocks, cpu ? cpuWaterColour() : undefined, cpu ? 2 : 1), this.water, this.root);
    // Nothing transparent sits under the surface, so the river blends first and later glass or glows stay on top.
    water.name = 'River water'; water.castShadow = false; water.renderOrder = -1;
  }

  private createPaths(): void {
    // The town's share of the merged walking network (walking-surface.ts): one paving mesh with world UVs whose junctions are
    // filleted unions, and kerbs that follow its outline. The lake garden builds the other share from the same surface.
    const { paving, kerbs } = walkingSurface(this.mobile);
    const surface = mesh(paving[TOWN_PAVING], this.paving, this.root); surface.name = 'Limestone walking network'; surface.castShadow = false;
    const kerbMaterial = new THREE.MeshStandardMaterial({ color: '#e4decf', map: this.paving.map, vertexColors: true, roughness: .97 });
    this.paving.userData.ready.then(() => { kerbMaterial.map = this.paving.map; kerbMaterial.needsUpdate = true; });
    const stones = kerbs[TOWN_PAVING], border = mesh(stones, kerbMaterial, this.root); border.name = 'Bevelled limestone kerbs'; border.castShadow = false;
    this.colliders.push({ type: 'mesh', vertices: new Float32Array(stones.getAttribute('position').array), indices: Uint32Array.from({ length: stones.getAttribute('position').count }, (_, i) => i) });
    paving.slice(1).concat(kerbs.slice(1)).forEach(g => g.dispose());
    for (const l of CIVIC_LANDMARKS) {
      const ring = mesh(new THREE.RingGeometry(8.4, 10.6, 64), this.paving, this.root, l.x, 0.06, l.z); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; const sp = spread(l, .85); ring.scale.set(sp.x, sp.z, 1);
      const p = ring.geometry.getAttribute('position'), uv = ring.geometry.getAttribute('uv');
      for (let i = 0; i < p.count; i++) uv.setXY(i, (l.x + p.getX(i) * sp.x) / 4, (l.z - p.getY(i) * sp.z) / 4);
    }
  }
  private shellPoint(phi: number, theta: number, radius: number, height: number, sx = 1, sz = 1): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(phi) * Math.sin(theta) * radius * sx, Math.cos(theta) * radius + height, Math.cos(phi) * Math.sin(theta) * radius * sz);
  }
  private surface(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number, radius: number, height: number, material: THREE.Material, parent: THREE.Group, sx = 1, sz = 1): THREE.Mesh {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = []; const nx = 28, ny = 20;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const phi = phiStart + i / nx * phiLength, theta = thetaStart + j / ny * thetaLength;
      const p = this.shellPoint(phi, theta, radius, height, sx, sz);
      vertices.push(p.x, p.y, p.z); uv.push(phi / Math.PI, theta / Math.PI);
      if (i < nx && j < ny) { const n = j * (nx + 1) + i; indices.push(n, n + nx + 1, n + 1, n + 1, n + nx + 1, n + nx + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    return mesh(geo, material, parent);
  }
  private createLandmark(id: string, x: number, z: number): void {
    const exterior = new THREE.Group(); exterior.position.set(x, 0.16, z); exterior.name = 'Hall · ' + id; this.root.add(exterior);
    const inside = new THREE.Group(); inside.position.copy(exterior.position); this.interiors.add(inside);
    this.probeParts.set(id, { objects: [exterior], hide: [exterior, inside] }); this.probeParts.set(id + '-inside', { objects: [inside], hide: [] });
    const radius = id === 'science' ? 8.5 : 10; const centerY = id === 'science' ? 6 : 5.7;
    const sx = 1, sz = 1;
    const floorR = Math.sqrt(radius * radius - centerY * centerY);
    const maxTheta = Math.acos(-centerY / radius); const doorwayTheta = Math.acos((3.1 - centerY) / radius);
    if (id === 'city-hall') {
      const facade = createCityHallFacade(exterior, this.mobile); this.jewelryReady.push(loadCityHallTextures(facade.walnut, facade.crystal, this.mobile));
      this.colliders.push(...transformColliders(facade.colliders, new THREE.Matrix4().makeTranslation(x, .16, z)));
    } else {
      const glass = this.glass('#b4bdb8'); glass.opacity = this.mobile ? .18 : .26; glass.userData.clearGallery = true;
      this.surface(0, TAU, .01, doorwayTheta - .01, radius, centerY, glass, exterior, sx, sz);
      this.surface(.29, TAU - .58, doorwayTheta, maxTheta - doorwayTheta, radius, centerY, glass, exterior, sx, sz);
    }
    const floor = mesh(new THREE.CylinderGeometry(floorR, floorR + 0.3, 0.3, 64), this.paving, exterior, 0, -0.03); floor.scale.set(sx, 1, sz);
    // World UVs tile the paving at its 4 m scale; the default cap UVs stretched one tile over the whole floor.
    const floorPosition = floor.geometry.getAttribute('position'), floorUV = floor.geometry.getAttribute('uv');
    for (let i = 0; i < floorPosition.count; i++) floorUV.setXY(i, (x + floorPosition.getX(i) * sx) / 4, (z + floorPosition.getZ(i) * sz) / 4);
    const rim = mesh(new THREE.TorusGeometry(floorR + 0.15, 0.2, 8, 72), this.masonry, exterior, 0, 0.08); rim.rotation.x = Math.PI / 2; rim.scale.set(sx, sz, 1);
    if (this.surfaces) bakeMasonry(rim.geometry, undefined, true); // indoors: no weathering
    this.colliders.push({ type: 'box', position: [x, 0.08, z], size: [floorR * sx * 0.75, 0.08, floorR * sz * 0.75] });
    this.wallRing(exterior, x, z, floorR * sx, floorR * sz, 0.32);
    // City Hall's arch is brass like its clasps, the Nanot's silver like its lattice; the town ashlar is no longer on either.
    if (id === 'city-hall') this.entranceArch(exterior, floorR * sz, this.brass);
    if (id === 'science') {
      const nanot = nanotCage(exterior, radius, centerY, this.mobile), frame = nanot.frame.clone().translate(x, .16, z);
      this.entranceArch(exterior, floorR * sz, nanot.silver);
      this.colliders.push({ type: 'mesh', vertices: new Float32Array(frame.getAttribute('position').array), indices: new Uint32Array(frame.index!.array) }); frame.dispose();
      const base = new THREE.RingGeometry(floorR - .1, 7.7, 80); base.rotateX(-Math.PI / 2); base.translate(x, .25, z);
      mesh(base, this.paving, this.root);
      this.colliders.push({ type: 'mesh', vertices: new Float32Array(base.getAttribute('position').array), indices: new Uint32Array(base.index!.array) });
    }
    this.createInterior(id, inside, x, z, floorR);
  }
  private glass(color: string, emissive = '#000000'): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({ color, emissive, emissiveIntensity: 0.35, metalness: 0.05, roughness: 0.16, transmission: this.mobile ? 0 : 0.45, thickness: 0.25, transparent: true, opacity: this.mobile ? 0.32 : 0.65, side: THREE.DoubleSide, depthWrite: false });
    // hallGlass: the quality switch retunes this glazing (main.ts) and leaves other physical materials alone.
    material.userData.hallGlass = true; nightEmission(material, color, .5); return material;
  }
  /** Invisible wall segments (colliders + occluders) around an elliptical floor, leaving a gap of ±gap radians at the south door. */
  private wallRing(exterior: THREE.Group, x: number, z: number, a: number, b: number, gap: number): void {
    const segments = Math.ceil(Math.PI * (a + b) / 1.15);
    for (let i = 1; i < segments; i++) {
      const phi = i / segments * TAU;
      if (phi < gap || phi > TAU - gap) continue;
      const cx = Math.sin(phi) * a, cz = Math.cos(phi) * b, yaw = Math.atan2(b * Math.sin(phi), a * Math.cos(phi));
      const width = Math.hypot(a * Math.cos(phi), b * Math.sin(phi)) * TAU / segments * 1.1;
      this.colliders.push({ type: 'box', position: [x + cx, 3.8, z + cz], size: [width / 2, 3.8, 0.2], yaw });
      const wall = mesh(new THREE.BoxGeometry(width, 7.6, 0.4), new THREE.MeshBasicMaterial({ visible: false }), exterior, cx, 3.64, cz); wall.rotation.y = yaw; this.occluders.push(wall);
    }
  }
  private entranceArch(exterior: THREE.Group, depth: number, material: THREE.Material): void {
    const entrance = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.35, 0, depth + 0.05), new THREE.Vector3(-2.3, 2.4, depth + 0.25), new THREE.Vector3(0, 4.1, depth + 0.3), new THREE.Vector3(2.3, 2.4, depth + 0.25), new THREE.Vector3(2.35, 0, depth + 0.05)]);
    mesh(new THREE.TubeGeometry(entrance, 40, 0.22, 8, false), material, exterior);
  }
  /** The Mitoring: an amber cup with a domed lid seated inside the bezel's silver basket, entered through the ring. */
  private createEnergyHall(x: number, z: number): void {
    const { a, b, wall, dome, doorPhi } = ENERGY_HALL;
    const exterior = new THREE.Group(); exterior.position.set(x, 0.16, z); exterior.name = 'Hall · energy'; this.root.add(exterior);
    const inside = new THREE.Group(); inside.position.copy(exterior.position); this.interiors.add(inside);
    this.probeParts.set('energy', { objects: [exterior], hide: [exterior, inside] }); this.probeParts.set('energy-inside', { objects: [inside], hide: [] });
    // A cabochon: the wall flares slightly up to the rim, then the dome closes over the hall.
    const profile: [number, number][] = [[0, 0.98], [3.7, 1], [wall, 1]];
    for (let k = 1; k <= 8; k++) profile.push([wall + dome * Math.sin(k / 8 * Math.PI / 2), Math.cos(k / 8 * Math.PI / 2)]);
    const nx = 72, vertices: number[] = [], indices: number[] = [], uv: number[] = [];
    for (const [j, [y, f]] of profile.entries()) for (let i = 0; i <= nx; i++) {
      const phi = i / nx * TAU; vertices.push(Math.sin(phi) * a * f, y, Math.cos(phi) * b * f); uv.push(i / nx, y / (wall + dome));
      if (i === nx || j === profile.length - 1) continue;
      // The doorway is the only cut in the amber; the arch and wall gap below match it.
      const angle = Math.atan2(Math.sin((i + 0.5) / nx * TAU), Math.cos((i + 0.5) / nx * TAU));
      if (Math.abs(angle) < doorPhi && y < 3.7) continue;
      const n = j * (nx + 1) + i; indices.push(n, n + 1, n + nx + 1, n + 1, n + nx + 2, n + nx + 1);
    }
    const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); shell.setIndex(indices); shell.computeVertexNormals();
    const amberShell = mitoringAmberMaterial(this.mobile); this.jewelryReady.push(loadMitoringAmberTextures(amberShell, this.mobile));
    mesh(shell, amberShell, exterior).name = 'Mitoring amber cup';
    const silver = mitoringCage(exterior, this.mobile); this.jewelryReady.push(loadMitoringSilverTexture(silver, this.mobile));
    const floor = mesh(new THREE.CylinderGeometry(a, a + 0.3, 0.3, 72), this.paving, exterior, 0, -0.03); floor.scale.z = b / a;
    const floorPosition = floor.geometry.getAttribute('position'), floorUV = floor.geometry.getAttribute('uv');
    for (let i = 0; i < floorPosition.count; i++) floorUV.setXY(i, (x + floorPosition.getX(i)) / 4, (z + floorPosition.getZ(i) * b / a) / 4);
    const rim = mesh(new THREE.TorusGeometry(a + 0.15, 0.2, 8, 96), silver, exterior, 0, 0.08); rim.rotation.x = Math.PI / 2; rim.scale.y = b / a;
    this.colliders.push({ type: 'box', position: [x, 0.08, z], size: [a * 0.75, 0.08, b * 0.75] });
    this.wallRing(exterior, x, z, a, b, doorPhi + 0.06);
    this.entranceArch(exterior, b, silver);
    // The ring's shank becomes the gateway: visitors walk through the Mitoring to reach the amber.
    const gateZ = b + 3.2;
    mesh(new THREE.TorusGeometry(3.15, 0.3, 12, 72), silver, exterior, 0, 2.1, gateZ);
    for (const side of [-1, 1]) this.colliders.push({ type: 'box', position: [x + side * 2.85, 1.4, z + gateZ], size: [0.4, 1.4, 0.4] });
    const ceiling = (px: number, pz: number): number => { const rho = Math.min(1, Math.hypot(px / a, pz / b)); return wall + dome * Math.sqrt(1 - rho * rho); };
    this.createInterior('energy', inside, x, z, b - 0.3, { a, b, ceiling, structure: exterior });
  }
  private createInterior(id: string, group: THREE.Group, x: number, z: number, floorR: number, hall?: { a: number; b: number; ceiling: (px: number, pz: number) => number; structure: THREE.Group }): void {
    const floorInset = mesh(new THREE.CircleGeometry(floorR * 0.87, 56), this.surfaces?.floor ?? new THREE.MeshStandardMaterial({ color: '#ddd7c4', roughness: 0.95 }), group, 0, 0.14); floorInset.rotation.x = -Math.PI / 2;
    if (this.surfaces) {
      // Terrazzo UVs: world metres over 4 from the hall centre, so a brass strip runs through it (local -y is world +z here).
      const inset = floorInset.geometry.getAttribute('position'), insetUV = floorInset.geometry.getAttribute('uv');
      for (let i = 0; i < inset.count; i++) insetUV.setXY(i, inset.getX(i) / 4, -inset.getY(i) / 4);
    }
    if (id === 'energy') {
      // Folded membranes descend from alternating sides, leaving a clear public hall below.
      const { a, b, ceiling, structure } = hall!;
      const fins: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 7; i++) {
        const px = (i - 3) * a / 4, side = i % 2 ? 1 : -1;
        const zWall = b * Math.sqrt(Math.max(0, 1 - (px / a) ** 2)) - 0.4;
        const vertices: number[] = [], indices: number[] = [];
        const edge: THREE.Vector3[] = [];
        for (let k = 0; k <= 32; k++) {
          const t = k / 32, reach = Math.sin(t * Math.PI), pz = side * zWall * (1 - reach * 1.18);
          const wx = px + (t - .5) * 1.9 + Math.sin(t * Math.PI * 2) * .24;
          const bottom = Math.max(3.7, Math.min(ceiling(wx, pz) - .4, 3.8 + 1.1 * reach));
          vertices.push(wx, ceiling(wx, pz) - .12, pz, wx, bottom, pz); edge.push(new THREE.Vector3(wx, bottom, pz));
          if (k < 32) { const n = k * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
        }
        this.probeParts.get('energy-inside')!.objects.push(lineTube(edge, .09, this.silver, structure));
        const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); fin.setIndex(indices); fin.computeVertexNormals(); fins.push(fin);
      }
      const amber = new THREE.MeshStandardMaterial({ color: '#dc9140', emissive: '#a94908', emissiveIntensity: 0.18, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4 });
      const shelves = new THREE.Mesh(mergeGeometries(fins, false)!, amber); shelves.position.y = -0.16; structure.add(shelves); this.probeParts.get('energy-inside')!.objects.push(shelves);
      for (const fin of fins) fin.dispose();
    }
    this.exhibitions.push(new PlanarExhibition(id, group, x, z, this.colliders, this.interactives, this.tier));
    const light = new THREE.PointLight(id === 'energy' ? '#ffc56d' : '#fff2d5', this.mobile ? 7 : 12, 18, 1.8); light.position.set(0, 5.5, 0); group.add(light);
    const lantern = mesh(new THREE.TorusGeometry(2.7, 0.025, 6, 50), new THREE.MeshBasicMaterial({ color: '#f4dfad' }), group, 0, 6, 0); lantern.rotation.x = Math.PI / 2;
    this.rooms.push({ center: new THREE.Vector3(x, 0, z), parts: group.children.filter((child) => !(child as THREE.Light).isLight), shown: null });
  }
  /** Trees as a probe at `position` sees them, in every direction (the bake's per-site hook). */
  surround(position: THREE.Vector3): void { const profile = graphicsProfile(this.tier); this.forest.surround(position, HAZE_CLASSIC && this.tier !== 'cpu' ? profile.fog : profile.forest); }
  /** Probe sites with the parts each serves (probes.ts); the cpu tier bakes none. */
  probeScopes(): ProbeScope[] {
    return PROBE_SITES.flatMap(site => { const parts = this.probeParts.get(site.id); return parts ? [{ site, ...parts }] : []; });
  }
  readonly forest = new Forest();
  async loadAssets(): Promise<void> { await Promise.all([this.paving.userData.ready, this.surfaces?.ready, this.forest.load(this.mobile, graphicsProfile(this.tier).shadows, this.wind, this.tier === 'gpu' && MOUNTAIN), this.mountains.ready, this.cragsReady, this.researchReady, ...this.jewelryReady, loadRailwayTextures(this.railway, this.mobile), ...this.exhibitions.map((exhibition) => exhibition.ready)]); }
  private createTrees(): void {
    const sites = forestSites(this.mobile);
    // A dwarf pine is a cushion of stems, not a trunk: its collider keeps walkers out of the bush.
    for (const { x, y, z, species } of sites) this.colliders.push(species === DWARF_PINE ? { type: 'box', position: [x, y + .6, z], size: [.9, .6, .9] } : { type: 'box', position: [x, y + 2, z], size: [0.3, 2, 0.3] });
    this.forest.sites = sites; this.forest.name = 'Forest'; this.root.add(this.forest);
  }
  private async createGardens(): Promise<void> {
    // The near grass field (gpu and mobile) replaces the meadow tufts close to the camera; map mode hides it with the details.
    // The ground's baked crown and wall occlusion (sub-plan 16), shared by the terrain and the grass standing on it.
    this.groundOcclusion = CONTACT_OFF ? undefined : groundShadeField(treeShadeDiscs(this.forest.sites), TOWN_SHADE_FOOTPRINTS);
    const trail = MOUNTAIN ? trailBoulders(this.mobile) : [];
    this.boulders = trail.map(boulder => boulder.site); const rocks = [...this.rocks, ...this.boulders];
    // Sub-plan 27: the Jepii Mici trail's crags, signs and boulders, alpine plants and water. Four parts, so each one built after
    // the first view holds the main thread only briefly.
    if (MOUNTAIN) {
      if (CRAGS) await this.place('Limestone crags', CRAGS_FOOTPRINT, () => this.buildCrags());
      await this.place('Jepii Mici trail signs', SIGNS_FOOTPRINT, () => this.buildTrailSigns(trail));
      await this.place('Alpine plants', PLATEAU_FOOTPRINT, () => {
        // The plateau's rhododendron mats, their cards with the turf's flowers and moss campion: three draws, none on cpu.
        const plants = createAlpinePlants(this.tier, rocks, FOREST_DETAIL.coverage); if (plants.meshes.length) this.root.add(...plants.meshes); this.contactSites.push(...plants.contacts);
      });
      await this.place('Gorge water and snow cave', WATER_FOOTPRINT, () => {
        // Round 2's water: the gorge's stream out of its snow cave, the plateau's brook and its waterfall; the mist joins the details.
        const water = createGorgeWater(this.tier); this.root.add(water.group); if (water.spray) this.details.add(water.spray);
      });
    }
    // The plateau's brook (sub-plan 27, round 2) keeps the blades off its water; the gorge's floor grows none. Parts built after
    // the first view stamp their own discs into the bake (show()).
    const grass = this.grass = createGrassField(this.tier, { rocks, stems: [...this.groundDiscs, ...MOUNTAIN ? brookGround() : []], height: (x, z) => terrainVertexHeight(this.terrainVertices, x, z), shade: this.groundOcclusion });
    if (grass) { this.details.add(grass.mesh); this.grassShade = grass.ground; }
    this.planting = createPlanting(this.root, this.details, this.mobile, terrainHeight, riverCenter, this.tier, grass?.ground.radius ?? 0, this.wind);
    // One instanced draw of blended boulder variants; one collider mesh sampled from the same shapes and transforms.
    // The trail's boulders keep their own draw, so the river rocks' bounds stay on the river; both share one collider.
    const stone = rockMaterial(this.mobile); this.root.add(createRiverRocks(this.rocks, stone, this.tier)); this.colliders.push(rockColliders(rocks));
    // Shore pebbles live with the other near-ground details, so map mode hides them; cpu has none. Only nearby cells draw.
    this.pebbles = createPebbles(this.tier, this.rocks); if (this.pebbles) this.details.add(this.pebbles.mesh);
    for (const [x, z] of LAMP_POSTS) {
      const pole = mesh(new THREE.CylinderGeometry(0.045, 0.065, 2.8, 8), this.brass, this.root, x, 1.4, z);
      const globe = mesh(this.sphere, new THREE.MeshStandardMaterial({ color: '#f3e8c9', emissive: '#e4c881', emissiveIntensity: 0.35, roughness: 0.6 }), this.root, x, 2.8, z); globe.scale.setScalar(0.23); pole.castShadow = false;
      nightEmission(globe.material as THREE.MeshStandardMaterial, '#ffcf79', 3);
      addGlow(this.root, new THREE.Vector3(x, 2.8, z), '#ffcf79', 4.5, 36, 10, .7);
    }
  }
  /** Sub-plan 27 round 2: limestone crags wherever the mountain is steep, clear of trunks and the trail's boulders; one draw, and one collider on every tier. */
  private buildCrags(): void {
    const obstacles = cragObstacles(this.forest.sites, this.boulders);
    // The ground under them comes from the collider grid's heights, already computed.
    const ground = new CragGround((x, z) => terrainVertexHeight(this.terrainVertices, x, z));
    const crags = this.crags = createCrags(this.tier, cragSites({ obstacles, ground }), ground); this.root.add(crags.mesh); this.colliders.push(crags.collider);
    this.groundDiscs.push(...crags.discs); this.contactSites.push(...crags.contacts);
    // Built after the first view, the mountains' rock maps are already loading; at loading, the mountains come later (build()).
    if (this.mountains) this.jewelryReady.push(this.cragMaps(crags));
  }
  /** The Jepii Mici trailhead and its boulders: every sign, post, rope and blaze is one mesh on one painted atlas. */
  private buildTrailSigns(trail: ReturnType<typeof trailBoulders>): void {
    // Matte grey limestone, darker than the pale river stone, which read as a bright lens on the sunlit slope.
    const limestone = rockMaterial(this.mobile); limestone.color.set('#cdc9bf');
    const boulders = createRiverRocks(this.boulders, limestone, this.tier); boulders.name = 'Trail boulders'; this.root.add(boulders);
    const signs = createTrailSigns(this.colliders, trail, this.forest.sites, this.mobile); this.root.add(signs.mesh); paintTrailSigns(signs, this.tier);
    this.researchPanels.push(signs.mesh); this.interactives.push({ id: 'jepii-mici', object: signs.mesh, position: signs.position }); this.contactSites.push(...signs.contacts);
  }
  private cragMaps(crags: Crags): Promise<void> {
    return this.mountains.rock.then(({ rock, rockNormal }) => useCragMaps(crags.material, this.tier, rock, rockNormal)).catch(() => { /* Plain grey crags if the rock maps fail. */ });
  }
  /** One multiply-blended draw grounds trunks, rocks, feet, posts and benches; tree patches follow the forest's own cells. */
  private createContactShadows(): void {
    this.contactShadows = this.contactBatch();
    if (!CONTACT_OFF) this.root.add(this.contactShadows.mesh);
    this.forest.onCells = this.contactShadows.showGroups;
  }
  private contactBatch(): ContactShadows {
    const trees = forestCells(this.forest.sites).map(cell => cell.sites.flatMap(({ p, index }) => treeContactSites(p, index)));
    return createContactShadows([...objectContactSites(), ...rockContactSites([...this.rocks, ...this.boulders.filter(b => snowCover(b.x, b.z) < .5)]), ...this.contactSites], trees);
  }
  /** The batch again with the patches of parts shown since: new geometry on the same mesh and material, so nothing rebuilds. */
  private refreshContacts(): void {
    const next = this.contactBatch(), mesh = this.contactShadows.mesh;
    mesh.geometry.dispose(); mesh.geometry = next.mesh.geometry; next.mesh.material.dispose();
    this.contactShadows = { ...next, mesh }; this.forest.onCells = next.showGroups; next.showGroups(this.forest.trunks());
  }
  /**
   * Returns whether a shadow caster changed detail or visibility this frame. `fullFog` is where the view's fog is complete
   * (GraphicsProfile.fog walking, or a longer distance a high viewpoint is given): grove crowns are culled only beyond it and
   * trees a little short of it (TREE_REACH of it, where the haze has faded most of a tree into the distant pass), except on the
   * cpu tier, which stops both at its own forest range inside its linear fog. Dev-only ?haze=classic draws trees until full fog.
   */
  /** The iris and its collider advance together in the fixed walking loop. */
  stepWinter(dt: number, position: { x: number; y: number; z: number }): boolean { return this.winter?.step(dt, position) ?? true; }
  update(time: number, camera?: THREE.Camera, fullFog = 220, mapView = false, shadow?: THREE.LightShadow): boolean {
    this.water.userData.time.value = time; shoreTime.value = time; updateWind(time);
    if (!camera) return false;
    const profile = graphicsProfile(this.tier), cpu = this.tier === 'cpu';
    const crowns = mapView || !cpu ? fullFog : Math.min(fullFog, profile.forest), reach = mapView || (!cpu && HAZE_CLASSIC) ? fullFog : cpu ? Math.min(fullFog, profile.forest) : fullFog * TREE_REACH;
    const trees = this.forest.update(camera, reach, mapView, shadow);
    // Their light silhouette matches, so a cached shadow map waits for its next re-bake.
    this.gardens?.updateDetail(camera, crowns, mapView); this.gardens?.turnRing();
    this.fireflies?.update();
    // Shrub batches toggle every couple of metres while walking; re-baking for them cost a shadow pass per ~2 m, so their shadows catch up at the next quarter-box re-bake.
    this.planting?.update(camera, mapView ? (this.tier === 'cpu' ? 0 : 200) : profile.plants);
    this.pebbles?.update(camera);
    // The map's camera is far above the town; residency follows the walking eye only.
    if (!mapView) { this.posters.update(camera.position); if (this.streaming) for (const exhibition of this.exhibitions) exhibition.updateFeatured(camera.position, ROOM_RANGE); }
    for (const room of this.rooms) {
      if (room.held) continue;
      const shown = mapView || BUDGET_OFF || camera.position.distanceTo(room.center) < ROOM_RANGE;
      if (shown !== room.shown) { room.shown = shown; for (const part of room.parts) part.visible = shown; }
    }
    if (this.tier === 'cpu') this.details.visible = false;
    return trees;
  }
  setMapMode(active: boolean): void { this.interiors.visible = !active; this.details.visible = !active; this.contactShadows.mesh.visible = !active; }
  startStreaming(): void { this.streaming = true; }
  /** An enclosed collection whose posters hide with distance; `matrix` places its parent in the town. */
  private addRoom(exhibition: PlanarExhibition, matrix?: THREE.Matrix4): void {
    const center = exhibition.center.clone(); if (matrix) center.applyMatrix4(matrix);
    this.rooms.push({ center: center.setY(0), parts: exhibition.objects, shown: null });
  }
  /**
   * Before the first frame: every tree and plant instanced, and culling off, so the precompile and the first shadow pass build
   * each shader during loading; on WebGPU a shader first built while walking would stall that frame. Photographs, captions and
   * signs keep their culling: the view from the station already builds their shaders, and uploading every canvas and photo
   * now would only move their upload from first sight to loading. Poster maps that arrive later swap onto built materials.
   */
  /**
   * As warmUp(), for one distant part while its shaders build (main.ts): every instance drawn, culling off and its rooms held
   * open, so the part builds every shader it can show. The part's root stays hidden meanwhile; its children are compiled.
   */
  warmPart(part: TownPart, on: boolean): void {
    const inside = (object: THREE.Object3D): boolean => { for (let at: THREE.Object3D | null = object; at; at = at.parent) if (at === part.root) return true; return false; };
    for (const exhibition of this.exhibitions) if (exhibition.objects.some(inside)) exhibition.warmUp(on);
    if (this.gardens && inside(this.gardens.root)) this.gardens.warmUp(on);
    for (const room of this.rooms) if (room.parts.some(inside)) { room.held = on; room.shown = null; if (on) for (const object of room.parts) object.visible = true; }
    part.root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!Array.isArray(material) && material?.userData.display) return;
      if (on) { warmCulled.set(object, object.frustumCulled); object.frustumCulled = false; }
      else { const culled = warmCulled.get(object); if (culled !== undefined) object.frustumCulled = culled; }
    });
  }
  warmUp(on: boolean): void {
    for (const exhibition of this.exhibitions) exhibition.warmUp(on);
    this.forest.warmUp(on); this.planting?.warmUp(on); this.pebbles?.warmUp(on); this.gardens?.warmUp(on);
    // Rooms draw during the warm-up, so their shaders build now; the next update() hides the distant ones again.
    if (on) for (const room of this.rooms) { room.shown = null; for (const part of room.parts) part.visible = true; }
    this.root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!Array.isArray(material) && material?.userData.display) return;
      if (on) { warmCulled.set(object, object.frustumCulled); object.frustumCulled = false; }
      else { const culled = warmCulled.get(object); if (culled !== undefined) object.frustumCulled = culled; }
    });
  }
}
