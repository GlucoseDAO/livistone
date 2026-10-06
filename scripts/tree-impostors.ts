import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TREE_SPECIES } from '../src/world/forest-layout';

// Offline bake (scripts/build-tree-impostors.ts): each species seen from the side, unlit, into one cell of an atlas that the summit
// view's far trees (forest.ts) draw as camera-facing cards. Each cell is a square of `size` metres, the tree's base at the middle of
// its lower edge. Rendered at twice the cell size into half floats, then averaged, encoded to sRGB and its colours bled into the
// transparent texels, so mipmaps never darken the crowns' edges.
const CELL = 256, SUPER = 2, loader = new GLTFLoader();
const renderer = new THREE.WebGPURenderer({ forceWebGL: true, antialias: false }); await renderer.init();
const target = new THREE.RenderTarget(CELL * SUPER, CELL * SUPER, { type: THREE.HalfFloatType });
const scene = new THREE.Scene(), files = new Map<string, THREE.Group>(), cells: { name: string; size: number }[] = [];
const atlas = document.createElement('canvas'); atlas.width = CELL * TREE_SPECIES.length; atlas.height = CELL; const paint = atlas.getContext('2d')!;
for (const [i, species] of TREE_SPECIES.entries()) {
  const file = files.get(species.file) ?? (await loader.loadAsync('/models/trees/' + species.file + '.glb')).scene; files.set(species.file, file);
  const tree = (species.file === species.name ? file : file.getObjectByName(species.name)!).clone(); tree.position.set(0, 0, 0); tree.updateMatrixWorld(true);
  tree.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return; const source = o.material as THREE.MeshStandardMaterial;
    o.material = new THREE.MeshBasicNodeMaterial({ map: source.map, color: source.color, alphaTest: source.alphaTest || .45, side: THREE.DoubleSide });
  });
  const box = new THREE.Box3().setFromObject(tree), size = Math.max(box.max.y, 2 * Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)) * 1.02;
  const camera = new THREE.OrthographicCamera(-size / 2, size / 2, size, 0, -100, 100); camera.position.set(0, 0, 50); camera.lookAt(0, 0, 0); camera.position.set(0, 0, 50);
  scene.clear(); scene.add(tree);
  renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
  const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, CELL * SUPER, CELL * SUPER) as Uint16Array;
  const half = (k: number): number => THREE.DataUtils.fromHalfFloat(raw[k]), srgb = (c: number): number => Math.round(255 * Math.min(1, c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055));
  const rgb = new Float32Array(CELL * CELL * 3), alpha = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SUPER; dy++) for (let dx = 0; dx < SUPER; dx++) { const k = ((y * SUPER + dy) * CELL * SUPER + x * SUPER + dx) * 4, w = half(k + 3) > 0 ? 1 : 0; r += half(k) * w; g += half(k + 1) * w; b += half(k + 2) * w; a += w; }
    // Render targets read bottom row first; the atlas is stored top row first.
    const o = (CELL - 1 - y) * CELL + x; alpha[o] = a / (SUPER * SUPER); if (a) { rgb[o * 3] = r / a; rgb[o * 3 + 1] = g / a; rgb[o * 3 + 2] = b / a; }
  }
  // Bleed: each pass gives every still-empty texel the mean of its filled neighbours.
  const filled = Uint8Array.from(alpha, a => a > 0 ? 1 : 0);
  for (let pass = 0; pass < 24; pass++) {
    const next = filled.slice();
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const o = y * CELL + x; if (filled[o]) continue; let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue; const q = ny * CELL + nx; if (filled[q]) { r += rgb[q * 3]; g += rgb[q * 3 + 1]; b += rgb[q * 3 + 2]; n++; } }
      if (n) { rgb[o * 3] = r / n; rgb[o * 3 + 1] = g / n; rgb[o * 3 + 2] = b / n; next[o] = 1; }
    }
    filled.set(next);
  }
  const image = paint.createImageData(CELL, CELL);
  for (let o = 0; o < CELL * CELL; o++) { image.data[o * 4] = srgb(rgb[o * 3]); image.data[o * 4 + 1] = srgb(rgb[o * 3 + 1]); image.data[o * 4 + 2] = srgb(rgb[o * 3 + 2]); image.data[o * 4 + 3] = Math.round(alpha[o] * 255); }
  paint.putImageData(image, i * CELL, 0);
  cells.push({ name: species.name, size: Number(size.toFixed(3)) });
}
Object.assign(window, { impostors: { webp: atlas.toDataURL('image/webp', .92), cells } }); document.body.textContent = 'Impostors ready.';
