// Source captions are reviewed in data/catalogue/selection.json; photographs keep their original proportions.
// Requires sharp as an offline authoring tool (LIVISTONE_SHARP may point to a bundled installation).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { paperBackground, paperShare } from './paper-background.mjs';
const { default: sharp } = await import(process.env.LIVISTONE_SHARP ?? 'sharp');
const selected = JSON.parse(readFileSync('data/catalogue/selection.json', 'utf8'));
mkdirSync('public/images/jewelry/catalogue', { recursive: true });
mkdirSync('output/testing/catalogue-sources', { recursive: true });
// Photographs whose backgrounds are not a white studio sweep keep them (sub-plan 12): grey, dark, scenic or graded.
const KEEP_BACKGROUND = new Set(['sunfinder-1', 'sunfinder-2', 'eyelense-1', 'timeface-2', 'art-nouveau', 'peas-in-pod', 'wormy', 'camel-dali']);
/**
 * Full image (1600 px) and thumbnail (640 px), both contained. White sweeps become paper (paper-background.mjs); the
 * others are encoded straight from the source exactly as before, so their files do not change (or, with `rewriteKept` off,
 * are not written at all: another script made them).
 */
async function derivatives(bytes, name, full, thumb, quality, rewriteKept = true) {
  const image = sharp(bytes).rotate();
  const sized = KEEP_BACKGROUND.has(name) ? null : await image.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const paper = sized && paperBackground(sized.data, sized.info.width, sized.info.height);
  if (!paper && !rewriteKept) return `${name}: background kept, files untouched`;
  if (!paper) {
    await image.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: quality[0] }).toFile(full);
    await image.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: quality[1] }).toFile(thumb);
    return `${name}: background kept`;
  }
  const raw = { raw: { width: sized.info.width, height: sized.info.height, channels: 3 } };
  await sharp(paper, raw).webp({ quality: quality[0] }).toFile(full);
  await sharp(paper, raw).resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: quality[1] }).toFile(thumb);
  return `${name}: paper background, ${Math.round(paperShare(paper) * 100)}% paper`;
}
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
    const base = `catalogue/${entry.discovery}-${index + 1}`, metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw Error('Invalid photograph: ' + path);
    console.log(await derivatives(bytes, `${entry.discovery}-${index + 1}`, `public/images/jewelry/${base}.webp`, `public/images/jewelry/${base}-thumb.webp`, [86, 82]));
    photos.push({ file: `${base}.webp`, thumb: `${base}-thumb.webp`, alt: `${entry.title} — Livia Zaharia, studio photograph ${index + 1}`, sourcePath: path, sourceSha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const { sourcePhotos, sourceTitle, ...facts } = entry; results.push({ ...facts, photos });
}
await Promise.all(Array.from({ length: 4 }, async (_, lane) => { for (let i = lane; i < selected.length; i += 4) await processEntry(selected[i]); }));
results.sort((a, b) => selected.findIndex((r) => r.discovery === a.discovery) - selected.findIndex((r) => r.discovery === b.discovery));
writeFileSync('src/game/jewelry-catalogue.json', JSON.stringify(results, null, 2) + '\n');
// The earlier works (scripts/extend-archive.py, run first) get the same paper backgrounds from their archive originals, at that
// script's quality; their manifest is unchanged. Originals that are missing or differ from the recorded hash are left alone.
for (const piece of JSON.parse(readFileSync('src/game/archive-catalogue.json', 'utf8'))) {
  const [photo] = piece.photos, source = resolve('../livia/assets', decodeURI(photo.sourcePath).slice(1));
  if (KEEP_BACKGROUND.has(piece.discovery) || !photo.sourcePath.startsWith('/pieces/') || !existsSync(source)) continue;
  const bytes = readFileSync(source);
  if (createHash('sha256').update(bytes).digest('hex') !== photo.sourceSha256) { console.log(`${piece.discovery}: original differs from the manifest, skipped`); continue; }
  console.log(await derivatives(bytes, piece.discovery, `public/images/jewelry/${photo.file}`, `public/images/jewelry/${photo.thumb}`, [86, 86], false));
}
