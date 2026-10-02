"""Bake original, seeded amber and cast-silver maps; photographs guide colour, not lighting."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

output = Path('public/textures/mitoring')
output.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(3475)
size = 1024
v, u = np.mgrid[0:size // 2, 0:size].astype(float)
u /= size
v /= size // 2

def field(frequency, waves):
    result = np.zeros_like(u)
    for _ in range(waves):
        x = int(rng.integers(max(1, frequency // 2), frequency + 1))
        y = rng.uniform(-frequency, frequency)
        result += np.sin(2 * np.pi * (u * x + v * y) + rng.uniform(0, 2 * np.pi))
    return result / np.sqrt(waves)

cloud = field(3, 14) * .19 + field(9, 16) * .09 + field(27, 18) * .035
warmth = np.clip(.61 + cloud, 0, 1)
inclusions = np.zeros_like(u)
for _ in range(28):
    x, y = rng.random(2)
    dx = (u - x + .5) % 1 - .5
    dy = v - y + np.sin(u * np.pi * 8) * .008
    patch = np.exp(-((dx / rng.uniform(.009, .045)) ** 2 + (dy / rng.uniform(.012, .13)) ** 2) * 2)
    inclusions = np.maximum(inclusions, patch * rng.uniform(.25, .65))
warmth = np.clip(warmth - inclusions, 0, 1)
dark, amber, honey = np.array([107, 35, 6]), np.array([230, 115, 13]), np.array([255, 204, 70])
lower = np.minimum(warmth * 2, 1)[..., None]
upper = np.maximum(warmth * 2 - 1, 0)[..., None]
colour = dark * (1 - lower) + amber * lower
colour = colour * (1 - upper) + honey * upper
dust = rng.random(u.shape)
colour *= np.where(dust < .002, .65, 1)[..., None]
polish = np.clip(.63 + field(15, 12) * .045 + inclusions * .12, .48, .84)

def save(array, name, width, lossless=False):
    image = Image.fromarray(np.clip(array * 255 if array.max() <= 1 else array, 0, 255).astype(np.uint8))
    image = image.resize((width, max(1, int(image.height * width / image.width))), Image.Resampling.LANCZOS)
    path = output / name
    image.save(path, format='WEBP', lossless=lossless, quality=88, method=6)
    print(path, path.stat().st_size)

for width in (512, 1024):
    save(colour, f'amber-colour-{width}.webp', width)
    save(np.repeat(polish[..., None], 3, axis=2), f'amber-roughness-{width}.webp', width, True)

v, u = np.mgrid[0:256, 0:256].astype(float)
u /= 256
v /= 256
cast = field(28, 16) * .06 + field(9, 12) * .08
silver = np.clip(.67 + cast + (rng.random(u.shape) - .5) * .12, .45, .92)
for width in (128, 256):
    save(np.repeat(silver[..., None], 3, axis=2), f'silver-roughness-{width}.webp', width, True)

references = [Path(f'public/images/jewelry/catalogue/mitoring-{i}.webp') for i in (1, 2)]
(output / 'sources.json').write_text(json.dumps({
    'generator': 'scripts/build-mitoring-textures.py', 'seed': 3475,
    'source': 'https://livia.glucosedao.org/pieces/?tab=mitoring-mitochondria-ring',
    'references': [{'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in references],
    'method': 'Original periodic cloud fields, resin inclusions and casting roughness; no photographic lighting baked into colour.',
}, indent=2) + '\n')
