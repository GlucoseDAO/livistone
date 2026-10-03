# Link preview and loading-screen views

These are real renders of the Livistone town, not concept art. `scripts/build-share-images.ts` captures them from a dev
server with `?capture=1` (frozen time, render scale and physics), the full gpu tier, day lighting and the HUD hidden, then
downsamples each 2× render in Chrome. `captures.json` records the commit, backend and browser of the current set.

| File | Use | View |
| --- | --- | --- |
| `livistone-gateway.jpg` | `og:image` / `twitter:image`, 1200×630 | The LIVISTONE city gate from the station path, City Hall framed in the ring, the Ministry of Energy and Ministry of Science either side |
| `loading-narrow.webp` | Loading-screen banner on narrow screens | Same composition as the card |
| `loading-wide.webp` | Loading-screen backdrop on wide screens | The gate turned to the right of the frame, leaving meadow behind the introduction text |

The architecture interprets Livia Zaharia's jewellery; see the project README and `concepts/` for its sources. Rerun the
script after changing anything visible from the arrival path. Link previews are cached by each platform, so a changed card
may need a re-scrape (Facebook Sharing Debugger, LinkedIn Post Inspector, Telegram's @WebpageBot).
