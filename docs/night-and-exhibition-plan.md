# Night lighting and exhibition update

Requested 23 September 2026.

1. Add persistent Auto / Day / Night options. Update the sky, reflections, fog and lighting without rebuilding the town or resetting position.
2. Give existing lamps actual light sources; illuminate civic buildings and stones with soft halos; add a neon-like gateway. Keep Vittoria Lake dark outside the central pavilion. Use a bounded pool of nearby lights for mobile performance.
3. Fit readable science/art advertisements to train walls, opening the respective artist website pages. Add correctly oriented reverse faces to station information and collection panels.
4. Replace generated glucose figures with images and text from the supplied Google Drive folder. Preserve six discovery IDs and record file provenance. Make the separate glucose molecule luminous.
5. Rebuild the pavilion as a faceted briolette with an open Dewdrop silver embrace. Use the two catalogue photographs of Mycelium to model broad curled silver folds around opals, with gentle halos.
6. Validate build, unit and browser tests; inspect day/night screenshots and check both pavilion entries and train interactions.

Source folder: https://drive.google.com/drive/folders/1yRQlA4vkeTHwVFzbLx2WphQGPMnaMutV

## Implementation

All six stages are implemented. Auto / Day / Night is saved on the device and switches the existing world in place. Nearby point lights are pooled (six on reduced graphics, ten on rich graphics), with depth-tested diffuse halos and no additional shadow maps.

Train end advertisements use actual research and jewelry photographs and open the science/art sites. Platform panels have separately oriented reverse faces. Glucose chapters use the supplied archive's poster crops and text, with originals linked and provenance recorded in `public/images/research/ATTRIBUTION.md`.

The lake pavilion is a faceted briolette with two open silver arms; both entrances remain traversable. Mycelium crowns follow the flattened silver folds in the two catalogue photographs, with softly glowing opals.

## Verification

- Production build and all 51 unit tests pass.
- Inspected 36 landmark screenshots plus focused day/night views, train advertisements, source images, and reverse station panels.
- All 30 desktop and emulated touch browser scenarios passed across the full run and six targeted reruns, covering movement, entrances, train boarding, direct website links, source images, and saved day/night overrides. This records the completed night update before the later tower/Future House extension.
- Physical-device frame rates have not been measured. The existing production bundle-size warning remains.
