# README screenshots

These are real renders of the Livistone town, not concept art. `bun scripts/build-share-images.ts --readme` captures them from a
dev server with `?capture=1` (frozen time, render scale and physics), the full gpu tier and day lighting, then downsamples each
2× render in Chrome. `captures.json` records the commit, backend and browser of the current set. They live outside `public/`
so the website build does not ship them.

| File | View |
| --- | --- |
| `livistone-gateway.jpg` | The LIVISTONE city gate from the station path, with City Hall framed in the ring and the ministries on either side |
| `livistone-centre.jpg` | The civic centre from the south-east: Ministry of Energy, City Hall, Ministry of Science and Timeface Tower |
| `livistone-map.jpg` | The aerial map (M) with its numbered route and destination list; the only view that keeps the interface |

Retake them after visible changes to these views, then look at the files before committing. The link-preview card and loading
backdrops are a separate set in `public/images/share/`.
