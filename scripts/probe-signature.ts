import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

// What a saved reflection probe depends on, and nothing else: a HUD, menu or stylesheet change must leave the probes valid,
// a change to anything the bake draws or lights with must not. vite.config.ts and scripts/build-reflection-probes.ts both
// read probeSignature(); scripts/check-probes.ts compares it with public/probes/manifest.json.

/** Every file under these is hashed: the scene's code and data, its renderer, and the maps and models it loads. */
export const PROBE_DIRECTORIES = ['src/world', 'src/render', 'public/textures', 'public/models'];
/**
 * The Game methods in src/main.ts that a probe bake runs (its light, fog, shadow box and phase state). The rest of main.ts is
 * input, modes and UI. Render setup that changes what a bake sees belongs in one of these or in src/render/scene-light.ts.
 */
export const BAKE_METHODS = ['light', 'setFog', 'syncDistant', 'phaseState', 'showProbes', 'startBake', 'bakeStep', 'pointReflections', 'aimSun', 'frameShadow'];
/** Modules those methods call that the scene itself does not import. */
export const BAKE_MODULES = ['src/game/shadow-frame.ts'];
const MAIN = 'src/main.ts';
const TEXT = /\.(ts|js|mjs|json|md|txt)$/;
const RELATIVE_IMPORTS = [
  /(?:^|[;\s])import\s+(?!type\b)(?:[^'"]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/gm,
  /(?:^|[;\s])export\s+(?!type\b)[^'"]*?\sfrom\s*['"](\.{1,2}\/[^'"]+)['"]/gm,
  /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
];

/** The source of one class member of main.ts, from its declaration line to its closing `  }` (the file's two-space members). */
export function methodSource(source: string, name: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n'), head = new RegExp(String.raw`^  (?:(?:private|protected|public|async|static|get)\s+)*${name}\s*\(`);
  const start = lines.findIndex(line => head.test(line));
  if (start < 0) throw new Error(`Probe signature: Game.${name} is no longer in ${MAIN}; update BAKE_METHODS in scripts/probe-signature.ts.`);
  const first = lines[start], opened = first.split('{').length - 1;
  if (opened > 0 && opened === first.split('}').length - 1) return first;
  const end = lines.indexOf('  }', start + 1);
  if (end < 0) throw new Error(`Probe signature: cannot find the end of Game.${name} in ${MAIN}.`);
  return lines.slice(start, end + 1).join('\n');
}

const read = (root: string, file: string): Buffer => {
  const bytes = readFileSync(join(root, file));
  // Line endings follow the checkout (core.autocrlf), not the content.
  return TEXT.test(file) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
};

/** Repository-relative paths of every whole file the signature hashes, sorted: the directories plus the modules they import. */
export function probeFiles(root = process.cwd()): string[] {
  const files = new Set<string>();
  const visit = (path: string): void => {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const file = posix.join(path, entry.name); if (entry.isDirectory()) visit(file); else files.add(file);
    }
  };
  for (const path of PROBE_DIRECTORIES) visit(path);
  for (const file of BAKE_MODULES) files.add(file);
  // Modules outside those directories that the scene imports at run time (content, exhibits, graphics profiles…), and theirs.
  const resolve = (from: string, spec: string): string | null => {
    const base = posix.normalize(posix.join(posix.dirname(from), spec));
    for (const file of [base, base + '.ts', base + '/index.ts']) if (existsSync(join(root, file)) && statSync(join(root, file)).isFile()) return file;
    return null;
  };
  const queue = [...files].filter(file => file.endsWith('.ts'));
  while (queue.length) {
    const from = queue.pop()!, source = read(root, from).toString('utf8');
    for (const pattern of RELATIVE_IMPORTS) for (const match of source.matchAll(pattern)) {
      const file = resolve(from, match[1]);
      if (file && !files.has(file)) { files.add(file); if (file.endsWith('.ts')) queue.push(file); }
    }
  }
  return [...files].sort();
}

/** Whether a changed repository path can change probeSignature() (the pre-commit hook asks before running the check). */
export function feedsProbeSignature(path: string, files: readonly string[]): boolean {
  return path === MAIN || path === 'package.json' || path === 'scripts/probe-signature.ts' || path.startsWith('public/probes/') || PROBE_DIRECTORIES.some(dir => path.startsWith(dir + '/')) || files.includes(path);
}

/** Geometry, lighting and source maps invalidate saved reflections; generated probe files never hash themselves. */
export function probeSignature(root = process.cwd()): string {
  const hash = createHash('sha256'); hash.update('livistone-pmrem-v2');
  for (const file of probeFiles(root)) { hash.update(file); hash.update(read(root, file)); }
  const main = read(root, MAIN).toString('utf8');
  for (const name of BAKE_METHODS) { hash.update(`${MAIN}#${name}`); hash.update(methodSource(main, name)); }
  // Of the dependencies, only three renders; its PMREM and node system shape every atlas.
  const three = (JSON.parse(read(root, 'package.json').toString('utf8')) as { dependencies?: Record<string, string> }).dependencies?.three;
  hash.update(`three@${three ?? 'missing'}`);
  return hash.digest('hex').slice(0, 16);
}
