# Mitoring material maps

Original procedural material maps authored for Livistone on 2 October 2026.
Colour, internal clouding and cast-metal finish are guided by Livia Zaharia's
Mitoring photographs, `IMG_3475.jpg` and `IMG_3480.jpg`, published in the
[Mitoring work on her Pieces page](https://livia.glucosedao.org/pieces/?tab=mitoring-mitochondria-ring).
The local reference derivatives are `public/images/jewelry/catalogue/mitoring-1.webp`
and `mitoring-2.webp`; their existing photograph attribution still applies.

`scripts/build-mitoring-textures.py` uses NumPy and Pillow with seed 3475 to bake
periodic colour clouds, sparse resin inclusions and surface roughness. These maps
are original generated patterns, not photographs or measured scans. Photographic
reflections and studio shadows are not copied into the colour texture. The source
photograph hash and generation method are recorded in `sources.json`.

Reduced detail loads a 512 × 256 colour/roughness pair and a 128 × 128 silver
roughness map (55,430 bytes combined). Rich detail loads 1024 × 512 amber maps
and a 256 × 256 silver map (161,170 bytes combined). Scalar maps use non-colour
texture data; the amber colour map uses sRGB. Amber uses the same colour maps in
both tiers, with refraction and clearcoat disabled in reduced detail, which uses
single-pass alpha transparency instead. Rich detail uses physical transmission.
The silver clearance correction adds 260 triangles in rich detail and 116 in
reduced detail, with no additional mesh, animation, reflection camera or
screen-space pass.
