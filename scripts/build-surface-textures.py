"""Bake procedural architectural surface maps for sub-plan 24 (Pillow + numpy; seeded, no downloads).

Three project-original sets, packed like the ground maps (scripts/build-ground-textures.py):

  <stem>-albedo-<n>.webp  sRGB colour, lossy WebP
  <stem>-nrh-<n>.webp     lossless RGBA, linear data: normal.x, normal.y (OpenGL: +y points up the
                          image), roughness, and height in alpha as 128 + h/2 (decode h = 2a - 1)

  stem       tile   gpu (albedo + nrh)   reduced         replaces the flat colour of
  ashlar     4 m    1024 + 512           512 + 256       bridge masonry, gateway abutments, plinth rings
  terrazzo   4 m    1024 + 512           512 + 256       hall floor insets (and any cast-stone floor)
  brass      1 m    512 + 512            256 + 256       poster stands, bridge rails, sign frames

Stone tiles repeat every 4 m like the limestone paving, so their gpu albedo has the paving's
256 px/m and nrh half of that. Brass keeps nrh at full size because its brushing lives in
roughness. Everything is synthesised at twice the gpu size, then albedo is Lanczos-resampled and
data maps box-filtered; normals come from a height field in metres, so relief has physical
slopes, and normal variance lost in filtering is added to roughness. Each albedo is rescaled so that its mean linear colour equals the
colour the material uses today; sources.json records it, so other users can tint by ratio.

Run from the repository root: python3 scripts/build-surface-textures.py [previewDir]
A preview directory, if given, receives PNG normal/roughness maps for inspection (not committed).
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from PIL import Image

output = Path('public/textures/surfaces')
output.mkdir(parents=True, exist_ok=True)
preview = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if preview:
    preview.mkdir(parents=True, exist_ok=True)


def to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def colour(hex_code):
    """Linear RGB of an sRGB hex colour."""
    return to_linear([int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def frequencies(n):
    k = np.fft.fftfreq(n, 1 / n)  # integer cycles per tile, so every component wraps
    return np.meshgrid(k, k)


def spectral(rng, n, low, high, power=2.0):
    """Periodic band-limited noise with unit RMS; wavelengths between tile/high and tile/low."""
    kx, ky = frequencies(n)
    r = np.maximum(np.hypot(kx, ky), 1e-6)
    gain = r ** (-power / 2) * (1 - np.exp(-(r / low) ** 4)) * np.exp(-(r / high) ** 2)
    gain[0, 0] = 0
    field = np.fft.ifft2(gain * rng.rayleigh(1, (n, n)) * np.exp(2j * np.pi * rng.random((n, n)))).real
    return field / field.std()


def blur(field, sigma_x, sigma_y=None):
    """Gaussian blur that wraps around (optionally anisotropic), so tiles stay seamless."""
    sigma_y = sigma_x if sigma_y is None else sigma_y
    fy, fx = np.fft.fftfreq(field.shape[0])[:, None], np.fft.rfftfreq(field.shape[1])[None, :]
    kernel = np.exp(-2 * np.pi ** 2 * (sigma_x ** 2 * fx ** 2 + sigma_y ** 2 * fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(field) * kernel, s=field.shape)


def stamp(rng, n, count, radius, weight=(.6, 1.0), density=None):
    """Union of soft discs of the given radius (px), wrapped; values 0..~1.

    Without a density field `count` discs land uniformly; with one, each is kept with probability
    density / density.max(), so the discs cluster where the field is high.
    """
    impulses = np.zeros((n, n))
    rows, cols, weights = rng.integers(0, n, count), rng.integers(0, n, count), rng.uniform(*weight, count)
    if density is not None:
        keep = rng.random(count) < density[rows, cols] / density.max()
        rows, cols, weights = rows[keep], cols[keep], weights[keep]
    np.add.at(impulses, (rows, cols), weights)
    d = np.hypot(*[np.minimum(k, n - k) for k in np.meshgrid(np.arange(n), np.arange(n))])
    disc = np.clip(radius + .5 - d, 0, 1)
    return np.clip(np.fft.irfft2(np.fft.rfft2(impulses) * np.fft.rfft2(disc), s=(n, n)), 0, 1.3)


def worley(rng, n, cells, jitter=.92):
    """Periodic Voronoi of a jittered grid: distances to the nearest and second seed, and the nearest's id."""
    s = n / cells
    jx, jy = rng.uniform(.5 - jitter / 2, .5 + jitter / 2, (2, cells, cells))
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) + .5
    i, j = (x // s).astype(np.int32), (y // s).astype(np.int32)
    f1 = np.full((n, n), np.inf, np.float32)
    f2 = f1.copy()
    ident = np.zeros((n, n), np.int32)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            ci, cj = i + di, j + dj
            wi, wj = ci % cells, cj % cells
            d = np.hypot(x - (ci + jx[wj, wi]) * s, y - (cj + jy[wj, wi]) * s)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            f1 = np.where(closer, d, f1)
            ident = np.where(closer, wj * cells + wi, ident)
    return f1, f2, ident


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def relief(field, px, slope):
    """Scale a height field (metres) so that its RMS slope equals `slope`."""
    gx = (np.roll(field, -1, 1) - np.roll(field, 1, 1)) / (2 * px)
    gy = (np.roll(field, -1, 0) - np.roll(field, 1, 0)) / (2 * px)
    return field * slope / np.sqrt(np.mean(gx ** 2 + gy ** 2))


def resize(plane, size, method=Image.Resampling.BOX):
    return np.asarray(Image.fromarray(plane.astype(np.float32), 'F').resize((size, size), method), dtype=np.float64)


def quantise(x, bits):
    """Drop low bits before lossless WebP, centred in each step (as the ground maps do)."""
    step = 2 ** (8 - bits)
    return np.clip(np.floor(np.clip(x, 0, 1) * 255 / step) * step + step // 2, 0, 255).astype(np.uint8)


def ashlar(rng, n):
    """Pale coursed limestone: ten courses of 0.375 / 0.4375 m, blocks 0.6-1.25 m, 10 mm lime joints."""
    tile = 4.0
    px = tile / n
    heights = np.array([224] * 4 + [192] * 6) * n // 2048
    rng.shuffle(heights)
    tops = np.concatenate([[0], np.cumsum(heights)[:-1]])
    block = np.zeros((n, n), np.int32)
    dist = np.zeros((n, n))
    rx = np.zeros((n, n))
    ry = np.zeros((n, n))
    xs = np.arange(n) + .5
    courses, count = [], 0

    def stagger(a, b):
        gap = np.abs(a[:, None] - b[None, :]) % n
        return np.minimum(gap, n - gap).min()

    for c, (top, height) in enumerate(zip(tops, heights)):
        for _ in range(2000):
            k = int(rng.integers(4, 6))
            lengths = rng.uniform(.6, 1.25, k)
            lengths *= n / lengths.sum()
            if lengths.min() < .58 / px or lengths.max() > 1.3 / px:
                continue
            joints = (rng.uniform(0, n) + np.concatenate([[0], np.cumsum(lengths)[:-1]])) % n
            # Head joints never line up with the course below (or, for the last, the first course above).
            neighbours = [courses[-1]] if courses else []
            if c == len(heights) - 1:
                neighbours.append(courses[0])
            if all(stagger(joints, other) > .15 / px for other in neighbours):
                break
        else:
            raise RuntimeError(f'no staggered layout for course {c}; change the seed')
        courses.append(joints)
        offset = joints[0]
        starts = np.sort((joints - offset) % n)
        ends = np.append(starts[1:], n)
        shifted = (xs - offset) % n
        idx = np.searchsorted(starts, shifted, side='right') - 1
        dx = np.minimum(shifted - starts[idx], ends[idx] - shifted)
        rows = slice(top, top + height)
        yc = np.arange(top, top + height)[:, None] + .5
        dy = np.minimum(yc - top, top + height - yc)
        block[rows] = count + idx[None, :]
        dist[rows] = np.minimum(dx[None, :], dy)
        rx[rows] = (shifted - (starts[idx] + ends[idx]) / 2)[None, :] * px
        ry[rows] = (yc - (top + height / 2)) * px
        count += len(starts)

    # Arrises are not ruled lines: a small wobble plus conchoidal chips knocked out of the edges.
    d = dist + .9 * spectral(rng, n, 24, 380)
    edge_y, edge_x = np.nonzero(dist < 1.2)
    for pick in rng.integers(0, len(edge_y), count * 7):
        radius = rng.choice([2.5, 3.5, 5, 8], p=[.45, .3, .18, .07]) * n / 2048
        cy, cx = edge_y[pick] + rng.uniform(-.5, .5) * radius, edge_x[pick] + rng.uniform(-.5, .5) * radius
        r = int(np.ceil(radius)) + 2
        wy, wx = np.mgrid[int(cy) - r:int(cy) + r + 1, int(cx) - r:int(cx) + r + 1]
        stretch = rng.uniform(.6, 1.4)
        bite = np.clip(radius - np.hypot((wy - cy) * stretch, (wx - cx) / stretch), 0, None) * 1.3
        d[wy % n, wx % n] -= bite

    joint, arris_width = 2.6 * n / 2048, 3.4 * n / 2048
    t = np.clip((d - joint) / arris_width, 0, 1)
    face = 1 - (1 - t) ** 2  # rounded arris into the joint

    # Porosity differs from block to block and clusters within a block, as in quarried oolite.
    porous = rng.lognormal(0, .55, count)[block] * smoothstep(-1.1, 1.4, spectral(rng, n, 5, 45))
    scale = n / 2048
    pits = (stamp(rng, n, 130000, .7 * scale, (.35, 1), porous) * .0011
            + stamp(rng, n, 12000, 1.5 * scale, (.6, 1), porous) * .0019 + stamp(rng, n, 600, 3.1 * scale, (.6, 1), porous) * .0028)
    pore = np.clip(pits / .0019, 0, 1)

    # Height in metres: tilted, slightly undulating faces, recessed sandy mortar, pores.
    tilt = rng.normal(0, .0016, (2, count))
    plane = tilt[0][block] * rx + tilt[1][block] * ry
    undulation = .00028 * spectral(rng, n, 16, 140)
    grain = .00006 * spectral(rng, n, 350, 1400)
    mortar = -.0055 + .00035 * spectral(rng, n, 250, 1400)
    height = mortar * (1 - face) + (plane + undulation + grain - pits) * face

    # Albedo. Each block is cut from a different bed: its own tone and warmth (a few ochre, a few
    # grey), faint bedding bands at its own phase and dip, clouding, shell flecks and dark pores.
    tone = 1 + np.clip(rng.normal(0, .045, count), -.1, .1)
    warm = rng.normal(0, .015, count) + .03 * (rng.random(count) < .12) - .02 * (rng.random(count) < .08)
    bands = spectral(rng, n, 30, 220)[:, 0]  # one periodic column, read at each block's own offset
    phase, dip = rng.uniform(0, n, count), np.tan(rng.normal(0, .05, count))
    bed = np.arange(n)[:, None] + phase[block] + dip[block] * rx / px
    bedding = .016 * bands[bed.astype(np.int64) % n]
    # The last two octaves are the sugary oolitic grain that makes the surface read as stone up close.
    clouds = .03 * spectral(rng, n, 6, 50) + .016 * spectral(rng, n, 50, 260) + .03 * spectral(rng, n, 250, 700) + .035 * spectral(rng, n, 700, 1600)
    lum = tone[block] * (1 + clouds + bedding)
    stain = np.clip(spectral(rng, n, 3, 22), 0, None) * .014
    hash_ = smoothstep(-.3, 1.5, spectral(rng, n, 10, 80))
    shells = (stamp(rng, n, 30000, .8 * scale, (.6, 1), hash_) - .7 * stamp(rng, n, 12000, .6 * scale, (.6, 1), hash_)) * .08
    albedo = np.ones((n, n, 3)) * (lum * (1 + shells))[..., None]
    albedo[..., 0] *= 1 + warm[block] + stain
    albedo[..., 2] *= 1 - .9 * warm[block] - 1.4 * stain
    albedo *= (1 - .5 * pore)[..., None]
    lime = np.array([.84, .84, .85]) * (1 + .05 * spectral(rng, n, 300, 1200))[..., None]
    albedo = albedo * face[..., None] + lime * (1 - face)[..., None]
    cavity = np.clip((blur(height, 2.5 * scale) - height) / .004, 0, 1)
    albedo *= (1 - .22 * cavity)[..., None]

    rough = .74 + rng.normal(0, .025, count)[block] + .025 * spectral(rng, n, 30, 400)
    rough = rough * face + .93 * (1 - face) + .14 * pore * face
    return tile, albedo, height, rough


def terrazzo(rng, n):
    """Honed civic terrazzo: three sizes of angular marble chips in a pale matrix, brass strips every metre."""
    tile = 4.0
    palette = [  # sRGB, share of chips, roughness when honed
        ('#efebe2', .40, .33), ('#e4d8c0', .20, .35), ('#cdcbc4', .15, .36), ('#d6c19c', .10, .37),
        ('#a3a19a', .07, .34), ('#646b62', .025, .31), ('#3d3d3b', .012, .30), ('#ad7a60', .008, .35)]
    tints = np.array([colour(h) for h, _, _ in palette])
    weights = np.array([w for _, w, _ in palette])
    weights /= weights.sum()
    polish = np.array([r for _, _, r in palette])

    sand = 1 + .035 * spectral(rng, n, 500, 1600) + .012 * spectral(rng, n, 20, 200)
    albedo = colour('#d9d2c1')[None, None, :] * sand[..., None]
    rough = np.full((n, n), .52) + .03 * spectral(rng, n, 200, 1200)
    height = np.full((n, n), -.00008)
    # Layers from fine to coarse: (cells per tile, chance a cell holds a chip, gap range in px, darkest
    # palette entry allowed). The fine grit is light marble only, so the floor reads pale, not granite.
    for cells, keep, gap, darkest in ((512, .5, (.5, 1.2), 4), (256, .55, (.7, 2.0), 8), (112, .32, (1.0, 3.0), 8)):
        cells = cells * n // 2048
        f1, f2, ident = worley(rng, n, cells)
        count = cells * cells
        kind = rng.choice(darkest, count, p=weights[:darkest] / weights[:darkest].sum())
        gaps = rng.uniform(*gap, count) * n / 2048
        present = rng.random(count) < keep
        alpha = np.clip((f2 - f1 - gaps[ident]) * .8 + .5, 0, 1) * present[ident]
        shade = (1 + rng.normal(0, .045, count))[ident] * (1 + .02 * spectral(rng, n, 200, 900))
        chip = tints[kind][ident] * shade[..., None]
        albedo = albedo * (1 - alpha[..., None]) + chip * alpha[..., None]
        rough = rough * (1 - alpha) + (polish[kind][ident] + rng.normal(0, .02, count)[ident]) * alpha
        height = height * (1 - alpha)

    # Pinholes left in the matrix by trapped air.
    voids = stamp(rng, n, 9000, .6 * n / 2048, (.5, 1)) * (rough > .45)
    albedo *= (1 - .38 * voids)[..., None]
    rough += .25 * voids
    height -= .0004 * voids

    # One-metre panels, each poured slightly differently, divided by flush 3 mm brass strips.
    period = n // 4
    u = np.arange(n) + .5
    line = np.clip(.75 * n / 2048 + .5 - np.abs((u + period / 2) % period - period / 2), 0, 1)
    strip = np.maximum(line[None, :], line[:, None])
    panel = (np.arange(n) // period)
    tone = 1 + rng.normal(0, .02, (4, 4))
    albedo *= tone[panel[:, None], panel[None, :]][..., None]
    albedo = albedo * (1 - strip[..., None]) + colour('#a38a58') * strip[..., None]
    rough = rough * (1 - strip) + .27 * strip
    height = height * (1 - strip)
    # Foot traffic polishes broad lanes a little; the floor is honed, not mirror-flat.
    rough += .035 * spectral(rng, n, 2, 10)
    height += .00012 * spectral(rng, n, 3, 24)
    return tile, albedo, height, rough


def brass(rng, n):
    """Brushed cast brass: fine streaks along u, soft tarnish clouds, a few scratches and oxide spots."""
    tile = 1.0
    px = tile / n
    streak = blur(rng.normal(size=(n, n)), 42 * n / 1024, .55 * n / 1024)
    streak /= streak.std()
    sheen = blur(rng.normal(size=(n, n)), 160 * n / 1024, 2.5 * n / 1024)
    sheen /= sheen.std()
    tarnish = smoothstep(.55, 1.6, spectral(rng, n, 3, 18) + .5 * spectral(rng, n, 18, 90))
    spots = stamp(rng, n, 500, 1.2 * n / 1024, (.4, 1)) * (.4 + tarnish)
    scratch = np.zeros((n, n))
    for _ in range(90):
        x0, y0 = rng.uniform(0, n, 2)
        angle = rng.normal(0, .12) + (np.pi / 2 if rng.random() < .15 else 0)
        length = rng.uniform(12, 70) * n / 1024
        t = np.linspace(0, length, int(length * 2) + 2)
        xs = (x0 + np.cos(angle) * t).astype(int) % n
        ys = (y0 + np.sin(angle) * t + 2 * np.sin(t / length * np.pi * rng.uniform(0, 1))).astype(int) % n
        scratch[ys, xs] = rng.uniform(.4, 1)
    scratch = np.clip(blur(scratch, .5) * 3, 0, 1)

    albedo = np.ones((n, n, 3)) * (1 + .018 * streak + .03 * sheen)[..., None]
    albedo *= 1 - tarnish[..., None] * np.array([.035, .045, .07]) - spots[..., None] * np.array([.12, .13, .15])
    albedo *= (1 + .06 * scratch)[..., None]
    rough = .33 + .045 * streak + .03 * sheen + .09 * tarnish + .12 * spots - .06 * scratch
    # Brushing grooves run along u; their cross slope gives the streaked shimmer of brushed metal.
    grooves = relief(blur(rng.normal(size=(n, n)), 26 * n / 1024, .6 * n / 1024), px, .035)
    height = grooves - relief(scratch, px, .03)
    return tile, albedo, height, rough


MATERIALS = [
    # stem, generator, seed, target colour (material it replaces), output sizes, nrh sizes, normal bits, roughness bits
    ('ashlar', ashlar, 2401, '#f4f0df', 'src/world/world.ts:97 town white (bridge masonry, hall rims)', (1024, 512), (512, 256), 6, 5),
    ('terrazzo', terrazzo, 2402, '#ddd7c4', 'src/world/world.ts:305 hall floor inset', (1024, 512), (512, 256), 7, 5),
    ('brass', brass, 2403, '#c2aa77', 'src/world/planar-exhibition.ts:43 poster stand feet', (512, 256), (512, 256), 6, 5),
]

records = []
for stem, make, seed, target, replaces, sizes, nrh_sizes, normal_bits, rough_bits in MATERIALS:
    n = 2 * sizes[0]
    tile, albedo, height, rough = make(np.random.default_rng(seed), n)
    goal = colour(target)
    for _ in range(4):  # rescale to the approved mean; repeat so clipping cannot drift it
        albedo = np.clip(albedo * goal / albedo.reshape(-1, 3).mean(0), 0, 1)
    mean = albedo.reshape(-1, 3).mean(0)
    rough = np.clip(rough, .04, 1)

    # Normals from metric height with wrapped central differences (OpenGL: +y up the image).
    px = tile / n
    dhdx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * px)
    dhdy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (2 * px)
    normal = np.stack([-dhdx, dhdy, np.ones_like(height)], -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    lo, hi = np.percentile(height, [.5, 99.5])
    level = np.clip((height - lo) / (hi - lo), 0, 1)

    files = {}
    for size in sizes:
        target_path = output / f'{stem}-albedo-{size}.webp'
        planes = np.stack([resize(albedo[..., k], size, Image.Resampling.LANCZOS) for k in range(3)], -1)
        Image.fromarray((to_srgb(planes) * 255 + .5).astype(np.uint8), 'RGB').save(target_path, quality=84, method=6)
        files[target_path.name] = target_path
    for size in nrh_sizes:
        nrm = np.stack([resize(normal[..., k], size) for k in range(3)], -1)
        length = np.linalg.norm(nrm, axis=-1)
        nrm /= length[..., None]
        # Box-filtered normals shorten where relief was averaged away; keep that as extra roughness.
        r = np.sqrt(resize(rough, size) ** 2 + (1 - length) * 1.5)
        alpha = (128 + quantise(resize(level, size), 6) // 2).astype(np.uint8)
        packed = np.stack([quantise(nrm[..., 0] * .5 + .5, normal_bits), quantise(nrm[..., 1] * .5 + .5, normal_bits), quantise(r, rough_bits), alpha], -1)
        nrh = output / f'{stem}-nrh-{size}.webp'
        Image.fromarray(packed, 'RGBA').save(nrh, lossless=True, quality=100, method=6, exact=True)
        files[nrh.name] = nrh
        if preview:
            Image.fromarray((np.clip(nrm * .5 + .5, 0, 1) * 255 + .5).astype(np.uint8), 'RGB').save(preview / f'{stem}-normal-{size}.png')
            Image.fromarray((np.clip(r, 0, 1) * 255 + .5).astype(np.uint8), 'L').save(preview / f'{stem}-roughness-{size}.png')
            Image.fromarray((resize(level, size) * 255 + .5).astype(np.uint8), 'L').save(preview / f'{stem}-height-{size}.png')
    for name, path in files.items():
        print(path, path.stat().st_size)
    records.append(dict(
        stem=stem, generator='scripts/build-surface-textures.py', seed=seed, license='project-original', tileMetres=tile,
        replaces=replaces, targetSRGB=target, meanLinearAlbedo=[round(float(v), 4) for v in mean],
        meanRoughness=round(float(rough.mean()), 3), heightRangeMetres=[round(float(lo), 6), round(float(hi), 6)],
        files={name: dict(bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for name, path in files.items()}))

(output / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
