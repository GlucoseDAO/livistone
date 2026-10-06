import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Offline asset build: the running game loads the resulting GLBs, not the generator.
const texturesReady = new Promise<void>((resolve) => { THREE.DefaultLoadingManager.onLoad = resolve; });
// `file`: species sharing one GLB, each under a group of its name, so their common bark and needle textures are stored once.
type Spec = { name: string; file?: string; preset: string; seed: number; height: number; leaf: string; shape: (tree: Tree) => void };
// Oak and ash keep their first build's settings, so a full rebuild reproduces them. The mountain conifers (sub-plan 27, round 3)
// follow the owner's Jepii Mici photographs: Norway spruce above the gorge, larch on its walls, dwarf pine on the ledges.
const SPECS: Spec[] = [
  { name: 'oak', preset: 'Oak Medium', seed: 713, height: 12, leaf: '#c5d5a4', shape: (tree) => { tree.options.branch.children[0] = 7; tree.options.branch.children[1] = 5; tree.options.leaves.count = 12; tree.options.leaves.size *= 1.15; } },
  { name: 'ash', preset: 'Ash Medium', seed: 146, height: 12, leaf: '#c5d5a4', shape: (tree) => { tree.options.branch.children[0] = 7; tree.options.branch.children[1] = 5; tree.options.leaves.count = 12; tree.options.leaves.size *= 1.15; } },
  // A narrow dark spire: whorls all the way down that droop a little, each with short side shoots, densely needled. The shoots are
  // thin enough that few sides and sections keep the tree near the ash's triangle count.
  { name: 'spruce', file: 'conifers', preset: 'Pine Medium', seed: 2711, height: 17, leaf: '#6f8a66', shape: (tree) => {
    const { branch, leaves } = tree.options; branch.levels = 2; branch.children[0] = 64; branch.children[1] = 4; branch.angle[1] = 100; branch.angle[2] = 48;
    branch.length[1] *= .78; branch.length[2] = 5; branch.radius[2] = .45; branch.start[2] = .2; branch.force.strength = -.008; branch.gnarliness[1] = .06;
    branch.sections[1] = 5; branch.segments[1] = 4; branch.sections[2] = 3; branch.segments[2] = 3; leaves.count = 16; leaves.size *= 1.6; leaves.start = 0;
  } },
  // Open and pale: fewer, longer, upswept whorls with tufts of light needles.
  { name: 'larch', file: 'conifers', preset: 'Pine Medium', seed: 5113, height: 15, leaf: '#b7c98f', shape: (tree) => {
    const { branch, leaves } = tree.options; branch.levels = 2; branch.children[0] = 44; branch.children[1] = 4; branch.angle[1] = 80; branch.angle[2] = 40;
    branch.length[1] *= .8; branch.length[2] = 4.5; branch.radius[2] = .4; branch.start[2] = .25; branch.gnarliness[1] = .14;
    branch.sections[1] = 5; branch.segments[1] = 4; branch.sections[2] = 3; branch.segments[2] = 3; leaves.count = 10; leaves.size *= 1.45; leaves.start = 0;
  } },
  // Pinus mugo: a low cushion of many stems rising from the base and spreading, needled to the ground.
  { name: 'dwarf-pine', file: 'conifers', preset: 'Pine Medium', seed: 907, height: 2.2, leaf: '#6c8461', shape: (tree) => {
    const { branch, leaves } = tree.options; branch.levels = 2; branch.length[0] = 10; branch.radius[0] = .9; branch.children[0] = 14; branch.start[1] = 0; branch.angle[1] = 62;
    branch.length[1] = 16; branch.radius[1] = .5; branch.children[1] = 5; branch.angle[2] = 38; branch.length[2] = 6; branch.radius[2] = .35; branch.start[2] = .15;
    branch.gnarliness[1] = .25; branch.gnarliness[2] = .2; branch.force.strength = .006; branch.sections[1] = 5; branch.segments[1] = 4; branch.sections[2] = 3; branch.segments[2] = 3;
    leaves.count = 14; leaves.size *= 1.8; leaves.start = 0;
  } },
];
const only = new URLSearchParams(location.search).get('only')?.split(',');
const files = new Map<string, THREE.Group>(), triangles = new Map<string, number>();
for (const { name, file, preset, seed, height, leaf, shape } of SPECS.filter(spec => !only || only.includes(spec.file ?? spec.name))) {
  const tree = new Tree(); tree.loadPreset(preset); tree.options.seed = seed;
  shape(tree);
  tree.generate();
  await texturesReady;
  const root = files.get(file ?? name) ?? new THREE.Group(); files.set(file ?? name, root);
  const group = file ? Object.assign(new THREE.Group(), { name }) : root; if (file) root.add(group);
  for (const source of [tree.branchesMesh, tree.leavesMesh]) {
    const old = source.material as THREE.MeshPhongMaterial;
    const mat = new THREE.MeshStandardMaterial({ map: old.map, normalMap: old.normalMap, color: old.color, roughness: 0.9, side: old.side, alphaTest: old.alphaTest });
    if (source === tree.leavesMesh) { mat.color.set(leaf); mat.alphaTest = 0.45; }
    const geometry = source.geometry.clone();
    // Export at the species' height, independent of preset units.
    const bounds = new THREE.Box3().setFromObject(tree); const scale = height / (bounds.max.y - bounds.min.y);
    geometry.translate(0, -bounds.min.y, 0); geometry.scale(scale, scale, scale);
    const part = new THREE.Mesh(geometry, mat); part.name = source === tree.leavesMesh ? 'foliage' : 'branches'; group.add(part);
  }
  triangles.set(file ?? name, (triangles.get(file ?? name) ?? 0) + tree.triangleCount);
}
const assets: { name: string; base64: string; triangles: number }[] = [];
for (const [name, group] of files) {
  const glb = await new GLTFExporter().parseAsync(group, { binary: true, maxTextureSize: 512 }) as ArrayBuffer;
  let binary = ''; for (const byte of new Uint8Array(glb)) binary += String.fromCharCode(byte);
  assets.push({ name, base64: btoa(binary), triangles: triangles.get(name)! });
}
Object.assign(window, { treeAssets: assets }); document.body.textContent = 'Trees ready.';
