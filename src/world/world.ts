import { TREE_REACH, graphicsProfile } from '../game/graphics';
import type { GraphicsTier } from '../game/graphics';
import { hazeLook } from '../render/aerial';
import { createIntroduction } from './introduction';
import { createEnhancementHill, createEnhancementPanel } from './enhancement';
import { createEnhancementGallery } from './enhancement-gallery';
import * as THREE from 'three';
import { addGlow, nightEmission } from './night-lighting';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { mitoringCage, nanotCage, ENERGY_HALL } from './jewelry';
import { FOREST_DETAIL, Forest, forestCells } from './forest';
import { forestSites } from './forest-layout';
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
import { CIVIC_LANDMARKS } from '../game/content';
import { createStation } from './station';
import { LivingWaters } from './living-waters';
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
import type { ContactSite } from './contact-shadows';

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
  gardens!: LivingWaters;
  readonly researchPanels: THREE.Mesh[] = [];
  private mountains!: Mountains;
  private railway!: THREE.Group;
  private researchReady!: Promise<void>;
  private readonly jewelryReady: Promise<void>[] = [];
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
  private trailContacts: ContactSite[] = [];
  /** Sub-plan 27 round 2: the mountain's limestone crags (one mesh, one collider), shaded once the mountains' rock maps load. */
  private crags: Crags | null = null;
  private cragsReady: Promise<void> = Promise.resolve();
  /** Hall interiors and enclosed collections, whose meshes (never their lights, which WebGPU builds into shaders) hide beyond ROOM_RANGE. */
  private readonly rooms: { center: THREE.Vector3; parts: THREE.Object3D[]; shown: boolean | null }[] = [];
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
  private constructor(private mobile: boolean, private tier: GraphicsTier) {
    this.water = waterMaterial(tier); this.paving = pavingMaterial(mobile);
    this.surfaces = activateSurfaces(tier); this.masonry = this.surfaces?.masonry ?? this.white; this.brass = this.surfaces?.gold ?? this.gold;
  }
  static async create(mobile: boolean, stage: (value: number, label: string) => Promise<void>, tier: GraphicsTier = mobile ? 'mobile' : 'gpu'): Promise<Town> {
    const town = new Town(mobile, tier); await town.build(stage); return town;
  }
  private async build(stage: (value: number, label: string) => Promise<void>): Promise<void> {
    const mobile = this.mobile;
    await stage(20, 'Shaping the river, bridge and town entrance…');
    this.root.name = 'Livistone'; this.interiors.name = 'Hall interiors'; this.details.name = 'Meadow grass details'; this.root.add(this.interiors, this.details);
    // Dev budget breakdown (snapshot().budget): each producer names its unnamed top-level objects.
    let mark = this.root.children.length;
    const label = (name: string): void => { for (const child of this.root.children.slice(mark)) if (!child.name) child.name = name; mark = this.root.children.length; };
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
    this.gardens = new LivingWaters(mobile, this.paving, this.wind); this.root.add(this.gardens.root);
    this.gardens.presentLakeJewelry();
    this.gardens.addInterpretation('living-mycelium', 'Mycelium Rain Garden', 'The Mycelium grove', 'Curled, open silver gills surround opal hearts, following the Mycelium ring. Tall crowns and lower ring-scale shrubs share the same folds. Its setting was designed to drain water away from porous opal. Follow the dry loop and silver rill to the lake.');
    this.colliders.push(...this.gardens.colliders); this.interactives.push(...this.gardens.interactives); this.researchPanels.push(...this.gardens.panels);
    label('Living Waters · town gardens');
    for (const bridge of GARDEN_BRIDGES) createGardenBridge(this.root, this.colliders, this.masonry, this.paving, this.brass, bridge);
    label('Garden bridges'); let first = this.root.children.length; createTimeTower(this.root, this.colliders, this.mobile); label('Time tower');
    const tower = this.root.children.slice(first); first = this.root.children.length;
    createFutureHouse(this.root, this.colliders, this.mobile); label('Future House'); const house = this.root.children.slice(first);
    await stage(54, 'Making room for science and bioart…');
    createEnhancementHill(this.root, this.colliders);
    label('Enhancement hill');
    const enhancementSign = createEnhancementPanel(this.root, this.colliders); this.researchPanels.push(...enhancementSign.panels); this.interactives.push({ id: 'materialized-enhancements', object: enhancementSign.panels[0], position: enhancementSign.position });
    const enhancementGallery = createEnhancementGallery(this.root, this.colliders); this.researchPanels.push(...enhancementGallery.panels); this.interactives.push(...enhancementGallery.interactives);
    label('Enhancement gallery');
    for (const id of ['timeface', 'future-house']) { this.exhibitions.push(new PlanarExhibition(id, this.root, 0, 0, this.colliders, this.interactives, this.tier)); label('Posters · ' + id); }
    // The tower's posters hang on its spiral and the house's stand in its cabin: both vanish with the envelope they belong to.
    for (const [id, parts] of [['timeface', tower], ['future-house', house]] as const) { const posters = this.exhibitions.find(e => e.id === id)!.objects; this.probeParts.set(id, { objects: [...parts, ...posters], hide: [...parts, ...posters] }); }
    // Timeface hangs its posters on the open gallery, seen across town; the Future House keeps its three inside the cabin.
    this.addRoom(this.exhibitions[this.exhibitions.length - 1]);
    label('Glucose Commons');
    const research = createGlucosePavilion(this.root, this.colliders, mobile, this.paving); this.researchPanels.push(...research.panels); this.interactives.push(...research.interactives);
    this.researchReady = Promise.all([research.ready, enhancementGallery.ready, gatewayPoster.ready]).then(() => undefined);
    await stage(62, 'Planting the woodland and mountain slopes…');
    label('Glucose Commons'); this.createTrees(); this.createGardens(); this.createContactShadows(); label('River rocks and lamps');
    for (const landmark of CIVIC_LANDMARKS) {
      const color = landmark.id === 'energy' ? '#ffbf66' : landmark.id === 'science' ? '#99ded7' : '#ffe0a3';
      addGlow(this.root, new THREE.Vector3(landmark.x, 6, landmark.z), color, 25, 90, 24, .3);
      for (const side of [-1, 1]) addGlow(this.root, new THREE.Vector3(landmark.x + side * 5, 2.5, landmark.z + 7), color, 8, 65, 15, .24);
    }
    // The concourse glows stay a quarter below their first strength, so the platform lamps' own pools read at night (sub-plan 28).
    for (const x of [-20, 0, 20]) addGlow(arrival, new THREE.Vector3(x, 4.3, -68), '#ffd28a', 12, 50, 17, .22);
    this.mountains = new Mountains(mobile, this.tier, this.groundOcclusion, this.grassShade); this.root.add(this.mountains);
    const crags = this.crags; if (crags) this.cragsReady = this.mountains.rock.then(({ rock, rockNormal }) => useCragMaps(crags.material, this.tier, rock, rockNormal)).catch(() => { /* Plain grey crags if the rock maps fail. */ });
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
  async loadAssets(): Promise<void> { await Promise.all([this.paving.userData.ready, this.surfaces?.ready, this.forest.load(this.mobile, graphicsProfile(this.tier).shadows, this.wind), this.mountains.ready, this.cragsReady, this.researchReady, ...this.jewelryReady, loadRailwayTextures(this.railway, this.mobile), ...this.exhibitions.map((exhibition) => exhibition.ready)]); }
  private createTrees(): void {
    const sites = forestSites(this.mobile);
    for (const { x, y, z } of sites) this.colliders.push({ type: 'box', position: [x, y + 2, z], size: [0.3, 2, 0.3] });
    this.forest.sites = sites; this.forest.name = 'Forest'; this.root.add(this.forest);
  }
  private createGardens(): void {
    // The near grass field (gpu and mobile) replaces the meadow tufts close to the camera; map mode hides it with the details.
    // The ground's baked crown and wall occlusion (sub-plan 16), shared by the terrain and the grass standing on it.
    this.groundOcclusion = CONTACT_OFF ? undefined : groundShadeField(treeShadeDiscs(this.forest.sites), TOWN_SHADE_FOOTPRINTS);
    const trail = MOUNTAIN ? trailBoulders(this.mobile) : [];
    this.boulders = trail.map(boulder => boulder.site); const rocks = [...this.rocks, ...this.boulders];
    if (CRAGS) {
      // Sub-plan 27 round 2: limestone crags wherever the mountain is steep, clear of trunks and the trail's boulders; one draw,
      // and one collider on every tier.
      const obstacles = cragObstacles(this.forest.sites, this.boulders);
      // The ground under them comes from the collider grid's heights, already computed.
      const ground = new CragGround((x, z) => terrainVertexHeight(this.terrainVertices, x, z));
      this.crags = createCrags(this.tier, cragSites({ obstacles, ground }), ground); this.root.add(this.crags.mesh); this.colliders.push(this.crags.collider);
    }
    const grass = createGrassField(this.tier, { rocks, stems: [...this.gardens.stems, ...this.crags?.discs ?? []], height: (x, z) => terrainVertexHeight(this.terrainVertices, x, z), shade: this.groundOcclusion });
    if (grass) { this.details.add(grass.mesh); this.grassShade = grass.ground; }
    this.planting = createPlanting(this.root, this.details, this.mobile, terrainHeight, riverCenter, this.tier, grass?.ground.radius ?? 0, this.wind);
    // One instanced draw of blended boulder variants; one collider mesh sampled from the same shapes and transforms.
    // The trail's boulders keep their own draw, so the river rocks' bounds stay on the river; both share one collider.
    const stone = rockMaterial(this.mobile); this.root.add(createRiverRocks(this.rocks, stone, this.tier)); this.colliders.push(rockColliders(rocks));
    if (MOUNTAIN) {
      // Matte grey limestone, darker than the pale river stone, which read as a bright lens on the sunlit slope.
      const limestone = rockMaterial(this.mobile); limestone.color.set('#cdc9bf');
      const boulders = createRiverRocks(this.boulders, limestone, this.tier); boulders.name = 'Trail boulders'; this.root.add(boulders);
      // The Jepii Mici trailhead (sub-plan 27): every sign, post, rope and blaze is one mesh on one painted atlas; the cushions one draw.
      const signs = createTrailSigns(this.colliders, trail, this.forest.sites, this.mobile); this.root.add(signs.mesh); paintTrailSigns(signs, this.tier);
      this.researchPanels.push(signs.mesh); this.interactives.push({ id: 'jepii-mici', object: signs.mesh, position: signs.position });
      // The plateau's rhododendron mats, their cards with the turf's flowers and moss campion: three draws, none on cpu.
      const plants = createAlpinePlants(this.tier, rocks, FOREST_DETAIL.coverage); this.root.add(...plants.meshes); this.trailContacts = [...signs.contacts, ...plants.contacts, ...this.crags?.contacts ?? []];
    }
    // Shore pebbles live with the other near-ground details, so map mode hides them; cpu has none. Only nearby cells draw.
    this.pebbles = createPebbles(this.tier, this.rocks); if (this.pebbles) this.details.add(this.pebbles.mesh);
    for (const [x, z] of LAMP_POSTS) {
      const pole = mesh(new THREE.CylinderGeometry(0.045, 0.065, 2.8, 8), this.brass, this.root, x, 1.4, z);
      const globe = mesh(this.sphere, new THREE.MeshStandardMaterial({ color: '#f3e8c9', emissive: '#e4c881', emissiveIntensity: 0.35, roughness: 0.6 }), this.root, x, 2.8, z); globe.scale.setScalar(0.23); pole.castShadow = false;
      nightEmission(globe.material as THREE.MeshStandardMaterial, '#ffcf79', 3);
      addGlow(this.root, new THREE.Vector3(x, 2.8, z), '#ffcf79', 4.5, 36, 10, .7);
    }
  }
  /** One multiply-blended draw grounds trunks, rocks, feet, posts and benches; tree patches follow the forest's own cells. */
  private createContactShadows(): void {
    const trees = forestCells(this.forest.sites).map(cell => cell.sites.flatMap(({ p, index }) => treeContactSites(p, index)));
    this.contactShadows = createContactShadows([...objectContactSites(), ...rockContactSites([...this.rocks, ...this.boulders.filter(b => snowCover(b.x, b.z) < .5)]), ...this.trailContacts], trees);
    if (!CONTACT_OFF) this.root.add(this.contactShadows.mesh);
    this.forest.onCells = this.contactShadows.showGroups;
  }
  /**
   * Returns whether a shadow caster changed detail or visibility this frame. `fullFog` is where the view's fog is complete
   * (GraphicsProfile.fog walking, or a longer distance a high viewpoint is given): grove crowns are culled only beyond it and
   * trees a little short of it (TREE_REACH of it, where the haze has faded most of a tree into the distant pass), except on the
   * cpu tier, which stops both at its own forest range inside its linear fog. Dev-only ?haze=classic draws trees until full fog.
   */
  update(time: number, camera?: THREE.Camera, fullFog = 220, mapView = false, shadow?: THREE.LightShadow): boolean {
    this.water.userData.time.value = time; shoreTime.value = time; updateWind(time);
    if (!camera) return false;
    const profile = graphicsProfile(this.tier), cpu = this.tier === 'cpu';
    const crowns = mapView || !cpu ? fullFog : Math.min(fullFog, profile.forest), reach = mapView || (!cpu && HAZE_CLASSIC) ? fullFog : cpu ? Math.min(fullFog, profile.forest) : fullFog * TREE_REACH;
    const trees = this.forest.update(camera, reach, mapView, shadow);
    // Their light silhouette matches, so a cached shadow map waits for its next re-bake.
    this.gardens.updateDetail(camera, crowns, mapView);
    // Shrub batches toggle every couple of metres while walking; re-baking for them cost a shadow pass per ~2 m, so their shadows catch up at the next quarter-box re-bake.
    this.planting?.update(camera, mapView ? (this.tier === 'cpu' ? 0 : 200) : profile.plants);
    this.pebbles?.update(camera);
    // The map's camera is far above the town; residency follows the walking eye only.
    if (!mapView) this.posters.update(camera.position);
    for (const room of this.rooms) {
      const shown = mapView || BUDGET_OFF || camera.position.distanceTo(room.center) < ROOM_RANGE;
      if (shown !== room.shown) { room.shown = shown; for (const part of room.parts) part.visible = shown; }
    }
    if (this.tier === 'cpu') this.details.visible = false;
    return trees;
  }
  setMapMode(active: boolean): void { this.interiors.visible = !active; this.details.visible = !active; this.contactShadows.mesh.visible = !active; }
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
  warmUp(on: boolean): void {
    this.forest.warmUp(on); this.planting?.warmUp(on); this.pebbles?.warmUp(on); this.gardens.warmUp(on);
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
