import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Geometry, lighting and source maps invalidate saved reflections; generated probe files never hash themselves. */
export function probeSignature(root = process.cwd()): string {
  const hash = createHash('sha256'); hash.update('livistone-pmrem-v1');
  const visit = (path: string): void => {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file); else { hash.update(file); hash.update(readFileSync(join(root, file))); }
    }
  };
  for (const path of ['src/world', 'src/render', 'src/game', 'public/textures', 'public/models']) visit(path);
  hash.update(readFileSync(join(root, 'src/main.ts')));
  hash.update(readFileSync(join(root, 'package.json')));
  return hash.digest('hex').slice(0, 16);
}
