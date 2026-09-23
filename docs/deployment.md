# Production deployment

Livistone is a static browser application. A production server serves the files generated in `dist/`; there is no backend, database, API key or application server to configure.

## Fix the current blocked-host error

The repository uses **`vite.config.ts`**, not `vite.config.js`. It now explicitly permits `livistone.liviazaharia.com` in both `server.allowedHosts` and `preview.allowedHosts`.

For an existing checkout:

```sh
git pull --ff-only origin main
git lfs pull
bun install --frozen-lockfile
bun run build
```

Then restart/redeploy the service through your hosting dashboard or service manager. If the error persists, confirm that the running service uses the latest commit and this repository's working directory. A cached container or a second old Vite process will still use its old configuration.

This resolves the named-host rejection. For the production setup below, serve `dist/` directly. Vite's `allowedHosts` setting only applies to Vite servers; it does not configure DNS, HTTPS, or your production static host. Keep an explicit hostname list instead of allowing every hostname. See [Vite host configuration](https://vite.dev/config/server-options.html#server-allowedhosts) and [preview configuration](https://vite.dev/config/preview-options.html#preview-allowedhosts).

## Option A: a managed static-site host

Choose a **static site** deployment in your provider's dashboard. Use these settings:

| Setting | Value |
| --- | --- |
| Repository / branch | `GlucoseDAO/livistone` / `main` |
| Project root | The directory containing `package.json`, `bun.lock` and `vite.config.ts` |
| Build tools | Node.js 22.12+, Bun 1.4.2, Git LFS |
| Checkout | Include Git LFS files; private repository access must also authorize LFS downloads |
| Install command | `bun install --frozen-lockfile` |
| Build command | `git lfs pull && bun run build` |
| Output / publish directory | `dist` |
| Production start command | None for a static-site service |
| Custom domain | `livistone.liviazaharia.com` |

If your provider combines install and build in one field, use `git lfs pull && bun install --frozen-lockfile && bun run build`. Install/enable Git LFS and Bun in the build image first. If checkout already fetches LFS automatically, the repeated `git lfs pull` is harmless.

If the provider cannot fetch Git LFS, build in a trusted local or CI checkout using the commands below, then upload the resulting `dist/` artifact. Do not deploy a GitHub source ZIP as if it were a built website.

Follow the provider's custom-domain instructions to set the DNS record it specifies, then enable HTTPS. The host must serve assets with their actual MIME types and support normal media requests. Publish at the domain root (`/`); subdirectory hosting requires auditing the app's root-relative asset URLs before changing Vite's `base`.

Vite's deployment guide describes the build/output workflow and explains that `vite preview` is not a production server: [Deploying a static site](https://vite.dev/guide/static-deploy.html).

## Build a deployable artifact yourself

Run in a checkout of the desired commit, with Git LFS and the build tools installed:

```sh
git lfs install --local --skip-repo
git lfs pull
bun install --frozen-lockfile
bun run build
```

`bun run build` fails early if an approved music asset is missing, is still a Git LFS pointer, or differs from its recorded hash. It then type-checks and bundles the site. The output includes the six approved recordings under `dist/audio/kalimba/`; rejected clip 7 is not included.

Copy **everything inside `dist/`**, preserving its subdirectories. Serve that directory as the website root. Do not expose the source checkout, `.git`, `node_modules` or the local audio-review/model folders.

`bun run preview` lets you inspect the artifact locally on port 4173 before uploading it. Stop it with Ctrl+C when finished.

## Option B: your own server with Caddy

This example assumes a Linux server with Caddy installed as a service. Copy the built contents of `dist/` into `/srv/livistone` so that `/srv/livistone/index.html` exists. Give the Caddy service read access to those files.

Add this site block to the server's Caddyfile, preserving any other sites already configured:

```caddyfile
livistone.liviazaharia.com {
    root * /srv/livistone
    encode zstd gzip
    @html path / /index.html
    header @html Cache-Control "no-cache"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    file_server
}
```

Point the domain's DNS A record (and AAAA record if used) to this server. Ports 80 and 443 must reach Caddy, and its certificate storage must be writable and persistent. Caddy can then provision and renew HTTPS certificates. Validate and reload the configuration:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

No proxy to port 5173 or 4173 is needed for this setup. The app changes views within the page and currently has no path-based client routes, so unknown files should remain 404 responses.

References: [Caddy static files](https://caddyserver.com/docs/quick-starts/static-files), [automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https).

## Verify a release

1. Open `https://livistone.liviazaharia.com/` in a fresh browser tab. Confirm the map finishes loading without a blocked-host error.
2. Enter the town, select a destination, and open a poster photograph.
3. Click or tap once if autoplay was blocked. Confirm kalimba playback, mute and unmute. The music credit appears in the menu.
4. Confirm `https://livistone.liviazaharia.com/audio/kalimba/kalimba-01.m4a` serves playable audio, not a tiny text file beginning with `version https://git-lfs.github.com/spec/v1`.
5. Check a phone/touch layout and inspect the browser Network panel for failed asset requests.

Locally, after a build, `bun run check:hosts` verifies that both Vite modes accept the intended domain and still reject an unrelated hostname. It also checks that preview serves real audio bytes.

## Updates and rollback

Build each release from a known commit after fetching its LFS objects. Publish the new `dist/` as a complete release through the host's deployment mechanism; keep the previous release available for rollback. Use the hosting provider's atomic deployment or a versioned directory switch on your own server to avoid serving a partially copied bundle.

Only filenames under `assets/` are content-hashed for long-term immutable caching. Keep HTML revalidated; unversioned images and audio should also be revalidated when replaced. Record the deployed commit so a failed release can be rolled back to its previous build.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Blocked host still appears | Restart/redeploy the latest Vite configuration, or point production at the built static files. |
| Build says audio is a pointer or missing | Install Git LFS, authenticate the checkout and run `git lfs pull`. |
| Music is silent initially | Browser autoplay may require a click/tap. Also check the menu switch, browser mute and audio network response. |
| Old page after a release | Check the deployed commit and CDN/HTML cache; a browser refresh cannot update an old server process. |
| White page / missing assets | Publish the entire `dist/` at the domain root and check MIME types and 404s. |
| Slow movement | Enable browser hardware acceleration and choose Gentle detail in the menu. |
