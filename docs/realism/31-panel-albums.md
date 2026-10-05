# Panel albums — 5 October 2026

Owner request: every rotunda poster opens an enlarged concept slideshow. Building panels open readable content; visitors can browse that building's panels, enlarge an image, browse its image album, then return to the matching content without walking between panels.

## Implementation

- The rotunda uses its existing ordered panel URLs and names: all fifteen images, wrapped Previous/Next controls, keyboard arrows, existing fit/zoom/pan, and Back to the garden. It no longer opens the image in a separate tab.
- `ui/album.ts` groups panel stories by building, respecting the catalogue's current location for relocated works. A gate's source photograph stays with the gate rather than redirecting to the building containing the original jewellery.
- Building panel photos open content first. Sticky Previous/Next panel buttons and keyboard arrows browse the same building. Enlarged images span different works in that building; returning selects the displayed image's panel. Glucose images retain their chapter identity even when the same source image appears in several chapters, and return to the matching slide.
- Research chapters retain their separate slide buttons. External source links remain available from content. Existing collection grids and photo zoom/pan remain usable. Walking is paused and its position preserved while either dialog is open.
- Albums assign one image URL at a time; there is no eager full-album preload or new graphics effect.

## Checks

Production build/type-check and album grouping unit checks pass. The browser scenario clicks a real rotunda panel, wraps through all fifteen images, moves between building pieces, returns to matching content, checks controls at 390 px width, and opens/returns from Glucose images without mixing duplicate sources across chapters. Both WebGPU and WebGL fallback passed the full scenario. All 280 unit assertions across 57 files passed, with a 60-second default allowance for the existing geometry suites. The final production build/type-check passed.

Review screenshots: `output/testing/albums/rotunda-desktop.png`, `rotunda-phone-layout.png`, and `building-content.png`. The review server remains on port 5181. No geometry, lighting, material, texture or physics changes are part of this follow-up.

The scene atlases from revision `dc187b993881c8cb` were retained byte-for-byte for UI-only revision `557c6f9d66eba21f`: all 104 files were SHA-256 verified during the manifest update. Geometry, render code, materials and source maps were unchanged, so no new reflection rendering was needed.
