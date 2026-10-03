# Architectural surface maps

Project-original and procedural: no photographs, scans or downloads. `scripts/build-surface-textures.py`
(Pillow + numpy) synthesises each set from a fixed seed; rerunning it reproduces every file byte for byte.

| Set | Seed | Tile | gpu | reduced | Mean colour (the flat colour it replaces) |
| --- | --- | --- | --- | --- | --- |
| `ashlar` | 2401 | 4 m | albedo 1024 + nrh 512 | albedo 512 + nrh 256 | `#f4f0df`, town white: bridge masonry, hall rims |
| `terrazzo` | 2402 | 4 m | albedo 1024 + nrh 512 | albedo 512 + nrh 256 | `#ddd7c4`, hall floor insets |
| `brass` | 2403 | 1 m | albedo 512 + nrh 512 | albedo 256 + nrh 256 | `#c2aa77`, poster stand feet |

- **ashlar**: pale coursed limestone. Ten courses of 0.375 and 0.4375 m, blocks 0.6–1.25 m with
  staggered head joints, 10 mm recessed lime joints, rounded and chipped arrises, per-block tone and
  warmth, faint bedding, clustered pores and shell flecks.
- **terrazzo**: honed terrazzo. Angular marble chips of about 6 mm, 12 mm and 3 cm in a pale matrix
  with air pinholes, poured in 1 m panels divided by flush 3 mm brass strips.
- **brass**: brushed cast brass, mainly a roughness variation map: streaks along u, soft tarnish,
  oxide spots and a few scratches.

Files per set and tier:

- `<set>-albedo-<n>.webp`: sRGB colour, lossy WebP (quality 84). Its mean linear colour equals the
  colour in the table, so the texture adds variation without changing the approved palette. To use a
  set on a material with another colour, multiply by that colour divided by `meanLinearAlbedo`.
- `<set>-nrh-<n>.webp`: lossless RGBA, linear data, packed like the ground maps: normal x/y (OpenGL,
  +y up the image), roughness, and height in alpha as 128 + h/2 (h = 2a − 1). Normals come from a
  height field in metres; normal variance lost when filtering to the smaller size is added to roughness.

The stone tiles repeat every 4 m like the limestone paving, so their gpu albedo has the paving's 256 px/m.
`sources.json` records each set's seed, tile size, mean colour and roughness, height range in metres,
and the size and SHA-256 of every file.
