import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const directory = resolve('public/audio/kalimba');
const tracks = JSON.parse(readFileSync(resolve(directory, 'provenance.json'), 'utf8'));
for (const track of tracks) {
  let bytes;
  try { bytes = readFileSync(resolve(directory, track.file)); }
  catch { throw new Error(`Missing music asset ${track.file}. Run git lfs install --local --skip-repo and git lfs pull before building.`); }
  if (bytes.subarray(0, 80).toString().startsWith('version https://git-lfs.github.com/spec/v1')) {
    throw new Error(`${track.file} is a Git LFS pointer. Run git lfs pull before building.`);
  }
  if (createHash('sha256').update(bytes).digest('hex') !== track.sha256) {
    throw new Error(`${track.file} differs from the approved recording. Restore it with Git LFS or review and update its provenance.`);
  }
}
console.log(`Verified ${tracks.length} approved music assets.`);
