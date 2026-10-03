"""Bake the Jepii Mici snow's boot prints (Pillow + numpy, procedural and seeded, no downloads).

The owner asked for the trail across the old snow to show that people have walked it before (sub-plan 27,
round 2): a band of boot prints going up and down, fresh ones crisp with their tread, older ones softened
and half filled, each walker's line wandering a little, the trampled band between them. The tile is
1.2 m across the trail by 9.6 m along it and wraps along the trail; across it fades to untouched snow at
both edges, so the ground shader can lay it on the trail's own frame (its along and across metres).

Channels (linear data, lossless WebP):
  R     surface height, 128 = untouched snow, 1 unit = 1.5 mm (print floors about 3–6 cm down, rims up)
  G, B  normal x (across) and y (along) of that height field, n = normalize(-dh/du, -dh/dv, 1), 128 = flat
  A     how trodden the snow is, 0 untouched to 255 inside a fresh print
Run from the repository root: python3 scripts/build-snow-footprints.py [previewDir]
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from PIL import Image

output = Path('public/textures/snow')
output.mkdir(parents=True, exist_ok=True)
ACROSS, ALONG = 1.2, 9.6          # metres covered by the tile
W, H = 256, 2048                  # gpu size; mobile halves both
px = W / ACROSS                   # pixels per metre (213: under 5 mm a pixel)
rng = np.random.default_rng(2703)
ys, xs = np.mgrid[0:H, 0:W]
u = (xs + .5) / px - ACROSS / 2   # metres across, 0 on the trail's centreline
v = (ys + .5) / px                # metres along

height = np.zeros((H, W))         # metres, 0 = untouched surface
trodden = np.zeros((H, W))


def sole(lx, ly, length, width):
    """Signed distance (m) to a boot sole in its own frame (x across, y toward the toe; heel at y = 0): a forefoot and a
    heel ellipse joined by a narrower waist. Negative inside."""
    fore = np.hypot(lx / (width * .5), (ly - length * .66) / (length * .34)) - 1
    heel = np.hypot(lx / (width * .42), (ly - length * .17) / (length * .17)) - 1
    waist = np.maximum(np.abs(lx) - width * .33, np.abs(ly - length * .42) - length * .2) / (width * .5)
    return np.minimum(np.minimum(fore, heel), waist) * width * .5


def lugs(lx, ly, length, width):
    """The tread: chevron lugs across the forefoot, blocks on the heel, 0 in the grooves and 1 on a lug."""
    chevron = np.mod(ly * 38 + np.abs(lx) * 22, 1)
    blocks = (np.mod(lx * 34 + .5, 1) < .62) & (np.mod(ly * 30, 1) < .6)
    return np.where(ly > length * .4, (chevron < .55).astype(float), blocks.astype(float))


def stamp(cx, cy, heading, length, width, depth, age):
    """Press one print: centre of the heel (cx, cy) m, toe toward `heading` (radians from +along); older prints are shallower,
    their edges and tread softened by melt and new snow. Later prints cut into earlier ones."""
    global height, trodden
    for wrap in (-ALONG, 0, ALONG):          # the tile wraps along the trail
        y0 = cy + wrap
        if y0 + length < 0 or y0 - length > ALONG:
            continue
        r0, r1 = max(0, int((y0 - length * 1.3) * px)), min(H, int((y0 + length * 1.3) * px) + 1)
        sl = (slice(r0, r1), slice(0, W))
        du, dv = u[sl] - cx, v[sl] - y0
        c, s = np.cos(heading), np.sin(heading)
        lx, ly = du * c - dv * s, du * s + dv * c
        d = sole(lx, ly, length, width)
        soft = .004 + age * .02               # wall softness (m)
        inside = 1 / (1 + np.exp(d / soft * 2.2))
        tread = lugs(lx, ly, length, width) * (1 - age) * .22
        floor = -depth * (1 - tread) * (1 - .25 * np.clip(ly / length, 0, 1))   # deeper at the heel, where weight lands
        rim = depth * .28 * (1 - age * .6) * np.exp(-(np.maximum(d, 0) / (.012 + age * .02)) ** 2) * (d > 0)
        cur = height[sl]
        # Inside, the new sole mostly sets the floor; outside, it only pushes snow up round its rim.
        height[sl] = (cur + rim) * (1 - inside) + (np.minimum(cur, floor) * .35 + floor * .65) * inside
        trodden[sl] = np.maximum(trodden[sl], inside * (1 - age * .5))


# Walkers up and down the trail, oldest first, each a wandering line of alternating left and right prints.
walkers = []
for k in range(9):
    up = k % 2 == 0
    walkers.append(dict(up=up, offset=rng.uniform(-.24, .24), wander=rng.uniform(.03, .09), phase=rng.uniform(0, 2 * np.pi),
                        stride=rng.uniform(.62, .76), size=rng.uniform(.27, .315), age=max(0., 1 - k / 7.5) * rng.uniform(.6, 1)))
for w in walkers:
    step = w['stride'] / 2
    count = int(ALONG / step)
    step = ALONG / count                    # whole steps per tile, so the line wraps cleanly
    start = rng.uniform(0, step)
    for i in range(count):
        along = start + i * step
        side = 1 if i % 2 else -1
        lateral = w['offset'] + w['wander'] * np.sin(along * 2 * np.pi / ALONG * 2 + w['phase']) + side * .085
        heading = (0 if w['up'] else np.pi) + side * rng.uniform(.05, .2) * (1 if w['up'] else -1) + rng.normal(0, .05)
        # A downhill walker plants the heel and slides; uphill steps press the forefoot.
        depth = rng.uniform(.03, .055) * (1.15 if not w['up'] else 1)
        stamp(lateral, along, heading, w['size'], w['size'] * .37, depth, w['age'] * rng.uniform(.8, 1.2))
        if not w['up'] and rng.random() < .25:  # a slip: a smear behind the heel
            stamp(lateral, along - .08, heading, w['size'] * 1.4, w['size'] * .3, depth * .5, min(1, w['age'] + .4))

# The trampled band: shallow, broad and uneven between the prints, fading out toward both edges of the tile.
band = np.exp(-(u / .38) ** 6)
rough = np.zeros((H, W))
for scale, amp in ((.4, .01), (.12, .005), (.04, .002)):
    n = rng.normal(0, 1, (int(H / (scale * px)) + 2, int(W / (scale * px)) + 2))
    img = Image.fromarray(((n - n.min()) / (n.max() - n.min()) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    rough += (np.asarray(img) / 255 - .5) * amp
height = (height - .008 * band + rough * band) * band
trodden = np.clip(np.maximum(trodden, band * .35) * band, 0, 1)

# Pack: height in 1.5 mm units round 128, its normal, and how trodden the snow is.
unit = .0015
r = np.clip(128 + height / unit, 0, 255)
gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * px / 2
gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * px / 2
n = np.dstack([-gx, -gy, np.ones_like(gx)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
rgba = np.dstack([r, 128 + n[..., 0] * 127, 128 + n[..., 1] * 127, trodden * 255]).round().clip(0, 255).astype(np.uint8)
files = {}
for name, scale in (('footprints-gpu.webp', 1), ('footprints-mobile.webp', 2)):
    image = Image.fromarray(rgba, 'RGBA')
    if scale > 1:
        image = image.resize((W // scale, H // scale), Image.LANCZOS)
    path = output / name
    image.save(path, lossless=True, quality=100, method=6, exact=True)
    files[name] = {'size': list(image.size), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
(output / 'sources.json').write_text(json.dumps({
    'generator': 'scripts/build-snow-footprints.py', 'seed': 2703, 'covers_m': [ACROSS, ALONG], 'height_unit_m': unit,
    'channels': 'R height (128 = untouched), G/B normal across/along, A trodden', 'files': files,
    'licence': 'Procedural, generated for Livistone; no third-party source.'}, indent=2) + '\n')
if len(sys.argv) > 1:
    preview = Path(sys.argv[1]); preview.mkdir(parents=True, exist_ok=True)
    shade = np.clip(.5 + (n[..., 0] * -.6 + n[..., 1] * .5 + n[..., 2] * .55) * .6, 0, 1) * (1 - trodden * .15)
    Image.fromarray((shade * 255).astype(np.uint8)).resize((W, H // 2)).save(preview / 'footprints-preview.png')
print(json.dumps(files, indent=1))
