// Paper backgrounds for the catalogue photographs (realism sub-plan 12), pure pixel code so Vitest can check it without Sharp.
// The studio's white sweep becomes the posters' paper (#f4f0e5) and the jewel keeps its true colours; before, the paper colour
// multiplied the whole photograph. Lossy WebP cannot store #f4f0e5 itself (no 8-bit YUV triple decodes to it: flat paper comes
// back as #f5efe6), so the poster shader keys colours within a few levels of paper to the exact value (paperPhotoMaterial).
// An alpha cut-out would be exact without the key, but its alpha plane tripled the files.

/** Light shadows on the sweep darken the paper; deeper ones hand over to the original pixels by this luminance. */
const SHADOW = { light: .88, deep: .6 };
/** Sweep pixels at least this bright (relative to the fitted sweep) become plain paper, absorbing JPEG noise. */
const CLEAN = .975;
/** Neighbours join the sweep while this bright and this neutral; enclosed holes need this share of the image to count. */
const FLOOD = { luminance: .55, chroma: .07, hole: .001, holeLuminance: .96, holeChroma: .03 };

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Least-squares quadratic surface c0 + c1 x + c2 y + c3 x² + c4 xy + c5 y² through (x, y, value) samples. */
function fitQuadratic(samples) {
  const a = Array.from({ length: 6 }, () => new Float64Array(7));
  for (const [x, y, v] of samples) {
    const t = [1, x, y, x * x, x * y, y * y];
    for (let i = 0; i < 6; i++) { for (let j = 0; j < 6; j++) a[i][j] += t[i] * t[j]; a[i][6] += t[i] * v; }
  }
  for (let i = 0; i < 6; i++) a[i][i] += 1e-6;
  for (let i = 0; i < 6; i++) {
    let pivot = i; for (let r = i + 1; r < 6; r++) if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    for (let r = 0; r < 6; r++) if (r !== i) { const f = a[r][i] / a[i][i]; for (let c = i; c < 7; c++) a[r][c] -= f * a[i][c]; }
  }
  const c = a.map((row, i) => row[6] / row[i]);
  return (x, y) => c[0] + c[1] * x + c[2] * y + c[3] * x * x + c[4] * x * y + c[5] * y * y;
}

/**
 * The sweep's own colour across the frame (it is rarely flat: vignetting, a blue cast), fitted on a coarse grid to the bright,
 * neutral samples connected to the border, ignoring samples darker than the fit (shadows). Null when less than half of the
 * border is such a sweep: a dark, grey or scenic background is kept as photographed.
 */
function sweepField(rgb, width, height) {
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200)), gw = Math.ceil(width / step), gh = Math.ceil(height / step);
  const at = (gx, gy) => (Math.min(height - 1, gy * step) * width + Math.min(width - 1, gx * step)) * 3;
  const light = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = at(gx, gy), lo = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]), hi = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]);
    light[gy * gw + gx] = lo >= 190 && hi - lo <= 30 ? 1 : 0;
  }
  let border = 0, sweep = 0; const seen = new Uint8Array(gw * gh), queue = [];
  for (let gx = 0; gx < gw; gx++) for (const gy of [0, gh - 1]) { border++; if (light[gy * gw + gx]) { sweep++; queue.push(gy * gw + gx); seen[gy * gw + gx] = 1; } }
  for (let gy = 1; gy < gh - 1; gy++) for (const gx of [0, gw - 1]) { border++; if (light[gy * gw + gx]) { sweep++; queue.push(gy * gw + gx); seen[gy * gw + gx] = 1; } }
  if (sweep < border * .5) return null;
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q], gx = k % gw, gy = (k - gx) / gw;
    for (const [nx, ny] of [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]]) {
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const n = ny * gw + nx;
      if (!seen[n] && light[n]) { seen[n] = 1; queue.push(n); }
    }
  }
  const nx = (x) => x / (width - 1) * 2 - 1, ny = (y) => y / (height - 1) * 2 - 1;
  let points = queue.map((k) => { const gx = k % gw, gy = (k - gx) / gw, i = at(gx, gy); return [nx(Math.min(width - 1, gx * step)), ny(Math.min(height - 1, gy * step)), rgb[i], rgb[i + 1], rgb[i + 2]]; });
  let fits = [0, 1, 2].map((c) => fitQuadratic(points.map((p) => [p[0], p[1], p[2 + c]])));
  for (let pass = 0; pass < 2; pass++) {
    const kept = points.filter((p) => fits.every((fit, c) => p[2 + c] - fit(p[0], p[1]) > -6));
    if (kept.length < 12) break; points = kept; fits = [0, 1, 2].map((c) => fitQuadratic(points.map((p) => [p[0], p[1], p[2 + c]])));
  }
  return (x, y) => fits.map((fit) => Math.min(255, Math.max(1, fit(nx(x), ny(y)))));
}

/**
 * The RGB photograph with its white studio sweep replaced by paper, or null when its background is not one. The sweep connected
 * to the border, and enclosed holes of clean sweep (inside rings), become paper; shadows on it darken the paper, handing over
 * to the original pixels as they deepen so the region's edge never steps; everything else keeps its photographed colour. In
 * between it is a straight-alpha cut-out (shadow as translucent black) composited over paper in sRGB, as a browser would.
 */
export function paperBackground(rgb, width, height, paper = [244, 240, 229]) {
  const field = sweepField(rgb, width, height); if (!field) return null;
  const size = width * height, luminance = new Float32Array(size), chroma = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    // The fit is smooth, so evaluating it every 8 pixels and holding it between costs nothing visible.
    let sweep = field(0, y);
    for (let x = 0; x < width; x++) {
      if (x % 8 === 0) sweep = field(x, y);
      const k = y * width + x, i = k * 3, r = Math.min(1, rgb[i] / sweep[0]), g = Math.min(1, rgb[i + 1] / sweep[1]), b = Math.min(1, rgb[i + 2] / sweep[2]);
      luminance[k] = .2126 * r + .7152 * g + .0722 * b; chroma[k] = Math.max(r, g, b) - Math.min(r, g, b);
    }
  }
  const joins = (k) => luminance[k] >= FLOOD.luminance && chroma[k] <= FLOOD.chroma;
  const region = new Uint8Array(size), queue = new Int32Array(size); let head = 0, tail = 0;
  const seed = (k) => { if (!region[k] && joins(k)) { region[k] = 1; queue[tail++] = k; } };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }
  // Large enclosed patches of clean sweep (the hole of a ring) seed the region too; small bright highlights do not.
  const label = new Int32Array(size), scratch = new Int32Array(size);
  for (let start = 0; start < size; start++) {
    if (label[start] || region[start] || luminance[start] < FLOOD.holeLuminance || chroma[start] > FLOOD.holeChroma) continue;
    let h = 0, t = 0; scratch[t++] = start; label[start] = 1;
    while (h < t) {
      const k = scratch[h++], x = k % width;
      for (const n of [x > 0 ? k - 1 : -1, x < width - 1 ? k + 1 : -1, k - width, k + width]) {
        if (n < 0 || n >= size || label[n] || luminance[n] < FLOOD.holeLuminance || chroma[n] > FLOOD.holeChroma) continue;
        label[n] = 1; scratch[t++] = n;
      }
    }
    if (t >= size * FLOOD.hole) for (let j = 0; j < t; j++) seed(scratch[j]);
  }
  while (head < tail) {
    const k = queue[head++], x = k % width;
    if (x > 0) seed(k - 1); if (x < width - 1) seed(k + 1); if (k >= width) seed(k - width); if (k < size - width) seed(k + width);
  }
  // Shadows take their depth from the luminance averaged over the sweep only (a 7 × 7 box, normalised by the region's share),
  // so sensor and JPEG noise neither speckles the alpha nor costs bytes, and the jewel's own dark edge adds no halo.
  const smooth = boxOver(luminance, region, width, height, 3);
  // A one-pixel feather (3 × 3 binomial) softens the cut where the jewel meets the sweep.
  const out = Buffer.alloc(size * 3), kernel = [1, 2, 1];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const k = y * width + x, i = k * 3;
    let weight = 0, total = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const sx = Math.min(width - 1, Math.max(0, x + dx)), sy = Math.min(height - 1, Math.max(0, y + dy)), w = kernel[dx + 1] * kernel[dy + 1];
      weight += w * region[sy * width + sx]; total += w;
    }
    const w = weight / total, l = region[k] ? smooth[k] : luminance[k], shadow = Math.min(1, Math.max(0, 1 - l / CLEAN)), original = smoothstep(SHADOW.light, SHADOW.deep, l);
    const alpha = (1 - w) + w * (shadow + (1 - shadow) * original), keep = (1 - w) + w * original;
    for (let c = 0; c < 3; c++) out[i + c] = Math.min(255, Math.round(paper[c] * (1 - alpha) + rgb[i + c] * keep));
  }
  return out;
}

/** Mean of `values` over the pixels where `mask` is set, in a (2r + 1)² box; separable sliding sums, linear in the radius. */
function boxOver(values, mask, width, height, r) {
  const size = values.length, sum = new Float32Array(size), count = new Float32Array(size), mean = new Float32Array(size);
  const slide = (n, stride, offset, readS, readC, write) => {
    let s = 0, c = 0;
    for (let i = 0; i < Math.min(r, n); i++) { s += readS(offset + i * stride); c += readC(offset + i * stride); }
    for (let i = 0; i < n; i++) {
      if (i + r < n) { s += readS(offset + (i + r) * stride); c += readC(offset + (i + r) * stride); }
      if (i - r - 1 >= 0) { s -= readS(offset + (i - r - 1) * stride); c -= readC(offset + (i - r - 1) * stride); }
      write(offset + i * stride, s, c);
    }
  };
  for (let y = 0; y < height; y++) slide(width, 1, y * width, (k) => mask[k] * values[k], (k) => mask[k], (k, s, c) => { sum[k] = s; count[k] = c; });
  for (let x = 0; x < width; x++) slide(height, width, x, (k) => sum[k], (k) => count[k], (k, s, c) => { mean[k] = c > 0 ? s / c : values[k]; });
  return mean;
}

/** The share of pixels that are exactly paper, for the build log. */
export function paperShare(rgb, paper = [244, 240, 229]) { let n = 0; for (let i = 0; i < rgb.length; i += 3) if (rgb[i] === paper[0] && rgb[i + 1] === paper[1] && rgb[i + 2] === paper[2]) n++; return n / (rgb.length / 3); }
