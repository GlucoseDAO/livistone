import * as THREE from 'three';
import { abs, dot, float, mix, normalView, positionViewDirection, pow } from 'three/tsl';
import { createPlaceSign, paintPlaceSign } from './place-sign';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ColliderSpec } from '../game/physics';
import { createMaglevTrain, createTrainCabinGraphics } from './train';
import { RAILWAY_LOCAL as RAILWAY, STATION_BENCHES, STATION_FITTINGS as FITTINGS, STATION_LOCAL as STATION, stationClassic } from './station-layout';
import { stationRingGeometry, stationRingAnchor } from './station-ring';
import { stationAmberGeometry, stationAmberMaterial, stationAmberPoint, stationAmberSoffit } from './station-amber';
import { activeSurfaces, bakeMasonry } from './surfaces';
import { nightEmission } from './night-lighting';

/** The southern placement (world.ts): a half-turn and x = -16. bakeMasonry() weathers the stone against the ground it stands on. */
const PLACEMENT = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(-16, 0, 0);

type Point = [number, number, number];
function tube(points: Point[], radius: number, mobile: boolean, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, Math.max(16, points.length * (mobile ? 3 : 6)), radius, mobile ? 6 : 10, closed);
}
function add(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material); object.name = name; object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function solid(colliders: ColliderSpec[], geometry: THREE.BufferGeometry): void {
  colliders.push({ type: 'mesh', vertices: new Float32Array(geometry.getAttribute('position').array), indices: geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i) });
}
function box(x: number, y: number, z: number, width: number, height: number, depth: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((part) => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(normalized)!; normalized.forEach((part) => part.dispose()); parts.forEach((part) => part.dispose()); return geometry;
}

function castProng(points: Point[], mobile: boolean): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, mobile ? 72 : 144, .51, mobile ? 10 : 18, false);
  // A continuous rounded section catches reflections all the way around the cast silver.
  return geometry;
}

/**
 * Foyer glass that reads as glass (sub-plan 28): a faint green-grey tint at normal incidence, mirroring the sky (heroEnv) more
 * as the view grazes it, as real glazing does. The classic pane was a near-invisible warm film, so its frames read as bare sticks.
 */
function foyerGlass(mobile: boolean): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ color: '#bcd6cf', metalness: 0, roughness: .05, envMapIntensity: 1.5, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const facing = abs(dot(normalView, positionViewDirection));
  material.opacityNode = mix(float(mobile ? .2 : .24), float(.82), pow(float(1).sub(facing), 3));
  material.userData.heroEnv = true; return material;
}

/** Slatted teak benches on cast-silver ring frames that echo the Embryo shank; one wood draw, the frames join the silver rails. */
function stationBenches(silverParts: THREE.BufferGeometry[], mobile: boolean): THREE.BufferGeometry {
  const slats: THREE.BufferGeometry[] = [], wood = new THREE.Color(), floor = STATION.floor, length = 2.8;
  const plank = (geometry: THREE.BufferGeometry, i: number): void => {
    wood.set('#8f5b31').offsetHSL(.008 * Math.sin(i * 2.7), .04 * Math.sin(i * 1.3), .035 * Math.sin(i * 3.1 + 1));
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) wood.toArray(colors, k * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); slats.push(geometry);
  };
  const radial = mobile ? 6 : 8;
  STATION_BENCHES.forEach(([x, z], bench) => {
    for (let i = 0; i < 5; i++) plank(box(x, floor + .46, z + .2 - i * .1, length, .045, .085), bench * 9 + i);
    for (let i = 0; i < 3; i++) {
      const y = floor + .64 + i * .14;
      plank(new THREE.BoxGeometry(length, .1, .035).rotateX(-.25).translate(x, y, z - .3 - i * .14 * .255), bench * 9 + 5 + i);
    }
    for (const dx of [-1.2, 0, 1.2]) {
      const fx = x + dx;
      silverParts.push(new THREE.TorusGeometry(.19, .03, radial, 28).rotateY(Math.PI / 2).translate(fx, floor + .22, z - .01));
      silverParts.push(tube([[fx, floor + .3, z - .2], [fx, floor + .62, z - .3], [fx, floor + 1.02, z - .41]], .026, mobile));
      if (dx) silverParts.push(tube([[fx, floor + .4, z + .2], [fx, floor + .62, z + .23], [fx, floor + .66, z + .02], [fx, floor + .7, z - .27]], .026, mobile));
    }
  });
  return merge(slats);
}

/** A sheared box: `x0`, `x1` are its inner and outer faces at the front (z0) and `x0b`, `x1b` at the back (z1). */
function shearedBlock(x0: number, x1: number, x0b: number, x1b: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const back = p.getZ(i) < 0, outer = p.getX(i) > 0;
    p.setXYZ(i, outer ? (back ? x1b : x1) : (back ? x0b : x0), p.getY(i) > 0 ? y1 : y0, back ? z1 : z0);
  }
  geometry.computeVertexNormals(); return geometry;
}

/**
 * Dressed stone of the detailed station (sub-plan 28): a coping round the whole slab (its platform edge behind the tactile
 * strip), two footings where the ring's shank lands beside the threshold, and a gently sloped threshold stone from the town path
 * onto the platform. One draw in the town's ashlar; every part has a collider.
 */
function stationStone(station: THREE.Group, colliders: ColliderSpec[]): void {
  const parts: THREE.BufferGeometry[] = [], floor = STATION.floor, top = floor + .015, bottom = -.15, width = .42, cx = STATION.entranceX;
  const x0 = STATION.x - STATION.halfLength, x1 = STATION.x + STATION.halfLength, front = STATION.front, back = STATION.back;
  const block = (geometry: THREE.BufferGeometry): void => { parts.push(geometry); solid(colliders, geometry); };
  // Coping: front (open across the ring's threshold), platform edge, and both ends.
  for (const [a, b] of [[x0 - .01, cx - 3.6], [cx + 3.6, x1 + .01]]) block(box((a + b) / 2, (top + bottom) / 2, front - width / 2 + .01, b - a, top - bottom, width));
  block(box((x0 + x1) / 2, (top + bottom) / 2, back + width / 2 - .01, x1 - x0 + .02, top - bottom, width));
  for (const x of [x0 + width / 2 - .01, x1 - width / 2 + .01]) block(box(x, (top + bottom) / 2, (front + back) / 2, width, top - bottom, front - back - width * 2 + .02));
  // Footings take the shank's outer wall where it meets the slab; their inner tops stay under the band's inner face.
  block(shearedBlock(cx - 3.1, cx - 4.85, cx - 2.8, cx - 4.85, -.2, floor + .24, front + .45, front - 4.85));
  block(shearedBlock(cx + 3.1, cx + 4.85, cx + 1.85, cx + 4.85, -.2, floor + .24, front + .45, front - 4.85));
  // The town path (13 cm over the ground) rises 7 cm over 1.2 m onto the ring's silver nosing: one level-reading surface.
  const sill = box(cx, 0, front + .6, 7.2, 1, 1.2), p = sill.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) < 0 ? -.1 : THREE.MathUtils.lerp(floor + .025, .135, (p.getZ(i) - front) / 1.2));
  sill.computeVertexNormals(); block(sill);
  const stone = merge(parts); bakeMasonry(stone, PLACEMENT);
  const material = activeSurfaces()?.abutments ?? new THREE.MeshStandardMaterial({ color: '#e5dbc7', roughness: .88 });
  add(station, stone, material, 'Dressed station coping, footings and threshold');
}

/** Lamp posts as on the town bridge, brass litter bins and the map panel's posts (sub-plan 28); the panel's faces are in createStation. */
function stationFittings(station: THREE.Group, colliders: ColliderSpec[], trim: THREE.BufferGeometry[], mobile: boolean): void {
  const floor = STATION.floor, globes: THREE.BufferGeometry[] = [];
  for (const [x, z] of FITTINGS.lamps) {
    trim.push(new THREE.CylinderGeometry(.045, .065, 2.8, 10).translate(x, floor + 1.4, z), new THREE.CylinderGeometry(.075, .05, .1, 12).translate(x, floor + 2.74, z));
    globes.push(new THREE.SphereGeometry(.23, mobile ? 12 : 18, mobile ? 8 : 12).translate(x, floor + 2.92, z));
    colliders.push({ type: 'box', position: [x, floor + 1.4, z], size: [.08, 1.4, .08] });
  }
  const globe = new THREE.MeshStandardMaterial({ color: '#f3e8c9', emissive: '#e4c881', emissiveIntensity: .35, roughness: .6 });
  nightEmission(globe, '#ffcf79', 3); add(station, merge(globes), globe, 'Platform lamp globes').castShadow = false;
  for (const [x, z] of FITTINGS.bins) {
    trim.push(new THREE.CylinderGeometry(.21, .18, .72, 18).translate(x, floor + .36, z), new THREE.TorusGeometry(.205, .022, 6, 24).rotateX(Math.PI / 2).translate(x, floor + .73, z));
    trim.push(new THREE.CylinderGeometry(.2, .225, .06, 18).translate(x, floor + .84, z), new THREE.SphereGeometry(.05, 8, 6).translate(x, floor + .89, z));
    colliders.push({ type: 'box', position: [x, floor + .45, z], size: [.23, .45, .23] });
  }
  const { x, z, width, height, bottom } = FITTINGS.panel;
  for (const dx of [-1, 1]) trim.push(box(x + dx * (width / 2 + .07), floor + (bottom + height + .05) / 2, z, .07, bottom + height + .05, .07));
  colliders.push({ type: 'box', position: [x, floor + (bottom + height) / 2, z], size: [width / 2 + .12, (bottom + height) / 2, .1] });
}

function createFoyer(station: THREE.Group, colliders: ColliderSpec[], mobile: boolean, silver: THREE.Material, brass: THREE.Material, classic: boolean, extraSilver: THREE.BufferGeometry[]): void {
  const structure: THREE.BufferGeometry[] = [], panes: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
  const r = 6.58, cy = 6.45, z = -62.15, x = STATION.entranceX;
  const arch = (depth: number, radius = r): THREE.BufferGeometry => tube(Array.from({ length: 61 }, (_, i) => { const a = -.5 * Math.PI + i / 60 * Math.PI; return [x + Math.sin(a) * radius, cy + Math.cos(a) * radius, depth] as Point; }), .085, mobile);
  structure.push(arch(z), arch(-65.5)); lights.push(arch(-61.4, 6.72));
  const panel = (left: number, right: number, bottomLeft: number, bottomRight: number, topLeft: number, topRight: number, depth: number): void => {
    if (Math.min(topLeft, topRight) <= Math.max(bottomLeft, bottomRight)) return;
    const shape = new THREE.Shape(); shape.moveTo(left, bottomLeft); shape.lineTo(right, bottomRight); shape.lineTo(right, topRight); shape.lineTo(left, topLeft); shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape).translate(0, 0, depth); panes.push(geometry); solid(colliders, geometry);
  };
  // Real glazing encloses the portal; the central ground-level bay is deliberately open.
  for (let i = 0; i < 12; i++) {
    const a = -r + i / 12 * r * 2, b = -r + (i + 1) / 12 * r * 2;
    const topA = cy + Math.sqrt(Math.max(0, r * r - a * a)), topB = cy + Math.sqrt(Math.max(0, r * r - b * b));
    const lowA = Math.max(.18, cy - Math.sqrt(Math.max(0, r * r - a * a))), lowB = Math.max(.18, cy - Math.sqrt(Math.max(0, r * r - b * b)));
    const doorway = a >= -2.2 && b <= 2.2;
    panel(x + a, x + b, doorway ? 3.5 : lowA, doorway ? 3.5 : lowB, topA, topB, z);
    if (i > 0 && Math.abs(a) > 2.2) structure.push(box(x + a, (topA + lowA) / 2, z + .03, .075, topA - lowA, .1));
    else if (i > 0) structure.push(box(x + a, (topA + 3.5) / 2, z + .03, .075, topA - 3.5, .1));
  }
  for (const y of [3.5, 5.1, 9.2]) {
    const half = Math.sqrt(r * r - (y - cy) ** 2); structure.push(box(x, y, z, half * 2, .09, .12));
  }
  for (const dx of [-2.2, 2.2]) structure.push(box(x + dx, 1.85, z, .1, 3.34, .14));
  for (const dx of [-5.1, 5.1]) structure.push(box(x + dx, 2.75, -64.4, .16, 5.15, .2));
  // A shallow clerestory gallery adds depth through the ring without blocking the concourse.
  for (const dx of [-4.45, 4.45]) {
    const balcony = box(x + dx, 5, -64.5, 3.2, .2, 3.5); structure.push(balcony); solid(colliders, balcony);
    structure.push(box(x + dx, 6.05, -63, 3.2, .05, .05));
    for (let i = -2; i <= 2; i++) structure.push(box(x + dx + i * .65, 5.55, -63, .035, 1, .035));
    lights.push(box(x + dx, 4.85, -63.05, 3, .025, .08));
  }
  if (classic) for (const left of [-5.7, -2.1, 1.5, 8.7, 12.3, 15.9, 23.1]) {
    const right = Math.min(26.5, left + 3.4), depth = -62.1;
    panel(left, right, .2, .2, 5.6, 5.6, depth);
    structure.push(box(left, 2.9, depth, .1, 5.45, .15), box((left + right) / 2, 5.6, depth, right - left, .15, .2));
    lights.push(box((left + right) / 2, 5.42, depth + .04, right - left - .2, .035, .08));
  } else {
    // One curtain wall east of the ring: bays of about 1.75 m between mullions, a brass kick plate and sill, a transom line at
    // door height and one top rail, with both doorways framed and glazed above the door head. No member stands alone.
    const depth = -62.1, floor = STATION.floor, sill = .46, head = 5.6, door = 3.05;
    const spans: readonly [number, number, boolean][] = [[-5.7, 4.9, false], [4.9, 8.7, true], [8.7, 19.3, false], [19.3, 23.1, true], [23.1, 26.5, false]];
    for (const [left, right, opening] of spans) {
      const bays = Math.max(2, Math.round((right - left) / 1.75)), low = opening ? door : sill;
      for (let i = 0; i < bays; i++) {
        const a = left + (right - left) * i / bays, b = left + (right - left) * (i + 1) / bays;
        panel(a, b, low, low, head - .09, head - .09, depth);
        if (i > 0) structure.push(box(a, (low + head) / 2, depth, .07, head - low, .12));
      }
      structure.push(box((left + right) / 2, door, depth, right - left, .09, .14));
      if (!opening) {
        structure.push(box((left + right) / 2, (floor + sill) / 2, depth, right - left, sill - floor, .05), box((left + right) / 2, sill, depth, right - left, .06, .16));
        lights.push(box((left + right) / 2, head - .18, depth + .04, right - left - .2, .035, .08));
      }
    }
    for (const x of [-5.7, 4.9, 8.7, 19.3, 23.1, 26.5]) structure.push(box(x, (floor + head) / 2, depth, .13, head - floor, .17));
    structure.push(box(10.4, head, depth, 32.4, .18, .22));
  }
  const columns = merge(structure); add(station, columns, brass, 'Glazed entrance hall frames'); solid(colliders, columns);
  const glazing = classic ? new THREE.MeshStandardMaterial({ color: '#ebd7a3', metalness: .15, roughness: .12, envMapIntensity: 1.6, transparent: true, opacity: mobile ? .12 : .18, side: THREE.DoubleSide, depthWrite: false }) : foyerGlass(mobile);
  const glass = add(station, merge(panes), glazing, 'Entrance hall glazing'); glass.castShadow = false;
  add(station, merge(lights), new THREE.MeshBasicMaterial({ color: '#ffdd8e' }), 'Warm entrance and concourse lighting');
  for (const [lx, lz] of [[-16, -64], ...(mobile ? [] : [[6, -68]])]) { const glow = new THREE.PointLight('#ffc86c', 16, 18, 1.3); glow.position.set(lx, 4.2, lz); station.add(glow); }
  // Solid jambs connect the pierced shank to the sheltered foyer behind it.
  const jambs: THREE.BufferGeometry[] = [];
  for (const a of [-1.12, -.68, 0, .68, 1.12]) {
    const px = x + Math.sin(a) * 6.8, py = cy + Math.cos(a) * 6.8;
    jambs.push(tube([[px, py, -60.6], [px, py, -63], [px, py - .15, -65.3]], .13, mobile));
  }
  add(station, merge([...jambs, ...extraSilver]), silver, 'Ring foyer vault');
}

export function createStationStructure(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): THREE.Group {
  const station = new THREE.Group(); station.name = 'Embryo Station'; root.add(station);
  const classic = stationClassic();
  const silver = new THREE.MeshStandardMaterial({ color: '#eee7db', metalness: .82, roughness: .23, envMapIntensity: 1.05, userData: { heroEnv: true } });
  const white = new THREE.MeshStandardMaterial({ color: '#ede9dc', metalness: .18, roughness: .43, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: '#b28d42', metalness: .65, roughness: .3 });
  const amber = stationAmberMaterial(mobile), roof = stationAmberGeometry(mobile);
  const stone = add(station, roof, amber, 'Sculpted amber body'); stone.castShadow = false; solid(colliders, roof);
  // A recessed resin core gives the transparent surface depth and warm internal reflections.
  if (!mobile) {
    // Sub-plan 28: a brighter heart, so the resin core reads through the stone from below and from the meadow.
    const core = add(station, stationAmberGeometry(true, .14), new THREE.MeshStandardMaterial({ color: '#fff3ad', map: amber.map, bumpMap: amber.bumpMap, bumpScale: .3, roughness: .28, emissive: '#ffda3d', emissiveMap: amber.map, emissiveIntensity: classic ? .2 : .34 }), 'Amber resin core'); core.castShadow = false;
  }
  const floor = box(STATION.x, .015, -68.1, 58, .33, 16.2);
  const floorUV = floor.getAttribute('uv'), floorPosition = floor.getAttribute('position');
  for (let i = 0; i < floorUV.count; i++) floorUV.setXY(i, floorPosition.getX(i) / 4, floorPosition.getZ(i) / 4);
  add(station, floor, paving, 'Concourse and platform'); colliders.push({ type: 'box', position: [STATION.x, .015, -68.1], size: [29, .165, 8.1] });
  if (!classic) stationStone(station, colliders);

  const frame: THREE.BufferGeometry[] = [], supports: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [];
  frame.push(stationRingGeometry(mobile, !classic));
  const clasp = (x: number, angle: number): Point => { const point = stationAmberPoint(x, angle); point.z += .15; return point.toArray() as Point; };
  const prongs: Point[][] = [
    [stationRingAnchor(-.84), [-23.5, 17.4, -58.6], [-22.1, 21.5, -61.5], [-20.9, 22, -62.3], [-19.8, 19.5, -61.5], [-18.5, 15, -60.4], clasp(-18.2, 1.42)],
    [stationRingAnchor(.59), [-7.7, 16.8, -58.6], [-.8, 18.8, -59.4], [.5, 18.2, -59.5], [-2.2, 13.6, -59.3], [-6.5, 9.9, -60.2], stationRingAnchor(.8, 1.1)],
    [stationRingAnchor(-1.88, 1.4), [-29.6, 8.1, -65.2], [-30, 15.1, -69.5], [-27, 19.4, -71], clasp(-23.5, -.65)],
    [stationRingAnchor(1.84), [-5, 4.9, -59.3], [5.2, 6.8, -58.8], [6.4, 10.1, -59.4], [3.2, 12.1, -59.3], clasp(-2.5, 1.35)],
  ];
  for (const points of prongs) { frame.push(castProng(points, mobile)); const end = points.at(-1)!; frame.push(new THREE.SphereGeometry(.51, 16, 10).translate(...end)); }
  frame.push(castProng([[-23.2, 16.7, -58.9], [-20.7, 16, -58.1], [-16.2, 16.8, -58.8], [-15, 17.2, -62.2]], mobile));
  // The lower clasp retains the photographed wire's wound attachment to the shank.
  for (const dx of [0, .38, .76]) frame.push(new THREE.TorusGeometry(.68, .16, 8, 32).rotateY(Math.PI / 2).translate(-7.5 + dx, 4.85, -60.1));
  for (const [x, z] of [[-28, -68], [-5, -67], [12, -68], [24, -69], [-22, -74.8], [2, -74.8], [23, -74.8]]) {
    const left = Math.max(-30, x - 3), right = Math.min(26, x + 2.8);
    supports.push(tube([[x, .18, z], [x, 3.6, z], [x - .7, 5, z], stationAmberSoffit(left, z - .4).toArray() as Point], .21, mobile));
    supports.push(tube([[x, 3.2, z], [x + .7, 4.8, z], stationAmberSoffit(right, z + .5).toArray() as Point], .15, mobile));
  }
  const mergedFrame = merge(frame), silverGeometry = mergeVertices(mergedFrame), supportGeometry = merge(supports); mergedFrame.dispose(); silverGeometry.computeVertexNormals();
  const silverwork = add(station, silverGeometry, silver, 'Pierced ring and clasping silver prongs');
  silverwork.receiveShadow = false; solid(colliders, silverGeometry);
  solid(colliders, supportGeometry);
  const vault: THREE.BufferGeometry[] = [];
  if (classic) add(station, supportGeometry, white, 'Branching platform columns');
  else {
    // Sub-plan 28: the amber is a set stone. Its columns are cast silver like the prongs, each tip cupped against the soffit,
    // and a bezel follows the stone's girdle, so the canopy reads as amber held in its silver setting.
    vault.push(supportGeometry);
    for (const [x, z] of [[-28, -68], [-5, -67], [12, -68], [24, -69], [-22, -74.8], [2, -74.8], [23, -74.8]]) {
      for (const [tip, offset] of [[Math.max(-30, x - 3), -.4], [Math.min(26, x + 2.8), .5]]) vault.push(new THREE.SphereGeometry(.3, 14, 10).translate(...stationAmberSoffit(tip, z + offset).toArray()));
    }
    const girdle: THREE.Vector3[] = [];
    for (const angle of [Math.PI / 2, Math.PI * 1.5]) for (let i = 0; i <= 96; i++) {
      const x = angle < Math.PI ? -30.4 + i / 96 * 56.8 : 26.4 - i / 96 * 56.8, point = stationAmberPoint(x, angle);
      point.z += angle < Math.PI ? .06 : -.06; girdle.push(point);
    }
    vault.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(girdle, true), mobile ? 160 : 320, .24, mobile ? 6 : 8, true));
  }
  createFoyer(station, colliders, mobile, silver, brass, classic, vault);

  const matrix = new THREE.Matrix4();

  // Open boarding bays align with real apertures in the parked train.
  const rails: THREE.BufferGeometry[] = [], screens: THREE.BufferGeometry[] = [];
  for (const z of [STATION.back, RAILWAY.centerZ - 7]) {
    const spans = z === STATION.back ? [[-107, -15.2], [-12.8, 8.8], [11.2, 107]] : [[-107, 107]];
    for (const [left, right] of spans) {
      rails.push(box((left + right) / 2, 1.26, z, right - left, .07, .07));
      colliders.push({ type: 'box', position: [(left + right) / 2, .72, z], size: [(right - left) / 2, .6, .08] });
      for (let x = left; x <= right; x += 3) rails.push(box(x, .72, z, .07, 1.15, .07));
      const l = Math.max(-30, left), r = Math.min(27, right);
      if (r > l) screens.push(box((l + r) / 2, .77, z, r - l, .92, .025));
    }
  }
  for (const x of [-14, 10]) {
    const ramp = box(x, .38, -75.25, 2.4, .12, 4.5);
    const pos = ramp.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + (-pos.getZ(i) - 75.25) * (.52 / 4.5));
    ramp.computeVertexNormals(); add(station, ramp, paving, 'Step-free boarding ramp'); solid(colliders, ramp);
    const bridge = box(x, .64, -77.7, 2.4, .12, .7); add(station, bridge, silver, 'Boarding threshold'); solid(colliders, bridge);
    for (const dx of [-1.24, 1.24]) {
      const rail = box(x + dx, .92, -76.7, .06, .9, 2.2); add(station, rail, brass, 'Boarding bridge handrail'); solid(colliders, rail);
    }
  }
  add(station, merge(screens), new THREE.MeshStandardMaterial({ color: '#bbd6cc', roughness: .13, metalness: .22, transparent: true, opacity: .2, depthWrite: false }), 'Platform safety glass');
  trim.push(box(STATION.x, .186, STATION.back + .58, 57.5, .012, .17));
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 3), brass, 360);
  for (let i = 0; i < dots.count; i++) dots.setMatrixAt(i, matrix.makeTranslation(-30 + (i % 180) * .32, .2, STATION.back + .85 + Math.floor(i / 180) * .16));
  dots.name = 'Platform tactile edge'; dots.computeBoundingSphere(); station.add(dots);

  createMaglevTrain(station, colliders, mobile);

  if (classic) {
    const benches: THREE.BufferGeometry[] = [];
    for (const [x, z] of STATION_BENCHES) {
      benches.push(box(x, .64, z, 3, .16, .65), box(x, 1.12, z - .28, 3, .65, .12));
      for (const dx of [-1.05, 1.05]) trim.push(box(x + dx, .4, z, .1, .48, .5));
    }
    add(station, merge(benches), new THREE.MeshStandardMaterial({ color: '#ad8051', roughness: .74 }), 'Waiting benches');
  } else {
    add(station, stationBenches(rails, mobile), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .58 }), 'Waiting benches');
    stationFittings(station, colliders, trim, mobile);
  }
  for (const [x, z] of STATION_BENCHES) colliders.push({ type: 'box', position: [x, .81, z - .1], size: [1.5, .65, .42] });
  add(station, merge(rails), silver, 'Track and platform railings');
  add(station, merge(trim), brass, 'Brass platform and train details');
  return station;
}

/** Atlas regions (px) of the platform boards' one canvas: departures, clock face, map and timetable, painted green, painted gold. */
const ATLAS = { width: 1536, height: 1024, departures: [0, 0, 1536, 384], clock: [1024, 400, 512, 512], panel: [0, 400, 480, 615], green: [520, 420, 64, 64], gold: [620, 420, 64, 64] } as const;
type Region = readonly [number, number, number, number];
function paintAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = ATLAS.width; canvas.height = ATLAS.height;
  const ctx = canvas.getContext('2d')!, green = '#233a35', gold = '#bca467', cream = '#f5e9c9';
  const board = ([x, y, w, h]: Region): void => { ctx.fillStyle = green; ctx.fillRect(x, y, w, h); ctx.strokeStyle = gold; ctx.lineWidth = 4; ctx.strokeRect(x + 12, y + 12, w - 24, h - 24); };
  ctx.fillStyle = green; ctx.fillRect(...ATLAS.green); ctx.fillStyle = gold; ctx.fillRect(...ATLAS.gold);
  // Departures: the parked maglev's two directions, as the cabin boards announce them.
  const [dx, dy, dw] = ATLAS.departures; board(ATLAS.departures);
  ctx.fillStyle = cream; ctx.textAlign = 'left'; ctx.font = '500 64px Georgia'; ctx.fillText('DEPARTURES', dx + 48, dy + 92);
  ctx.textAlign = 'right'; ctx.font = '28px sans-serif'; ctx.fillStyle = gold; ctx.fillText('PLATFORM 1  ·  MAGLEV', dx + dw - 48, dy + 88);
  ctx.fillRect(dx + 48, dy + 118, dw - 96, 2);
  const rows = [['10:10', 'NEW HORIZONS', 'BOARDING'], ['10:30', 'THE FUTURE  ·  SCIENCE', 'ON TIME'], ['10:50', 'ART AND GEOMETRY', 'ON TIME'], ['11:10', 'NEW HORIZONS', 'ON TIME']];
  rows.forEach(([time, place, state], i) => {
    const y = dy + 176 + i * 52; ctx.font = '600 36px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = gold; ctx.fillText(time, dx + 48, y);
    ctx.fillStyle = cream; ctx.font = '36px sans-serif'; ctx.fillText(place, dx + 210, y); ctx.fillText('1', dx + 1040, y);
    ctx.textAlign = 'right'; ctx.fillStyle = i ? cream : '#e9c46a'; ctx.fillText(state, dx + dw - 48, y);
  });
  // Clock: gold hour bars on the green face, cream hands at a fixed 10:08.
  const [cx0, cy0, cw] = ATLAS.clock, r = cw / 2, ccx = cx0 + r, ccy = cy0 + r;
  ctx.fillStyle = green; ctx.fillRect(cx0, cy0, cw, cw); ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(ccx, ccy, r - 14, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, hour = i % 5 === 0, inner = r - (hour ? 78 : 44), outer = r - 30;
    ctx.lineWidth = hour ? 14 : 4; ctx.strokeStyle = hour ? gold : cream; ctx.beginPath();
    ctx.moveTo(ccx + Math.sin(a) * inner, ccy - Math.cos(a) * inner); ctx.lineTo(ccx + Math.sin(a) * outer, ccy - Math.cos(a) * outer); ctx.stroke();
  }
  ctx.fillStyle = gold; ctx.textAlign = 'center'; ctx.font = '22px Georgia'; ctx.fillText('LIVISTONE', ccx, ccy + 92);
  ctx.strokeStyle = cream; ctx.lineCap = 'round';
  for (const [a, length, width] of [[(10 + 8 / 60) / 12 * Math.PI * 2, r * .5, 16], [8 / 60 * Math.PI * 2, r * .74, 10]] as const) {
    ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(ccx - Math.sin(a) * 26, ccy + Math.cos(a) * 26); ctx.lineTo(ccx + Math.sin(a) * length, ccy - Math.cos(a) * length); ctx.stroke();
  }
  ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(ccx, ccy, 18, 0, Math.PI * 2); ctx.fill();
  // Map and timetable: the walking route from here, in the order the town map lists its stops.
  const [px, py, pw, ph] = ATLAS.panel; board(ATLAS.panel);
  ctx.textAlign = 'center'; ctx.fillStyle = cream; ctx.font = '500 40px Georgia'; ctx.fillText('LIVISTONE', px + pw / 2, py + 70);
  ctx.fillStyle = gold; ctx.font = '20px sans-serif'; ctx.fillText('ON FOOT FROM THE STATION', px + pw / 2, py + 102);
  const stops = ['Embryo Station  ·  you are here', 'King’s Chapel gate', 'City Hall', 'Ministry of Energy', 'Ministry of Science', 'Timeface Tower', 'Glucose Commons', 'Vittoria Lake', 'Future House', 'Materialized Enhancements'];
  ctx.strokeStyle = gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px + 60, py + 140); ctx.lineTo(px + 60, py + 140 + (stops.length - 1) * 34); ctx.stroke();
  stops.forEach((stop, i) => {
    const y = py + 140 + i * 34; ctx.fillStyle = i ? gold : '#e9c46a'; ctx.beginPath(); ctx.arc(px + 60, y, i ? 7 : 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cream; ctx.textAlign = 'left'; ctx.font = (i ? '' : '600 ') + '22px sans-serif'; ctx.fillText(stop, px + 84, y + 8);
  });
  ctx.fillStyle = gold; ctx.fillRect(px + 40, py + 478, pw - 80, 2);
  ctx.fillStyle = cream; ctx.textAlign = 'center'; ctx.font = '500 28px Georgia'; ctx.fillText('TIMETABLE', px + pw / 2, py + 518);
  ctx.font = '20px sans-serif'; ctx.fillText('Maglev New Horizons, platform 1', px + pw / 2, py + 552); ctx.fillText('every 20 minutes  ·  06:10 to 23:50', px + pw / 2, py + 580);
  return canvas;
}

/** Map a geometry's 0–1 UVs into an atlas region, or (`solid`) paint the whole part with the region's colour. */
function toRegion(geometry: THREE.BufferGeometry, [x, y, w, h]: Region, solid = false): THREE.BufferGeometry {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const u = solid ? .5 : uv.getX(i), v = solid ? .5 : uv.getY(i);
    uv.setXY(i, (x + u * w) / ATLAS.width, 1 - (y + (1 - v) * h) / ATLAS.height);
  }
  return geometry;
}

/**
 * The hanging clock and departures board and the standing map panel (sub-plan 28), in the dark-green-and-gold sign style: one
 * canvas atlas and one draw for faces and bodies. Every face has its own correctly oriented reverse, as the other station signs.
 */
function platformBoards(station: THREE.Group, hang: (x: number, z: number, bottom: number) => void): void {
  const parts: THREE.BufferGeometry[] = [];
  const faces = (geometry: () => THREE.BufferGeometry, region: Region, x: number, y: number, z: number, depth: number): void => {
    parts.push(toRegion(geometry(), region).translate(x, y, z + depth / 2 + .004), toRegion(geometry(), region).rotateY(Math.PI).translate(x, y, z - depth / 2 - .004));
  };
  const { departures: d, clock: c, panel: p } = FITTINGS;
  parts.push(toRegion(box(d.x, d.y, d.z, d.width + .08, d.height + .08, .12), ATLAS.green, true));
  faces(() => new THREE.PlaneGeometry(d.width, d.height), ATLAS.departures, d.x, d.y, d.z, .12);
  for (const dx of [-1.3, 1.3]) hang(d.x + dx, d.z, d.y + d.height / 2 + .04);
  parts.push(toRegion(new THREE.CylinderGeometry(c.radius + .04, c.radius + .04, .16, 40).rotateX(Math.PI / 2).translate(c.x, c.y, c.z), ATLAS.green, true));
  for (const side of [1, -1]) parts.push(toRegion(new THREE.TorusGeometry(c.radius + .04, .03, 8, 40).translate(c.x, c.y, c.z + side * .08), ATLAS.gold, true));
  faces(() => new THREE.CircleGeometry(c.radius, 48), ATLAS.clock, c.x, c.y, c.z, .16);
  hang(c.x, c.z, c.y + c.radius + .04);
  const floor = STATION.floor, py = floor + p.bottom + p.height / 2;
  parts.push(toRegion(box(p.x, py, p.z, p.width + .08, p.height + .08, .09), ATLAS.green, true));
  faces(() => new THREE.PlaneGeometry(p.width, p.height), ATLAS.panel, p.x, py, p.z, .09);
  const map = new THREE.CanvasTexture(paintAtlas()); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  add(station, merge(parts), new THREE.MeshStandardMaterial({ map, roughness: .7, emissive: '#d4c69a', emissiveMap: map, emissiveIntensity: .22 }), 'Platform clock, departures board and map');
}

export function createStation(root: THREE.Group, colliders: ColliderSpec[], mobile: boolean, paving: THREE.Material): { object: THREE.Object3D; position: THREE.Vector3; posters: THREE.Mesh[] } {
  const station = createStationStructure(root, colliders, mobile, paving);
  const silver = new THREE.MeshStandardMaterial({ color: '#e1e8e8', metalness: .86, roughness: .21 });
  // Signs are world-space surfaces; the ordinary discovery input remains the only interaction.
  const sign = (width: number, height: number, title: string, subtitle: string): THREE.Mesh => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#233a35'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#bca467'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    ctx.fillStyle = '#f5e9c9'; ctx.textAlign = 'center'; ctx.font = '500 88px Georgia'; ctx.fillText(title, 512, canvas.height * .5);
    ctx.font = '30px sans-serif'; ctx.fillText(subtitle, 512, canvas.height * .77);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return add(station, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, roughness: .8, side: THREE.FrontSide, emissive: '#d4c69a', emissiveMap: map, emissiveIntensity: .25 }), title);
  };
  const entrance = sign(5.4, 1.3, 'EMBRYO', 'LIVISTONE  /  RAILWAY STATION'); entrance.position.set(-16, 4.25, -61.85);
  const platform = sign(5.2, 1.3, '01  /  NEW HORIZONS', 'MAGLEV  ·  BOARD AT THE OPEN GATES'); platform.position.set(6, 3.8, -73.4);
  const arrival = sign(4.3, 1.05, 'LIVISTONE STATION', 'CITY CENTRE  ↑'); arrival.position.set(-14, 3.6, -66); arrival.rotation.y = Math.PI;
  const boarding = sign(3.6, .8, 'BOARD HERE', 'LIVISTONE  ·  ARRIVALS'); boarding.position.set(-14, 3.6, -76.1);
  const hangers: THREE.BufferGeometry[] = [];
  const hang = (x: number, z: number, bottom: number): void => { const top = stationAmberSoffit(x, z).y; hangers.push(box(x, (top + bottom) / 2, z, .035, top - bottom, .035)); };
  for (const board of [entrance, platform, arrival]) for (const dx of [-2, 2]) hang(board.position.x + dx, board.position.z, board.position.y + .65);
  if (!stationClassic()) platformBoards(station, hang);
  add(station, merge(hangers), silver, 'Suspended station signs');
  const story = createPlaceSign(station, colliders, { x: -8.5, z: -66.35, yaw: 0 }, 'Station story panel');
  paintPlaceSign(story, { eyebrow: 'The Embryo Station', title: 'New beginnings', body: 'Livia’s Embryo Ring holds raw amber in an organic embrace of sterling-silver prongs. In Livia Lore it blesses new projects and beginnings; Livistone makes it a station for journeys yet to come.', footer: 'Click, or E / tap, for the story of the Embryo Ring' });
  for (const face of story.faces) face.userData.discovery = 'embryo-station';
  // Independent front faces keep reverse lettering readable instead of mirrored.
  for (const board of [entrance, platform, boarding]) {
    const back = board.clone(); back.rotation.y = Math.PI; back.position.z -= .035; back.name = board.name + ' · reverse'; station.add(back);
  }
  const posters = [...createTrainCabinGraphics(station.getObjectByName('Panoramic maglev') as THREE.Group), ...story.faces];
  return { object: story.faces[0], position: story.position.clone(), posters };
}
