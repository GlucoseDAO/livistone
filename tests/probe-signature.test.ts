import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BAKE_METHODS, methodSource, probeSignature } from '../scripts/probe-signature.ts';
import { probeProblems, REBAKE } from '../scripts/check-probes.ts';

const repo = resolve(__dirname, '..');
// A scratch copy of what the signature reads; the maps and models are linked, not copied.
const root = mkdtempSync(join(tmpdir(), 'livistone-probes-'));
cpSync(join(repo, 'src'), join(root, 'src'), { recursive: true });
cpSync(join(repo, 'package.json'), join(root, 'package.json'));
mkdirSync(join(root, 'public'));
for (const dir of ['textures', 'models']) symlinkSync(join(repo, 'public', dir), join(root, 'public', dir), 'dir');
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** The signature after an edit to one file, which is then restored. */
function signatureWith(file: string, edit: (source: string) => string): string {
  const path = join(root, file), before = readFileSync(path, 'utf8'), after = edit(before);
  expect(after).not.toBe(before);
  writeFileSync(path, after);
  try { return probeSignature(root); } finally { writeFileSync(path, before); }
}

describe('saved probe signature', () => {
  const base = probeSignature(root);
  it('matches the repository', () => expect(base).toBe(probeSignature(repo)));

  it.each([
    ['src/ui/ui.ts', (s: string) => s + '\n// A toolbar tweak.\n'],
    ['src/style.css', (s: string) => s + '\n.topbar{gap:9px}\n'],
    ['src/loading.css', (s: string) => s + '\n.loading-bar{opacity:.99}\n'],
    ['src/game/input.ts', (s: string) => s + '\n// A key binding.\n'],
    ['src/main.ts', (s: string) => s.replace('private updateMarkers(): void {', 'private updateMarkers(): void {\n    // Markers.')],
    ['src/main.ts', (s: string) => s.replace("ui.setLookHint('Hold left mouse to look');", "ui.setLookHint('Hold the left mouse button to look');")],
    ['package.json', (s: string) => s.replace('"test": "vitest run"', '"test": "vitest run --reporter=dot"')],
  ])('ignores a UI-only change to %s', (file, edit) => expect(signatureWith(file, edit)).toBe(base));

  it.each([
    ['src/render/scene-light.ts', (s: string) => s.replace('sun: 3.35', 'sun: 3.4')],
    ['src/world/sky.ts', (s: string) => s + '\n// The sky.\n'],
    ['src/render/output.ts', (s: string) => s + '\n// Output.\n'],
    ['src/game/content.ts', (s: string) => s + '\n// Landmark data the town imports.\n'],
    ['src/game/shadow-frame.ts', (s: string) => s + '\n// Shadow framing.\n'],
    ['src/main.ts', (s: string) => s.replace('private bakeStep(): void {', 'private bakeStep(): void {\n    // A bake change.')],
    ['src/main.ts', (s: string) => s.replace('private frameShadow(force = false', 'private frameShadow(force = !1')],
    ['package.json', (s: string) => s.replace('"three": "0.186.0"', '"three": "0.187.0"')],
  ])('changes with a scene, render or lighting change to %s', (file, edit) => expect(signatureWith(file, edit)).not.toBe(base));

  it('finds every bake method in main.ts', () => {
    const main = readFileSync(join(repo, 'src/main.ts'), 'utf8');
    for (const name of BAKE_METHODS) expect(methodSource(main, name)).toMatch(new RegExp(`^  .*\\b${name}\\b`));
    expect(() => methodSource(main, 'noSuchBakeMethod')).toThrow(/BAKE_METHODS/);
  });
});

describe('committed probes', () => {
  // Fails whenever a change to the scene, its renderer or lighting lands without rebaking: every visitor would then bake live.
  it('match the sources and are real LFS atlases', () => expect(probeProblems(repo), REBAKE).toEqual([]));

  it('reports a stale revision and pointer files', () => {
    const probes = join(root, 'public/probes'); mkdirSync(join(probes, 'webgpu-256-day'), { recursive: true });
    writeFileSync(join(probes, 'manifest.json'), JSON.stringify({ revision: '0000000000000000', sets: { 'webgpu-256-day': [{ id: 'a', width: 1, height: 1, file: 'webgpu-256-day/a-0000000000000000.bin.gz' }] } }));
    writeFileSync(join(probes, 'webgpu-256-day/a-0000000000000000.bin.gz'), 'version https://git-lfs.github.com/spec/v1\noid sha256:00\nsize 1\n');
    const problems = probeProblems(root, false);
    expect(problems.some(problem => problem.includes('has revision 0000000000000000'))).toBe(true);
    expect(problems.some(problem => problem.includes('Git LFS pointer'))).toBe(true);
    expect(problems.some(problem => problem.includes('no webgl-128-night set'))).toBe(true);
    rmSync(probes, { recursive: true });
  });
});
