// Source captions are reviewed in data/catalogue/selection.json; photographs keep their original proportions.
// Requires sharp as an offline authoring tool (LIVISTONE_SHARP may point to a bundled installation).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const { default: sharp } = await import(process.env.LIVISTONE_SHARP ?? 'sharp');
const selected = JSON.parse(readFileSync('data/catalogue/selection.json', 'utf8'));
mkdirSync('public/images/jewelry/catalogue', { recursive: true });
mkdirSync('output/testing/catalogue-sources', { recursive: true });
const results = [];
async function processEntry(entry) {
  const photos = [];
  for (const [index, path] of entry.sourcePhotos.entries()) {
    const archive = resolve('../livia/assets', path.slice(1)), cached = `output/testing/catalogue-sources/${entry.discovery}-${index}.jpg`;
    let bytes = existsSync(archive) ? readFileSync(archive) : null;
    if (!bytes || bytes.subarray(0, 40).toString().startsWith('version https://git-lfs')) {
      if (existsSync(cached)) bytes = readFileSync(cached);
      else { const response = await fetch('https://livia.glucosedao.org' + encodeURI(path), { signal: AbortSignal.timeout(60000) }); if (!response.ok) throw Error(`${response.status}: ${path}`); bytes = Buffer.from(await response.arrayBuffer()); writeFileSync(cached, bytes); }
    }
    const base = `catalogue/${entry.discovery}-${index + 1}`, image = sharp(bytes).rotate(), metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw Error('Invalid photograph: ' + path);
    await image.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toFile(`public/images/jewelry/${base}.webp`);
    await image.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(`public/images/jewelry/${base}-thumb.webp`);
    photos.push({ file: `${base}.webp`, thumb: `${base}-thumb.webp`, alt: `${entry.title} — Livia Zaharia, studio photograph ${index + 1}`, sourcePath: path, sourceSha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const { sourcePhotos, sourceTitle, ...facts } = entry; results.push({ ...facts, photos }); console.log(`${entry.discovery}: ${photos.length} photographs`);
}
await Promise.all(Array.from({ length: 4 }, async (_, lane) => { for (let i = lane; i < selected.length; i += 4) await processEntry(selected[i]); }));
results.sort((a, b) => selected.findIndex((r) => r.discovery === a.discovery) - selected.findIndex((r) => r.discovery === b.discovery));
writeFileSync('src/game/jewelry-catalogue.json', JSON.stringify(results, null, 2) + '\n');
