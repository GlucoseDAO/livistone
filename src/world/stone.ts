import * as THREE from 'three';
import { dot, mix, texture, uniform, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { plantingAllowed } from './landscape';
import { terrainSurfaceHeight } from './terrain';
import { rockReach, seatedHeight, streamRockSites } from './river-rocks';
import { riverCenter, tributaryCenter } from './waterways';
import type { RockSite } from './water-surface';

/** One four-metre tile, with separate colour and relief so mortar stays recessed. */
export function pavingMaterial(mobile = false): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas'), relief = document.createElement('canvas');
  canvas.width = canvas.height = relief.width = relief.height = 512;
  const ctx = canvas.getContext('2d')!, bump = relief.getContext('2d')!;
  let seed = 725; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = '#aaa38f'; ctx.fillRect(0, 0, 512, 512); bump.fillStyle = '#666666'; bump.fillRect(0, 0, 512, 512);
  // Staggered limestone courses wrap at the tile boundary; wide slabs and fine seams read at walking scale.
  for (let row = 0; row < 8; row++) {
    const y = row * 64, offset = row % 2 ? -64 : 0;
    const course = row % 3 === 0 ? [128, 192, 192] : row % 3 === 1 ? [192, 128, 192] : [192, 192, 128];
    for (let col = -1; col < 6; col++) {
      const slot = (col + 3) % 3, width = course[slot], x = Math.floor(col / 3) * 512 + course.slice(0, slot).reduce((sum, value) => sum + value, 0) + offset, light = 70 + rand() * 13;
      const points = [[x + 2, y + 2], [x + width - 3, y + 2 + rand() * 2], [x + width - 2, y + 61], [x + 2 + rand() * 2, y + 62]];
      for (const c of [ctx, bump]) {
        c.beginPath(); points.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath();
        c.fillStyle = c === ctx ? `hsl(40, ${10 + rand() * 8}%, ${light}%)` : '#c7c7c7'; c.fill();
        c.save(); c.clip();
        const wash = c.createLinearGradient(x, y, x + width, y + 64);
        wash.addColorStop(0, c === ctx ? 'rgba(255,250,228,.2)' : '#dedede'); wash.addColorStop(1, c === ctx ? 'rgba(103,92,70,.13)' : '#aaaaaa');
        c.fillStyle = wash; c.fillRect(x, y, width, 64);
        for (let vein = 0; vein < 3; vein++) {
          c.beginPath(); const vy = y + rand() * 64;
          c.moveTo(x, vy); c.bezierCurveTo(x + 45, vy - 12, x + 85, vy + 15, x + width, vy + 8);
          c.strokeStyle = c === ctx ? 'rgba(117,107,88,.13)' : 'rgba(80,80,80,.12)'; c.lineWidth = .5 + rand(); c.stroke();
        }
        c.restore();
        c.strokeStyle = c === ctx ? 'rgba(255,250,233,.35)' : '#b4b4b4'; c.lineWidth = 1; c.stroke();
      }
    }
  }
  for (let i = 0; i < 38000; i++) {
    const x = rand() * 512, y = rand() * 512, size = .5 + rand() * 2;
    ctx.fillStyle = i % 2 ? 'rgba(69,61,42,.09)' : 'rgba(255,252,226,.15)'; ctx.fillRect(x, y, size, size);
    bump.fillStyle = 'rgba(65,65,65,.12)'; bump.fillRect(x, y, size, size);
  }
  const map = new THREE.CanvasTexture(canvas), bumpMap = new THREE.CanvasTexture(relief);
  for (const t of [map, bumpMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = mobile ? 2 : 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map, bumpMap: mobile ? null : bumpMap, bumpScale: .012, roughness: .96, side: THREE.DoubleSide });
  material.userData.ready = new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + `textures/paving/limestone-${mobile ? 512 : 1024}.webp`).then(stone => {
    stone.colorSpace = THREE.SRGBColorSpace; stone.wrapS = stone.wrapT = THREE.RepeatWrapping; stone.anisotropy = mobile ? 2 : 8;
    // Dark joints give restrained relief; colour variation is not used as physical displacement.
    material.map = stone; material.bumpMap = mobile ? null : stone; material.needsUpdate = true; map.dispose(); bumpMap.dispose();
  }).catch(() => { /* The procedural fallback keeps all paths visible if the local texture fails. */ });
  return material;
}

export function rockMaterial(mobile: boolean): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1 }), loader = new THREE.TextureLoader();
  loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-color.jpg', (map) => {
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = mobile ? 2 : 4;
    // Retain scanned mineral detail, but remove the source map's rusty brown cast: its value shades the rock, not its hue.
    // colorNode replaces the map multiply; .map stays set for the cpu tier's Lambert copy, which keeps the plain map.
    material.map = map; material.colorNode = (uniform(material.color) as unknown as Node<'vec3'>).mul(mix(vec3(.55), vec3(1.05), dot(texture(map).rgb, vec3(.2126, .7152, .0722)))); material.needsUpdate = true;
  }, undefined, () => { /* Vertex colour keeps the stones usable without the optional surface map. */ });
  if (!mobile) loader.load(import.meta.env.BASE_URL + 'textures/mountains/rock-normal.jpg', (map) => {
    map.wrapS = map.wrapT = THREE.RepeatWrapping; material.normalMap = map; material.normalScale.set(.65, .65); material.needsUpdate = true;
  }, undefined, () => { /* The silhouette remains modelled if relief cannot load. */ });
  return material;
}

/**
 * Seeded boulders along the river and both tributaries, then a few standing in the shallow edge. The instanced rocks, their
 * colliders and the water's rock foam all read this one list. Bank rocks rest on the triangulated ground the player walks on.
 */
export function riverRockSites(mobile: boolean): RockSite[] {
  let seed = 58; const rand = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const count = mobile ? 230 : 420, sites: RockSite[] = [];
  for (let i = 0; i < count * 3 && sites.length < count; i++) {
    let x = (rand() - 0.5) * 170, z = riverCenter(x) + (i % 2 ? 1 : -1) * (7.4 + rand() * 2);
    if (i % 3) { z = -49 + rand() * 70; x = tributaryCenter(z, i % 2 ? 1 : -1) + (i % 4 < 2 ? 1 : -1) * (4.1 + rand() * 1.6); }
    const s = i % 5 ? .16 + rand() * .35 : .65 + rand() * .6;
    if (!plantingAllowed(x, z, s * 1.45)) continue;
    const site = { x, y: Math.max(terrainSurfaceHeight(x, z) + s * .26, -.62 - s * .2), z, s, yaw: rand() * Math.PI * 2 };
    // On a slope the downhill underside would lift clear of the ground: sink the rock just enough to bury it.
    sites.push({ ...site, y: Math.min(site.y, seatedHeight(site, 0)) });
  }
  // The few rocks standing in the stream displace any bank rock they would overlap.
  const stream = streamRockSites(mobile);
  return [...sites.filter(b => stream.every(r => Math.hypot(r.x - b.x, r.z - b.z) >= (rockReach(r.s) + rockReach(b.s)) * .9)), ...stream];
}
