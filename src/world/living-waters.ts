import { paintPosterText } from './poster-text';
import * as THREE from 'three';
import { instancedBufferAttribute, length, positionLocal, uniform, uv, vec2 } from 'three/tsl';
import { lakeWaterMaterial } from './water-material';
import { displayMaterial, paperPhotoMaterial } from '../render/output';
import { createPlaceSign, paintPlaceSign } from './place-sign';
import type { PlaceSign } from './place-sign';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';
import { GARDENS, GARDEN_PANELS, LAKE_OUTLINE, OPAL_BASIN, RILL, RILL_RADIUS, gardenHeight, pointInPolygon, rainPlantAllowed } from './living-waters-layout';
import { clearance, eyeLip, fansFrom, largestEyes, waterEyes } from './lake-eyes';
import type { WaterEye } from './lake-eyes';
import type { Point } from './living-waters-layout';
import { MYCELIUM_RADIUS, MyceliumGrove } from './mycelium';
import type { GroveInstance } from './mycelium';
import { COLLECTION, photoSize, photoURL } from '../game/exhibits';
import { addGlow, nightEmission } from './night-lighting';
import { createLakePlants } from './lake-plants';
import { GARDEN_PAVING, walkingSurface } from './walking-surface';
import { WALKING_NETWORK } from './landscape';
import { KERB_WIDTH } from './path-kerbs';
import type { GroundDisc } from './grass-field';
import { mergeStatic } from './static-batch';
import { addWindRoots, plantSway, windRoots, windTime } from './wind';
import { MODELS_OFF, modelURL } from '../game/featured';

/** A culvert headwall's centre, past the outer face of the path kerb (it is 0.3 m thick, so it clears the kerb by 0.15 m). */
const CULVERT_SET = .3;
function shape(points: Point[]): THREE.Shape { return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z))); }
function random(seed: number): () => number { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
/**
 * Rain and drips: the Points stay the animated source of truth, but WebGPU point primitives are one pixel wide, so a child
 * sprite draws one round, size-attenuated quad per point from the same (now instanced) position array.
 */
function sizedPoints(points: THREE.Points): void {
  const source = points.geometry.getAttribute('position'), classic = points.material as THREE.PointsMaterial;
  const positions = new THREE.InstancedBufferAttribute(source.array as Float32Array, 3); positions.setUsage(THREE.DynamicDrawUsage); points.geometry.setAttribute('position', positions);
  const material = new THREE.PointsNodeMaterial({ color: classic.color, size: classic.size, transparent: classic.transparent, opacity: classic.opacity, sizeAttenuation: classic.sizeAttenuation, depthWrite: classic.depthWrite });
  material.positionNode = instancedBufferAttribute(positions);
  // The classic sprites discarded outside a tall ellipse, so drops read as streaks.
  material.maskNode = length(uv().sub(.5).mul(vec2(1.8, .8))).lessThanEqual(.45);
  const sprite = new THREE.Sprite(material); sprite.count = positions.count; sprite.frustumCulled = false; sprite.name = points.name || 'Sized points';
  // Hiding the Points (cpu-detail) hides the sprite with them; the Points themselves no longer draw.
  classic.visible = false; points.add(sprite);
}
// Dev-only ?grove=full|light pins every crown to one detail level without the distance cull, for review (sub-plan 25).
/** The opal orb's top over the grove floor, and the clear air between it and the floating ring's net. */
const RING_ORB_TOP = 1.75, RING_GAP = 1, RING_SCALE = 1.6;
const GROVE_PIN = import.meta.env?.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('grove') : null;
export class LivingWaters {
  readonly root = new THREE.Group();
  readonly colliders: ColliderSpec[] = [];
  readonly interactives: Interactive[] = [];
  readonly panels: THREE.Mesh[] = [];
  /** Every mushroom stem's foot in world space: the near grass field grows round them and under the crowns. */
  readonly stems: GroundDisc[] = [];
  grove!: MyceliumGrove;
  /** Livia's Mycelium Ring, decimated from its print STL, floating over the opal orb in the grove's own silver. */
  readonly ring = new THREE.Mesh(new THREE.BufferGeometry());
  private ringBase = 0;
  private readonly signs = new Map<string, PlaceSign>();
  private readonly waterTime = uniform(0);
  private readonly water = lakeWaterMaterial(this.waterTime);
  private readonly silver = new THREE.MeshStandardMaterial({ color: '#d9e0d6', metalness: .63, roughness: .32 });
  private readonly stone = new THREE.MeshStandardMaterial({ color: '#d4cfbc', roughness: .91 });
  private readonly rain: THREE.Points;
  private readonly drips: THREE.Points;
  private readonly drainage: THREE.Curve<THREE.Vector3>[] = [];
  /** `wind`: the reeds sway (gpu and mobile tiers); the cpu tier keeps them still and their geometry unchanged. */
  constructor(private mobile: boolean, private readonly pathMaterial: THREE.Material = new THREE.MeshStandardMaterial({ color: '#d4cfbc', roughness: .91 }), private readonly wind = false) {
    this.root.name = 'Living Waters · town gardens'; this.root.position.set(GARDENS.x, 0, GARDENS.z);
    // The eyes keep clear of the garden paths' paving and kerbs (lake-eyes.ts), so their stone lips never cross a path.
    const network = shape(LAKE_OUTLINE); waterEyes().forEach((eye) => network.holes.push(new THREE.Path(eye.outline.map(([x, z]) => new THREE.Vector2(x, -z)))));
    this.mesh(new THREE.ShapeGeometry(network).rotateX(-Math.PI / 2), this.silver, true, 0, .12);
    const eyes: THREE.Mesh[] = [], eyeKerbs: THREE.Mesh[] = [];
    waterEyes().forEach((eye) => {
      const mesh = this.mesh(this.waterEye(eye), this.water, false, 0, -.08 + eye.cell % 3 * .012); mesh.castShadow = false; eyes.push(mesh);
      eyeKerbs.push(this.mesh(eyeLip(eye.outline, .14, .085, 5), this.stone, false));
    });
    // Each cell keeps its own surface height and local x/z, so the ripples are unchanged when the eyes draw together.
    mergeStatic(eyes, 'Lake water eyes'); mergeStatic(eyeKerbs, 'Lake water-eye stone kerbs');
    // The garden's share of the merged walking network (walking-surface.ts), level at 13 cm; paving and kerbs are both walkable.
    const { paving, kerbs } = walkingSurface(mobile), local = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(-GARDENS.x, 0, -GARDENS.z);
    const surface = this.mesh(local(paving[GARDEN_PAVING]), this.pathMaterial, true); surface.name = 'Lake walking network'; surface.castShadow = false;
    const kerbMaterial = new THREE.MeshStandardMaterial({ color: '#e4decf', vertexColors: true, roughness: .97 });
    if (this.pathMaterial instanceof THREE.MeshStandardMaterial) {
      const paving = this.pathMaterial; kerbMaterial.map = paving.map;
      paving.userData.ready?.then(() => { kerbMaterial.map = paving.map; kerbMaterial.needsUpdate = true; });
    }
    this.mesh(local(kerbs[GARDEN_PAVING]), kerbMaterial, true).name = 'Lake path stone kerbs';
    paving.filter((_, i) => i !== GARDEN_PAVING).concat(kerbs.filter((_, i) => i !== GARDEN_PAVING)).forEach(g => g.dispose());
    this.pavilion();
    this.mushrooms(); this.wetlandPlanting(); createLakePlants(this.root, mobile);
    for (const [name, [x, z]] of Object.entries(GARDEN_PANELS)) {
      const id = 'living-' + name, jewelry = name === 'vittoria' || name === 'dewdrop';
      if (!jewelry) {
        const sign = createPlaceSign(this.root, this.colliders, { x, z, yaw: 0 }, 'Garden story · ' + name, new THREE.Vector3(GARDENS.x, 0, GARDENS.z));
        for (const face of sign.faces) face.userData.discovery = id;
        this.signs.set(id, sign); this.panels.push(...sign.faces); this.interactives.push({ id, object: sign.faces[0], position: sign.position });
        continue;
      }
      for (const dx of [-1, 1]) this.mesh(new THREE.CylinderGeometry(.045, .065, 1.7, 6), this.silver, true, x + dx, .85, z);
      this.mesh(new THREE.BoxGeometry(2.72, 2.9, .1), displayMaterial({ color: '#f4f0e5' }), true, x, 1.82, z);
      // Both faces carry the photograph and caption: the stands stand free on the lake paths and are walked round.
      const photoPaper = displayMaterial({ color: '#f4f0e5' }), captionPaper = displayMaterial({ color: '#f4f0e5' });
      for (const side of [1, -1]) {
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 1.32), photoPaper);
        photo.position.set(x, 2.4, z + side * .06); photo.rotation.y = side < 0 ? Math.PI : 0; photo.userData.discovery = id; photo.userData.kind = 'photo'; if (name === 'vittoria') photo.userData.piece = 'vittoria-amazonica';
        const caption = new THREE.Mesh(new THREE.PlaneGeometry(2.52, 1.32), captionPaper);
        caption.position.set(x, 1.18, z + side * .06); caption.rotation.y = photo.rotation.y; caption.userData.discovery = id; caption.userData.kind = 'caption';
        this.root.add(photo, caption); this.panels.push(photo, caption);
        if (side > 0) this.interactives.push({ id, object: caption, position: new THREE.Vector3(x + GARDENS.x, 1.8, z + GARDENS.z) });
      }
    }
    // Where the rill meets the Mycelium paths it runs through a culvert: the pipe ends in a stone headwall just outside each kerb
    // and nothing shows under the paving. Each open run is its own pipe and water channel, and carries its own drips.
    const samples = RILL.getSpacedPoints(400), clear = samples.map(p => WALKING_NETWORK.edge(p.x + GARDENS.x, p.z + GARDENS.z, 4) - KERB_WIDTH - CULVERT_SET);
    let run: THREE.Vector3[] = []; const runs: THREE.CatmullRomCurve3[] = [], walls: THREE.BufferGeometry[] = [];
    const close = (): void => { if (run.length > 1) runs.push(new THREE.CatmullRomCurve3(run)); run = []; };
    samples.forEach((p, i) => {
      if (i > 0 && (clear[i] >= 0) !== (clear[i - 1] >= 0)) {
        // The headwall stands square to the rill where it crosses the culvert line; the pipe's open end lies inside it.
        const a = samples[i - 1], t = clear[i - 1] / (clear[i - 1] - clear[i]), at = a.clone().lerp(p, t), along = p.clone().sub(a).normalize();
        walls.push(new THREE.BoxGeometry(1.05, .5, .3).rotateY(Math.atan2(along.x, along.z)).translate(at.x, .13, at.z));
        if (clear[i] < 0) { run.push(at); close(); } else run.push(at);
      }
      if (clear[i] >= 0) run.push(p);
    });
    close(); this.drainage.push(...runs);
    // One pipe, one water channel and one headwall mesh however many runs the paths leave (the draw budget counts each).
    const tubes = (radius: number, sides: number): THREE.BufferGeometry => mergeGeometries(runs.map(run => new THREE.TubeGeometry(run, Math.max(4, Math.ceil(run.getLength() * 2)), radius, sides, false)))!;
    this.mesh(tubes(RILL_RADIUS, 6), this.silver, false).name = 'Rill silver pipe';
    this.mesh(tubes(.18, 5), this.water, false, 0, .08).name = 'Rill water channel';
    if (walls.length) this.mesh(mergeGeometries(walls)!, this.stone, true).name = 'Rill culvert headwalls';
    this.mesh(new THREE.CylinderGeometry(3.6, OPAL_BASIN.radius, .14, 40), this.water, false, OPAL_BASIN.x, .025, OPAL_BASIN.z);
    this.mesh(new THREE.IcosahedronGeometry(RING_ORB_TOP - .65, 1), new THREE.MeshStandardMaterial({ color: '#bddacf', metalness: .45, roughness: .2 }), true, OPAL_BASIN.x, .65, OPAL_BASIN.z);
    const rain = new Float32Array((mobile ? 150 : 460) * 3), drips = new Float32Array(this.drainage.length * 6 * 3), fall = random(3304);
    for (let i = 0; i < rain.length; i += 3) { rain[i] = -48 + fall() * 152; rain[i + 1] = fall() * 9; rain[i + 2] = -40 + fall() * 76; }
    for (let i = 0; i < drips.length / 3; i++) { const p = this.drainage[i % this.drainage.length].getPoint((i % 6) / 6); drips[i * 3] = p.x; drips[i * 3 + 1] = p.y + .1; drips[i * 3 + 2] = p.z; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(rain, 3)); this.rain = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#e1f3ef', size: .09, transparent: true, opacity: .7 })); this.root.add(this.rain);
    const dripGeo = new THREE.BufferGeometry(); dripGeo.setAttribute('position', new THREE.BufferAttribute(drips, 3)); this.drips = new THREE.Points(dripGeo, new THREE.PointsMaterial({ color: '#c7eeef', size: .16 })); this.root.add(this.drips);
    for (const particles of [this.rain, this.drips]) sizedPoints(particles);
  }
  /** Deep teal at the eye's centre fading to pale at its lip: a fan from the centre where it covers the outline once, else earcut with interior points shaded by their clearance. */
  private waterEye({ outline, center, reach }: WaterEye): THREE.BufferGeometry {
    const vertices = [center[0], 0, center[1]], colors = [.37, .65, .65], indices: number[] = [], deep = (t: number): number[] => [.78 - .41 * t, .87 - .22 * t, .68 - .03 * t];
    if (fansFrom(outline, center)) outline.forEach(([x, z], i) => { vertices.push(x, 0, z); colors.push(...deep(0)); indices.push(0, (i + 1) % outline.length + 1, i + 1); });
    else {
      vertices.length = colors.length = 0;
      const contour = outline.map(([x, z]) => new THREE.Vector2(x, z)), inner: THREE.Vector2[][] = [], jitter = random(outline.length * 7919);
      // Earcut takes one-point holes as interior vertices; a jittered 1.2 m lattice keeps the depth shading inside cut pieces.
      for (let x = Math.min(...outline.map(p => p[0])); x < Math.max(...outline.map(p => p[0])); x += 1.2) for (let z = Math.min(...outline.map(p => p[1])); z < Math.max(...outline.map(p => p[1])); z += 1.2) {
        const px = x + (jitter() - .5) * .5, pz = z + (jitter() - .5) * .5; if (pointInPolygon(px, pz, outline) && clearance(px, pz, outline) > .6) inner.push([new THREE.Vector2(px, pz)]);
      }
      for (const p of [...contour, ...inner.map(([p]) => p)]) { vertices.push(p.x, 0, p.y); colors.push(...deep(Math.min(1, clearance(p.x, p.y, outline) / reach))); }
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, inner)) {
        const ax = vertices[a * 3], az = vertices[a * 3 + 2], cross = (vertices[b * 3] - ax) * (vertices[c * 3 + 2] - az) - (vertices[b * 3 + 2] - az) * (vertices[c * 3] - ax);
        // Counter-clockwise in (x, z) faces down; keep the fan's upward winding.
        indices.push(...(cross > 0 ? [a, c, b] : [a, b, c]));
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  private wetlandPlanting(): void {
    const bladeParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) { const blade = new THREE.PlaneGeometry(.075, .6 + i % 3 * .18, 1, 3), p = blade.getAttribute('position');
      for (let j = 0; j < p.count; j++) { const y = p.getY(j) + .4; p.setXYZ(j, p.getX(j) + y * y * .4, y, 0); } blade.rotateY(i * 2.399); bladeParts.push(blade); }
    const geometry = mergeGeometries(bladeParts)!; bladeParts.forEach(g => g.dispose());
    const sites: THREE.Vector3[] = [], rand = random(2201);
    for (let i = 0; i < (this.mobile ? 420 : 900); i++) {
      const lake = rand() < .7, a = rand() * Math.PI * 2, r = 44 + rand() * 10;
      const x = lake ? Math.cos(a) * r : 54 + rand() * 48, z = lake ? Math.sin(a) * r : -30 + rand() * 61;
      if (rainPlantAllowed(x, z, .55)) sites.push(new THREE.Vector3(x, gardenHeight(x, z), z));
    }
    // Reeds bend about as far as the meadow's blades (wind.ts), from roots given in town coordinates so the gusts run on across the garden.
    const reedParameters = { color: '#466347', roughness: .9, side: THREE.DoubleSide };
    const material = this.wind ? Object.assign(new THREE.MeshStandardNodeMaterial(reedParameters), { positionNode: plantSway(positionLocal, .7, .4), userData: { wind: true } }) : new THREE.MeshStandardMaterial(reedParameters);
    const reeds = new THREE.InstancedMesh(geometry, material, sites.length), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    sites.forEach((p, i) => { const scale = .4 + rand() * .5; matrix.compose(p, rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2), new THREE.Vector3(scale, scale, scale)); reeds.setMatrixAt(i, matrix); }); reeds.computeBoundingSphere(); this.root.add(reeds);
    if (this.wind) { const roots = windRoots(reeds.instanceMatrix.array); for (let i = 0; i < roots.length; i += 4) { roots[i] += GARDENS.x; roots[i + 2] += GARDENS.z; } addWindRoots(geometry, sites.length).array.set(roots); }
    const pads: { x: number; y: number; z: number; angle: number; scale: number }[] = [], jitter = random(4417);
    largestEyes().forEach(({ center: [x, z] }) => {
      const count = 1 + (jitter() < .45 ? 1 : 0) + (jitter() < .2 ? 1 : 0);
      for (let j = 0; j < count; j++) pads.push({ x: x + (jitter() - .5) * 1.8, y: -.05 + jitter() * .024, z: z + (jitter() - .5) * 1.8, angle: jitter() * Math.PI * 2, scale: .75 + jitter() * .45 });
    });
    const leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(.6, this.mobile ? 8 : 14, .1, Math.PI * 1.88).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a8c55', roughness: .65, side: THREE.DoubleSide }), pads.length);
    pads.forEach((pad, i) => { matrix.compose(new THREE.Vector3(pad.x, pad.y, pad.z), rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pad.angle), new THREE.Vector3(pad.scale, 1, pad.scale)); leaves.setMatrixAt(i, matrix); }); leaves.computeBoundingSphere(); this.root.add(leaves);
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, solid = false, x = 0, y = 0, z = 0): THREE.Mesh {
    if (material === this.water && !geometry.hasAttribute('color')) geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    if (solid) { mesh.updateWorldMatrix(true, false); const world = geometry.clone().applyMatrix4(mesh.matrixWorld); this.colliders.push({ type: 'mesh', vertices: new Float32Array(world.getAttribute('position').array), indices: world.index ? new Uint32Array(world.index.array) : Uint32Array.from({ length: world.getAttribute('position').count }, (_, i) => i) }); world.dispose(); }
    return mesh;
  }
  private pavilion(): void {
    const x = GARDENS.pavilionX, z = GARDENS.pavilionZ;
    this.mesh(new THREE.CylinderGeometry(6, 6.15, .18, 10), this.stone, true, x, .09, z);
    const blue = new THREE.MeshPhysicalMaterial({ color: '#79cde9', roughness: .13, metalness: .12, transmission: this.mobile ? 0 : .42, thickness: .6, ior: 1.61, clearcoat: 1, transparent: true, opacity: this.mobile ? .45 : .7, side: THREE.DoubleSide, depthWrite: false, flatShading: true });
    blue.userData.pavilionGem = blue.userData.heroEnv = true; nightEmission(blue, '#74cbe5', .24);
    // Staggered triangular facets follow the pear profile; the two existing entry sectors stay open.
    const profile = [[4.5, .18], [5.8, 1.5], [6, 3.2], [5.4, 4.9], [4, 6.7], [2.4, 8.7], [1.05, 10.5], [.03, 12.4]], segments = 20, vertices: number[] = [];
    const point = (ring: number, sector: number): THREE.Vector3 => { const a = (sector + (ring % 2 ? .5 : 0)) / segments * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * profile[ring][0], profile[ring][1], Math.cos(a) * profile[ring][0]); };
    for (let ring = 0; ring < profile.length - 1; ring++) for (let i = 0; i < segments; i++) {
      const angle = (i + .5) / segments * 360;
      if (ring < 2 && ((angle >= 36 && angle <= 108) || (angle >= 144 && angle <= 216))) continue;
      const a = point(ring, i), b = point(ring, i + 1), c = point(ring + 1, i), d = point(ring + 1, i + 1);
      for (const p of [a, c, b, b, c, d]) vertices.push(p.x, p.y, p.z);
    }
    const gem = new THREE.BufferGeometry(); gem.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); gem.computeVertexNormals();
    this.mesh(gem, blue, true, x, 0, z).name = 'Dewdrop pavilion · faceted briolette';
    const metal = this.silver.clone(); metal.metalness = .9; metal.roughness = .2;
    nightEmission(metal, '#87bac4', .15);
    // The adjustable ring's two free silver ends sweep around the lower stone and curl upward.
    mergeStatic([-1, 1].map((side) => {
      const embrace = [[.8, 3.35, 6.2], [4.8, 3.6, 4.5], [6.1, 4, 0], [5, 6, -1.8], [3.1, 8.8, -.8], [.55, 11.7, .15]].map(([px, py, pz]) => new THREE.Vector3(x + side * px, py, z + pz));
      return this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(embrace), this.mobile ? 64 : 110, .2, 8, false), metal, true);
    }), 'Dewdrop · open silver embrace');
    addGlow(this.root, new THREE.Vector3(x, 4, z), '#8cdeef', 14, 75, 16, .32);
    addGlow(this.root, new THREE.Vector3(x, 7.2, z), '#b2eeff', 8, 0, 8, .28);
  }
  private mushrooms(): void {
    const sites: { x: number; z: number; scale: number; height: number }[] = [], rand = random(8142);
    for (let i = 0; i < 900 && sites.length < (this.mobile ? 26 : 44); i++) {
      const x = 55 + rand() * 45, z = -30 + rand() * 58, scale = .8 + rand() * .55, height = 3.6 + rand() * 2.8;
      if (!rainPlantAllowed(x, z, scale * MYCELIUM_RADIUS) || sites.some(p => Math.hypot(x - p.x, z - p.z) < (p.scale + scale) * MYCELIUM_RADIUS + .4)) continue;
      sites.push({ x, z, scale, height });
    }
    // Sparse young trees follow the outside of the hill approach, with full crown clearance.
    // Coordinates are local to the garden (world z = local z - 110).
    for (const [x, z, scale, height] of [[80,-26,.62,2.6],[86,-25,.54,2.3],[94,-30,.48,2.1],[101,-35,.42,1.9],[106,-40,.35,1.65]]) {
      sites.push({ x, z, scale, height });
    }
    const silver = new THREE.MeshStandardMaterial({ color: '#c7c3b7', roughness: .27, metalness: .9, userData: { heroEnv: true } });
    nightEmission(silver, '#739589', .11);
    const opal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, metalness: .15, roughness: .18, iridescence: this.mobile ? .35 : 1, iridescenceIOR: 1.38, iridescenceThicknessRange: [180, 420], clearcoat: .9 });
    opal.userData.myceliumOpal = opal.userData.heroEnv = true;
    nightEmission(opal, '#a8ead2', .7);
    // Tall crowns and the shrub ring below share the grove's batches; placement, rotation and colliders are seeded as before.
    const instances: GroveInstance[] = [], rotation = new THREE.Quaternion();
    const place = (site: { x: number; z: number; scale: number; height: number }, stemTop: number, opalLift: number, opalHeight: number): void => {
      const s = site.scale, center = new THREE.Vector3(GARDENS.x + site.x, site.height, GARDENS.z + site.z);
      this.stems.push({ x: center.x, z: center.z, radius: .34 * s + .05 });
      instances.push({ center, scale: s, crown: new THREE.Matrix4().compose(new THREE.Vector3(site.x, site.height, site.z), rotation, new THREE.Vector3(s, s, s)),
        stem: new THREE.Matrix4().compose(new THREE.Vector3(site.x, 0, site.z), rotation, new THREE.Vector3(s, site.height - stemTop * s, s)),
        opal: new THREE.Matrix4().compose(new THREE.Vector3(site.x, site.height + opalLift * s, site.z), rotation, new THREE.Vector3(s, s * opalHeight, s)) });
    };
    sites.forEach((site, i) => {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2); place(site, .4, .5, .72);
      addGlow(this.root, new THREE.Vector3(site.x, site.height + .5 * site.scale, site.z), '#adf5d8', 5 * site.scale, 12, 7, .52).userData.surfaceOffset = 1.02 * site.scale;
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height / 2, GARDENS.z + site.z], size: [.38 * site.scale, site.height / 2, .38 * site.scale] });
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height + .15 * site.scale, GARDENS.z + site.z], size: [site.scale * MYCELIUM_RADIUS, .75 * site.scale, site.scale * MYCELIUM_RADIUS] });
      if (i % 2 === 0) this.drainage.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(site.x + .6 * site.scale, site.height + .65 * site.scale, site.z), new THREE.Vector3(site.x + 2.15 * site.scale, site.height + .35 * site.scale, site.z),
        new THREE.Vector3(site.x + 2.4 * site.scale, site.height - .15 * site.scale, site.z), new THREE.Vector3(site.x + 2.4 * site.scale, .12, site.z),
      ]));
    });
    const shrubs: { x: number; z: number; scale: number; height: number }[] = [], bush = random(9021);
    for (let i = 0; i < 1400 && shrubs.length < (this.mobile ? 18 : 34); i++) {
      const x = 54 + bush() * 48, z = -31 + bush() * 60, scale = .28 + bush() * .2, height = .98 + bush() * .42;
      if (!rainPlantAllowed(x, z, scale * MYCELIUM_RADIUS) || [...sites, ...shrubs].some(p => Math.hypot(x - p.x, z - p.z) < (p.scale + scale) * MYCELIUM_RADIUS + .28)) continue;
      shrubs.push({ x, z, scale, height });
    }
    shrubs.forEach((site) => {
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bush() * Math.PI * 2); place(site, .12, .12, .7);
      addGlow(this.root, new THREE.Vector3(site.x, site.height + .12 * site.scale, site.z), '#b8e7dc', 4 * site.scale, 0, 4, .42).userData.surfaceOffset = 1.02 * site.scale;
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height / 2, GARDENS.z + site.z], size: [.28 * site.scale, site.height / 2, .28 * site.scale] });
      this.colliders.push({ type: 'box', position: [GARDENS.x + site.x, site.height + .08 * site.scale, GARDENS.z + site.z], size: [site.scale * MYCELIUM_RADIUS, .42 * site.scale, site.scale * MYCELIUM_RADIUS] });
    });
    this.grove = new MyceliumGrove(this.root, instances, silver, opal, this.mobile);
    this.ring.material = silver;
  }
  /**
   * Loads the ring (public/models/jewelry/mycelium.glb, one draw, named for the grove's frame-budget group). Its net hangs
   * open side down over the orb, as the opal sits in the ring; no collider, since it floats out of reach.
   */
  async presentMyceliumRing(): Promise<void> {
    if (MODELS_OFF) return;
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), gltf = await new GLTFLoader().loadAsync(modelURL('mycelium'));
      const source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | undefined; (source?.material as THREE.Material | undefined)?.dispose(); if (!source) return;
      const geometry = source.geometry; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      this.ringBase = RING_ORB_TOP + RING_GAP - geometry.boundingBox!.min.y * RING_SCALE; this.ring.scale.setScalar(RING_SCALE);
      Object.assign(this.ring, { geometry, name: 'Mycelium ring', castShadow: true }); this.ring.userData.keepGeometry = true;
      this.ring.position.set(OPAL_BASIN.x, this.ringBase, OPAL_BASIN.z); this.root.add(this.ring);
    } catch { /* The grove stands without it. */ }
  }
  /** A slow turn and sway on the wind clock: still under reduced motion, frozen by ?capture=1. */
  turnRing(): void { if (!this.ring.parent) return; const t = windTime.value as number; this.ring.rotation.y = t * .12; this.ring.position.y = this.ringBase + .08 * Math.sin(t * .5); }
  /** Gives every grove crown its detail level from the camera, within the forest's fog-limited `range`; see MyceliumGrove. */
  updateDetail(camera: THREE.Camera, range: number, mapView: boolean): boolean {
    return this.grove.update(camera, range, mapView, GROVE_PIN === 'full' || GROVE_PIN === 'light' ? GROVE_PIN : null);
  }
  warmUp(on: boolean): void { this.grove.warmUp(on); }
  addInterpretation(id: string, eyebrow: string, title: string, body: string): void {
    const sign = this.signs.get(id); if (sign) paintPlaceSign(sign, { eyebrow, title, body, footer: 'Click, or E / tap, for the story and sources' });
  }
  presentLakeJewelry(): void {
    const caption = (id: string, title: string, body: string): void => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 540; const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 1024, 540);
      ctx.fillStyle = '#25473b'; ctx.font = '48px Georgia'; ctx.fillText(title, 40, 70);
      ctx.fillStyle = '#445c4b'; paintPosterText(ctx, body, 40, 110, 940, 340, 44);
      ctx.fillStyle = '#25473b'; ctx.font = '26px sans-serif'; ctx.fillText('Click / E · story and livia.glucosedao.org/pieces', 40, 500);
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      // Both faces share one caption material.
      const panel = this.panels.find(p => p.userData.discovery === id && p.userData.kind === 'caption'); if (!panel) { map.dispose(); return; }
      const material = panel.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
    };
    caption('living-vittoria', 'Vittoria Amazonica', 'Silver and aquamarine, 2022. Survival, Romanian Jewelry Week 2023. The lake reads its lily-pad form. Dewdrop, a separate topaz ring, stands by the pavilion.');
    caption('living-dewdrop', 'Dewdrop Ring', 'Adjustable silver around treated Swiss blue topaz. A faceted droplet in an open embrace. Vittoria Amazonica, the aquamarine pendant, has its own stand on the lake.');
    const faces = (id: string): THREE.Mesh[] => this.panels.filter(p => p.userData.discovery === id && p.userData.kind === 'photo');
    const fit = (meshes: THREE.Mesh[], map: THREE.Texture): void => {
      const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, 2.52, 1.32), geometry = new THREE.PlaneGeometry(size.width, size.height);
      meshes[0]?.geometry.dispose(); for (const mesh of meshes) mesh.geometry = geometry;
    };
    const dewdrop = faces('living-dewdrop');
    if (dewdrop.length) new THREE.TextureLoader().load(photoURL('dewdrop-ring-stand.webp'), (map) => {
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; fit(dewdrop, map);
      const material = dewdrop[0].material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
    });
    const vittoria = COLLECTION.find(p => p.discovery === 'vittoria-amazonica'), photos = faces('living-vittoria');
    if (vittoria && photos.length) {
      new THREE.TextureLoader().load(photoURL(vittoria.photos[0].thumb ?? vittoria.photos[0].file), (map) => {
        map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; fit(photos, map);
        // The catalogue thumbnail's sweep is baked to paper: key it to the exact paper, the jewel in its own colours.
        (photos[0].material as THREE.Material).dispose(); const material = paperPhotoMaterial(map); for (const photo of photos) photo.material = material;
      });
    }
  }
  update(time: number, dt: number, reducedMotion: boolean): void {
    if (reducedMotion) return; this.waterTime.value = time;
    const p = this.rain.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, (p.getY(i) - dt * 3.8 + 9) % 9); p.needsUpdate = true;
    const drops = this.drips.geometry.getAttribute('position');
    for (let i = 0; i < drops.count; i++) { const route = this.drainage[i % this.drainage.length], point = route.getPoint((time * .16 + Math.floor(i / this.drainage.length) / 6) % 1); drops.setXYZ(i, point.x, point.y + .1, point.z); } drops.needsUpdate = true;
  }
  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.root.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); } } });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
  }
}
