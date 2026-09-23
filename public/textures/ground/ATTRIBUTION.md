# Ground-cover photographs

- [Leafy Grass](https://polyhaven.com/a/leafy_grass), Charlotte Baglioni, Poly Haven, CC0.
- [Sparse Grass](https://polyhaven.com/a/sparse_grass), Amal Kumar, Poly Haven, CC0.

Retrieved 23 September 2026. `sources.json` records the original 1K diffuse JPG URLs
and SHA-256 hashes. `scripts/build-ground-textures.py` resizes and compresses the
unaltered colours to 512 px (reduced graphics) and 1024 px (rich graphics) WebP.
No displacement or new terrain geometry is used. Both photographs are tiled at
world scale and blended using soil-wear weights baked into existing terrain vertices.

At runtime, meadow colours are tinted towards fresh spring green; soil is limited
to subtle path wear and riverbank patches. The local image derivatives retain their original colours.
