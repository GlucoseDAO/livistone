# Ground-cover scans

All CC0, from Poly Haven (2K JPG map sets: colour, OpenGL normal, roughness, displacement, AO):

- [Leafy Grass](https://polyhaven.com/a/leafy_grass), Charlotte Baglioni — `meadow-*`
- [Sparse Grass](https://polyhaven.com/a/sparse_grass), Amal Kumar — `sparse-*` (worn and dry grass)
- [Brown Mud Leaves 01](https://polyhaven.com/a/brown_mud_leaves_01), Rob Tuytel — `soil-*` (path wear, banks)
- [Gravel Floor 02](https://polyhaven.com/a/gravel_floor_02), Jenelle van Heerden and Dimitrios Savva — `gravel-*` (reserved for the shore, sub-plan 14; not loaded yet)

Retrieved 3 October 2026. `sources.json` records every original URL, SHA-256 and size. The
originals are cached outside git under `data/textures-src/ground/`.

`scripts/build-ground-textures.py` (Pillow + numpy) writes per layer:

- `<layer>-albedo-{1024,512}.webp`: sRGB colour with a little AO baked in and its low-frequency
  blotches flattened (mean colour preserved), so repeats are not visible from afar.
- `<layer>-nrh-{512,256}.webp`: lossless RGBA, normal.x/normal.y (OpenGL), roughness, and height
  stored in alpha as 0.5 + h/2. The normals are quantised to 5 bits and roughness to 4 bits.

The gpu tier loads 1024 albedo + 512 nrh, mobile 512 + 256, and cpu albedo 512 only. At runtime
the terrain shader re-centres the scans on a spring-green palette. The earlier 1K colour-only
derivatives (`meadow-*`/`soil-*`, 23 September 2026) are superseded.
