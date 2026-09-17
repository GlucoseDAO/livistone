# Railway texture sources

The bundled JPG files are unchanged 1K maps from Poly Haven, licensed under [CC0](https://polyhaven.com/license). Downloaded 18 September 2026. Exact source URLs, byte sizes, and verified MD5 checksums are recorded in `sources.json`.

| Local prefix | Source | Creator(s) | Usage |
| --- | --- | --- | --- |
| `ballast-` | [Gravel Stones](https://polyhaven.com/a/gravel_stones) | Amal Kumar | Crushed stone track bed and maintenance ledges |
| `sleeper-` | [Wooden Planks](https://polyhaven.com/a/wooden_planks) | Charlotte Baglioni (photography), Dario Barresi (processing) | Timber sleepers |
| `rail-` | [Rusty Metal](https://polyhaven.com/a/rusty_metal) | Rob Tuytel | Rail webs, feet, fastening plates, and tunnel ribs |

Each set includes base color, OpenGL normal, and roughness maps. Color maps use sRGB; normal and roughness maps are linear data. Desktop uses all three; mobile omits normal maps. Rails have a separate polished steel running surface. Maps repeat in world-scaled UVs; sleeper UVs select a narrow timber strip. Geometry and material tinting are applied at runtime.

The dark shell and tunnel lining reuse the existing [Rock Face 03 maps](../mountains/ATTRIBUTION.md). The bronze ornament reuses their normal relief. The user-provided dark Nut of Power photograph is preserved only as a design reference in `concepts/08-mountain-railway/references/`; it is not a track texture or a runtime asset.
