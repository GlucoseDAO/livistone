// Optimized jewelry derivatives from Livia's print STLs (millimetres, life size), per data/catalogue/models.json.
// Usage: bun scripts/build-jewelry-models.ts [driveDir] [--only id,id] [--preview]
// The STLs never enter the repository: each is welded, cleaned of print leftovers, oriented, scaled and decimated with
// meshoptimizer (docs/jewelry-stl-inclusion-analysis.md §5), then written as a plain GLB per level of detail to
// public/models/jewelry/, with provenance in public/models/jewelry/sources.json. --preview also renders three
// orthographic views of every result into output/testing/jewelry-models/ for checking the orientation.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

interface Entry { id: string; use: 'featured' | 'grove' | 'gate'; files: string[]; rotate: [number, number, number]; size: number; triangles: number[]; anchor?: 'center' | 'base' }
interface Mesh { positions: Float32Array; indices: Uint32Array }

const root = resolve(import.meta.dirname, '..'), args = process.argv.slice(2);
const drive = resolve((args.find((a) => !a.startsWith('--') && !['--only', '--triangles'].includes(args[args.indexOf(a) - 1])) ?? join(homedir(), 'Downloads/drive-folder')).replace(/^~/, homedir()));
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null, preview = args.includes('--preview');
const override = args.includes('--triangles') ? +args[args.indexOf('--triangles') + 1] : 0;
const manifest = JSON.parse(readFileSync(join(root, 'data/catalogue/models.json'), 'utf8')) as { models: Entry[] };
const outDir = join(root, 'public/models/jewelry'), previewDir = join(root, 'output/testing/jewelry-models');
const DEBRIS = .5, WELD = 1e-3, CREASE = Math.cos(60 * Math.PI / 180);

/** Triangle soup in millimetres from a binary or ASCII STL. */
function readStl(file: string): Float32Array {
  const data = readFileSync(file), count = data.readUInt32LE(80);
  if (84 + count * 50 === data.length) {
    const out = new Float32Array(count * 9), view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let t = 0; t < count; t++) for (let k = 0; k < 9; k++) out[t * 9 + k] = view.getFloat32(84 + t * 50 + 12 + k * 4, true);
    return out;
  }
  const values = [...data.toString('latin1').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].flatMap((m) => [+m[1], +m[2], +m[3]]);
  return new Float32Array(values);
}

/** Merge corners within WELD mm into an indexed mesh, dropping collapsed triangles. */
function weld(soup: Float32Array): Mesh {
  const corners = soup.length / 3; let size = 1 << 20; while (size < corners) size <<= 1;
  const table = new Int32Array(size).fill(-1), positions = new Float32Array(corners * 3), remap = new Uint32Array(corners); let unique = 0;
  for (let c = 0; c < corners; c++) {
    const x = Math.round(soup[c * 3] / WELD), y = Math.round(soup[c * 3 + 1] / WELD), z = Math.round(soup[c * 3 + 2] / WELD);
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & (size - 1);
    for (;;) {
      const v = table[h];
      if (v < 0) { table[h] = unique; positions[unique * 3] = x * WELD; positions[unique * 3 + 1] = y * WELD; positions[unique * 3 + 2] = z * WELD; remap[c] = unique++; break; }
      if (Math.round(positions[v * 3] / WELD) === x && Math.round(positions[v * 3 + 1] / WELD) === y && Math.round(positions[v * 3 + 2] / WELD) === z) { remap[c] = v; break; }
      h = (h + 1) & (size - 1);
    }
  }
  const indices = new Uint32Array(corners); let n = 0;
  for (let t = 0; t < corners / 3; t++) { const a = remap[t * 3], b = remap[t * 3 + 1], c = remap[t * 3 + 2]; if (a !== b && b !== c && a !== c) { indices[n++] = a; indices[n++] = b; indices[n++] = c; } }
  return { positions: positions.slice(0, unique * 3), indices: indices.slice(0, n) };
}

/** Delete repeated faces, components smaller than DEBRIS mm, and flip inside-out shells. */
function clean(mesh: Mesh): { mesh: Mesh; report: Record<string, number> } {
  const { positions } = mesh, ix = mesh.indices, faces = ix.length / 3; let size = 1 << 16; while (size < faces * 2) size <<= 1;
  const table = new Int32Array(size).fill(-1), keep = new Uint32Array(ix.length); let n = 0, duplicates = 0;
  const sorted = (t: number) => [ix[t], ix[t + 1], ix[t + 2]].sort((p, q) => p - q);
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = sorted(t); let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) & (size - 1), repeated = false;
    for (;;) { const other = table[h]; if (other < 0) { table[h] = t; break; } const [p, q, r] = sorted(other); if (p === a && q === b && r === c) { repeated = true; break; } h = (h + 1) & (size - 1); }
    if (repeated) { duplicates++; continue; } keep[n++] = ix[t]; keep[n++] = ix[t + 1]; keep[n++] = ix[t + 2];
  }
  const kept = keep.subarray(0, n);
  const vertices = positions.length / 3, parent = Int32Array.from({ length: vertices }, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let t = 0; t < kept.length; t += 3) { const a = find(kept[t]), b = find(kept[t + 1]), c = find(kept[t + 2]); parent[b] = a; parent[find(c)] = a; }
  const boxes = new Map<number, number[]>(), volume = new Map<number, number>();
  for (let v = 0; v < vertices; v++) {
    const r = find(v), box = boxes.get(r) ?? [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], positions[v * 3 + k]); box[k + 3] = Math.max(box[k + 3], positions[v * 3 + k]); } boxes.set(r, box);
  }
  for (let t = 0; t < kept.length; t += 3) {
    const [a, b, c] = [kept[t], kept[t + 1], kept[t + 2]].map((i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]);
    const signed = (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, r = find(kept[t]);
    volume.set(r, (volume.get(r) ?? 0) + signed);
  }
  const debris = new Set([...boxes].filter(([, b]) => Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) < DEBRIS).map(([r]) => r));
  const inverted = new Set([...volume].filter(([r, v]) => v < 0 && !debris.has(r)).map(([r]) => r)), out = new Uint32Array(kept.length); let m = 0;
  for (let t = 0; t < kept.length; t += 3) { const r = find(kept[t]); if (debris.has(r)) continue; const flip = inverted.has(r); out[m++] = kept[t]; out[m++] = kept[flip ? t + 2 : t + 1]; out[m++] = kept[flip ? t + 1 : t + 2]; }
  return { mesh: { positions, indices: out.slice(0, m) }, report: { duplicates, shells: boxes.size, debris: debris.size, inverted: inverted.size } };
}

/** STL Z-up to Y-up, the manifest rotation, then centre (or stand on y = 0) and scale the longest side to metres. */
function place(mesh: Mesh, entry: Entry): number {
  const [rx, ry, rz] = entry.rotate.map((d) => d * Math.PI / 180), p = mesh.positions;
  const rot = (v: number[]): number[] => {
    let [x, y, z] = v; [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]; [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]; return [x, y, z];
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < p.length; v += 3) { const q = rot([p[v], p[v + 2], -p[v + 1]]); p.set(q, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); } }
  const scale = entry.size / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]), centre = [(min[0] + max[0]) / 2, entry.anchor === 'base' ? min[1] : (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  for (let v = 0; v < p.length; v += 3) for (let k = 0; k < 3; k++) p[v + k] = (p[v + k] - centre[k]) * scale;
  return scale;
}

/** Split vertices where faces meet beyond the crease angle; area-weighted normals elsewhere. */
function shade(mesh: Mesh): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } {
  const p = mesh.positions, ix = mesh.indices, faces = ix.length / 3, fn = new Float32Array(faces * 3), around: number[][] = Array.from({ length: p.length / 3 }, () => []);
  for (let f = 0; f < faces; f++) {
    const [a, b, c] = [ix[f * 3], ix[f * 3 + 1], ix[f * 3 + 2]], e1 = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]), e2 = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
    fn.set([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], f * 3); around[a].push(f); around[b].push(f); around[c].push(f);
  }
  const unit = (f: number) => { const l = Math.hypot(fn[f * 3], fn[f * 3 + 1], fn[f * 3 + 2]) || 1; return [fn[f * 3] / l, fn[f * 3 + 1] / l, fn[f * 3 + 2] / l]; };
  const positions: number[] = [], normals: number[] = [], indices = new Uint32Array(ix.length), keyed = new Map<string, number>();
  for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
    const v = ix[f * 3 + k], n = unit(f), group = around[v].filter((g) => { const m = unit(g); return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > CREASE; }), key = v + ':' + group.join();
    let out = keyed.get(key);
    if (out === undefined) {
      const sum = [0, 0, 0]; for (const g of group) for (let j = 0; j < 3; j++) sum[j] += fn[g * 3 + j]; const l = Math.hypot(...sum) || 1;
      out = positions.length / 3; keyed.set(key, out); positions.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); normals.push(sum[0] / l, sum[1] / l, sum[2] / l);
    }
    indices[f * 3 + k] = out;
  }
  return { positions: Float32Array.from(positions), normals: Float32Array.from(normals), indices };
}

/** A minimal GLB: one mesh, POSITION and NORMAL floats, uint16 indices (uint32 past 65 535 vertices). */
function glb(name: string, m: ReturnType<typeof shade>): Buffer {
  const wide = m.positions.length / 3 > 65535, index = wide ? m.indices : Uint16Array.from(m.indices), pad = (n: number) => (n + 3) & ~3;
  const parts = [Buffer.from(m.positions.buffer), Buffer.from(m.normals.buffer), Buffer.from(index.buffer, index.byteOffset, index.byteLength)];
  const offsets = [0, pad(parts[0].length), pad(parts[0].length) + pad(parts[1].length)], total = offsets[2] + pad(parts[2].length);
  const min = [0, 1, 2].map((k) => Math.min(...m.positions.filter((_, i) => i % 3 === k))), max = [0, 1, 2].map((k) => Math.max(...m.positions.filter((_, i) => i % 3 === k)));
  const json = {
    asset: { version: '2.0', generator: 'livistone build-jewelry-models' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }], buffers: [{ byteLength: total }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: parts[0].length, target: 34962 }, { buffer: 0, byteOffset: offsets[1], byteLength: parts[1].length, target: 34962 }, { buffer: 0, byteOffset: offsets[2], byteLength: parts[2].length, target: 34963 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: m.positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: m.normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: wide ? 5125 : 5123, count: m.indices.length, type: 'SCALAR' },
    ],
  };
  const text = Buffer.from(JSON.stringify(json)), jsonChunk = Buffer.concat([text, Buffer.alloc(pad(text.length) - text.length, 0x20)]), bin = Buffer.alloc(total);
  parts.forEach((part, i) => part.copy(bin, offsets[i]));
  const header = Buffer.alloc(12); header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
  const chunk = (type: number, body: Buffer) => { const h = Buffer.alloc(8); h.writeUInt32LE(body.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, body]); };
  return Buffer.concat([header, chunk(0x4e4f534a, jsonChunk), chunk(0x004e4942, bin)]);
}

/** Flat-lit orthographic views (front along -z, side along +x, top along -y) as one PNG strip. */
function render(m: ReturnType<typeof shade>, file: string): void {
  const S = 360, W = S * 3, img = new Uint8Array(W * S * 3).fill(255), depth = new Float32Array(W * S).fill(-Infinity), p = m.positions;
  const extent = Math.max(...p.map(Math.abs)) * 1.08 || 1;
  const views: ((v: number[]) => number[])[] = [(v) => [v[0], v[1], v[2]], (v) => [-v[2], v[1], v[0]], (v) => [v[0], -v[2], v[1]]];
  views.forEach((view, panel) => {
    for (let t = 0; t < m.indices.length; t += 3) {
      const q = [0, 1, 2].map((k) => { const i = m.indices[t + k]; const v = view([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]); return [panel * S + (v[0] / extent + 1) * S / 2, (1 - v[1] / extent) * S / 2, v[2]]; });
      const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1]], e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1]], area = e1[0] * e2[1] - e1[1] * e2[0]; if (!area) continue;
      const nv = [0, 1, 2].map((k) => { const j = m.indices[t + k]; return view([m.normals[j * 3], m.normals[j * 3 + 1], m.normals[j * 3 + 2]]); }), n = [0, 1, 2].map((k) => (nv[0][k] + nv[1][k] + nv[2][k]) / 3);
      const light = Math.max(.12, .35 * Math.abs(n[2]) + .65 * Math.max(0, n[0] * -.4 + n[1] * .6 + n[2] * .7));
      const x0 = Math.max(panel * S, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), x1 = Math.min(panel * S + S - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), y1 = Math.min(S - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + .5 - q[0][0], py = y + .5 - q[0][1], b = (px * e2[1] - py * e2[0]) / area, c = (e1[0] * py - e1[1] * px) / area; if (b < 0 || c < 0 || b + c > 1) continue;
        const z = q[0][2] + b * (q[1][2] - q[0][2]) + c * (q[2][2] - q[0][2]), at = y * W + x; if (z <= depth[at]) continue; depth[at] = z;
        img.set([40 + 150 * light, 50 + 150 * light, 70 + 140 * light].map((c) => Math.min(230, c)), at * 3);
      }
    }
  });
  const raw = Buffer.alloc((W * 3 + 1) * S); for (let y = 0; y < S; y++) Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  const chunk = (type: string, body: Buffer) => { const h = Buffer.alloc(4); h.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type), body]), c = Buffer.alloc(4); c.writeUInt32BE(crc(tb)); return Buffer.concat([h, tb, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(S, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

/** Twice the volume over the area: the tube radius of a wire, the thickness of a plate. */
function featureSize(mesh: Mesh): number {
  let volume = 0, area = 0; const p = mesh.positions, ix = mesh.indices;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]].map((i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]), e1 = [0, 1, 2].map((k) => b[k] - a[k]), e2 = [0, 1, 2].map((k) => c[k] - a[k]);
    area += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return 2 * Math.abs(volume) / area;
}

await MeshoptSimplifier.ready;
mkdirSync(outDir, { recursive: true }); if (preview) mkdirSync(previewDir, { recursive: true });
const sourcesFile = join(outDir, 'sources.json'), sources: Record<string, unknown> = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {};
for (const entry of manifest.models) {
  if (only && !only.includes(entry.id)) continue;
  const started = performance.now(), files = entry.files.map((f) => join(drive, f)), missing = files.filter((f) => !existsSync(f));
  if (missing.length) { console.warn(`${entry.id}: missing ${missing.join(', ')}`); continue; }
  const soups = files.map(readStl), soup = new Float32Array(soups.reduce((n, s) => n + s.length, 0)); let at = 0; for (const s of soups) { soup.set(s, at); at += s.length; }
  const welded = weld(soup), { mesh, report } = clean(welded), feature = featureSize(mesh), mmScale = place(mesh, entry);
  const levels = (override ? [override] : entry.triangles).map((target, level) => {
    const [simplified, error] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, Math.min(mesh.indices.length, target * 3), 1, ['Prune']);
    const deviation = error * MeshoptSimplifier.getScale(mesh.positions, 3), shaded = shade({ positions: mesh.positions, indices: simplified }), [remap, count] = MeshoptSimplifier.compactMesh(shaded.indices);
    // compactMesh renumbers the indices in place for vertex fetch order and returns old → new.
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
    remap.forEach((to, from) => { if (to === 0xffffffff) return; positions.set(shaded.positions.subarray(from * 3, from * 3 + 3), to * 3); normals.set(shaded.normals.subarray(from * 3, from * 3 + 3), to * 3); });
    const out = { positions, normals, indices: shaded.indices }, name = entry.id + (level ? '-far' : ''), bytes = glb(name, out);
    writeFileSync(join(outDir, name + '.glb'), bytes); if (preview) render(out, join(previewDir, name + '.png'));
    return { file: `public/models/jewelry/${name}.glb`, triangles: simplified.length / 3, bytes: bytes.length, deviationMm: +(deviation / mmScale).toFixed(3), deviationOfFeature: +(deviation / mmScale / feature).toFixed(3) };
  });
  sources[entry.id] = {
    use: entry.use, sources: entry.files.map((f, i) => ({ file: f, sha256: createHash('sha256').update(readFileSync(files[i])).digest('hex'), modified: statSync(files[i]).mtime.toISOString(), triangles: soups[i].length / 9 })),
    cleanup: { ...report, trianglesAfter: mesh.indices.length / 3 }, featureMm: +feature.toFixed(3), metresPerMm: +mmScale.toFixed(5), levels,
  };
  console.log(`${entry.id}: ${(soup.length / 9 / 1e3).toFixed(0)}k → ${levels.map((l) => `${(l.triangles / 1e3).toFixed(1)}k (${(l.bytes / 1e3).toFixed(0)} kB, ${(l.deviationOfFeature * 100).toFixed(1)}% of feature)`).join(', ')}; ${JSON.stringify(report)}; ${((performance.now() - started) / 1e3).toFixed(1)} s`);
}
writeFileSync(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
