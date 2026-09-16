import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  page.on('pageerror', console.error);
  await page.goto('http://localhost:5173/scripts/tree-assets.html');
  await page.waitForFunction(() => window.treeAssets, null, { timeout: 60000 });
  const assets = await page.evaluate(() => window.treeAssets);
  await mkdir('public/models/trees', { recursive: true });
  for (const asset of assets) {
    const bytes = Buffer.from(asset.base64, 'base64');
    await writeFile(`public/models/trees/${asset.name}.glb`, bytes);
    console.log(`${asset.name}: ${asset.triangles} triangles, ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} finally { await browser.close(); }
