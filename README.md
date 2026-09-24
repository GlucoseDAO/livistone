# Livistone

Explore a 3D art-and-science town built around Livia Zaharia’s jewelry, artworks and research projects. Every stop is inspired by a real, existing work. Ten destinations lead from Embryo Station through the civic halls and gardens to Materialized Enhancements hill.

**[Visit Livistone](https://livistone.liviazaharia.com/)** · [Run it locally](#run-it-locally) · [Deploy the website](docs/deployment.md) · [Technical guide](docs/technical-guide.md)

## Visiting the town

You only need a recent browser with WebGL 2 and hardware acceleration. No installation, IDE, account or login is required to visit the website.

1. The loading screen introduces Livia with her artistic homepage portrait and shows preparation progress. On short screens, scroll to see the full portrait. The town opens in **first person at the station exit, facing the Livistone entrance**.
2. Walk towards the bridge and city gate. Choose **Map** (M) to see the town from above or select a named stop to arrive at its entrance.
3. Approach a display and press **E**, or tap its discovery prompt, to read the story. Click a photograph to enlarge it. The pointer turns into a hand over anything you can click; the posters at Materialized Enhancements open [enhancement.bio](https://enhancement.bio/) in a new tab. Large dark signs in gold lattice frames introduce a place; cream boards show individual pieces.
4. Open **Journal** to browse the stories and jewelry catalogue at any time.

An introduction poster to the right of the bridge approach tells the story of Livia’s journey from architecture to parametric jewellery and citizen science. On the left, a photo poster shows the King’s Chapel Double Ring that inspired the bridge arch. Click the posters or press E nearby to read their stories. The larger **Map** button (M) opens the aerial view without moving you. A nearby-piece panel introduces what you pass in one sentence; choose **Read story**, click the **E** control, or press **E** to read more. Use the small line icon to minimize the panel to its labels, then the square icon to restore it. The desktop controls strip has the same icons, and the top-bar speaker icon toggles the radio.

| Action | Computer | Phone or tablet |
| --- | --- | --- |
| Walk | W/A/S/D or arrow keys; Shift moves faster | Left thumbstick |
| Look around | Hold the left mouse button and drag; ←/→ also turn | Drag the scene |
| Read a nearby display | E or click its prompt | Tap its prompt |
| Fold or expand the nearby description | Line / square icon on the place card | Line / square icon on the place card |
| Fold or expand control hints | Line / square icon on the hint strip | Touch controls stay visible |
| Toggle sound | Speaker button or menu | Speaker button or menu |
| Switch map / walking | M or the top-bar view button | The top-bar view button |
| Move / zoom the map | Drag / scroll | Drag / pinch |
| Menu | Escape or ☰ | ☰ |

### Make yourself comfortable

- **Day or night:** choose Auto, Day or Night in the menu. Day and Night work independently of the current time.
- **Music:** on by default. If your browser blocks autoplay, it starts after your first click, tap or keypress. Use the speaker button or **Livistone Radio** in the menu whenever you prefer silence.
- **About the music:** these are informal phone recordings of Livia Zaharia playing kalimba, not professional studio recordings. The six included clips were reviewed and approved by Livia.
- **Performance:** select **Gentle** visual detail if movement is slow. Initial loading can take longer on a phone or a slower connection.
- **Progress:** visits and stories read are saved in this browser. They do not sync between devices; clearing site data resets them.
- **Lost?** Choose a destination on the map, or use the menu’s return-to-entrance action.

## Run it locally

This section is for running your own copy. Visitors to the published website can skip it. An IDE is optional; a terminal is enough.

Install **Git**, **Git LFS**, **Node.js 22.12 or newer**, and **Bun** (the project pins Bun 1.4.2). Installation guides: [Git LFS](https://git-lfs.com/), [Node.js](https://nodejs.org/en/download), [Bun](https://bun.com/docs/installation).

In PowerShell on Windows, Terminal on macOS, or a Linux shell:

```sh
git clone https://github.com/GlucoseDAO/livistone.git
cd livistone
git lfs install --local --skip-repo
git lfs pull
bun install --frozen-lockfile
bun run dev
```

Repository access is required if GitHub asks you to sign in. If you already have a checkout, use that folder instead of cloning again. The repository supplies its LFS push hook, so `--skip-repo` preserves it. Git LFS downloads the music files; ordinary Git pointer files cannot play audio.

Open **http://localhost:5173/** on the computer. The development server listens on `0.0.0.0` by default, so a phone on the same Wi-Fi can open **`http://<computer-LAN-IP>:5173/`**. On Linux, `hostname -I` shows candidate IP addresses; use the address for your Wi-Fi interface. On Windows use `ipconfig`, or on macOS use `ipconfig getifaddr en0`. Keep the terminal open; **Ctrl+C** stops the server. If the phone cannot connect, check that both devices are on the same network and that the computer's firewall allows TCP port 5173. If port 5173 is already in use, use the existing server or stop it before starting another.

## Build, check and publish

```sh
bun run build
bun run preview
```

The build checks TypeScript, verifies the approved audio assets, and creates **`dist/`**. Preview it locally at **http://localhost:4173/**. Publish the contents of `dist/` with a static website host or production web server.

**[Production deployment instructions](docs/deployment.md)** cover build settings, Git LFS, the custom domain, HTTPS, updates and troubleshooting. Vite development and preview servers are for development and local checks.

### “This host is not allowed”

`vite.config.ts` explicitly allows `livistone.liviazaharia.com` for development and preview. If your existing deployment shows that error, pull the latest commit and **restart or redeploy the running service**. Merely refreshing the browser does not update its server configuration. The production guide explains how to replace the Vite process with static hosting.

## For contributors

```sh
bun run test --maxWorkers=1 --testTimeout=20000
bun run test:browser
bun run check:hosts
```

Browser tests require Chrome and use the dev server on port 5173. `check:hosts` requires a completed build and checks real development/preview HTTP responses for the configured hostname and an unapproved hostname.

- [Technical guide: architecture, assets, controls and project history](docs/technical-guide.md)
- [Design and implementation plan](docs/3d-game-plan.md)
- [Contributor instructions](AGENTS.md)
- [Artwork and research references](docs/extension-references.md)
- [Enhancement hill and human-mesh provenance](docs/enhancement-reference.md)
- [Kalimba credits and source records](public/audio/kalimba/README.md)

Livistone is a playable prototype. Performance varies by device, and physical-phone and Safari verification remain ongoing work. Artwork and recording credits, third-party asset licences and concept references are preserved in the [technical guide](docs/technical-guide.md#credits-and-licensing).

Ground cover combines local grass-and-soil photographs with worn path edges, earth near riverbanks and broad spring-green meadow variation. It uses the existing terrain mesh: reduced detail loads two 512 px WebP textures (about 130 KiB combined), while rich detail uses 1024 px textures. Physical-phone performance still needs measurement. Texture sources and regeneration are recorded in `public/textures/ground/ATTRIBUTION.md`.

Open grass areas have broad rolling contours, reaching roughly 1–2.5 metres where space allows, with a subdued spring-green palette. `meadow-relief.ts` bakes a clearance distance field once and tapers the contours around paths, buildings and other authored clearances, including a 2.5-metre interpolation margin. The existing terrain mesh and Rapier surface share these heights; plants follow the same field. Contours add no triangles or draw calls.

Players arrive outside the town-facing train door at Embryo Station, with a Livistone Station sign ahead. Space (or the touch Jump button) jumps; players can clear gallery rails and fall back to the ground without damage. The main navigation includes a labeled Mute sound / Enable sound button.
