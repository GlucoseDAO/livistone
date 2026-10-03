import * as THREE from 'three';

/**
 * Tileable 3D cloud noise for the sky bake (sky.ts), generated once per day bake with a fixed seed: red is Perlin–Worley, the
 * puffy base shape of cumulus (Schneider, "The real-time volumetric cloudscapes of Horizon Zero Dawn", 2015); green a Worley
 * fbm three times finer that erodes the edges; blue a low Perlin fbm for the coverage map. 48³ voxels, about 0.1 s of script.
 */
export function cloudNoise(size = 48, seed = 26): THREE.Data3DTexture {
  let state = seed >>> 0;
  const random = (): number => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  // Unit gradients on a fixed lattice for Perlin noise; feature points per cell for Worley, each wrapped at the tile edge.
  const gradients = Array.from({ length: 256 }, () => { const z = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; });
  const permutation = Array.from({ length: 256 }, (_, i) => i).sort(() => random() - .5);
  const lattice = (x: number, y: number, z: number, period: number): number[] => gradients[permutation[(permutation[(permutation[((x % period) + period) % period & 255] + ((y % period) + period) % period) & 255] + ((z % period) + period) % period) & 255]];
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  const perlin = (x: number, y: number, z: number, period: number): number => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const corner = (dx: number, dy: number, dz: number): number => { const g = lattice(ix + dx, iy + dy, iz + dz, period); return g[0] * (fx - dx) + g[1] * (fy - dy) + g[2] * (fz - dz); };
    const u = fade(fx), v = fade(fy), w = fade(fz), lerp = THREE.MathUtils.lerp;
    return lerp(lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v), lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v), w);
  };
  const features = new Map<number, Float32Array>();
  const points = (cells: number): Float32Array => {
    let p = features.get(cells); if (p) return p;
    p = new Float32Array(cells ** 3 * 3); for (let i = 0; i < p.length; i++) p[i] = random(); features.set(cells, p); return p;
  };
  /** 1 at a feature point, falling to 0 a cell away: inverted cellular noise. */
  const worley = (x: number, y: number, z: number, cells: number): number => {
    const p = points(cells), cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z); let nearest = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = ((cx + dx + cells) % cells), j = ((cy + dy + cells) % cells), k = ((cz + dz + cells) % cells), n = ((k * cells + j) * cells + i) * 3;
      const ox = cx + dx + p[n] - x, oy = cy + dy + p[n + 1] - y, oz = cz + dz + p[n + 2] - z, d = ox * ox + oy * oy + oz * oz;
      if (d < nearest) nearest = d;
    }
    return 1 - Math.min(1, Math.sqrt(nearest));
  };
  const count = size ** 3, raw = [new Float32Array(count), new Float32Array(count), new Float32Array(count)];
  for (let k = 0, n = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++, n++) {
    const x = i / size, y = j / size, z = k / size;
    const fbm = perlin(x * 4, y * 4, z * 4, 4) * .5 + perlin(x * 8, y * 8, z * 8, 8) * .25 + perlin(x * 16, y * 16, z * 16, 16) * .125;
    // Perlin–Worley: billows bounded by the cells, which rounds them.
    raw[0][n] = fbm * .45 + (worley(x * 4, y * 4, z * 4, 4) * .625 + worley(x * 8, y * 8, z * 8, 8) * .25 + worley(x * 16, y * 16, z * 16, 16) * .125) * .55;
    raw[1][n] = worley(x * 12, y * 12, z * 12, 12) * .625 + worley(x * 24, y * 24, z * 24, 24) * .25 + worley(x * 48, y * 48, z * 48, 48) * .125;
    raw[2][n] = perlin(x * 2, y * 2, z * 2, 2) + perlin(x * 4, y * 4, z * 4, 4) * .5;
  }
  // Each channel stretched to fill 0–1 between its 1st and 99th percentiles, so the bake's coverage thresholds mean the same at any seed.
  const data = new Uint8Array(count * 4);
  raw.forEach((values, c) => {
    const sorted = Float32Array.from(values.filter((_, i) => i % 7 === 0)).sort(), low = sorted[Math.floor(sorted.length * .01)], high = sorted[Math.floor(sorted.length * .99)];
    for (let n = 0; n < count; n++) data[n * 4 + c] = Math.round(THREE.MathUtils.clamp((values[n] - low) / (high - low), 0, 1) * 255);
  });
  for (let n = 0; n < count; n++) data[n * 4 + 3] = 255;
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping; texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1; texture.needsUpdate = true;
  return texture;
}
