"""Bake seeded walnut folds and smoky crystal clouds; use the owner's photographs for palette."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

output = Path('public/textures/city-hall')
output.mkdir(parents=True, exist_ok=True)
references = [Path(f'public/images/jewelry/catalogue/nut-{i}.webp') for i in (1, 2)]
rng = np.random.default_rng(3493)
size = 1024
v, u = np.mgrid[0:size, 0:size].astype(float) / size

def field(frequency, waves):
    result = np.zeros_like(u)
    for _ in range(waves):
        x, y = rng.integers(1, frequency + 1, 2)
        result += np.sin(2 * np.pi * (u * x + v * y) + rng.uniform(0, 2 * np.pi))
    return result / np.sqrt(waves)

wu = u + .045 * np.sin(v * np.pi * 6 + np.sin(u * np.pi * 4)) + .022 * field(5, 8)
wv = v + .06 * np.sin(u * np.pi * 4 + .6 * np.sin(v * np.pi * 6)) + .018 * field(7, 8)
seeds = []
while len(seeds) < 38:
    candidate = rng.random(2)
    if all(np.linalg.norm((candidate - point + .5) % 1 - .5) > .085 for point in seeds):
        seeds.append(candidate)
first, second = np.full(u.shape, np.inf), np.full(u.shape, np.inf)
for x, y in seeds:
    dx, dy = (wu - x + .5) % 1 - .5, (wv - y + .5) % 1 - .5
    distance = dx * dx + dy * dy * .75
    second = np.minimum(second, np.maximum(first, distance))
    first = np.minimum(first, distance)
margin = np.sqrt(second) - np.sqrt(first)
raised = 1 - np.exp(-margin / .022)
grain = field(35, 16) * .012 + field(80, 12) * .003
branches = np.exp(-field(8, 12) ** 2 * 95) * .07 * raised
height = np.clip(raised * .77 + .18 * np.exp(-first * 28) - branches + grain, 0, 1)

palettes = []
for reference in references:
    pixels = np.asarray(Image.open(reference).convert('RGB').resize((256, 256))).reshape(-1, 3).astype(float)
    red, green, blue = pixels.T
    mask = (red > green * 1.25) & (green > blue * 1.3) & (red > 80) & (red < 238)
    palettes.append(pixels[mask])
palette = np.concatenate(palettes)
dark, light = np.quantile(palette, [.14, .83], axis=0)
variation = np.clip(.19 + height * .67 + field(3, 12) * .06, 0, 1)
colour = dark * (1 - variation[..., None]) + light * variation[..., None]
colour += grain[..., None] * 130
ao = np.clip(.70 + .30 * height, 0, 1)
roughness = np.clip(.51 + (1 - height) * .20 + grain * 2, .43, .82)
packed = np.stack([ao, roughness, np.zeros_like(u)], axis=-1)
dy, dx = np.gradient(height)
normal = np.stack([-dx * size * .035, dy * size * .035, np.ones_like(u)], axis=-1)
normal /= np.linalg.norm(normal, axis=-1)[..., None]
normal = normal * .5 + .5

def save(array, name, width, lossless=False):
    image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
    image = image.resize((width, width), Image.Resampling.LANCZOS)
    path = output / name
    image.save(path, format='WEBP', quality=88, lossless=lossless, method=6)
    print(path, path.stat().st_size)

for width in (512, 1024):
    save(colour, f'walnut-colour-{width}.webp', width)
for width in (256, 512):
    save(packed * 255, f'walnut-ao-roughness-{width}.webp', width, True)
save(normal * 255, 'walnut-normal-512.webp', 512, True)

cloud = field(3, 18) * .035 + field(11, 14) * .012
inclusions = np.zeros_like(u)
for _ in range(18):
    x, y = rng.random(2)
    dx, dy = (u - x + .5) % 1 - .5, (v - y + .5) % 1 - .5
    inclusions = np.maximum(inclusions, np.exp(-((dx / .024) ** 2 + (dy / .12) ** 2)) * .12)
crystal = np.stack([.92 + cloud - inclusions, .91 + cloud - inclusions, .95 + cloud - inclusions * .7], axis=-1)
for width in (256, 512):
    save(crystal * 255, f'crystal-cloud-{width}.webp', width)

(output / 'sources.json').write_text(json.dumps({
    'generator': 'scripts/build-city-hall-textures.py', 'seed': 3493,
    'source': 'https://livia.glucosedao.org/pieces/',
    'originalPhotos': ['https://livia.glucosedao.org/RJW2025/IMG_3493.jpg', 'https://livia.glucosedao.org/RJW2025/IMG_3496.jpg'],
    'references': [{'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in references],
    'walnutPalette': {'dark': dark.tolist(), 'light': light.tolist()},
    'method': 'Original periodic warped fold fields, branch furrows, normal/occlusion/roughness bake, and smoky cloud fields. No photographed highlights projected onto the building.',
}, indent=2) + '\n')
