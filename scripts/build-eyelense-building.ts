/** Export the actual DOM-independent Eyelense E building and record its source comparison. Run with Bun. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createEyelenseGate } from '../src/world/eyelense-gate';
import { EYELENSE as E } from '../src/world/eyelense-gate-layout';
class BinaryReader {
  result: ArrayBuffer | null = null; onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void { void blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
}
Object.assign(globalThis, { FileReader: BinaryReader });
const comparison = [];
let source: THREE.BufferGeometry | undefined;
for (const id of ['eyelense-gate', 'eyelense-1', 'eyelense-2']) {
  const path = `public/models/jewelry/${id}.glb`, bytes = readFileSync(path);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  const mesh = gltf.scene.getObjectByProperty('type', 'Mesh') as THREE.Mesh; mesh.geometry.computeBoundingBox();
  comparison.push({ path, sha256: createHash('sha256').update(bytes).digest('hex'), min: mesh.geometry.boundingBox!.min.toArray(), max: mesh.geometry.boundingBox!.max.toArray(), triangles: mesh.geometry.index!.count / 3 });
  if (id === 'eyelense-gate') source = mesh.geometry;
}
const gate = createEyelenseGate(source!); gate.root.position.set(-E.x, -E.floor, -E.z);
gate.root.userData = { concept: '12-eyelense-e-red-bead-passage.png', source: comparison[0].path, geometry: 'Source crescent retains vertex and index order under uniform scale and rigid placement. Added bead has a real open arch, tunnel lining and sealed soles.' };
gate.root.updateMatrixWorld(true);
const result = await new GLTFExporter().parseAsync(gate.root, { binary: true, onlyVisible: true });
const directory = 'concepts/15-moon-gates/models'; mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/eyelense-e-building.glb`, Buffer.from(result as ArrayBuffer));
writeFileSync(`${directory}/eyelense-e-sources.json`, JSON.stringify({ concept: '../images/12-eyelense-e-red-bead-passage.png', status: 'Playable building; rendered screenshots are recorded separately from generated concepts.', generator: 'bun scripts/build-eyelense-building.ts', runtime: 'src/world/eyelense-gate.ts', layout: E, origin: 'Passage axis x=z=0, limestone floor y=0. West-facing placement is retained.', sourceComparison: comparison, sourceGeometry: 'Both source faces survive in the gate asset; raised swirls are sparse after optimization. Crescent topology retained, 1.65 uniform scale, translation and -90 degree Y rotation only. Separate black raised swirl tubes are seated on source faces by raycast. Brass rings and fittings, curved lens, round red bead with tunnel, clear glass surround, floor and benches are new architectural elements.', photographs: ['public/images/jewelry/catalogue/eyelense-1.webp', 'public/images/jewelry/catalogue/eyelense-2.webp'], reduced: 'Opaque reflective glass; doorway and source silhouette retained. Day/night tint belongs only to the lens.', export: 'Static daylight materials. Game daylight/quality behaviour lives in runtime TypeScript. No original STL included.' }, null, 2) + '\n');
console.log(`Exported ${directory}/eyelense-e-building.glb (${Math.round((result as ArrayBuffer).byteLength / 1024)} KiB)`);
