import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { attribute, cameraPosition, cameraViewMatrix, diffuseColor, float, fwidth, mix, normalize, positionGeometry, positionLocal, vec2, vec3, vec4 } from 'three/tsl';
import { BUDGET_OFF } from '../game/render-budget';
import { WIND_ROOT, addWindRoots, treeSway, windRoots } from './wind';
import { TREE_SPECIES, treeSpecies } from './forest-layout';
import type { TreeSite } from './forest-layout';

const NEAR = 36;
/**
 * Beyond this distance to its nearest tree a cell draws each tree as one camera-facing card of its baked side view (impostors,
 * gpu): only the summit view's longer fog (main.ts) reaches it, where whole trees more than doubled the forest's triangles and
 * their sub-pixel leaf cards thinned to speckles in the haze.
 */
const CROWN = 160;
/** Layer of the shadow-only tree meshes; the sun's shadow camera renders it (main.ts), the view cameras do not. */
export const SHADOW_LAYER = 1;
/** Per-tree culling is re-evaluated after the camera moves this far, against a reach grown by the same margin. */
const REACH_STEP = 2;

/**
 * A cell's foliage detail from its centre distance, or hidden once even its nearest tree surface (`nearest`, the distance to its
 * bounding sphere) lies at or beyond `reach`: the tree reach (TREE_REACH of the full-fog distance), where the haze has faded
 * most of a tree into what lies behind it (render/aerial.ts).
 */
export function forestLod(distance: number, nearest: number, reach: number): 'full' | 'reduced' | 'crown' | 'hidden' {
  if (nearest >= reach) return 'hidden';
  return distance < NEAR ? 'full' : nearest >= CROWN ? 'crown' : 'reduced';
}

function thinFoliage(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = geo.clone();
  if (!copy.index) return copy;
  const index = Array.from(copy.index.array), reduced: number[] = [];
  for (let i = 0; i < index.length; i += 12) reduced.push(...index.slice(i, i + 6));
  copy.setIndex(reduced); return copy;
}

/** Foliage half-extent of each species' model at scale 1, from its GLB bounds (forest-layout.ts TREE_SPECIES, treeSpecies). */
export const TREE_CANOPY: readonly number[] = TREE_SPECIES.map(species => species.canopy);
/** Per-tree size shared by the instances, their contact shadows and the baked ground shade. */
export function treeScale(index: number): number { return .66 + ((index * 317) % 100) / 100 * .48; }
export interface ForestCell { species: number; sites: { p: THREE.Vector3; index: number }[] }
/** Each species' trees on a 48 m grid, species by species, then in grid order. Contact shadows plan the same cells, so a decal
 *  hides with its tree when onCells reports the cell. */
export function forestCells(sites: readonly TreeSite[]): ForestCell[] {
  const cells: ForestCell[] = [];
  for (let species = 0; species < TREE_SPECIES.length; species++) {
    const grouped = new Map<string, { p: THREE.Vector3; index: number }[]>();
    sites.forEach((p, index) => {
      if (treeSpecies(p, index) !== species) return;
      const key = Math.floor(p.x / 48) + ':' + Math.floor(p.z / 48);
      const cell = grouped.get(key) ?? []; cell.push({ p, index }); grouped.set(key, cell);
    });
    for (const members of grouped.values()) cells.push({ species, sites: members });
  }
  return cells;
}

/**
 * Branches without their twigs: tube pieces whose extent is under `size` metres, mostly hidden by foliage and under a pixel
 * wide beyond NEAR. The trunk and limbs keep every triangle, so the silhouette and its shadow stay.
 */
export function dropTwigs(geo: THREE.BufferGeometry, size = 2): THREE.BufferGeometry {
  const copy = geo.clone(), index = copy.index, position = copy.getAttribute('position');
  if (!index) return copy;
  const parent = Int32Array.from({ length: position.count }, (_, i) => i), find = (a: number): number => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  // Tube seams repeat positions, so weld before joining triangles into pieces.
  const welded = new Map<string, number>();
  for (let i = 0; i < position.count; i++) { const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`, j = welded.get(key); if (j === undefined) welded.set(key, i); else parent[find(i)] = find(j); }
  for (let i = 0; i < index.count; i += 3) { const a = find(index.getX(i)); parent[find(index.getX(i + 1))] = a; parent[find(index.getX(i + 2))] = a; }
  const boxes = new Map<number, THREE.Box3>(), point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) { const root = find(i), box = boxes.get(root) ?? new THREE.Box3(); box.expandByPoint(point.fromBufferAttribute(position, i)); boxes.set(root, box); }
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) if (boxes.get(find(index.getX(i)))!.getSize(point).length() >= size) kept.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  copy.setIndex(kept); return copy;
}

/**
 * Read at load. `twigless`: distant views drop the twigs; ?budget=off (and the budget script's comparison) keep them.
 * `coverage`: leaf cards use alpha-to-coverage; main.ts turns it on where the renderer multisamples (fine pointers).
 */
export const FOREST_DETAIL = { twigless: !BUDGET_OFF, coverage: false };

/**
 * A tree part's material, swaying in the wind (wind.ts): a node copy of the GLB's material, as three's own conversion makes
 * it, with the sway as its position. Shadow casters keep the rest pose: the sun's shadow map is baked once and refreshed only
 * when visibility changes, so a swaying caster would freeze a random wind pose into it and jump at every re-bake. The wind
 * blows almost square to the sun's azimuth, so the moving cards hardly change depth against that rest-pose map. `far`: the
 * crown's lean only, for the reduced detail (wind.ts treeSway).
 */
export function swayingTreeMaterial(source: THREE.MeshStandardMaterial, foliage: boolean, coverage = FOREST_DETAIL.coverage, far = false, height = 12): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();
  for (const key in source) (material as unknown as Record<string, unknown>)[key] = (source as unknown as Record<string, unknown>)[key];
  material.positionNode = treeSway(height, foliage, far); material.castShadowPositionNode = positionLocal;
  // With MSAA the cards' cut-out edges cover a share of the samples instead of stepping at the .45 cutoff; the shadow pass
  // keeps the plain alpha test (three copies alphaTest, not alphaToCoverage, to its shadow material). three ramps coverage
  // over the pixel above the cutoff, which thinned every crown; centring the ramp on the cutoff keeps the alpha test's density.
  if (foliage && coverage && source.alphaTest > 0) { material.alphaToCoverage = true; material.alphaTestNode = float(source.alphaTest).sub(fwidth(diffuseColor.a).mul(.5)); }
  return material;
}
/** The impostor atlas (scripts/build-tree-impostors.ts): one square cell per species of `size` metres, base at its lower middle. */
interface ImpostorAtlas { texture: THREE.Texture; cell: number; cells: { name: string; size: number }[] }
/**
 * A far tree's card: the baked side view on a quad that turns about the trunk to face the camera (positionNode, from the tree's
 * windRoot: base and scale), shaded as a rounded crown (a normal bent across the card and toward its top) so the sun lights one
 * flank, darker toward the foot. Haze, sun and sky come as for any lit surface.
 */
function impostorMaterial(atlas: ImpostorAtlas, size: number, coverage: boolean): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ map: atlas.texture, alphaTest: .4, roughness: .95, metalness: 0 });
  const root = attribute<'vec4'>(WIND_ROOT, 'vec4'), look = cameraPosition.sub(root.xyz), flat = normalize(vec2(look.x, look.z)), right = vec3(flat.y, 0, flat.x.negate());
  material.positionNode = root.xyz.add(right.mul(positionGeometry.x.mul(root.w))).add(vec3(0, positionGeometry.y.mul(root.w), 0));
  const u = positionGeometry.x.div(size).mul(2), v = positionGeometry.y.div(size);
  const normal = normalize(vec3(flat.x, 0, flat.y).mul(.75).add(right.mul(u.mul(.65))).add(vec3(0, v.mul(.7).sub(.1), 0)));
  material.normalNode = normalize(cameraViewMatrix.mul(vec4(normal, 0)).xyz); material.aoNode = mix(float(.55), float(1), v);
  if (coverage) { material.alphaToCoverage = true; material.alphaTestNode = float(.4).sub(fwidth(diffuseColor.a).mul(.5)); }
  return material;
}
/** The atlas and its cell sizes, in TREE_SPECIES order. */
async function loadImpostors(base: string): Promise<ImpostorAtlas> {
  const [texture, layout] = await Promise.all([new THREE.TextureLoader().loadAsync(base + 'impostors.webp'), fetch(base + 'impostors.json').then(response => response.json() as Promise<{ cell: number; cells: { name: string; size: number }[] }>)]);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { texture, cell: layout.cell, cells: TREE_SPECIES.map(species => layout.cells.find(cell => cell.name === species.name)!) };
}
/** Foliage parts are named foliage in the GLBs (a suffix where one file holds several species). */
const foliage = (mesh: THREE.Object3D): boolean => mesh.name.startsWith('foliage');
/** Grove tint per species: hue and its spread across groves, foliage saturation and lightness (multiplying the leaf texture). */
const TINTS: readonly { hue: number; spread: number; saturation: number; light: number }[] = [
  { hue: .19, spread: .055, saturation: .18, light: .67 }, { hue: .19, spread: .055, saturation: .18, light: .67 },
  { hue: .28, spread: .03, saturation: .1, light: .7 }, { hue: .22, spread: .04, saturation: .16, light: .74 }, { hue: .27, spread: .03, saturation: .1, light: .7 },
];
/** One species' card: `size` square, its base on the ground at the trunk, uv on the species' atlas cell. */
function impostorGeometry(atlas: ImpostorAtlas, species: number): THREE.BufferGeometry {
  const size = atlas.cells[species].size, count = atlas.cells.length, geometry = new THREE.PlaneGeometry(size, size).translate(0, size / 2, 0), uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, (species + uv.getX(i)) / count);
  return geometry;
}
/** The same vertices and index under a geometry of its own, so a second view mesh can carry its own per-instance windRoot. */
function twin(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = new THREE.BufferGeometry(); copy.setIndex(geometry.index);
  for (const [name, attribute] of Object.entries(geometry.attributes)) copy.setAttribute(name, attribute);
  copy.boundingSphere = geometry.boundingSphere; return copy;
}

/**
 * A cell's trees: a slice of its species' instance arrays, and a sphere that bounds them all. A cell that straddles the reach
 * draws only the trees inside it (`inside`, a flag per tree).
 */
interface Cell { species: number; center: THREE.Vector3; first: number; count: number; sphere: THREE.Sphere; state: number; seen: boolean; lit: boolean; partial: boolean; inside: Uint8Array }
/**
 * One model part of one species in one detail, drawn by a view mesh and, with shadows, a shadow-only mesh; `casts` picks the
 * shadow mesh's cells when they differ from the view's.
 */
interface Part { species: number; view: THREE.InstancedMesh; shadow: THREE.InstancedMesh | null; colors: Float32Array; shows: (state: number) => boolean; casts?: (state: number) => boolean }
// A view mesh's windRoot attribute sits on its geometry; shadow meshes share that geometry but draw the rest pose and never read it.
// Cell states: hidden, trunks only (map), trunks with reduced foliage, trunks with full foliage, impostor cards alone (CROWN).
const HIDDEN = 0, TRUNKS = 1, REDUCED = 2, FULL = 3, CROWNS = 4;
const frustum = new THREE.Frustum(), viewProjection = new THREE.Matrix4();

/**
 * Tree models instanced on a 48 m grid of cells. On WebGPU every instanced mesh costs its own shader build, so each species,
 * part and foliage detail is one shared mesh, refilled from the cells that show it: the view meshes from cells in the camera
 * frustum, the shadow-only meshes from cells in the sun's shadow frustum, as per-cell culling did in each pass.
 */
export class Forest extends THREE.Group {
  sites: THREE.Vector3[] = [];
  /** Called with each cell's trunk visibility, in forestCells order, whenever any of them changes. */
  onCells: ((shown: readonly boolean[]) => void) | null = null;
  /** Which cells show their trunks now, as onCells last reported them. */
  trunks(): boolean[] { return this.cells.map((cell) => cell.state >= TRUNKS); }
  private cells: Cell[] = [];
  private parts: Part[] = [];
  private matrices: Float32Array[] = [];
  /** Each tree's bounding sphere per species, packed as x, y, z, radius. */
  private spheres: Float32Array[] = [];
  private readonly reachFrom = new THREE.Vector3(Infinity, 0, 0);
  private reach = Infinity;
  private roots: Float32Array[] = [];
  private warm = false;
  /**
   * `wind`: the trees sway (gpu and mobile; the cpu tier keeps the GLB materials and geometry untouched). `impostors`: cells past
   * CROWN draw baked cards (gpu, where the summit view reaches them).
   */
  async load(mobile: boolean, shadows = true, wind = false, impostors = false): Promise<void> {
    const loader = new GLTFLoader(), base = import.meta.env.BASE_URL + 'models/trees/', files = [...new Set(TREE_SPECIES.map(species => species.file))];
    const [models, atlas] = await Promise.all([
      Promise.all(files.map(file => loader.loadAsync(base + file + '.glb'))).then(loaded => new Map(files.map((file, i) => [file, loaded[i].scene]))),
      impostors ? loadImpostors(base) : null,
    ]);
    const planned = forestCells(this.sites);
    for (let species = 0; species < TREE_SPECIES.length; species++) {
      const { name, file } = TREE_SPECIES[species], scene = models.get(file)!, model = file === name ? scene : scene.getObjectByName(name)!;
      const parts: THREE.Mesh[] = []; scene.updateMatrixWorld(true);
      model.traverse((o) => { if (o instanceof THREE.Mesh) parts.push(o); });
      const sites = planned.filter((cell) => cell.species === species).map((cell) => cell.sites), total = sites.reduce((sum, cell) => sum + cell.length, 0);
      if (!total) continue;
      const geometries = parts.map((source) => source.geometry.clone().applyMatrix4(source.matrixWorld));
      const bounds = geometries.reduce((sphere, geo) => { geo.computeBoundingSphere(); return sphere.radius < 0 ? sphere.copy(geo.boundingSphere!) : sphere.union(geo.boundingSphere!); }, new THREE.Sphere(new THREE.Vector3(), -1));
      const matrices = new Float32Array(total * 16), spheres = new Float32Array(total * 4), tints = parts.map(() => new Float32Array(total * 3));
      const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), color = new THREE.Color(), scaled = new THREE.Sphere();
      let next = 0;
      for (const cellSites of sites) {
        const center = new THREE.Vector3();
        for (const { p } of cellSites) center.add(p);
        const cell: Cell = { species, center: center.multiplyScalar(1 / cellSites.length), first: next, count: cellSites.length, sphere: new THREE.Sphere(new THREE.Vector3(), -1), state: -1, seen: false, lit: false, partial: false, inside: new Uint8Array(cellSites.length) };
        for (const { p, index } of cellSites) {
          const scale = treeScale(index);
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 2.399);
          matrix.compose(p, quaternion, new THREE.Vector3(scale, scale * (1 + (index % 3) * .035), scale)); matrix.toArray(matrices, next * 16);
          scaled.copy(bounds).applyMatrix4(matrix); if (cell.sphere.radius < 0) cell.sphere.copy(scaled); else cell.sphere.union(scaled);
          scaled.center.toArray(spheres, next * 4); spheres[next * 4 + 3] = scaled.radius;
          // Spatial colour families read as woodland groves rather than alternating identical trees; conifers stay cooler.
          const grove = .5 + .5 * Math.sin(p.x * .038 + Math.sin(p.z * .047) * 2), tint = TINTS[species];
          parts.forEach((source, i) => { color.setHSL(tint.hue + grove * tint.spread, foliage(source) ? tint.saturation + grove * .12 : .04, tint.light + grove * .13 + (index % 3) * .025); color.toArray(tints[i], next * 3); });
          next++;
        }
        this.cells.push(cell);
      }
      this.matrices[species] = matrices; this.spheres[species] = spheres; if (wind || atlas) this.roots[species] = windRoots(matrices);
      const height = geometries.reduce((top, geo) => { geo.computeBoundingBox(); return Math.max(top, geo.boundingBox!.max.y); }, 0);
      parts.forEach((source, i) => {
        const original = source.material as THREE.MeshStandardMaterial;
        original.envMapIntensity = .35;
        if (original.map) original.map.anisotropy = 4;
        const leafy = foliage(source), reduced = leafy ? thinFoliage(geometries[i]) : null;
        // Each detail is its own instanced mesh and shader build anyway; the distant one sways more cheaply.
        const material = wind ? swayingTreeMaterial(original, leafy, FOREST_DETAIL.coverage, false, height) : original, far = wind ? swayingTreeMaterial(original, leafy, FOREST_DETAIL.coverage, true, height) : original;
        // Mobile always draws the thinned foliage; desktop thins it beyond NEAR metres. Distant views drop the twigs (sub-plan 25)
        // through one extra view-only mesh; the map's bare trunks and every shadow keep them.
        const twigless = !leafy && FOREST_DETAIL.twigless;
        const details: [THREE.BufferGeometry, THREE.Material, (state: number) => boolean, boolean, ((state: number) => boolean)?][] = !leafy
          ? twigless ? [[geometries[i], material, (state) => state === FULL || state === TRUNKS, true, (state) => state >= TRUNKS], [dropTwigs(geometries[i]), far, (state) => state === REDUCED, false]] : [[geometries[i], material, (state) => state >= TRUNKS, true]]
          : [[mobile ? reduced! : geometries[i], material, (state) => state === FULL, true], [mobile && wind ? twin(reduced!) : reduced!, far, (state) => state === REDUCED || (!atlas && state === CROWNS), true]];
        for (const [geometry, look, shows, casts, castShows] of details) {
          if (wind) addWindRoots(geometry, total);
          const instanced = (castShadow: boolean): THREE.InstancedMesh => {
            const mesh = new THREE.InstancedMesh(geometry, look, total);
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
            mesh.count = 0; mesh.visible = false; mesh.castShadow = castShadow; mesh.receiveShadow = !castShadow; mesh.name = source.name; this.add(mesh);
            if (castShadow) mesh.layers.set(SHADOW_LAYER);
            return mesh;
          };
          this.parts.push({ species, view: instanced(false), shadow: shadows && casts ? instanced(true) : null, colors: tints[i], shows, casts: castShows });
        }
      });
      if (atlas) {
        // Far cells' cards take the foliage's grove tint, so a crown keeps its colour as it turns into a card.
        const geometry = impostorGeometry(atlas, species); addWindRoots(geometry, total);
        const view = new THREE.InstancedMesh(geometry, impostorMaterial(atlas, atlas.cells[species].size, FOREST_DETAIL.coverage), total);
        view.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3); view.count = 0; view.visible = false; view.name = name + ' impostors'; this.add(view);
        this.parts.push({ species, view, shadow: null, colors: tints[Math.max(0, parts.findIndex(foliage))], shows: (state) => state === CROWNS });
      }
    }
  }
  /**
   * Returns whether near foliage switched detail; the far hide/show happens beyond any walking shadow box and is not reported.
   * `reach` is the tree reach (on gpu and mobile TREE_REACH of the full-fog distance, which a high viewpoint may lengthen each
   * frame): trees are drawn while any part of them is nearer. `shadow` is the sun's shadow, whose frustum picks the shadow casters.
   */
  update(camera: THREE.Camera, reach: number, mapView: boolean, shadow?: THREE.LightShadow): boolean {
    if (this.warm) return false;
    camera.updateMatrixWorld(); frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const origin = camera.position, sun = shadow?.getFrustum(); let casters = false, trunks = false, changed = 0;
    // The tree selection is redone once the camera's travel and the reach's own change add up to REACH_STEP metres, against a
    // reach grown by REACH_STEP, so it covers every camera position and reach until the next pass; a tree may appear up to that
    // much early, deep in the haze. A reach that creeps each frame (a longer view on high ground) thus reselects every few metres.
    const moved = mapView || origin.distanceTo(this.reachFrom) + Math.abs(reach - this.reach) >= REACH_STEP;
    if (moved) { this.reachFrom.copy(origin); this.reach = reach; }
    const from = this.reachFrom, grown = this.reach + REACH_STEP;
    for (const cell of this.cells) {
      const centre = from.distanceTo(cell.sphere.center), lod = forestLod(origin.distanceTo(cell.center), centre - cell.sphere.radius, grown);
      const state = mapView ? TRUNKS : lod === 'hidden' ? HIDDEN : lod === 'full' ? FULL : lod === 'crown' ? CROWNS : REDUCED, previous = cell.state;
      const seen = state !== HIDDEN && frustum.intersectsSphere(cell.sphere), lit = state !== HIDDEN && !!sun?.intersectsSphere(cell.sphere);
      const partial = !mapView && state !== HIDDEN && centre + cell.sphere.radius >= grown, reselected = partial && moved && this.select(cell, grown);
      if (state === previous && seen === cell.seen && lit === cell.lit && partial === cell.partial && !reselected) continue;
      if (previous !== -1 && state !== previous && (state === FULL) !== (previous === FULL)) casters = true;
      if ((state >= TRUNKS) !== (previous >= TRUNKS)) trunks = true;
      // Casters entering the shadow frustum come with a moved shadow box, which re-bakes anyway.
      cell.state = state; cell.seen = seen; cell.lit = lit; cell.partial = partial; changed |= 1 << cell.species;
    }
    for (let species = 0; species < this.matrices.length; species++) if (changed & (1 << species)) this.refill(species);
    if (trunks) this.onCells?.(this.cells.map((cell) => cell.state >= TRUNKS));
    return casters;
  }
  /**
   * A reflection probe (probes.ts) looks every way at once: each cell takes the detail its distance from `origin` gives,
   * unculled and whole (a cell straddling `reach` keeps its outer trees, which the haze turns to sky). The next update()
   * restores the view's own cells.
   */
  surround(origin: THREE.Vector3, reach: number): void {
    for (const cell of this.cells) {
      const lod = forestLod(origin.distanceTo(cell.center), origin.distanceTo(cell.sphere.center) - cell.sphere.radius, reach);
      cell.state = lod === 'hidden' ? HIDDEN : lod === 'full' ? FULL : lod === 'crown' ? CROWNS : REDUCED; cell.seen = cell.state !== HIDDEN; cell.partial = false;
    }
    for (let species = 0; species < this.matrices.length; species++) this.refill(species);
  }
  /**
   * Before the first frame, draw every tree in every mesh with culling off, so the precompile and first shadow pass build
   * each shader now rather than when a cell first comes into view. update() restores the cells afterwards.
   */
  warmUp(on: boolean): void {
    this.warm = on;
    for (const { view, shadow } of this.parts) { view.frustumCulled = !on; if (shadow) shadow.frustumCulled = !on; }
    if (on) for (let species = 0; species < this.matrices.length; species++) this.refill(species, true);
    else { for (const cell of this.cells) cell.state = -1; this.reach = Infinity; }
  }
  /** Flag the straddling cell's trees that reach inside `reach` of the selection point; returns whether any flag changed. */
  private select(cell: Cell, reach: number): boolean {
    const spheres = this.spheres[cell.species], from = this.reachFrom; let changed = false;
    for (let i = 0; i < cell.count; i++) {
      const at = (cell.first + i) * 4, inside = Math.hypot(spheres[at] - from.x, spheres[at + 1] - from.y, spheres[at + 2] - from.z) - spheres[at + 3] < reach ? 1 : 0;
      if (cell.inside[i] !== inside) { cell.inside[i] = inside; changed = true; }
    }
    return changed;
  }
  private refill(species: number, everything = false): void {
    for (const part of this.parts) {
      if (part.species !== species) continue;
      this.fill(part, part.view, (cell) => everything || (cell.seen && part.shows(cell.state)));
      if (part.shadow) this.fill(part, part.shadow, (cell) => everything || (cell.lit && (part.casts ?? part.shows)(cell.state)));
    }
  }
  private fill(part: Part, mesh: THREE.InstancedMesh, include: (cell: Cell) => boolean): void {
    const matrices = this.matrices[part.species], target = mesh.instanceMatrix.array as Float32Array, colors = mesh.instanceColor!.array as Float32Array, sphere = new THREE.Sphere(new THREE.Vector3(), -1);
    const roots = mesh === part.view ? mesh.geometry.getAttribute(WIND_ROOT) as THREE.InstancedBufferAttribute | undefined : undefined, source = this.roots[part.species];
    let count = 0;
    for (const cell of this.cells) {
      if (cell.species !== part.species || !include(cell)) continue;
      if (cell.partial && !this.warm) {
        for (let i = 0; i < cell.count; i++) if (cell.inside[i]) {
          target.set(matrices.subarray((cell.first + i) * 16, (cell.first + i + 1) * 16), count * 16);
          colors.set(part.colors.subarray((cell.first + i) * 3, (cell.first + i + 1) * 3), count * 3);
          if (roots) (roots.array as Float32Array).set(source.subarray((cell.first + i) * 4, (cell.first + i + 1) * 4), count * 4);
          count++;
        }
      } else {
        target.set(matrices.subarray(cell.first * 16, (cell.first + cell.count) * 16), count * 16);
        colors.set(part.colors.subarray(cell.first * 3, (cell.first + cell.count) * 3), count * 3);
        if (roots) (roots.array as Float32Array).set(source.subarray(cell.first * 4, (cell.first + cell.count) * 4), count * 4);
        count += cell.count;
      }
      if (sphere.radius < 0) sphere.copy(cell.sphere); else sphere.union(cell.sphere);
    }
    if (roots) { roots.clearUpdateRanges(); roots.addUpdateRange(0, count * 4); roots.needsUpdate = true; }
    mesh.count = count; mesh.visible = count > 0; mesh.boundingSphere = count > 0 ? sphere : null;
    mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.clearUpdateRanges(); mesh.instanceColor!.addUpdateRange(0, count * 3); mesh.instanceColor!.needsUpdate = true;
  }
}
