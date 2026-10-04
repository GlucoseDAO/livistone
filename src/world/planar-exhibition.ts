import { paintPosterText } from './poster-text';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { displayMaterial, paperPhotoMaterial } from '../render/output';
import { COLLECTION, EXHIBITS, photoURL, photoSize } from '../game/exhibits';
import type { Exhibit } from '../game/exhibits';
import type { ColliderSpec } from '../game/physics';
import type { GraphicsTier } from '../game/graphics';
import type { Interactive } from './world';
import { POSTER_BOARD, posterBoard, posterLayout } from './poster-layout';
import { activeSurfaces } from './surfaces';
import { mergeStatic } from './static-batch';
import { featuredPiece, modelURL, townHour, FEATURED_CANDIDATES } from '../game/featured';
import { windTime } from './wind';

/**
 * Texture residency (realism sub-plan 12). Every poster keeps a small copy of its photograph and caption for distant views;
 * the full ones exist only for the collections the visitor is in or approaching (PosterResidency). Captions are 640 px wide
 * where memory is tight; anisotropy follows the tier.
 */
const CAPTION_WIDTH: Record<GraphicsTier, number> = { gpu: 960, mobile: 640, cpu: 640 }, ANISOTROPY: Record<GraphicsTier, number> = { gpu: 8, mobile: 4, cpu: 1 };
const DISTANT = { caption: 128, photo: 96 };
/** A collection is approached within this horizontal distance of its posters' centre; two stay resident (least recently approached leaves). */
export const POSTER_RANGE = 40, RESIDENT_COLLECTIONS = 2;
/** Dev-only `?posters=all`: every collection resident from the first walking frame, the memory profile before sub-plan 12, for review. */
const ALL_RESIDENT = !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('posters') === 'all';
/** Dev-only `?featured=<piece>` hovers that piece in its building (`off`: none, for before/after reviews); `?capture=1` pins hour 0 so captures repeat. */
const DEV_PARAMS = import.meta.env?.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const PINNED = DEV_PARAMS?.get('featured') ?? null, CAPTURE = !!DEV_PARAMS?.has('capture');
/**
 * The hovering model's lowest point stands this far above its poster's board; `inward` moves it toward the room where the
 * wall curves in above the posters (Energy's fins, the Future House cabin roof), `scale` shrinks it where headroom is short.
 */
const HOVER = { gap: .45, bob: .05, spin: .25, scale: 1.35 }, HOVER_SITE: Record<string, { inward?: number; scale?: number; gap?: number }> = { energy: { inward: 1 }, station: { scale: 1, gap: .2 }, 'future-house': { inward: .6, scale: .85 } };
let featuredSilver: THREE.MeshStandardMaterial | null = null;

function textLines(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string): number {
  ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; let line = '';
  for (const word of text.split(' ')) { if (line && ctx.measureText(line + ' ' + word).width > 860) { ctx.fillText(line, 50, y); y += size * 1.32; line = word; } else line += (line ? ' ' : '') + word; }
  ctx.fillText(line, 50, y); return y + size * 1.6;
}
/**
 * A picture light's pool, baked in: the caption dims toward its lower corners by up to 7%, multiplied over paper and text alike.
 * Its top stays exact paper, where it meets the photograph's backing; the paper itself stays unlit, as by day so at night.
 */
function lightPool(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // A 16 × 16 grid of cell shades, smoothed by the upscale.
  const grid = document.createElement('canvas'), cells = 16; grid.width = grid.height = cells; const g = grid.getContext('2d')!;
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    const u = (i + .5) / cells * 2 - 1, v = (j + .5) / cells, shade = Math.round(255 * (1 - .07 * THREE.MathUtils.smoothstep(v, .15, 1) * (.7 + .3 * u * u)));
    g.fillStyle = `rgb(${shade},${shade},${shade})`; g.fillRect(i, j, 1, 1);
  }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true; ctx.drawImage(grid, 0, 0, width, height); ctx.restore();
}
/** The caption `pixels` wide: laid out in the 960-unit design space and painted through a scale, so every size wraps alike. */
function caption(piece: Exhibit, width: number, pixels: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'), scale = pixels / 960; canvas.width = pixels; canvas.height = Math.round(pixels * 1.4 / width);
  const ctx = canvas.getContext('2d')!, height = canvas.height / scale; ctx.scale(scale, scale);
  ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 960, height);
  let y = textLines(ctx, piece.title, 54, 40, '#25473b');
  y = textLines(ctx, `${piece.type} · ${piece.year}`, y + 4, 27, '#856c43');
  y = textLines(ctx, piece.materials, y, 25, '#445c4b');
  y = textLines(ctx, piece.dimensions, y, 24, '#445c4b');
  y = textLines(ctx, piece.collection ?? '', y + 8, 23, '#687461');
  ctx.fillStyle = '#445c4b'; paintPosterText(ctx, piece.story ?? piece.description, 50, y, 860, height - 108 - y, 40);
  textLines(ctx, 'Livia Zaharia · studio archive image', height - 67, 23, '#687461');
  textLines(ctx, 'Click photo to enlarge · E / tap for the story', height - 25, 23, '#25473b');
  lightPool(ctx, 960, height);
  return canvas;
}
/** The photograph shrunk to at most `pixels` on its long side, for distant views. */
function shrink(image: HTMLImageElement, pixels: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'), scale = Math.min(1, pixels / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas;
}
/** Every poster map shares one sampler setup, so swapping one for another never changes a material's shader. */
function prepare<T extends THREE.Texture>(map: T, tier: GraphicsTier): T { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = ANISOTROPY[tier]; return map; }
/** Bytes on the GPU, mip chain included. */
function textureBytes(map: THREE.Texture): number {
  const image = map.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | null;
  return Math.round((image?.naturalWidth ?? image?.width ?? 0) * (image?.naturalHeight ?? image?.height ?? 0) * 4 * (map.generateMipmaps ? 4 / 3 : 1));
}
/** The map a material shows until its distant copy is ready: one paper texel, so photographs build with a map from the start. */
let blank: THREE.CanvasTexture | null = null;
function blankPaper(): THREE.CanvasTexture {
  if (blank) return blank;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f4f0e5'; ctx.fillRect(0, 0, 1, 1);
  return blank = prepare(new THREE.CanvasTexture(canvas), 'gpu');
}
/** The thin brass rail around a poster's paper, bevelled on both edges and standing 3 cm proud of the board, front face +z. */
function rail(width: number, z: number): THREE.BufferGeometry {
  const board = posterBoard(width), bevel = .006, outer = new THREE.Shape(), hole = new THREE.Path();
  const ox = board.halfWidth - bevel, oy0 = POSTER_BOARD.bottom + bevel, oy1 = board.y + board.halfHeight - bevel;
  const ix = width / 2 - POSTER_BOARD.overlap, iy0 = POSTER_BOARD.paperBottom + POSTER_BOARD.overlap, iy1 = POSTER_BOARD.paperTop - POSTER_BOARD.overlap;
  outer.moveTo(-ox, oy0); outer.lineTo(ox, oy0); outer.lineTo(ox, oy1); outer.lineTo(-ox, oy1); outer.closePath();
  hole.moveTo(-ix, iy0); hole.lineTo(-ix, iy1); hole.lineTo(ix, iy1); hole.lineTo(ix, iy0); hole.closePath(); outer.holes.push(hole);
  const extruded = new THREE.ExtrudeGeometry(outer, { depth: .03 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  extruded.translate(0, 0, POSTER_BOARD.depth / 2 + bevel); if (z < 0) extruded.rotateY(Math.PI);
  // Indexed like the feet's boxes, so rails and feet merge into one brass draw per collection.
  const rails = mergeVertices(extruded); extruded.dispose(); rails.clearGroups(); return rails;
}
let boardMaterial: THREE.MeshStandardMaterial | null = null;

interface Poster { piece: Exhibit; group: THREE.Group; width: number; photo: THREE.MeshBasicNodeMaterial; caption: THREE.MeshBasicNodeMaterial; distant: { photo: THREE.Texture | null; caption: THREE.Texture }; full: THREE.Texture[] }

export class PlanarExhibition {
  readonly photos: THREE.Mesh[] = [];
  readonly textSurfaces: THREE.Mesh[] = [];
  /** Everything this exhibition added to its parent, and the parent-space centre of its posters (for distance hiding). */
  readonly objects: THREE.Object3D[] = [];
  readonly center = new THREE.Vector3();
  readonly ready: Promise<void>;
  readonly pieces: Exhibit[];
  selected: Exhibit;
  /** Whether the full photographs and captions are wanted (PosterResidency); `generation` retires loads that outlived it. */
  resident = false;
  private generation = 0;
  private readonly posters: Poster[] = [];
  private worldCenter: THREE.Vector3 | null = null;
  /** The poster piece shown as a hovering model this hour (src/game/featured.ts); one mesh, its geometry swapped hourly. */
  readonly featured: THREE.Mesh;
  featuredPiece: string | null = null;
  private featuredBase = 0;
  private featuredLoading: string | null = null;
  private featuredRetryAt = 0;
  constructor(readonly id: string, private readonly parent: THREE.Group, x: number, z: number, colliders: ColliderSpec[], interactives: Interactive[], private readonly tier: GraphicsTier = 'gpu') {
    this.pieces = COLLECTION.filter((piece) => piece.location === id);
    this.selected = this.pieces.find((piece) => piece.discovery === EXHIBITS.find((anchor) => anchor.landmark === id)?.discovery) ?? this.pieces[0];
    const layout = posterLayout(id, this.pieces.length), tasks: Promise<void>[] = [];
    // The paper stays unlit display paper; the board behind it and the brass rail and foot around it are lit, without the display mask.
    boardMaterial ??= new THREE.MeshStandardMaterial({ color: '#e6dfcc', roughness: .82 });
    const brass = activeSurfaces()?.stand ?? new THREE.MeshStandardMaterial({ color: '#c2aa77', roughness: .4, metalness: .5 });
    const width = id === 'science' ? 1.72 : 2, board = posterBoard(width), lit: THREE.Mesh[] = [];
    // Civic hall floors stand .16 above their group; colliders are in town space.
    const lift = (site: { y?: number }): number => (site.y === undefined && id !== 'station' ? .16 : 0);
    this.pieces.forEach((piece, i) => {
      const site = layout[i], floor = site.y ?? 0, group = new THREE.Group(); group.position.set(site.x, floor, site.z); group.rotation.y = site.yaw; parent.add(group); this.objects.push(group);
      this.center.addScaledVector(group.position, 1 / this.pieces.length);
      const back = new THREE.Mesh(new THREE.BoxGeometry(board.halfWidth * 2, board.halfHeight * 2, POSTER_BOARD.depth), boardMaterial!); back.position.y = board.y;
      const rails = (id === 'station' ? [1, -1] : [1]).map((side) => new THREE.Mesh(rail(width, side), brass)); group.add(back, ...rails); lit.push(back, ...rails);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(width * .7, .16, id === 'timeface' ? .2 : .48), brass); foot.position.y = .23; group.add(foot); lit.push(foot);
      if (id === 'timeface') { const bracket = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .55), brass); bracket.position.set(0, .23, .2); group.add(bracket); lit.push(bracket); }
      colliders.push({ type: 'box', position: [x + site.x, floor + board.y + lift(site), z + site.z], size: [board.halfWidth, board.halfHeight, .09], yaw: site.yaw });
      colliders.push({ type: 'box', position: [x + site.x, floor + .23 + lift(site), z + site.z], size: [width * .35, .08, id === 'timeface' ? .1 : .24], yaw: site.yaw });
      const distantCaption = prepare(new THREE.CanvasTexture(caption(piece, width, DISTANT.caption)), tier);
      const info = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.4), displayMaterial({ map: distantCaption })); info.position.set(0, 1.07, .051); info.userData.posterInfo = true; info.userData.piece = piece.discovery; group.add(info); this.textSurfaces.push(info);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(width, 1.45), displayMaterial({ color: '#f4f0e5' })); paper.position.set(0, 2.49, .051); group.add(paper);
      const picture = new THREE.Mesh(new THREE.PlaneGeometry(width - .06, 1.4), paperPhotoMaterial(blankPaper())); picture.position.set(0, 2.49, .057); picture.userData.piece = piece.discovery; picture.userData.photoIndex = 0; picture.userData.exhibition = id; group.add(picture); this.photos.push(picture);
      const backPicture = id === 'station' ? picture.clone() : undefined;
      if (backPicture) {
        for (const face of [info, paper, picture]) {
          const back = face === picture ? backPicture : face.clone(); back.position.z = -face.position.z; back.rotation.y = Math.PI; group.add(back);
          if (face === info) this.textSurfaces.push(back); if (face === picture) this.photos.push(back);
        }
      }
      const poster: Poster = { piece, group, width, photo: picture.material as THREE.MeshBasicNodeMaterial, caption: info.material as THREE.MeshBasicNodeMaterial, distant: { photo: null, caption: distantCaption }, full: [] };
      this.posters.push(poster);
      // The thumbnail sizes the photograph and leaves its distant copy; the full thumbnail returns only while resident.
      tasks.push(new THREE.ImageLoader().loadAsync(photoURL(piece.photos[0].thumb ?? piece.photos[0].file)).then((image) => {
        const size = photoSize(image.naturalWidth, image.naturalHeight, width - .06, 1.4);
        picture.geometry.dispose(); picture.geometry = new THREE.PlaneGeometry(size.width, size.height); if (backPicture) backPicture.geometry = picture.geometry;
        poster.distant.photo = prepare(new THREE.CanvasTexture(shrink(image, DISTANT.photo)), tier);
        if (!poster.full.some((map) => map === poster.photo.map)) poster.photo.map = poster.distant.photo;
      }).catch(() => { picture.visible = false; if (backPicture) backPicture.visible = false; }));
      interactives.push({ id: piece.discovery, object: info, position: new THREE.Vector3(x + site.x, floor + 1.75, z + site.z) });
    });
    // Boards share one lit material, rails and feet the brass, so each collection draws its stands twice; colliders came per poster above.
    this.objects.push(...mergeStatic(lit, `Poster frames · ${id}`, Infinity, parent));
    // One shared silver for every building, so changing the hour's piece swaps geometry only and builds no shader.
    featuredSilver ??= new THREE.MeshStandardMaterial({ color: '#e1e5df', metalness: .78, roughness: .29, userData: { heroEnv: true } });
    // Build the collection's silver shader and assign its probe before the GLB arrives.
    const placeholder = new THREE.BoxGeometry(.001, .001, .001); placeholder.deleteAttribute('uv');
    this.featured = new THREE.Mesh(placeholder, featuredSilver); this.featured.name = `Featured jewelry · ${id}`; this.featured.visible = false;
    parent.add(this.featured);
    // The 10k-triangle model is already the reduction; cpu-detail.ts must not simplify it again or batch it.
    Object.assign(this.featured.userData, { keepGeometry: true, photoIndex: 0, exhibition: id }); this.photos.push(this.featured);
    // Captures keep deterministic, complete models; ordinary visits request them on approach after startup.
    const first = this.featuredFor(CAPTURE ? 0 : townHour()); if (first && (CAPTURE || PINNED)) tasks.push(this.feature(first));
    this.ready = Promise.all(tasks).then(() => undefined);
  }
  /** The piece this collection hovers in `hour`, or the dev pin when it belongs here. */
  featuredFor(hour: number): string | null {
    if (PINNED === 'off') return null;
    if (PINNED && FEATURED_CANDIDATES[this.id as keyof typeof FEATURED_CANDIDATES]?.includes(PINNED)) return PINNED;
    const piece = featuredPiece(this.id, hour); return piece && this.posters.some((poster) => poster.piece.discovery === piece) ? piece : null;
  }
  /** Load `piece`'s model and hang it above its poster; a failed load leaves the poster alone. */
  private async feature(piece: string): Promise<void> {
    this.featuredLoading = piece;
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), gltf = await new GLTFLoader().loadAsync(modelURL(piece));
      const source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh | undefined, poster = this.posters.find((entry) => entry.piece.discovery === piece);
      (source?.material as THREE.Material | undefined)?.dispose(); if (!source || !poster || this.featuredLoading !== piece) return;
      const geometry = source.geometry; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const site = HOVER_SITE[this.id] ?? {}, scale = site.scale ?? HOVER.scale, box = geometry.boundingBox!, board = posterBoard(poster.width);
      this.featured.geometry.dispose(); this.featured.geometry = geometry; this.featured.scale.setScalar(scale);
      this.featuredBase = board.y + board.halfHeight + (site.gap ?? HOVER.gap) - box.min.y * scale;
      this.featured.position.set(0, this.featuredBase, site.inward ?? 0); this.featured.userData.piece = piece; this.featuredPiece = piece;
      poster.group.add(this.featured); this.featured.visible = true;
    } catch { this.featuredRetryAt = performance.now() + 30000; /* Keep the poster and avoid flooding a failed connection. */ } finally { if (this.featuredLoading === piece) this.featuredLoading = null; }
  }
  /**
   * Turn and bob the model on the wind clock (still under reduced motion, frozen by ?capture=1). When the town hour moves on,
   * the next piece loads only while the visitor is beyond `far` of this collection, so no one sees it swap.
   */
  updateFeatured(position: THREE.Vector3, far: number): void {
    if (this.featuredPiece) { const t = windTime.value as number; this.featured.rotation.y = t * HOVER.spin; this.featured.position.y = this.featuredBase + HOVER.bob * Math.sin(t * .7); }
    if (this.featuredLoading || CAPTURE || PINNED || performance.now() < this.featuredRetryAt) return;
    const next = this.featuredFor(townHour());
    if (next && next !== this.featuredPiece && (this.featuredPiece ? this.distance(position) > far : this.distance(position) < far + 20)) void this.feature(next);
  }
  warmUp(on: boolean): void { if (!this.featuredPiece) this.featured.visible = on; }
  select(piece: Exhibit): boolean { if (!this.pieces.includes(piece)) return false; this.selected = piece; return true; }
  turn(direction: number): void { this.selected = this.pieces[(this.pieces.indexOf(this.selected) + direction + this.pieces.length) % this.pieces.length]; }
  /** Horizontal distance from `position` (town space) to the centre of this collection's posters. */
  distance(position: THREE.Vector3): number {
    if (!this.worldCenter) { this.parent.updateWorldMatrix(true, false); this.worldCenter = this.parent.localToWorld(this.center.clone()); }
    return Math.hypot(position.x - this.worldCenter.x, position.z - this.worldCenter.z);
  }
  /**
   * Full photographs and captions on (painted one caption per task, so an arriving collection costs no long frame) or off
   * (back to the distant copies, the full textures disposed and their canvases emptied). Maps swap on the same materials,
   * with the same sampler setup, so no shader is rebuilt.
   */
  setResident(on: boolean): void {
    if (on === this.resident) return;
    this.resident = on; const generation = ++this.generation;
    if (!on) { for (const poster of this.posters) this.release(poster); return; }
    const queue = [...this.posters];
    const next = (): void => {
      const poster = queue.shift(); if (!poster || generation !== this.generation) return;
      const full = prepare(new THREE.CanvasTexture(caption(poster.piece, poster.width, CAPTION_WIDTH[this.tier])), this.tier);
      poster.full.push(full); poster.caption.map = full;
      if (poster.distant.photo) new THREE.TextureLoader().loadAsync(photoURL(poster.piece.photos[0].thumb ?? poster.piece.photos[0].file)).then((map) => {
        prepare(map, this.tier);
        if (generation !== this.generation) { map.dispose(); return; }
        poster.full.push(map); poster.photo.map = map;
      }).catch(() => undefined);
      setTimeout(next, 0);
    };
    next();
  }
  private release(poster: Poster): void {
    poster.caption.map = poster.distant.caption; poster.photo.map = poster.distant.photo ?? blankPaper();
    for (const map of poster.full) { map.dispose(); if (map.image instanceof HTMLCanvasElement) map.image.width = map.image.height = 0; }
    poster.full.length = 0;
  }
  /** GPU bytes of this collection's poster textures as they stand: distant copies always, full ones while resident. */
  textureBytes(): number { return this.posters.reduce((sum, poster) => sum + textureBytes(poster.distant.caption) + (poster.distant.photo ? textureBytes(poster.distant.photo) : 0) + poster.full.reduce((total, map) => total + textureBytes(map), 0), 0); }
}

/** Keeps the full posters of the RESIDENT_COLLECTIONS collections most recently approached; the rest show their distant copies. */
export class PosterResidency {
  private readonly approached = new Map<PlanarExhibition, number>();
  private clock = 0;
  constructor(private readonly exhibitions: PlanarExhibition[]) {}
  update(position: THREE.Vector3): void {
    if (ALL_RESIDENT) { for (const exhibition of this.exhibitions) exhibition.setResident(true); return; }
    // Nearer collections are stamped later, so of several in range the nearest stay.
    const near = this.exhibitions.map((exhibition) => ({ exhibition, distance: exhibition.distance(position) })).filter((entry) => entry.distance < POSTER_RANGE).sort((a, b) => b.distance - a.distance);
    if (!near.length) return;
    for (const { exhibition } of near) this.approached.set(exhibition, ++this.clock);
    const keep = new Set([...this.approached].sort((a, b) => b[1] - a[1]).slice(0, RESIDENT_COLLECTIONS).map(([exhibition]) => exhibition));
    for (const exhibition of this.exhibitions) exhibition.setResident(keep.has(exhibition));
  }
  /** Dev and tests: which collections are resident and the GPU bytes of every poster texture. */
  report(): { resident: string[]; bytes: number; collections: Record<string, number> } {
    const collections = Object.fromEntries(this.exhibitions.map((exhibition) => [exhibition.id, exhibition.textureBytes()]));
    return { resident: this.exhibitions.filter((exhibition) => exhibition.resident).map((exhibition) => exhibition.id), bytes: Object.values(collections).reduce((a, b) => a + b, 0), collections };
  }
}
