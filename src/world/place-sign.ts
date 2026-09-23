import { paintPosterText } from './poster-text';
import * as THREE from 'three';
import type { ColliderSpec } from '../game/physics';
import { nightEmission } from './night-lighting';

/** Building and place signs: larger than any jewelry poster, dark Livia-style face in a pierced cast-gold Voronoi frame. */
export const PLACE_SIGN = { width: 3, height: 2, frame: .24, centre: 2.05, depth: .07, postX: 1.25 };
const OUTER = { width: PLACE_SIGN.width + PLACE_SIGN.frame * 2, height: PLACE_SIGN.height + PLACE_SIGN.frame * 2 };
const BOTTOM = PLACE_SIGN.centre - OUTER.height / 2;
export interface PlaceSite { x: number; z: number; yaw: number }
export interface PlaceSign { group: THREE.Group; faces: THREE.Mesh[]; position: THREE.Vector3 }
export interface PlaceSignText { eyebrow: string; title: string; body: string; footer: string }

/** Board and both posts, in the parent's frame plus an optional offset for parents placed in world space. */
export function placeSignColliders(site: PlaceSite, offset = new THREE.Vector3()): ColliderSpec[] {
  const at = (dx: number, y: number): [number, number, number] => [site.x + offset.x + Math.cos(site.yaw) * dx, y + offset.y, site.z + offset.z - Math.sin(site.yaw) * dx];
  return [
    { type: 'box', position: at(0, PLACE_SIGN.centre), size: [OUTER.width / 2, OUTER.height / 2, PLACE_SIGN.depth / 2 + .01], yaw: site.yaw },
    ...[-1, 1].map((side): ColliderSpec => ({ type: 'box', position: at(side * PLACE_SIGN.postX, BOTTOM / 2), size: [.06, BOTTOM / 2, .06], yaw: site.yaw })),
  ];
}

function seeded(seed: number): () => number { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
/** A rounded band pierced by irregular cells, like the porous lattices on Livia's site and her parametric pieces. */
export function placeFrameGeometry(): THREE.BufferGeometry {
  const w = OUTER.width / 2, h = OUTER.height / 2, band = PLACE_SIGN.frame, round = .07, random = seeded(20260923), shape = new THREE.Shape();
  shape.moveTo(-w + round, -h); shape.lineTo(w - round, -h); shape.quadraticCurveTo(w, -h, w, -h + round); shape.lineTo(w, h - round); shape.quadraticCurveTo(w, h, w - round, h);
  shape.lineTo(-w + round, h); shape.quadraticCurveTo(-w, h, -w, h - round); shape.lineTo(-w, -h + round); shape.quadraticCurveTo(-w, -h, -w + round, -h);
  const iw = PLACE_SIGN.width / 2, ih = PLACE_SIGN.height / 2;
  shape.holes.push(new THREE.Path([new THREE.Vector2(-iw, -ih), new THREE.Vector2(-iw, ih), new THREE.Vector2(iw, ih), new THREE.Vector2(iw, -ih)]));
  // Packed cells of mixed size leave thin struts, largest first, like a cast porous lattice.
  const cells: { x: number; y: number; r: number }[] = [], edge = .022, strut = .016, perimeter = 2 * (OUTER.width + OUTER.height - band * 2);
  const fits = (x: number, y: number, r: number): boolean => {
    const ax = Math.abs(x), ay = Math.abs(y), inner = ax < iw && ay < ih ? -1 : Math.hypot(Math.max(ax - iw, 0), Math.max(ay - ih, 0)), qx = ax - w + round, qy = ay - h + round;
    const corner = qx <= 0 || qy <= 0 || Math.hypot(qx, qy) + r + edge <= round;
    return ax + r + edge <= w && ay + r + edge <= h && inner >= r + edge && corner && cells.every(c => Math.hypot(c.x - x, c.y - y) >= c.r + r + strut);
  };
  for (let attempt = 0; attempt < 9000; attempt++) {
    const stage = attempt / 9000, r = .075 - stage * .05 - random() * .012, s = random() * perimeter, across = (random() - .5) * band, cw = w - band / 2, ch = h - band / 2;
    const [x, y] = s < 2 * cw ? [-cw + s, -ch + across] : s < 2 * cw + 2 * ch ? [cw + across, -ch + s - 2 * cw] : s < 4 * cw + 2 * ch ? [cw - (s - 2 * cw - 2 * ch), ch + across] : [-cw + across, ch - (s - 4 * cw - 2 * ch)];
    if (r > .02 && fits(x, y, r)) cells.push({ x, y, r });
  }
  for (const { x, y, r } of cells) {
    const turn = random() * Math.PI;
    shape.holes.push(new THREE.Path(Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, k = r * (.9 + random() * .12); return new THREE.Vector2(x + Math.cos(a + turn) * k * 1.06, y + Math.sin(a + turn) * k * .94); })));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: PLACE_SIGN.depth, bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 1, curveSegments: 3 });
  return geometry.translate(0, 0, -PLACE_SIGN.depth / 2);
}

let frameGeometry: THREE.BufferGeometry | undefined;
/** DOM-independent: frame, board, posts and two blank faces; paintPlaceSign adds the lettering later. */
export function createPlaceSign(parent: THREE.Object3D, colliders: ColliderSpec[], site: PlaceSite, name: string, offset?: THREE.Vector3): PlaceSign {
  const group = new THREE.Group(); group.name = name; group.position.set(site.x, 0, site.z); group.rotation.y = site.yaw; parent.add(group);
  const gold = new THREE.MeshStandardMaterial({ color: '#d6a458', metalness: .8, roughness: .26 }); nightEmission(gold, '#d4943a', .22);
  const frame = new THREE.Mesh(frameGeometry ??= placeFrameGeometry(), gold); frame.position.y = PLACE_SIGN.centre; frame.castShadow = true; frame.name = name + ' · pierced frame'; group.add(frame);
  const board = new THREE.Mesh(new THREE.BoxGeometry(PLACE_SIGN.width + .06, PLACE_SIGN.height + .06, .05), new THREE.MeshBasicMaterial({ color: '#120f0c', toneMapped: false })); board.position.y = PLACE_SIGN.centre; group.add(board);
  for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, BOTTOM + .3, 8), gold); post.position.set(side * PLACE_SIGN.postX, (BOTTOM + .3) / 2, 0); post.castShadow = true; group.add(post); }
  const face = new THREE.MeshBasicMaterial({ color: '#120f0c', toneMapped: false }), faces = [1, -1].map(side => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PLACE_SIGN.width, PLACE_SIGN.height), face); mesh.position.set(0, PLACE_SIGN.centre, side * .027); if (side < 0) mesh.rotation.y = Math.PI; mesh.name = name + (side < 0 ? ' · reverse' : ''); group.add(mesh); return mesh;
  });
  colliders.push(...placeSignColliders(site, offset));
  return { group, faces, position: new THREE.Vector3(site.x, PLACE_SIGN.centre, site.z).add(offset ?? new THREE.Vector3()) };
}

/** Warm dark panel, letter-spaced serif capitals and the amber-to-green rule from livia.glucosedao.org. Both faces read correctly. */
export function paintPlaceSign(sign: PlaceSign, text: PlaceSignText): void {
  const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 1000; const ctx = canvas.getContext('2d')!, random = seeded(text.title.length * 7919 + 17);
  const background = ctx.createLinearGradient(0, 0, 1500, 1000); background.addColorStop(0, '#1d1812'); background.addColorStop(1, '#120f0c'); ctx.fillStyle = background; ctx.fillRect(0, 0, 1500, 1000);
  // Porous amber cells drift in from one corner and a faint green data line from the other, as on the artist's home page.
  for (let i = 0; i < 70; i++) { const x = 1500 - Math.pow(random(), 1.8) * 520, y = Math.pow(random(), 1.8) * 420, radius = 6 + random() * 30; ctx.strokeStyle = `rgba(212,148,58,${.07 + random() * .12})`; ctx.lineWidth = 2 + random() * 3; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(94,168,130,.22)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 40; x < 560; x += 8) { const y = 900 - Math.sin(x / 70) * 40 - x * .08; x === 40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  ctx.fillStyle = 'rgba(94,168,130,.35)'; for (let x = 60; x < 560; x += 70) { ctx.beginPath(); ctx.arc(x, 900 - Math.sin(x / 70) * 40 - x * .08, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,248,238,.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(34, 34, 1432, 932, 38); ctx.stroke();
  ctx.fillStyle = '#d4943a'; ctx.font = '600 30px sans-serif'; ctx.letterSpacing = '6px'; ctx.fillText(text.eyebrow.toUpperCase(), 100, 150);
  ctx.fillStyle = '#f5f0e8'; ctx.font = '84px Georgia, serif'; ctx.letterSpacing = '9px';
  const words = text.title.toUpperCase().split(' '), lines: string[] = []; for (const word of words) { const last = lines.at(-1); if (last && ctx.measureText(last + ' ' + word).width < 1300) lines[lines.length - 1] = last + ' ' + word; else lines.push(word); }
  lines.forEach((line, i) => ctx.fillText(line, 100, 265 + i * 100));
  let y = 265 + (lines.length - 1) * 100 + 52; const rule = ctx.createLinearGradient(100, 0, 480, 0); rule.addColorStop(0, '#d4943a'); rule.addColorStop(1, '#5ea882'); ctx.fillStyle = rule; ctx.fillRect(100, y, 380, 6);
  ctx.fillStyle = 'rgba(245,240,232,.86)'; ctx.letterSpacing = '0px';
  paintPosterText(ctx, text.body, 100, y + 40, 1290, 830 - (y + 40), 60);
  ctx.fillStyle = '#d4943a'; ctx.font = '600 34px sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText(text.footer, 100, 900);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const material = sign.faces[0].material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
}
