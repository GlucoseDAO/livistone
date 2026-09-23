import * as THREE from 'three';
import { ENHANCEMENT_CATEGORIES, ENHANCEMENT_POSTERS, ENHANCEMENT_URL, enhancementImage } from '../game/enhancement';
import type { CategoryIcon, EnhancementCategory, EnhancementPoster } from '../game/enhancement';
import { photoSize } from '../game/exhibits';
import { GALLERY, POSTER_SITES, STAND_SITES } from './enhancement-layout';
import { addGlow, nightEmission } from './night-lighting';
import type { ColliderSpec } from '../game/physics';
import type { Interactive } from './world';

const PAPER = '#f4f0e5', BOARD = { height: 3.1, y: 1.9, depth: .09 }, PLINTH = { height: .95, depth: .9 }, EMBLEM = { y: 2.05, z: -.39, radius: .42 };
const STORY = 'materialized-enhancements';

export interface GeneratedCrystal { category: string; seed: number; genes: number; sha256: string; triangles: number; positions: number[]; indices: number[] }
/** Every generated triangle, flat back down on its plinth: STL Z becomes world Y, shown at ten times the STL's millimetres. */
export function crystalGeometry(source: GeneratedCrystal): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.positions.map(v => v * .001), 3)); geometry.setIndex(source.indices);
  geometry.rotateX(-Math.PI / 2); geometry.computeBoundingBox();
  const box = geometry.boundingBox!; geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.computeVertexNormals(); return geometry;
}
export function enhancementGalleryColliders(): ColliderSpec[] {
  return [
    ...POSTER_SITES.flatMap((p): ColliderSpec[] => [{ type: 'box', position: [p.x, BOARD.y, p.z], size: [GALLERY.posterWidth / 2, BOARD.height / 2, BOARD.depth / 2] }, { type: 'box', position: [p.x, .12, p.z], size: [GALLERY.posterWidth * .35, .12, .24] }]),
    ...STAND_SITES.flatMap((p): ColliderSpec[] => [{ type: 'box', position: [p.x, PLINTH.height / 2, p.z], size: [GALLERY.standWidth / 2 + .02, PLINTH.height / 2, PLINTH.depth / 2 + .02] }, { type: 'box', position: [p.x, 1.5, p.z + EMBLEM.z], size: [.05, .56, .05] }]),
  ];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number): number {
  let current = '';
  for (const word of text.split(' ')) { if (current && ctx.measureText(current + ' ' + word).width > width) { ctx.fillText(current, x, y); y += line; current = word; } else current += (current ? ' ' : '') + word; }
  ctx.fillText(current, x, y); return y + line;
}
function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; draw(canvas.getContext('2d')!);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; return map;
}
function posterCaption(poster: EnhancementPoster): THREE.CanvasTexture {
  return canvasTexture(1024, 640, ctx => {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#5b4bc4'; ctx.font = '600 22px sans-serif'; ctx.fillText('MATERIALIZED ENHANCEMENTS', 48, 62);
    ctx.fillStyle = '#25473b'; ctx.font = '46px Georgia'; const y = wrap(ctx, poster.title, 48, 122, 930, 52);
    ctx.fillStyle = '#445c4b'; ctx.font = '28px sans-serif'; wrap(ctx, poster.body, 48, y + 14, 930, 38);
    ctx.fillStyle = '#687461'; ctx.font = '22px sans-serif'; ctx.fillText(poster.credit, 48, 560);
    ctx.fillStyle = '#25473b'; ctx.font = '600 24px sans-serif'; ctx.fillText('Click to open enhancement.bio ↗  ·  E for the story', 48, 604);
  });
}
function standLabel(category: EnhancementCategory, genes: number, seed: number): THREE.CanvasTexture {
  return canvasTexture(1040, 640, ctx => {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1040, 640); ctx.fillStyle = category.color; ctx.fillRect(0, 0, 18, 640);
    ctx.font = '600 22px sans-serif'; ctx.fillText('GENE CATEGORY', 52, 62);
    ctx.fillStyle = '#25473b'; ctx.font = '50px Georgia'; ctx.fillText(category.name, 52, 124, 950);
    ctx.fillStyle = '#445c4b'; ctx.font = '29px sans-serif'; let y = wrap(ctx, category.description, 52, 180, 940, 40);
    ctx.font = 'italic 26px sans-serif'; y = wrap(ctx, 'Genes include ' + category.genes + '.', 52, y + 10, 940, 36);
    ctx.fillStyle = '#687461'; ctx.font = '23px sans-serif'; wrap(ctx, `Crystal above: grown by the project’s pipeline from all ${genes} game genes in this category · seed ${seed} · 10× STL size`, 52, 540, 940, 30);
    ctx.fillStyle = '#25473b'; ctx.font = '600 24px sans-serif'; ctx.fillText('Click to open enhancement.bio ↗', 52, 612);
  });
}
/** Simplified category marks drawn in a unit square; the website uses Fomantic UI icons with the same meanings. */
function drawIcon(ctx: CanvasRenderingContext2D, icon: CategoryIcon, color: string, background: string): void {
  ctx.fillStyle = ctx.strokeStyle = color; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
  if (icon === 'shield') {
    ctx.moveTo(0, -1); ctx.bezierCurveTo(.45, -.74, .78, -.76, .85, -.72); ctx.lineTo(.85, -.1); ctx.bezierCurveTo(.85, .45, .42, .8, 0, 1); ctx.bezierCurveTo(-.42, .8, -.85, .45, -.85, -.1); ctx.lineTo(-.85, -.72); ctx.bezierCurveTo(-.78, -.76, -.45, -.74, 0, -1); ctx.fill();
    ctx.fillStyle = background; ctx.globalAlpha = .35; ctx.beginPath(); ctx.moveTo(0, -.78); ctx.bezierCurveTo(.36, -.58, .6, -.6, .66, -.56); ctx.lineTo(.66, -.1); ctx.bezierCurveTo(.66, .34, .34, .62, 0, .8); ctx.fill(); ctx.globalAlpha = 1;
  } else if (icon === 'heartbeat') {
    ctx.moveTo(0, .88); ctx.bezierCurveTo(-1.15, .1, -.95, -1, 0, -.42); ctx.bezierCurveTo(.95, -1, 1.15, .1, 0, .88); ctx.fill();
    ctx.strokeStyle = background; ctx.lineWidth = .13; ctx.beginPath(); ctx.moveTo(-1, .02); ctx.lineTo(-.42, .02); ctx.lineTo(-.24, -.36); ctx.lineTo(0, .42); ctx.lineTo(.18, -.14); ctx.lineTo(.3, .02); ctx.lineTo(1, .02); ctx.stroke();
  } else if (icon === 'sync') {
    ctx.lineWidth = .2;
    for (const [start, end] of [[-2.7, -.35], [.44, 2.79]]) {
      ctx.beginPath(); ctx.arc(0, 0, .68, start, end); ctx.stroke();
      const ex = Math.cos(end) * .68, ey = Math.sin(end) * .68, tx = -Math.sin(end), ty = Math.cos(end), nx = Math.cos(end), ny = Math.sin(end);
      ctx.beginPath(); ctx.moveTo(ex + tx * .34, ey + ty * .34); ctx.lineTo(ex + nx * .26, ey + ny * .26); ctx.lineTo(ex - nx * .26, ey - ny * .26); ctx.closePath(); ctx.fill();
    }
  } else if (icon === 'globe') {
    ctx.lineWidth = .11; ctx.arc(0, 0, .86, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, .38, .86, 0, 0, Math.PI * 2); ctx.moveTo(0, -.86); ctx.lineTo(0, .86); ctx.moveTo(-.86, 0); ctx.lineTo(.86, 0);
    for (const y of [-.46, .46]) { ctx.moveTo(-.72, y); ctx.lineTo(.72, y); } ctx.stroke();
  } else if (icon === 'eye') {
    ctx.moveTo(-1, 0); ctx.quadraticCurveTo(0, -.98, 1, 0); ctx.quadraticCurveTo(0, .98, -1, 0); ctx.fill();
    ctx.fillStyle = background; ctx.beginPath(); ctx.arc(0, 0, .38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, .18, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.lineWidth = .22; ctx.moveTo(.82, -.82); ctx.lineTo(.12, -.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(.16, -.3); ctx.bezierCurveTo(-.2, -.3, -.3, .1, -.42, .36); ctx.bezierCurveTo(-.55, .66, -.78, .74, -.92, .8); ctx.bezierCurveTo(-.5, .96, -.05, .82, .16, .52); ctx.bezierCurveTo(.3, .3, .32, 0, .3, -.16); ctx.closePath(); ctx.fill();
  }
}
function emblem(category: EnhancementCategory): THREE.CanvasTexture {
  return canvasTexture(512, 512, ctx => {
    const navy = '#16133a', glow = ctx.createRadialGradient(256, 230, 20, 256, 256, 256);
    ctx.fillStyle = navy; ctx.fillRect(0, 0, 512, 512); glow.addColorStop(0, category.color + '55'); glow.addColorStop(1, category.color + '00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
    ctx.lineWidth = 16; ctx.strokeStyle = category.color; ctx.beginPath(); ctx.arc(256, 256, 240, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(256, 206); ctx.scale(92, 92); drawIcon(ctx, category.icon, category.color, navy); ctx.restore();
    ctx.fillStyle = '#f2efff'; ctx.textAlign = 'center'; ctx.font = '600 38px sans-serif';
    const words = category.name.split(' '), lines = words.length > 2 ? [words.slice(0, -1).join(' '), words.at(-1)!] : ctx.measureText(category.name).width > 380 ? words : [category.name];
    lines.forEach((line, i) => ctx.fillText(line, 256, 372 + i * 44 - (lines.length - 1) * 16, 400));
  });
}
function clickable(mesh: THREE.Mesh, name: string): THREE.Mesh { mesh.name = name; mesh.userData.href = ENHANCEMENT_URL; mesh.userData.discovery = STORY; return mesh; }

/** Photo posters and category crystals in front of the hill; every face opens enhancement.bio when clicked. */
export function createEnhancementGallery(parent: THREE.Group, colliders: ColliderSpec[]): { panels: THREE.Mesh[]; interactives: Interactive[]; ready: Promise<void> } {
  const panels: THREE.Mesh[] = [], interactives: Interactive[] = [], tasks: Promise<void>[] = [];
  colliders.push(...enhancementGalleryColliders());
  const paper = new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false }), metal = new THREE.MeshStandardMaterial({ color: '#8f8aa8', metalness: .6, roughness: .35 });
  const back = new THREE.MeshBasicMaterial({ map: canvasTexture(512, 768, ctx => { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 512, 768); ctx.fillStyle = '#5b4bc4'; ctx.textAlign = 'center'; ctx.font = '600 30px sans-serif'; ctx.fillText('MATERIALIZED', 256, 330); ctx.fillText('ENHANCEMENTS', 256, 372); ctx.fillStyle = '#25473b'; ctx.font = '26px sans-serif'; ctx.fillText('enhancement.bio ↗', 256, 440); }), toneMapped: false });
  ENHANCEMENT_POSTERS.forEach((poster, i) => {
    const site = POSTER_SITES[i], group = new THREE.Group(); group.position.copy(site); group.name = 'Enhancement poster · ' + poster.title; parent.add(group);
    const board = new THREE.Mesh(new THREE.BoxGeometry(GALLERY.posterWidth, BOARD.height, BOARD.depth), paper); board.position.y = BOARD.y; group.add(board);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(GALLERY.posterWidth * .7, .24, .48), metal); foot.position.y = .12; group.add(foot);
    const caption = clickable(new THREE.Mesh(new THREE.PlaneGeometry(2, 1.25), new THREE.MeshBasicMaterial({ map: posterCaption(poster), toneMapped: false })), 'Enhancement poster caption'); caption.position.set(0, 1.05, BOARD.depth / 2 + .006); group.add(caption);
    const picture = clickable(new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.72), new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false })), 'Enhancement poster photo'); picture.position.set(0, 2.56, BOARD.depth / 2 + .008); group.add(picture);
    const reverse = clickable(new THREE.Mesh(new THREE.PlaneGeometry(2, 3), back), 'Enhancement poster reverse'); reverse.position.set(0, BOARD.y, -BOARD.depth / 2 - .006); reverse.rotation.y = Math.PI; group.add(reverse);
    panels.push(caption, picture, reverse);
    interactives.push({ id: STORY, object: caption, position: site.clone().setY(1.6) });
    tasks.push(new THREE.TextureLoader().loadAsync(enhancementImage(poster.slug)).then(map => {
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; const image = map.image as HTMLImageElement, size = photoSize(image.naturalWidth, image.naturalHeight, 1.96, 1.72);
      picture.geometry.dispose(); picture.geometry = new THREE.PlaneGeometry(size.width, size.height); const material = picture.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = map; material.needsUpdate = true;
    }).catch(() => { picture.visible = false; }));
  });
  const plinth = new THREE.MeshStandardMaterial({ color: '#2a2560', metalness: .2, roughness: .5 }), stands: { category: EnhancementCategory; group: THREE.Group; accent: THREE.MeshStandardMaterial; label: THREE.Mesh }[] = [];
  ENHANCEMENT_CATEGORIES.forEach((category, i) => {
    const site = STAND_SITES[i], group = new THREE.Group(); group.position.copy(site); group.name = 'Enhancement category · ' + category.name; parent.add(group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(GALLERY.standWidth, PLINTH.height, PLINTH.depth), plinth); base.position.y = PLINTH.height / 2; group.add(base);
    const accent = new THREE.MeshStandardMaterial({ color: category.color, metalness: .15, roughness: .42, flatShading: true }); nightEmission(accent, category.color, .5);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(GALLERY.standWidth + .04, .05, PLINTH.depth + .04), accent); rim.position.y = PLINTH.height + .025; group.add(rim);
    const label = clickable(new THREE.Mesh(new THREE.PlaneGeometry(1.3, .8), new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false })), 'Enhancement category label'); label.position.set(0, .48, PLINTH.depth / 2 + .005); group.add(label);
    stands.push({ category, group, accent, label });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.12, 8), metal); post.position.set(0, PLINTH.height + .56, EMBLEM.z); group.add(post);
    const face = new THREE.MeshBasicMaterial({ map: emblem(category), toneMapped: false });
    for (const side of [1, -1]) {
      const disc = clickable(new THREE.Mesh(new THREE.CircleGeometry(EMBLEM.radius, 48), face), 'Enhancement category emblem'); disc.position.set(0, EMBLEM.y, EMBLEM.z + side * .045); if (side < 0) disc.rotation.y = Math.PI; group.add(disc); panels.push(disc);
    }
    panels.push(label); interactives.push({ id: STORY, object: label, position: site.clone().setY(1.2) });
    addGlow(group, new THREE.Vector3(0, EMBLEM.y, EMBLEM.z + .1), category.color, 1.6, 0, 6, .28);
  });
  // The meshes load as their own chunk; the rim already registers each accent material for night lighting.
  tasks.push(import('./models/enhancement-crystals.json').then(({ default: data }) => {
    for (const { category, group, accent, label } of stands) {
      const source = data.crystals.find(c => c.category === category.name)!;
      const crystal = new THREE.Mesh(crystalGeometry(source), accent); crystal.position.y = PLINTH.height + .05; crystal.castShadow = true; crystal.name = `Generated crystal · ${category.name} · seed ${source.seed}`; group.add(crystal);
      const material = label.material as THREE.MeshBasicMaterial; material.color.set('#ffffff'); material.map = standLabel(category, source.genes, source.seed); material.needsUpdate = true;
    }
  }));
  return { panels, interactives, ready: Promise.all(tasks).then(() => undefined) };
}
