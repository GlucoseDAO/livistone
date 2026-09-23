# Curated jewelry exhibition

`selection.json` records reviewed facts, source titles, exhibition assignments and original photograph paths from the adjacent `livia/content/pieces.md`. The first exhibition has **32 physical works**: 8 in City Hall, 8 in Energy, 9 in Science, and 7 in Embryo Station. The later extension assigns Timeface to its tower, and Eyelense and Deep Sea Pearl to Future House. Five older works and Camel Dalí are added in `src/game/archive-catalogue.json`, with provenance under `public/images/jewelry/archive/ATTRIBUTION.md`. The combined catalogue now has 41 physical works. Every work has exactly one physical location or none; there is no duplicate physical poster.

Photographs: © Livia Zaharia, studio archive. Supplied for the Livistone/Livia project; no blanket third-party reuse license is implied. Source URLs are `https://livia.glucosedao.org` followed by each `sourcePhotos` path. The public site is a build-time fallback when the adjacent archive contains a Git LFS pointer. It is never a runtime dependency.

`src/game/jewelry-catalogue.json` is the generated, source-hashed manifest. Full images are contained within 1600 × 1600 pixels and thumbnails within 640 × 640, preserving their entire natural aspect ratio and applying EXIF orientation. Posters load thumbnails; opening the photo viewer or factual sheet loads the full images. Source facts remain available after image failures. Generated derivatives live in `public/images/jewelry/catalogue/`.

Regenerate with Node ≥22.12 and the offline authoring library `sharp` available:

```bash
node scripts/build-catalogue.mjs
```

An existing authoring installation can be selected with `LIVISTONE_SHARP=/absolute/path/to/sharp/dist/index.mjs`. The generator does not install or add a runtime dependency. It reads the reviewed selection, uses original local photographs when available, otherwise downloads the specified artist photographs and caches them under git-ignored `output/testing/catalogue-sources/`.

The older Rotary Magnetic Ring studio prose describes a tourmaline experiment, while its structured 2026 exhibition entry and selected exhibition photos identify amber. This exhibition uses only the structured exhibition caption and corresponding photos; it does not combine those two versions. Amonite/Ammonite is displayed as Ammonite without changing source filenames. Missing archive facts have not been invented.
