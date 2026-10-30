import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readGlb, capIntegrity } from '../scripts/adapt-stump-scan';

const asset = 'public/models/jewelry/stump-of-life-livistone.glb', model = readGlb(asset);
const record = JSON.parse(readFileSync('public/models/jewelry/stump-of-life-livistone.organic.json', 'utf8'));
const dna = JSON.parse(readFileSync('public/models/jewelry/stump-of-life-livistone.provenance.json', 'utf8')).dna_texture as {
  reference_id: string; shared_alignment_columns_zero_based: number[]; source_alignment_columns_one_based: number[];
  profile_tracks: { sample_id: string; radius_mm_in_physical_plan: number }[];
  pending_tracks: { sample: string; radius_mm_in_physical_plan: number; status: string }[];
  calls_relative_to_reference: Record<string, number>; aligned_fasta_sha256: string; ancient_missing_calls_synthesized: boolean;
};
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

describe('organic Stump of Life source asset', () => {
  it('retains the native physical engraving table and its 294 observed substitutions', () => {
    const bytes = readFileSync('data/stump-of-life/engraving-marks.csv'), rows = bytes.toString().trim().split(/\r?\n/), columns = rows.shift()!.split(','), values = rows.map(row => row.split(','));
    expect(hash(bytes)).toBe('1c99c2015be902075d05b4460d101861cadd7a21c6fde4902e862a3038040974');
    expect(values).toHaveLength(294); expect(values.every(row => row[columns.indexOf('event')] === 'substitution' && row[columns.indexOf('operation')] === 'ENGRAVE')).toBe(true);
    expect(new Set(values.map(row => row[columns.indexOf('alignment_column')])).size).toBe(174);
  });
  it('keeps the previously reviewed DNA cap and called-base image byte-identical', () => {
    expect(capIntegrity(model)).toEqual({
      geometry: '9441f13f32847fe4021402d49077f11813eb1ec5dc232b74fa9f617aa524e580',
      texture: 'a805d106d3d7b6a1770703e0168b87c3c17992434515f929d16b14070854e3f7',
    });
    expect(record.cap_before).toEqual(record.cap_after);
    expect(hash(readFileSync(asset))).toBe(record.output_sha256);
  });

  it('retains every original resource and permits only the documented rigid cap-node lift', () => {
    expect(hash(model.bin.subarray(0, record.original_binary_byte_length))).toBe(record.original_binary_sha256);
    expect(hash(JSON.stringify(model.json.meshes.filter(mesh => mesh.name !== 'Giant_Wood_Stump')))).toBe(record.protected_nonwood_mesh_definitions_sha256);
    const capNames = ['Giant_Solid_Cap_Edge', 'Giant_Solid_DNA_Cap'];
    expect(hash(JSON.stringify(model.json.nodes.filter(node => !capNames.includes(node.name ?? ''))))).toBe(record.protected_noncap_nodes_sha256);
    const restored = structuredClone(model.json.nodes);
    for (const transform of record.permitted_cap_node_transforms) {
      const node = restored[transform.node_index];
      expect(capNames).toContain(node.name); expect(node.translation).toEqual([0, 1.1, 0]);
      expect(transform.original_translation).toBeNull(); delete node.translation;
    }
    expect(record.permitted_cap_node_transforms).toHaveLength(2);
    expect(hash(JSON.stringify(restored))).toBe(record.original_nodes_sha256);
  });

  it('keeps a clear photographed trunk above a restrained low buttress flare', () => {
    const mesh = model.json.meshes.find(mesh => mesh.name === 'Giant_Wood_Stump')!, primitive = mesh.primitives[0];
    const position = model.json.accessors[primitive.attributes.POSITION], view = model.json.bufferViews[position.bufferView];
    const lower: number[] = [], middle: number[] = [], upper: number[] = [];
    expect(position.count).toBeGreaterThan(6000);
    expect(model.json.accessors[primitive.attributes.TEXCOORD_0].count).toBe(position.count);
    for (let i = 0; i < position.count; i++) {
      const offset = (view.byteOffset ?? 0) + (position.byteOffset ?? 0) + i * 12, x = model.bin.readFloatLE(offset) - 10.64391425710376, y = model.bin.readFloatLE(offset + 4), z = model.bin.readFloatLE(offset + 8) + 3.4787374527067465, radius = Math.hypot(x, z);
      expect(radius).toBeLessThan(2.75);
      expect(y).toBeGreaterThanOrEqual(.24999); expect(y).toBeLessThanOrEqual(2.01301);
      if (y < .65) lower.push(radius); if (y > 1.05 && y < 1.55) middle.push(radius); if (y > 1.66) upper.push(radius);
      if (y > 1.9) expect(radius).toBeLessThan(1.50);
    }
    const percentile = (values: number[]): number => values.sort((a, b) => a - b)[Math.floor(values.length * .95)];
    expect(percentile(lower) - percentile(upper)).toBeGreaterThan(.55);
    expect(percentile(lower) - percentile(upper)).toBeLessThan(1.1);
    expect(Math.abs(percentile(middle) - percentile(upper))).toBeLessThan(.20);
    const material = model.json.materials[primitive.material!];
    expect(material.normalTexture).toBeDefined(); expect(material.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
    expect(material.occlusionTexture).toBeUndefined();
    expect(record.transformations.radial_boundary_edges_closed).toBe(0);
  });

  it('adds delicate unequal branching roots, closed and resting on the same floor within the original footprint', () => {
    const mesh = model.json.meshes.find(mesh => mesh.name === 'Giant_Wood_Stump')!, primitive = mesh.primitives.find(primitive => model.json.materials[primitive.material!].name?.startsWith('Generated fine branching roots'))!;
    const a = model.json.accessors[primitive.attributes.POSITION], view = model.json.bufferViews[a.bufferView], index = model.json.accessors[primitive.indices!], indexView = model.json.bufferViews[index.bufferView], edges = new Map<string, number>();
    let lowest = Infinity, longest = 0;
    for (let i = 0; i < a.count; i++) {
      const offset = (view.byteOffset ?? 0) + i * 12, x = model.bin.readFloatLE(offset) - 10.64391425710376, y = model.bin.readFloatLE(offset + 4), z = model.bin.readFloatLE(offset + 8) + 3.4787374527067465;
      expect([x, y, z].every(Number.isFinite)).toBe(true); expect(y).toBeGreaterThanOrEqual(.24999); expect(y).toBeLessThan(1.0);
      expect(Math.hypot(x, z)).toBeLessThan(3.505); lowest = Math.min(lowest, y); longest = Math.max(longest, Math.hypot(x, z));
    }
    for (let i = 0; i < index.count; i += 3) {
      const triangle = [0, 1, 2].map(j => model.bin.readUInt32LE((indexView.byteOffset ?? 0) + (i + j) * 4));
      for (let edge = 0; edge < 3; edge++) { const key = [triangle[edge], triangle[(edge + 1) % 3]].sort((a, b) => a - b).join(','); edges.set(key, (edges.get(key) ?? 0) + 1); }
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true);
    expect(lowest).toBeCloseTo(.25, 5); expect(longest).toBeGreaterThan(3.3);
    expect(record.generated_fine_roots).toMatchObject({ photographed_scan_geometry: false, main_roots: 12, fork_roots: 8 });
    const material = model.json.materials[primitive.material!];
    expect(material.normalTexture).toBeUndefined(); expect(material.pbrMetallicRoughness?.baseColorTexture).toBeUndefined(); expect(material.pbrMetallicRoughness?.roughnessFactor).toBe(1);
    expect(primitive.attributes.TEXCOORD_0).toBeUndefined();
  });

  it('retains all observed substitutions and reserves missing ancient records without invented calls', () => {
    expect(dna.reference_id).toBe('KF540505.1');
    expect(dna.shared_alignment_columns_zero_based).toHaveLength(175);
    expect(new Set(dna.shared_alignment_columns_zero_based).size).toBe(175);
    expect(dna.source_alignment_columns_one_based).toEqual(dna.shared_alignment_columns_zero_based.map(column => column + 1));
    expect(dna.calls_relative_to_reference).toEqual({ substitution: 294, insertion: 0, deletion: 9, unknown: 0 });
    expect(dna.profile_tracks).toHaveLength(10); expect(dna.pending_tracks).toHaveLength(6);
    expect(dna.profile_tracks.length + dna.pending_tracks.length).toBe(16);
    expect(dna.profile_tracks[0]).toEqual({ sample_id: 'KF540505.1', radius_mm_in_physical_plan: 30 });
    expect(dna.pending_tracks.filter(track => track.sample.startsWith('Suogang '))).toEqual([
      { sample: 'Suogang B1', radius_mm_in_physical_plan: 92, status: 'mtDNA unavailable; no MT reads in public deposit' },
      { sample: 'Suogang B3', radius_mm_in_physical_plan: 100, status: 'mtDNA unavailable; no MT reads in public deposit' },
    ]);
    expect(dna.ancient_missing_calls_synthesized).toBe(false);
    expect(dna.aligned_fasta_sha256).toBe('84012f3696b0b36adf837225260d9a516dc49f6f7b8756e3888443ef1b2224e7');
  });

  it('credits the real CC0 source and makes no Taiwanese-specimen claim', () => {
    expect(record.source).toBe('https://polyhaven.com/a/tree_stump_01'); expect(record.author).toBe('Rob Tuytel');
    expect(record.license).toBe('CC0 1.0'); expect(record.physical_specimen_claim).toBe(false);
    expect(record.transformations.native_vertical_clip).toEqual([.025, .3]);
  });
});
