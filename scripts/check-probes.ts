// Are the committed reflection probes the ones this source tree bakes? Usage: bun scripts/check-probes.ts [--staged]
// Exits 1, saying how to rebake, when public/probes/manifest.json names another revision than probeSignature(), or when a
// listed atlas is missing, empty, an unfetched Git LFS pointer, not gzip, or not tracked by LFS. A page whose revision does not
// match ignores every saved probe and bakes them all live after loading. --staged (the pre-commit hook) checks only when a
// staged path can change the signature, so commits that touch nothing the bake reads stay instant.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProbeManifest } from '../src/world/saved-probes.ts';
import { feedsProbeSignature, probeFiles, probeSignature } from './probe-signature.ts';

/** Every set the loader asks for: both backends, both probe sizes (gpu 256, mobile 128), both phases. */
export const PROBE_SETS = ['webgpu', 'webgl'].flatMap(backend => [256, 128].flatMap(size => ['day', 'night'].map(phase => `${backend}-${size}-${phase}`)));
export const REBAKE = [
  'Rebake the saved reflection probes for the current sources:',
  '  bun run dev                                   (restart it after any source change)',
  '  bun scripts/build-reflection-probes.ts webgpu  (PW_HEADED=1 if headless WebGPU cannot present)',
  '  bun scripts/build-reflection-probes.ts webgl',
  'then commit public/probes/ (atlases go through Git LFS) with the source change. SKIP_PROBE_CHECK=1 skips this hook once.',
].join('\n');

/** Problems with public/probes under `root`; empty when the probes match the sources. */
export function probeProblems(root = process.cwd(), lfs = true): string[] {
  const dir = join(root, 'public/probes'), problems: string[] = [];
  let manifest: ProbeManifest;
  try { manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as ProbeManifest; }
  catch (error) { return [`public/probes/manifest.json is unreadable: ${(error as Error).message}`]; }
  const expected = probeSignature(root);
  if (manifest.revision !== expected) problems.push(`public/probes/manifest.json has revision ${manifest.revision}, but the sources give ${expected}: every visitor would bake the reflections live.`);
  for (const set of PROBE_SETS) if (!manifest.sets?.[set]?.length) problems.push(`public/probes/manifest.json has no ${set} set.`);
  const files = Object.values(manifest.sets ?? {}).flat().map(entry => 'public/probes/' + entry.file);
  const misnamed = files.filter(file => !file.endsWith(`-${manifest.revision}.bin.gz`));
  if (misnamed.length) problems.push(`${misnamed.length} of ${files.length} listed atlases do not carry the manifest's revision in their names (e.g. ${misnamed[0]}).`);
  // One line per kind of fault, naming the first file: a missing LFS fetch would otherwise list all hundred atlases.
  const faults = new Map<string, string[]>(), fault = (kind: string, file: string): void => { faults.set(kind, [...faults.get(kind) ?? [], file]); };
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) { fault('missing', file); continue; }
    if (statSync(path).size === 0) { fault('empty', file); continue; }
    const head = readFileSync(path).subarray(0, 64);
    if (head.toString('latin1').startsWith('version https://git-lfs')) fault('Git LFS pointers, not atlases (run git lfs pull)', file);
    else if (head[0] !== 0x1f || head[1] !== 0x8b) fault('not gzip data', file);
  }
  for (const [kind, list] of faults) problems.push(`${list.length} of ${files.length} listed atlases are ${kind}, e.g. ${list[0]}.`);
  if (lfs && files.length) {
    // Atlases must go through Git LFS (.gitattributes), never into plain git objects.
    try {
      const attributes = execFileSync('git', ['check-attr', '--stdin', 'filter'], { cwd: root, input: files.join('\n') + '\n', encoding: 'utf8' });
      for (const line of attributes.trim().split('\n')) if (!line.endsWith(': filter: lfs')) problems.push(`${line.split(': filter:')[0]} is not tracked by Git LFS (see .gitattributes).`);
    } catch { /* Not a git checkout: nothing to commit, nothing to check. */ }
  }
  return problems;
}

if ((import.meta as { main?: boolean }).main ?? process.argv[1]?.endsWith('check-probes.ts')) {
  const root = process.cwd();
  if (process.argv.includes('--staged')) {
    const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean), files = probeFiles(root);
    if (!staged.some(path => feedsProbeSignature(path, files))) process.exit(0);
  }
  const problems = probeProblems(root);
  if (problems.length) { console.error(['Saved reflection probes do not match the sources.', ...problems.map(problem => '  - ' + problem), '', REBAKE].join('\n')); process.exit(1); }
  console.log(`Saved reflection probes match the sources (revision ${probeSignature(root)}).`);
}
