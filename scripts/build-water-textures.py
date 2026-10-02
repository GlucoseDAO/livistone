"""Bake the river's tileable ripple normals and foam noise (Pillow + numpy, procedural, no downloads).

One seeded spectrum makes both sizes: the 256 px map is the 512 px spectrum cropped to its own
Nyquist limit, so mobile sees the same ripples without the finest octave and both tiles wrap.

Channels (linear data, lossless WebP):
  R, G  ripple normal x/y of a summed-wave height field, n = normalize(-dh/du, -dh/dv, 1)
  B     foam noise: lacy ridges over soft blobs, equalised so a threshold of t keeps ~t of the tile
Run from the repository root: python3 scripts/build-water-textures.py
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

output = Path('public/textures/water')
output.mkdir(parents=True, exist_ok=True)
SIZE = 512
rng = np.random.default_rng(4410)
k = np.fft.fftfreq(SIZE, 1 / SIZE)  # integer wave numbers per tile, so every wave wraps
kx, ky = np.meshgrid(k, k)
radius = np.hypot(kx, ky)
safe = np.maximum(radius, 1e-6)


def spectrum(power, low, high):
    """Random complex amplitudes with |A|^2 ~ k^-power, band-limited between low and high."""
    phase = rng.uniform(0, 2 * np.pi, radius.shape)
    gain = rng.rayleigh(1.0, radius.shape)
    amplitude = safe ** (-power / 2) * (1 - np.exp(-(radius / low) ** 4)) * np.exp(-(radius / high) ** 2)
    amplitude[0, 0] = 0
    return amplitude * gain * np.exp(1j * phase)


# Ripples: wavelengths from half a tile down to ~1/100 tile with a capillary-like k^-4 height
# spectrum (slope spectrum ~k^-2, so every octave carries similar visible detail). Three soft
# wave-train headings give the criss-cross chop of a stream instead of isotropic blobs; the
# shader scrolls the tile along the baked flow, so no heading is tied to a channel.
height = spectrum(4.8, 6.0, 52.0)
heading = np.arctan2(ky, kx)
trains = sum(np.cos(heading - angle) ** 8 for angle in rng.uniform(0, np.pi, 3))
height *= .45 + 1.1 * trains / 3
foam_lace = spectrum(3.0, 4.0, 34.0)
foam_blob = spectrum(3.4, 1.5, 24.0)


def crop(field, size):
    """Keep only the wave numbers a size x size tile can represent (exact, wrap-safe downsample)."""
    if size == SIZE:
        return field
    half = size // 2
    keep = np.zeros((size, size), complex)
    keep[:half, :half] = field[:half, :half]
    keep[:half, -half:] = field[:half, -half:]
    keep[-half:, :half] = field[-half:, :half]
    keep[-half:, -half:] = field[-half:, -half:]
    return keep * (size / SIZE) ** 2


def real(field):
    return np.fft.ifft2(field).real


def bake(size, slope_scale):
    h = crop(height, size)
    q = np.fft.fftfreq(size, 1 / size)
    qx, qy = np.meshgrid(q, q)
    # Spectral derivatives are exact and periodic: no seams at the tile edge.
    du = real(h * 2j * np.pi * qx)
    dv = real(h * 2j * np.pi * qy)
    if slope_scale is None:
        slope_scale = .42 / np.sqrt(np.mean(du ** 2 + dv ** 2))
    nx, ny, nz = -du * slope_scale, -dv * slope_scale, np.ones_like(du)
    length = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny = nx / length, ny / length
    lace = real(crop(foam_lace, size))
    lace = 1 - np.abs(lace / np.abs(lace).max())
    blob = real(crop(foam_blob, size))
    blob = (blob - blob.min()) / (blob.max() - blob.min())
    foam = lace ** 3 * .6 + blob * .4
    rank = np.argsort(np.argsort(foam.ravel())).reshape(foam.shape)
    foam = rank / (foam.size - 1)
    rgb = np.stack([nx * .5 + .5, ny * .5 + .5, foam], -1)
    image = Image.fromarray(np.clip(np.round(rgb * 255), 0, 255).astype(np.uint8), 'RGB')
    target = output / f'ripples-{size}.webp'
    image.save(target, 'WEBP', lossless=True, quality=100, method=6)
    print(target, target.stat().st_size, 'bytes, slope rms', float(np.sqrt(np.mean(nx ** 2 + ny ** 2))))
    return slope_scale, target


scale, first = bake(SIZE, None)
_, second = bake(256, scale)
records = [dict(file=path.name, generator='scripts/build-water-textures.py', seed=4410, license='project-original',
                sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in (first, second)]
(output / 'sources.json').write_text(json.dumps(records, indent=2) + '\n')
