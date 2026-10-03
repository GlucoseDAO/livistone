import * as THREE from 'three';
import { CIVIC_LANDMARKS } from '../game/content';
import { COLLECTION } from '../game/exhibits';
import { FUTURE_HOUSE, TOWER_WALK } from './elevated-layout';
import { ENHANCEMENT_SIGN, GALLERY, POSTER_SITES, STAND_SITES } from './enhancement-layout';
import { TREE_CANOPY, treeScale } from './forest';
import { GATEWAY, GATEWAY_POSTER } from './gateway-layout';
import { GLUCOSE_PAVILION, GLUCOSE_POSTERS } from './glucose-layout';
import { contactFalloff } from './ground-cover';
import type { ShadeDisc, ShadeFootprint } from './ground-cover';
import { INTRODUCTION_SCALE, INTRODUCTION_SITE } from './introduction-layout';
import { ENERGY_HALL } from './jewelry';
import { GARDEN_PANELS, GARDENS } from './living-waters-layout';
import { PLACE_SIGN } from './place-sign';
import { posterLayout } from './poster-layout';
import { KEEP_DISPLAY } from '../render/output';
import { STATION, STATION_BENCHES, stationPoint } from './station-layout';
import { landscapeHeight } from './terrain';
import { LAMP_POSTS } from './town-layout';
import type { RockSite } from './water-surface';
import { TIME_TOWER, waterDistance } from './waterways';

/** One soft footprint. Radii run along the decal's own axes and yaw follows Object3D.rotation.y. `floor` seats it on a level
 *  paved floor; otherwise it follows the rendered terrain. Strength is the darkening at its centre. */
export interface ContactSite { x: number; z: number; rx: number; rz: number; yaw?: number; floor?: number; strength: number }
export interface ContactShadows {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial>;
  patches: number;
  /** Draw each group (a forest cell) only while its flag holds. Rewrites the index once per change, never per frame. */
  showGroups: (shown: readonly boolean[]) => void;
}

/** The rendered terrain's near grid (mountains.ts). Patches reuse its vertices and diagonal, so they lie exactly on the ground. */
export const CONTACT_GRID = { step: 2, minX: -240, maxX: 240, minZ: -264, maxZ: 150 };
/** What a full-strength decal multiplies the ground by at its centre: a cool, sky-occluded grey. */
const SHADE = [.3, .33, .35];
const SIZE = 64;

/** The shared radial falloff in a small texture. The profile ends on the outermost texel centres, so the clamped rim is exactly clear. */
export function contactShadowTexture(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4).fill(255), rim = (SIZE - 1) / SIZE;
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) data[(j * SIZE + i) * 4 + 3] = Math.round(255 * contactFalloff(Math.hypot((i + .5) * 2 / SIZE - 1, (j + .5) * 2 / SIZE - 1) / rim));
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  // No mipmaps: the profile is smooth, and clamping to the clear rim keeps each patch's square corners invisible at any distance.
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; return texture;
}
export function contactShadowMaterial(): THREE.MeshBasicNodeMaterial {
  // Multiply scales the ground's own linear light before the output pass tone-maps it: dst × (1 − α + α·shade). The decal keeps
  // the ground's display mask and fog factor (a zero `display` leaves them unchanged under this blend), so the output pass fogs
  // the shaded ground exactly as before and far decals fade into the haze. Polygon offset wins against the coplanar ground.
  const material = new THREE.MeshBasicNodeMaterial({ name: 'Contact shadows', map: contactShadowTexture(), vertexColors: true, transparent: true, premultipliedAlpha: true, blending: THREE.MultiplyBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  material.mrtNode = KEEP_DISPLAY; return material;
}

interface Buffers { position: number[]; uv: number[]; color: number[]; index: number[] }
function addPatch(site: ContactSite, ground: (x: number, z: number) => number, out: Buffers): void {
  const c = Math.cos(site.yaw ?? 0), s = Math.sin(site.yaw ?? 0), color = SHADE.map(shade => 1 - (1 - shade) * site.strength), indices = out.index;
  const vertex = (x: number, y: number, z: number): number => {
    const dx = x - site.x, dz = z - site.z;
    out.position.push(x, y, z); out.uv.push((dx * c - dz * s) / (2 * site.rx) + .5, (dx * s + dz * c) / (2 * site.rz) + .5); out.color.push(...color);
    return out.position.length / 3 - 1;
  };
  if (site.floor !== undefined) {
    const [a, b, d, e] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => vertex(site.x + u * site.rx * c + v * site.rz * s, site.floor!, site.z - u * site.rx * s + v * site.rz * c));
    indices.push(a, d, b, b, d, e); return;
  }
  // Terrain: every 2 m cell the ellipse touches, triangulated like mountainGeometry so the patch is coplanar with the ground.
  const { step } = CONTACT_GRID, ex = Math.hypot(site.rx * c, site.rz * s), ez = Math.hypot(site.rx * s, site.rz * c);
  const i0 = Math.floor((site.x - ex) / step), i1 = Math.ceil((site.x + ex) / step), j0 = Math.floor((site.z - ez) / step), j1 = Math.ceil((site.z + ez) / step);
  const columns = i1 - i0 + 1, ids = new Int32Array(columns * (j1 - j0 + 1)).fill(-1), reach = step * Math.SQRT1_2 / Math.min(site.rx, site.rz);
  const at = (i: number, j: number): number => { const n = (j - j0) * columns + i - i0; if (ids[n] < 0) ids[n] = vertex(i * step, ground(i * step, j * step), j * step); return ids[n]; };
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const dx = (i + .5) * step - site.x, dz = (j + .5) * step - site.z;
    if (Math.hypot((dx * c - dz * s) / site.rx, (dx * s + dz * c) / site.rz) - reach >= 1) continue; // wholly outside the ellipse
    const a = at(i, j), b = at(i, j + 1), d = at(i + 1, j), e = at(i + 1, j + 1);
    indices.push(a, b, d, d, b, e);
  }
}

/** One draw call for every decal. Group patches stay out of the index until showGroups() reports them. */
export function createContactShadows(fixed: readonly ContactSite[], groups: readonly (readonly ContactSite[])[] = [], ground: (x: number, z: number) => number = landscapeHeight): ContactShadows {
  const out: Buffers = { position: [], uv: [], color: [], index: [] }, indices = out.index;
  for (const site of fixed) addPatch(site, ground, out);
  const always = indices.length, ranges = groups.map((sites): [number, number] => { const start = indices.length; for (const site of sites) addPatch(site, ground, out); return [start, indices.length - start]; });
  const all = Uint32Array.from(indices), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
  geometry.setIndex(new THREE.BufferAttribute(all.slice(), 1)); geometry.setDrawRange(0, always); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, contactShadowMaterial()); mesh.name = 'Contact shadows';
  // Drawn with the river, before other transparent surfaces, so they blend over ground that is already shaded. Each patch is
  // coplanar with the ground, so the CPU tier's simplifier must leave the vertices alone (cpu-detail.ts).
  mesh.renderOrder = -1; mesh.userData.keepGeometry = true;
  const showGroups = (shown: readonly boolean[]): void => {
    const index = geometry.index!, target = index.array as Uint32Array; let count = always;
    ranges.forEach(([start, length], i) => { if (!shown[i]) return; target.set(all.subarray(start, start + length), count); count += length; });
    // Only the rewritten span is uploaded; the fixed sites at the front never change.
    geometry.setDrawRange(0, count);
    if (count > always) { index.clearUpdateRanges(); index.addUpdateRange(always, count - always); index.needsUpdate = true; }
  };
  return { mesh, patches: fixed.length + groups.reduce((sum, sites) => sum + sites.length, 0), showGroups };
}

/** A crown-wide patch and a tight contact at the trunk, both scaled with the tree. The crown patch stays light: the baked ground
 *  shade already dims the sky light under it, and the trees' own shade sits in the dark toe of the output pass's tone curve. */
export function treeContactSites(p: { x: number; z: number }, index: number): ContactSite[] {
  const scale = treeScale(index), crown = TREE_CANOPY[index % 2] * scale * .85, trunk = 1.3 * scale;
  return [{ x: p.x, z: p.z, rx: crown, rz: crown, strength: .3 }, { x: p.x, z: p.z, rx: trunk, rz: trunk, strength: .7 }];
}
/** Bank boulders. The patch stays inside each rock's planting clearance (s × 1.45 plus 0.3–0.35 m), so it never reaches water or a path. */
export function rockContactSite({ x, z, s, yaw }: RockSite): ContactSite {
  return { x, z, rx: s * 1.45 + .25, rz: s * 1.15 + .25, yaw, strength: .85 };
}
/** Only rocks whose patch stays on dry ground. A boulder standing in the stream is grounded by its foam ring and wet foot, and a
 *  patch there would darken the riverbed through the transparent water. */
export function rockContactSites(rocks: readonly RockSite[]): ContactSite[] {
  return rocks.map(rockContactSite).filter(site => waterDistance(site.x, site.z) > Math.max(site.rx, site.rz));
}

const feet = (x: number, z: number, yaw: number, width: number, depth: number, floor?: number): ContactSite => ({ x, z, yaw, rx: width / 2 + .55, rz: depth / 2 + .55, floor, strength: .8 });
const post = (x: number, z: number, radius: number, floor?: number): ContactSite => ({ x, z, rx: radius, rz: radius, floor, strength: .75 });
/** A place sign's raised board shades a broad band; each post gets its own contact. */
function placeSign(x: number, z: number, yaw: number, scale = 1, floor?: number): ContactSite[] {
  const half = (PLACE_SIGN.width / 2 + PLACE_SIGN.frame + .3) * scale, dx = Math.cos(yaw) * PLACE_SIGN.postX * scale, dz = -Math.sin(yaw) * PLACE_SIGN.postX * scale;
  return [{ x, z, yaw, rx: half, rz: .8 * scale, floor, strength: .45 }, post(x - dx, z - dz, .45 * scale, floor), post(x + dx, z + dz, .45 * scale, floor)];
}
/** The hall floor inset; the plain floor ring around it is 2 cm lower, which the polygon offset hides. */
const HALL_FLOOR = .3;
const pieces = (id: string): number => COLLECTION.filter(piece => piece.location === id).length;

/** Feet, posts, plinths and benches across the town, from the same layouts that place them. Timeface posters hang on brackets
 *  over the tower core and get none. */
export function objectContactSites(): ContactSite[] {
  const sites: ContactSite[] = LAMP_POSTS.map(([x, z]) => post(x, z, .6));
  for (const hall of CIVIC_LANDMARKS) for (const p of posterLayout(hall.id, pieces(hall.id))) sites.push(feet(hall.x + p.x, hall.z + p.z, p.yaw, (hall.id === 'science' ? 1.72 : 2) * .7, .48, HALL_FLOOR));
  for (const p of posterLayout('station', pieces('station'))) { const at = stationPoint(p.x, p.z); sites.push(feet(at.x, at.z, p.yaw + Math.PI, 1.4, .48, STATION.floor)); }
  for (const p of posterLayout('future-house', pieces('future-house'))) sites.push(feet(p.x, p.z, p.yaw, 1.4, .48, FUTURE_HOUSE.floor));
  for (const [x, z] of STATION_BENCHES) { const at = stationPoint(x, z); sites.push({ x: at.x, z: at.z, yaw: Math.PI, rx: 2, rz: .85, floor: STATION.floor, strength: .75 }); }
  const story = stationPoint(-8.5, -66.35); sites.push(...placeSign(story.x, story.z, Math.PI, 1, STATION.floor));
  sites.push(feet(GATEWAY_POSTER.x, GATEWAY_POSTER.z, GATEWAY_POSTER.yaw, 1.45, .48));
  sites.push(...placeSign(INTRODUCTION_SITE.x, INTRODUCTION_SITE.z, INTRODUCTION_SITE.yaw, INTRODUCTION_SCALE));
  sites.push(...placeSign(ENHANCEMENT_SIGN.x, ENHANCEMENT_SIGN.z, ENHANCEMENT_SIGN.yaw));
  sites.push(...placeSign(GARDENS.x + GARDEN_PANELS.mycelium[0], GARDENS.z + GARDEN_PANELS.mycelium[1], 0));
  for (const p of POSTER_SITES) sites.push(feet(p.x, p.z, 0, GALLERY.posterWidth * .7, .48));
  for (const p of STAND_SITES) sites.push({ x: p.x, z: p.z, rx: GALLERY.standWidth / 2 + .55, rz: 1, strength: .85 });
  for (const p of GLUCOSE_POSTERS) sites.push(feet(p.x, p.z, p.yaw, 1.7, .65, GLUCOSE_PAVILION.floorY));
  for (const [x, z] of [[-4.3, -7.4], [4.3, -7.4], [-4.3, 7.4], [4.3, 7.4], [3.8, 6.2]]) sites.push(post(GLUCOSE_PAVILION.x + x, GLUCOSE_PAVILION.z + z, .75, GLUCOSE_PAVILION.floorY));
  // Lake jewellery stands: Dewdrop stands on the pavilion platform, Vittoria on the meadow.
  for (const name of ['vittoria', 'dewdrop'] as const) {
    const x = GARDENS.x + GARDEN_PANELS[name][0], z = GARDENS.z + GARDEN_PANELS[name][1], floor = name === 'dewdrop' ? .18 : undefined;
    sites.push({ x, z, rx: 1.75, rz: .7, floor, strength: .45 }, post(x - 1, z, .45, floor), post(x + 1, z, .45, floor));
  }
  return sites;
}

/** Ground-shade discs for the baked occlusion: a soft crown disc and a darker ring around each trunk. */
export function treeShadeDiscs(sites: readonly { x: number; z: number }[]): ShadeDisc[] {
  return sites.flatMap((p, index): ShadeDisc[] => { const scale = treeScale(index); return [{ x: p.x, z: p.z, radius: TREE_CANOPY[index % 2] * scale * .9, strength: .28 }, { x: p.x, z: p.z, radius: 1.4 * scale, strength: .32 }]; });
}
/** Buildings whose walls or overhangs shade the ground at their foot. Paved rings and floors cover the inside; the reach outside matters. */
export const TOWN_SHADE_FOOTPRINTS: readonly ShadeFootprint[] = [
  ...CIVIC_LANDMARKS.map((hall): ShadeFootprint => {
    const radius = hall.id === 'science' ? Math.sqrt(8.5 ** 2 - 6 ** 2) : Math.sqrt(10 ** 2 - 5.7 ** 2);
    return hall.id === 'energy' ? { x: hall.x, z: hall.z, rx: ENERGY_HALL.a, rz: ENERGY_HALL.b, reach: 6, strength: .35 } : { x: hall.x, z: hall.z, rx: radius, rz: radius, reach: 6, strength: .35 };
  }),
  { x: STATION.x, z: (STATION.front + STATION.back) / 2, rx: STATION.halfLength, rz: (STATION.back - STATION.front) / 2, box: true, reach: 5, strength: .35 },
  { x: TIME_TOWER.x, z: TIME_TOWER.z, rx: TOWER_WALK.outer, rz: TOWER_WALK.outer, reach: 4, strength: .3 },
  { x: GLUCOSE_PAVILION.x, z: GLUCOSE_PAVILION.z, rx: GLUCOSE_PAVILION.radius, rz: GLUCOSE_PAVILION.radius, reach: 3, strength: .25 },
  // The printed cabin floats on its legs: the ground beneath stays in its shade.
  { x: FUTURE_HOUSE.x, z: FUTURE_HOUSE.z, rx: FUTURE_HOUSE.radiusX, rz: FUTURE_HOUSE.radiusZ, reach: 4, strength: .45 },
  ...[-1, 1].map((side): ShadeFootprint => ({ x: side * 3.15, z: GATEWAY.z, rx: .95, rz: .95, box: true, reach: 1.5, strength: .3 })),
];
