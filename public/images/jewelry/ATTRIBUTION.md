# Jewelry exhibition photographs

Livia Zaharia's studio archive, as published in her Pieces catalogue:
https://livia.glucosedao.org/pieces/

The originals are also in the adjacent Livia website repository under `assets/RJW2025/`.
These are authentic photographs, downsampled to 1024 × 1024 JPEG (quality 88, metadata stripped), without cropping, retouching, or generated replacements. Reused for this Livia/Livistone project at the project owner's request; no general third-party redistribution licence is asserted.

| Exhibit | Photographs | Original URL prefix |
| --- | --- | --- |
| Nut of Power | IMG_3493.jpg, IMG_3496.jpg | https://livia.glucosedao.org/RJW2025/ |
| Mitoring | IMG_3475.jpg, IMG_3480.jpg | https://livia.glucosedao.org/RJW2025/ |
| Nanot | IMG_3433.jpg, IMG_3434.jpg | https://livia.glucosedao.org/RJW2025/ |

Catalogue facts (type, materials, dimensions, year) were checked against the site's Pieces catalogue and its `content/pieces.md` source on 17 September 2026. Artist: Livia Zaharia. Collection: Romanian Jewelry Week 2025, “It's just a cell life”. Fantasy lore is kept separately labelled.

Reproduction command, run for each source image with ImageMagick installed:
`magick ../livia/assets/RJW2025/IMG_3433.jpg -auto-orient -resize 1024x1024 -strip -quality 88 public/images/jewelry/IMG_3433.jpg`
