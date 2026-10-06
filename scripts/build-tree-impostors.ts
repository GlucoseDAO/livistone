// `bun scripts/build-tree-impostors.ts` rebakes public/models/trees/impostors.webp and impostors.json from the tree GLBs, through
// scripts/tree-impostors.ts on a running dev server (LIVISTONE_BASE_URL, default the owner's http://localhost:5173). Rerun after
// regenerating any tree.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const base = (process.env.LIVISTONE_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=gl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); page.on('pageerror', error => console.error(error));
  await page.goto(`${base}/scripts/tree-impostors.html`);
  await page.waitForFunction(() => (window as unknown as { impostors?: unknown }).impostors, null, { timeout: 120000 });
  const { webp, cells } = await page.evaluate(() => (window as unknown as { impostors: { webp: string; cells: { name: string; size: number }[] } }).impostors);
  const bytes = Buffer.from(webp.split(',')[1], 'base64');
  await writeFile('public/models/trees/impostors.webp', bytes);
  await writeFile('public/models/trees/impostors.json', JSON.stringify({ cell: 256, cells }, null, 1) + '\n');
  console.log(`impostors.webp: ${cells.map(c => `${c.name} ${c.size} m`).join(', ')}; ${(bytes.length / 1024).toFixed(0)} KB`);
} finally { await browser.close(); }
