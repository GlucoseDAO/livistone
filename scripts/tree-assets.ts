import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Offline asset build: the running game loads the resulting GLBs, not the generator.
const texturesReady = new Promise<void>((resolve) => { THREE.DefaultLoadingManager.onLoad = resolve; });
const assets: { name: string; base64: string; triangles: number }[] = [];
for (const [name, preset, seed] of [['oak', 'Oak Medium', 713], ['ash', 'Ash Medium', 146]] as const) {
  const tree = new Tree(); tree.loadPreset(preset); tree.options.seed = seed;
  tree.options.branch.children[0] = 7; tree.options.branch.children[1] = 5;
  tree.options.leaves.count = 12; tree.options.leaves.size *= 1.15;
  tree.generate();
  await texturesReady;
  const group = new THREE.Group();
  for (const source of [tree.branchesMesh, tree.leavesMesh]) {
    const old = source.material as THREE.MeshPhongMaterial;
    const mat = new THREE.MeshStandardMaterial({ map: old.map, normalMap: old.normalMap, color: old.color, roughness: 0.9, side: old.side, alphaTest: old.alphaTest });
    if (source === tree.leavesMesh) { mat.color.set('#c5d5a4'); mat.alphaTest = 0.45; }
    const geometry = source.geometry.clone();
    // Export at a consistent 12 m height, independent of preset units.
    const bounds = new THREE.Box3().setFromObject(tree); const scale = 12 / (bounds.max.y - bounds.min.y);
    geometry.translate(0, -bounds.min.y, 0); geometry.scale(scale, scale, scale);
    const part = new THREE.Mesh(geometry, mat); part.name = source === tree.leavesMesh ? 'foliage' : 'branches'; group.add(part);
  }
  const glb = await new GLTFExporter().parseAsync(group, { binary: true, maxTextureSize: 512 }) as ArrayBuffer;
  let binary = ''; for (const byte of new Uint8Array(glb)) binary += String.fromCharCode(byte);
  assets.push({ name, base64: btoa(binary), triangles: tree.triangleCount });
}
Object.assign(window, { treeAssets: assets }); document.body.textContent = 'Trees ready.';
