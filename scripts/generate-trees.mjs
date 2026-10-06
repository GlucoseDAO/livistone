import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// `bun scripts/generate-trees.mjs [file,…]` rebuilds every tree GLB, or only the named files (oak, ash, conifers), from a running dev server
// (LIVISTONE_BASE_URL, default the owner's http://localhost:5173).
const base = (process.env.LIVISTONE_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, ''), only = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', console.error);
  await page.goto(`${base}/scripts/tree-assets.html${only ? `?only=${only}` : ''}`);
  await page.waitForFunction(() => window.treeAssets, null, { timeout: 120000 });
  const assets = await page.evaluate(() => window.treeAssets);
  await mkdir('public/models/trees', { recursive: true });
  for (const asset of assets) {
    const bytes = Buffer.from(asset.base64, 'base64');
    await writeFile(`public/models/trees/${asset.name}.glb`, bytes);
    console.log(`${asset.name}: ${asset.triangles} triangles, ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} finally { await browser.close(); }
