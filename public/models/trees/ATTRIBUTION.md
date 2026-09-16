# Oak and ash tree assets

Generated for Livistone from Daniel Greenheck's **EZ-Tree 1.1.0** presets and bundled bark/leaf textures.

- Source: https://github.com/dgreenheck/ez-tree
- Package: https://www.npmjs.com/package/@dgreenheck/ez-tree/v/1.1.0
- License: MIT; reproduced in `LICENSE.txt` alongside these assets.
- Generator: `scripts/tree-assets.ts`, with deterministic seeds 713 (oak) and 146 (ash).
- Changes: consistent 12 m model height, adjusted branching/leaf density, PBR materials, texture downsampling to 512 px, GLB export.
- Runtime: spatially batched instances with scale, orientation and color variation. Mobile uses one card of each crossed foliage pair.

These are textured procedural models, not photogrammetry scans. GLBs embed the downloaded bark and leaf textures and need no external asset host at runtime.

To regenerate, run the Vite dev server, then `bun scripts/generate-trees.mjs`. Google Chrome and the development dependencies are required.
