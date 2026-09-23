"""Build compact, local ground maps from attributed CC0 photographs (Pillow, authoring only)."""
from pathlib import Path
import hashlib
import json
import urllib.request
from PIL import Image

output = Path('public/textures/ground')
cache = Path('output/testing/ground-sources')
output.mkdir(parents=True, exist_ok=True)
cache.mkdir(parents=True, exist_ok=True)
records = []
for asset, stem, author in [('leafy_grass', 'meadow', 'Charlotte Baglioni'), ('sparse_grass', 'soil', 'Amal Kumar')]:
    url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{asset}/{asset}_diff_1k.jpg'
    source = cache / f'{asset}-original.jpg'
    if not source.exists():
        urllib.request.urlretrieve(url, source)
    with Image.open(source) as image:
        for size in (512, 1024):
            target = output / f'{stem}-{size}.webp'
            image.convert('RGB').resize((size, size), Image.Resampling.LANCZOS).save(target, quality=82, method=6)
            print(target, target.stat().st_size)
    records.append(dict(asset=asset, author=author, license='CC0', source=url, sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
(output / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
