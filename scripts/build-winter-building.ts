/** Export the first approved Winter building study, preserving the original optimized silver mesh. Run with Bun. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createWinterGate } from '../src/world/winter-gate';
import { WINTER } from '../src/world/winter-gate-layout';

// GLTFExporter uses the browser FileReader for its binary buffer; these exports have no texture images.
class BinaryReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void { void blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.(); }); }
}
Object.assign(globalThis, { FileReader: BinaryReader });
const sourcePath = 'public/models/jewelry/eye-of-winter-gate.glb';
const bytes = readFileSync(sourcePath);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
const source = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
const gate = createWinterGate(source.geometry);
// Local origin: the eye axis in plan and the interior floor vertically; the trailing rings extend below the floor.
gate.root.position.set(-WINTER.x, -WINTER.floor, -WINTER.z);
gate.root.userData = { approvedConcept: '17-winter-g-model-two-stones-open.png', source: sourcePath, scale: WINTER.scale, door: 'Six operable leaves; runtime motion is defined in src/world/winter-gate.ts' };
gate.root.updateMatrixWorld(true);
const result = await new GLTFExporter().parseAsync(gate.root, { binary: true, onlyVisible: true, maxTextureSize: 1 });
const directory = 'concepts/15-moon-gates/models'; mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/eye-of-winter-building.glb`, Buffer.from(result as ArrayBuffer));
writeFileSync(`${directory}/sources.json`, JSON.stringify({ approvedConcept: '../images/17-winter-g-model-two-stones-open.png', source: sourcePath, sourceSha256: createHash('sha256').update(bytes).digest('hex'), sourceProvenance: 'public/models/jewelry/sources.json', geometry: 'Original source indices and vertices retained; uniform 1.5 scale, -90 degree Z rotation and translation only. Clear quartz envelope, smaller blue faceted hexagonal stone, six iris leaves, room floor, benches and forecourt added.', origin: 'Eye axis at x=z=0; room floor y=0; ring feet extend below the floor.', generator: 'bun scripts/build-winter-building.ts', runtime: 'src/world/winter-gate.ts', status: 'First 3D building study; landscaping and material polish remain.' }, null, 2) + '\n');
console.log(`Exported ${directory}/eye-of-winter-building.glb (${Math.round((result as ArrayBuffer).byteLength / 1024)} KiB)`);
