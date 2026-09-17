# Interactive photo cylinders

Follow-up direction from the project owner: replace the three central abstract sculptures
and information lecterns with rotating cylinders carrying curved photographs. Beside
each, a light cylinder offers floating words for information and exploration. Selecting
another jewelry piece updates that hall’s cylinder. Clicking a curved image unfolds a
flat, enlargable view; retain source proportions and provide visible controls. Improve
the river’s appearance as part of this pass.

Implemented with three arc panels per cylinder (cycling the available photographs),
independent selection from six source-linked catalogue entries, keyboard/touch controls,
a flat photo viewer with pan, pinch/scroll/button zoom, next/previous and fit, and a
reduced-motion default. Authentic local photographs are reused from Livia’s archive;
source dimensions govern panel aspect ratio. The old rear panels and lecterns are removed,
while the building architecture, lore plaques, and access paths remain.

Water now uses the sky environment, irregular flowing ripple normals, shallow-edge
colour, variable bank width and gravel shores. No fluid simulation is implied.

Follow-up correction: the owner identified the remaining dark-topped lore pedestal in
a screenshot and requested its removal everywhere. The shared pedestal geometry and
its interaction targets are deleted from all three halls. Their stories move to
“About this place” on the existing light-column controls, leaving the floor clear.

The next revision replaces the camera-facing floating card with information textured
directly onto the smaller cylinder, repeated on its front and back. Its canvas aspect
ratio matches unwrapped arc width / height; wrapped text is sized uniformly. Clickable
labels use the same canvas rectangles for rendering and UV raycasting. Both cylinders
are 35% wider, retaining their heights and photograph aspect ratios. The information
column moves slightly outward to preserve the passage. Keyboard-only native controls
remain available on focus; no card is shown during ordinary scene viewing.

The wider photo cylinder uses four curved photo panels. The two faces of the information
cylinder repeat the same text and controls. Mouse and touch activate labels after the
completed click, preventing a touch release from immediately closing the new dialog.

The subsequent rotation request adds slow rotation to the information cylinder as well.
Both cylinders share pause/resume, stop during dialogs, and respect reduced motion.
