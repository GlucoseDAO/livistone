# River ripple maps

Project-original, procedural; no photographs or downloads. `scripts/build-water-textures.py`
(Pillow + numpy, seed 4410) synthesises one periodic wave spectrum and writes lossless WebP:

- `ripples-512.webp` (gpu) and `ripples-256.webp` (mobile, the same spectrum cropped to its Nyquist limit).
- R, G: ripple normal x/y; B: equalised foam noise. Linear data, not colour.

`sources.json` records the generator, seed and SHA-256 of each file.
