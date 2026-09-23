"""Build attributed local derivatives of the older works and original presentation slides."""
import hashlib, json, urllib.request
from pathlib import Path
from PIL import Image
import pypdfium2 as pdfium

root = Path(__file__).resolve().parent.parent
cache = root / 'output/testing/research-sources'
dest = root / 'public/images/jewelry/archive'
dest.mkdir(parents=True, exist_ok=True)
entries = [
    ('first-ring', 'First Ring', 'Silver; bronze exhibition variant', '2018–2022 (archive estimate)', 'The artist’s first cast piece uses polygons of different heights and an open front for adjustment. The archive records silver and a bronze version made for exhibition.', '/pieces/First%20ring/2130268170623444.jpg'),
    ('moldavian-vault', 'Moldavian Vault Ring', 'Not specified in the archive', '2018 (archive estimate)', 'An early ring from the studio archive. Its name refers to a Moldavian vault; the available catalogue records photographs and an estimated year, without a longer artist statement.', '/pieces/Moldavian%20vault%20ring/2130322920617969.jpg'),
    ('art-nouveau', 'Art Nouveau Ring', 'Silver, amethyst cabochon', '2020 (archive estimate)', 'An oval amethyst inspired a light Art Nouveau setting. Livia describes this as her first complete flush setting, designed to pair with the Pretzel earrings.', '/pieces/Art-Nouveau%20ring/2386236335026625.jpg'),
    ('peas-in-pod', 'Peas in Pod Ring', 'Silver, jade beads', '2020 (archive estimate)', 'Moving jade beads sit inside a silver ring inspired by gears. The artist wanted the beads to move while keeping a smooth shape that would not catch on clothing.', '/pieces/Peas-in-pod%20ring/2532581933725397.jpg'),
    ('wormy', 'Wormy Ring', 'Silver, purple cultured pearl', 'Undated in the archive', 'The woven silver setting was developed around an unusually shaped purple cultured pearl. Livia found that the woven pattern also strengthened the open ring.', '/pieces/Wormy%20ring/2485169258466665.jpg'),
]
manifest = []
for slug, title, materials, year, story, source in entries:
    original = cache / (slug + '.jpg')
    if not original.exists(): urllib.request.urlretrieve('https://livia.glucosedao.org' + source, original)
    im = Image.open(original).convert('RGB')
    photos = []
    for suffix, size in [('', 1600), ('-thumb', 640)]:
        copy = im.copy(); copy.thumbnail((size, size)); copy.save(dest / (slug + suffix + '.webp'), quality=86)
    manifest.append(dict(discovery=slug, title=title, type='Ring', materials=materials, dimensions='Not recorded', year=year, location='timeface', collection='Earlier explorations', description=story, story=story, source='https://livia.glucosedao.org/pieces/', photos=[dict(file=f'archive/{slug}.webp', thumb=f'archive/{slug}-thumb.webp', alt=title+' — Livia Zaharia, studio archive', sourcePath=source, sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest())]))
camel = cache / 'camel-dali.jpg'
if camel.exists():
    for suffix, size in [('', 1600), ('-thumb', 640)]:
        image = Image.open(camel).convert('RGB'); image.thumbnail((size, size)); image.save(dest / ('camel-dali'+suffix+'.webp'), quality=88)
    manifest.append(dict(discovery='camel-dali', title='Camel Dalí', type='Mixed-material object', materials='Native copper, PLA print, leather', dimensions='Not recorded', year='2026', location='future-house', collection='Organic forms and 3D printing', description='Native copper hangs beneath a dark PLA printed part, held together with leather ties. Livia describes the form as a camel; her original Instagram post introduces an organic form and 3D printing. These materials inspire Future House.', story='Native copper hangs beneath a dark PLA printed part, held together with leather ties. The drinking camel, walkable neck and exhibition cabin are new architecture imagined for Livistone.', source='https://www.instagram.com/p/DdDwLqDlcm2/', photos=[dict(file='archive/camel-dali.webp', thumb='archive/camel-dali-thumb.webp', alt='Camel Dalí — original photograph supplied by Livia through Instagram', sourcePath='https://www.instagram.com/p/DdDwLqDlcm2/', sourceSha256=hashlib.sha256(camel.read_bytes()).hexdigest())]))
(root / 'src/game/archive-catalogue.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
doc = pdfium.PdfDocument(cache / 'presentation-12.pdf')
for page in [1, 2, 3, 9, 11, 12, 13, 14, 15, 16]:
    image = doc[page-1].render(scale=2.5).to_pil(); image.thumbnail((2000, 1400)); image.save(root / f'public/images/research/slide-{page:02}.webp', quality=89)
print('Built five older works and ten original presentation slides.')
