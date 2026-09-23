"""Build the Materialized Enhancements poster images and compact crystal meshes.

Usage: python3 scripts/build-enhancement.py [photo folder]   (default ~/Pictures/materialized)
Photos stay outside the repository; only resized WebP derivatives and their source hashes are written.
Crystals come from data/enhancement/crystals (see generate-enhancement-crystals.py).
"""
import hashlib, json, struct, sys
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
photos = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Pictures/materialized'
dest = root / 'public/images/enhancement'; dest.mkdir(parents=True, exist_ok=True)
sources = {}

def load(name: str) -> Image.Image:
    path = photos / name; sources[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')

def save(image: Image.Image, slug: str, edge: int = 1280) -> None:
    image = image.copy(); image.thumbnail((edge, edge), Image.LANCZOS); image.save(dest / f'{slug}.webp', 'WEBP', quality=82, method=6)

def collage(images: list[Image.Image], columns: int, cell: tuple[int, int], gap: int, background: str) -> Image.Image:
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * cell[0] + (columns + 1) * gap, rows * cell[1] + (rows + 1) * gap), background)
    for i, image in enumerate(images):
        fitted = image.copy(); fitted.thumbnail(cell, Image.LANCZOS)
        x, y = gap + (i % columns) * (cell[0] + gap), gap + (i // columns) * (cell[1] + gap)
        sheet.paste(fitted, (x + (cell[0] - fitted.width) // 2, y + (cell[1] - fitted.height) // 2))
    return sheet

save(load('3dprinter.jpg'), 'printer')
save(load('livia_with_piece.jpg'), 'livia')
save(load('pieces/WhatsApp Image 2026-09-23 at 2.18.35 PM.jpeg'), 'glow')
save(load('materialized_Scinquisitor_s2371.webp'), 'report', 1080)
visitors = [load('people_with_pieces/' + p.name) for p in sorted((photos / 'people_with_pieces').glob('*.jpg'))]
save(collage(visitors, 3, (420, 560), 14, '#f4f0e5'), 'visitors', 1400)
memes = [load('memes/' + name) for name in ('dsup2_chat_gpt.jpg', 'elephant_chat_gpt.jpg', 'klotho_chat_gpt.jpg', 'myostatin_chat_gpt.jpg')]
save(collage(memes, 2, (620, 700), 14, '#f4f0e5'), 'memes', 1300)
(dest / 'sources.json').write_text(json.dumps(sources, indent=1) + '\n')

# Binary STL triangles are indexed by exact vertex identity, then quantized to 0.1 mm; no triangle is removed.
meta = json.loads((root / 'data/enhancement/crystals/meta.json').read_text()); crystals = []
for entry in meta['crystals']:
    data = (root / 'data/enhancement/crystals' / entry['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['file']
    count = struct.unpack_from('<I', data, 80)[0]; lookup, positions, indices = {}, [], []
    for t in range(count):
        for v in range(3):
            key = struct.unpack_from('<3f', data, 84 + t * 50 + 12 + v * 12)
            if key not in lookup: lookup[key] = len(lookup); positions.extend(round(c * 10) for c in key)
            indices.append(lookup[key])
    crystals.append({**{k: entry[k] for k in ('category', 'seed', 'genes', 'sha256')}, 'triangles': count, 'positions': positions, 'indices': indices})
(root / 'src/world/models/enhancement-crystals.json').write_text(json.dumps({'name': meta['name'], 'sourceCommit': meta['sourceCommit'], 'unit': '0.1 mm', 'crystals': crystals}, separators=(',', ':')))
print('images', sorted(p.name for p in dest.glob('*.webp')), 'crystals', [(c['category'], c['triangles'], len(c['positions']) // 3) for c in crystals])
