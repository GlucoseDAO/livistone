"""Build compact, tiered ground maps from attributed CC0 Poly Haven scans (Pillow + numpy, authoring only).

Per layer and tier this writes an sRGB albedo WebP and a linear RGBA "nrh" WebP packing
normal.x, normal.y (OpenGL convention), roughness and height. Originals are cached under the
git-ignored data/textures-src/ground/ and fetched only when missing.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
import numpy as np
from PIL import Image

output = Path('public/textures/ground')
cache = Path('data/textures-src/ground')
output.mkdir(parents=True, exist_ok=True)
cache.mkdir(parents=True, exist_ok=True)

# asset, runtime stem, author(s), real-world tile size (m), how strongly to remove low frequencies.
# Flattening keeps the scan's fine detail but removes the blotches that make a repeat visible from
# afar; the terrain shader supplies large-scale variation instead. Soil keeps more of its clover/mud
# structure, because that structure is its character.
LAYERS = [
    ('leafy_grass', 'meadow', 'Charlotte Baglioni', 2.0, .8),
    ('sparse_grass', 'sparse', 'Amal Kumar', 2.0, .7),
    ('brown_mud_leaves_01', 'soil', 'Rob Tuytel', 1.3, .45),
    ('gravel_floor_02', 'gravel', 'Jenelle van Heerden, Dimitrios Savva', 2.0, .6),
]
MAPS = ['diff', 'nor_gl', 'rough', 'disp', 'ao']
# Albedo sizes per tier (gpu, reduced); nrh is stored at half the albedo size.
ALBEDO = (1024, 512)


def fetch(asset: str, kind: str) -> tuple[Path, str]:
    url = f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{asset}/{asset}_{kind}_2k.jpg'
    source = cache / f'{asset}_{kind}_2k.jpg'
    if not source.exists():
        urllib.request.urlretrieve(url, source)
    return source, url


def load(path: Path, mode: str) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert(mode), dtype=np.float64) / 255


def to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def blur(channel: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur that wraps around, so the result stays tileable."""
    fy, fx = np.fft.fftfreq(channel.shape[0])[:, None], np.fft.rfftfreq(channel.shape[1])[None, :]
    kernel = np.exp(-2 * np.pi ** 2 * sigma ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(channel) * kernel, s=channel.shape)


def resize(channels: np.ndarray, size: int) -> np.ndarray:
    """Resize float data per channel (linear values, so mip-like averaging stays correct)."""
    planes = channels if channels.ndim == 3 else channels[..., None]
    out = [np.asarray(Image.fromarray(planes[..., k].astype(np.float32), 'F').resize((size, size), Image.Resampling.LANCZOS)) for k in range(planes.shape[2])]
    result = np.stack(out, -1).astype(np.float64)
    return result if channels.ndim == 3 else result[..., 0]


def quantise(x: np.ndarray, bits: int) -> np.ndarray:
    """Drop low bits before lossless WebP: grass normals are noise, so this halves the file at an error of about 1 %."""
    step = 2 ** (8 - bits)
    return np.clip(np.floor(np.clip(x, 0, 1) * 255 / step) * step + step // 2, 0, 255).astype(np.uint8)


records, derivatives = [], {}
for asset, stem, author, metres, flatten in LAYERS:
    paths, files = {}, {}
    for kind in MAPS:
        path, url = fetch(asset, kind)
        paths[kind] = path
        files[kind] = dict(source=url, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)
    n = load(paths['diff'], 'RGB').shape[0]
    sigma = n / 16  # about 12 cm on a 2 m scan

    # Albedo: bake a little ambient occlusion so reduced tiers keep small-scale shade, then
    # flatten the low-frequency colour while preserving the mean.
    albedo = to_linear(load(paths['diff'], 'RGB')) * load(paths['ao'], 'L')[..., None] ** .5
    for k in range(3):
        low = np.maximum(blur(albedo[..., k], sigma), 1e-4)
        albedo[..., k] *= (albedo[..., k].mean() / low) ** flatten
    mean = albedo.reshape(-1, 3).mean(0)

    # Normals: remove the broad tilt the same way, so lighting does not repeat at mid range.
    normal = load(paths['nor_gl'], 'RGB') * 2 - 1
    for k in range(2):
        normal[..., k] -= blur(normal[..., k], sigma) * flatten
    normal[..., 2] = np.maximum(normal[..., 2], .05)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    rough = load(paths['rough'], 'L')
    # Height drives blending only; keep its local relief, not the scan's large hollows.
    height = load(paths['disp'], 'L')
    height -= blur(height, n / 12) * .7
    lo, hi = np.percentile(height, [1, 99])
    height = np.clip((height - lo) / max(hi - lo, 1e-6), 0, 1)

    for tier, size in zip(('gpu', 'reduced'), ALBEDO):
        target = output / f'{stem}-albedo-{size}.webp'
        Image.fromarray((to_srgb(resize(albedo, size)) * 255 + .5).astype(np.uint8), 'RGB').save(target, quality=82, method=6)
        half = size // 2
        nrm = resize(normal, half)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=-1, keepdims=True), 1e-6)
        r = blur(resize(rough, half), half / 512 * 1.5)
        # Height lives in alpha 129..255 (h = 2a - 1): if a browser premultiplies the decoded image,
        # the round trip then costs the colour channels less than one 5-bit normal step.
        alpha = (128 + quantise(resize(height, half), 6) // 2).astype(np.uint8)
        packed = np.stack([quantise(nrm[..., 0] * .5 + .5, 5), quantise(nrm[..., 1] * .5 + .5, 5), quantise(r, 4), alpha], -1)
        nrh = output / f'{stem}-nrh-{half}.webp'
        Image.fromarray(packed, 'RGBA').save(nrh, lossless=True, quality=100, method=6, exact=True)
        for path in (target, nrh):
            derivatives[path.name] = path.stat().st_size
            print(path, path.stat().st_size)
    records.append(dict(asset=asset, page=f'https://polyhaven.com/a/{asset}', author=author, license='CC0', tileMetres=metres,
                        meanLinearAlbedo=[round(float(v), 4) for v in mean], meanRoughness=round(float(rough.mean()), 3), files=files))

(output / 'sources.json').write_text(json.dumps(dict(retrieved='2026-10-03', layers=records, derivatives=derivatives), indent=2) + '\n')
