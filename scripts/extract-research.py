from pathlib import Path
from hashlib import sha256
import pypdfium2 as pdf

root = Path('public/images/research')
root.mkdir(parents=True, exist_ok=True)
source = Path('output/testing/research-sources/glucosedao-poster.pdf')
if sha256(source.read_bytes()).hexdigest() != '029430b3819ff87fc7b5e9b84eda9039e9890824386c5c01c1db98a0ce552540':
    raise ValueError('Source poster changed; inspect it before using these crop coordinates.')
doc = pdf.PdfDocument(source)
im = doc[0].render(scale=1).to_pil().convert('RGB')
# Crop coordinates refer to the inspected 1191 x 1560 full-page preview.
regions = {
 'cgm': (48, 276, 391, 615),
 'architecture': (413, 276, 761, 784),
 'benchmarks': (777, 276, 1148, 789),
 'personalisation': (47, 815, 769, 1191),
 'sugar-sugar': (800, 1200, 1149, 1515),
 'inputs': (419, 1200, 772, 1496),
}
for name, box in regions.items():
    crop = im.crop(tuple(round(v * im.width / 1191) for v in box))
    crop.thumbnail((1440, 1440))
    crop.save(root / (name + '.webp'), quality=91)
im.thumbnail((1800, 2400))
im.save(root / 'original-poster.webp', quality=88)
print('Extracted', len(regions), 'source panels and full poster')
