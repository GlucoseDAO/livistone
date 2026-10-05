"""Small, uncropped gallery derivatives of existing generated concepts; originals stay in concepts/."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parent.parent
sources = {
    'overview': 'concepts/01-garden-town/images/01-town-overview.png',
    'embryo': 'concepts/06-town-extension/images/01-embryo-station.png',
    'gateway': 'concepts/07-bridge-monument/images/08-kings-chapel-name-on-top.png',
    'eyelense': 'concepts/15-moon-gates/images/12-eyelense-e-red-bead-passage.png',
    'winter': 'concepts/15-moon-gates/images/17-winter-g-model-two-stones-open.png',
}
for name in ['city-hall', 'energy', 'science', 'timeface', 'glucose', 'lake', 'future-house', 'mycelium', 'enhancement', 'jepii']:
    sources[name] = f'concepts/16-concept-garden/images/{name}.png'
out = root / 'public/images/concepts'
out.mkdir(parents=True, exist_ok=True)
manifest = {}
for name, source in sources.items():
    image = Image.open(root / source).convert('RGB')
    image.thumbnail((1440, 1440), Image.Resampling.LANCZOS)
    # Never rewrite the five existing published concepts when filling missing slots.
    if not (out / f'{name}.webp').exists():
        image.save(out / f'{name}.webp', quality=88)
    manifest[name] = {'source': source, 'sha256': hashlib.sha256((root / source).read_bytes()).hexdigest(), 'kind': 'AI-generated architectural concept', 'size': image.size}
(out / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
