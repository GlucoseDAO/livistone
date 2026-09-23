// Offline, reproducible reductions of the attributed molecular sources; no network or runtime parser.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const pdb = readFileSync(new URL('../data/molecules/1TRZ.pdb', import.meta.url), 'utf8');
const chains = ['A', 'B'].map((id) => ({ id, residues: [] }));
const sulfurs = new Map(), atomPositions = new Map();
for (const line of pdb.split('\n')) {
  if (!line.startsWith('ATOM  ') || ![' ', 'A'].includes(line[16])) continue;
  const chain = chains.find((c) => c.id === line[21]); if (!chain) continue;
  const atom = line.slice(12, 16).trim(), residue = Number(line.slice(22, 26));
  const position = [30, 38, 46].map((start) => Number(line.slice(start, start + 8)));
  atomPositions.set(`${chain.id}:${residue}:${atom}`, position);
  if (atom === 'CA') chain.residues.push({ number: residue, name: line.slice(17, 20).trim(), position });
  if (atom === 'SG') sulfurs.set(`${chain.id}:${residue}`, position);
}
const disulfides = pdb.split('\n').filter((line) => line.startsWith('SSBOND')).flatMap((line) => {
  const from = `${line[15]}:${Number(line.slice(17, 21))}`, to = `${line[29]}:${Number(line.slice(31, 35))}`;
  return sulfurs.has(from) && sulfurs.has(to) ? [{ from, to, positions: [sulfurs.get(from), sulfurs.get(to)], sidechains: [from, to].map((residue) => ['CA', 'CB', 'SG'].map((atom) => atomPositions.get(`${residue}:${atom}`))) }] : [];
});
if (disulfides.some((bond) => bond.sidechains.some((side) => side.some((atom) => !atom)))) throw Error('Missing cysteine side-chain atoms');
if (chains[0].residues.length !== 21 || chains[1].residues.length !== 30 || disulfides.length !== 3) throw Error('Unexpected insulin chains or disulfides');
const sdf = readFileSync(new URL('../data/molecules/GLC_ideal.sdf', import.meta.url), 'utf8'), lines = sdf.split('\n');
const atomCount = Number(lines[3].slice(0, 3)), bondCount = Number(lines[3].slice(3, 6));
const atoms = lines.slice(4, 4 + atomCount).map((line, index) => ({ id: index + 1, element: line.slice(31, 34).trim(), position: [0, 10, 20].map((start) => Number(line.slice(start, start + 10))) })).filter((a) => a.element !== 'H');
const bonds = lines.slice(4 + atomCount, 4 + atomCount + bondCount).map((line) => [Number(line.slice(0, 3)), Number(line.slice(3, 6))]).filter((bond) => bond.every((id) => atoms.some((a) => a.id === id)));
if (atoms.length !== 12 || bonds.length !== 12) throw Error('Unexpected glucose heavy-atom graph');
const hash = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const write = (name, data) => writeFileSync(new URL(`../src/world/molecules/${name}.json`, import.meta.url), JSON.stringify(data) + '\n');
write('insulin', { source: 'https://www.rcsb.org/structure/1TRZ', pdb: '1TRZ', sourceSha256: hash(pdb), units: 'angstrom', chains, disulfides });
write('glucose', { source: 'https://www.rcsb.org/ligand/GLC', component: 'GLC', sourceSha256: hash(sdf), coordinates: 'ideal', units: 'angstrom', atoms, bonds });
console.log('Extracted insulin A/B (51 residues, 3 disulfides) and glucose (12 heavy atoms, 12 bonds).');
