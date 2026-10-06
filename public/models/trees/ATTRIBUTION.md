# Tree assets

Generated for Livistone from Daniel Greenheck's **EZ-Tree 1.1.0** presets and bundled bark/leaf textures.

- Source: https://github.com/dgreenheck/ez-tree
- Package: https://www.npmjs.com/package/@dgreenheck/ez-tree/v/1.1.0
- License: MIT; reproduced in `LICENSE.txt` alongside these assets.
- Generator: `scripts/tree-assets.ts`, with deterministic seeds 713 (oak) and 146 (ash); the mountain conifers (sub-plan 27, round 3) 2711 (spruce, from Pine Medium), 5113 (larch, from Pine Medium) and 907 (dwarf pine, from Pine Medium as a low cushion).
- Changes: model height per species (oak and ash 12 m, spruce 17 m, larch 15 m, dwarf pine 2.2 m), adjusted branching/leaf density and leaf tint, PBR materials, texture downsampling to 512 px, GLB export. `conifers.glb` holds the three conifers as groups named after them, sharing one copy of the pine bark and needle textures.
- `impostors.webp` / `impostors.json`: each species seen from the side, unlit, baked from these GLBs by `scripts/build-tree-impostors.ts` (256 px a species); the summit view draws trees beyond 160 m as these cards.
- Runtime: spatially batched instances with scale, orientation and color variation. Mobile uses one card of each crossed foliage pair.

These are textured procedural models, not photogrammetry scans. GLBs embed the downloaded bark and leaf textures and need no external asset host at runtime.

To regenerate, run a Vite dev server, then `bun scripts/generate-trees.mjs [oak,ash,conifers]` (`LIVISTONE_BASE_URL` for a server other than port 5173) and `bun scripts/build-tree-impostors.ts`. Google Chrome and the development dependencies are required. `scripts/tree-preview.html` shows the models side by side.
