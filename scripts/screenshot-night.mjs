import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Usage: node scripts/screenshot-night.mjs [lake,mycelium,...]
const out = 'output/testing/night-review'; mkdirSync(out, { recursive: true });
const gpu = process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-gl=angle', '--use-angle=gl'];
const browser = await chromium.launch({ channel: 'chrome', args: [...gpu, '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000); page.on('pageerror', e => console.log('ERROR', e.message));
await page.goto('http://127.0.0.1:5173'); await page.waitForFunction(() => window.__livistone?.snapshot().ready);
await page.locator('#start-exploring').click();
const views = [['gateway',0,52,0,.24],['energy',-29,12,0,.16],['city-hall',0,-5,0,.3],['station',0,49,Math.PI,.24],['station-reverse',11,68.3,0,0],['lake',-10,-92,0,.3],['mycelium',74,-138,Math.PI,.18],['science-ad',3,79, -Math.PI/2,0],['art-ad',-31,79, Math.PI/2,0],['glucose',38,-23,0,.2]];
for (const mode of ['night','day']) {
  await page.getByRole('button',{name:'Open menu',exact:true}).click(); await page.getByLabel('Time of day').selectOption(mode); await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
  for (const [name,x,z,yaw,pitch] of views) {
    if (process.argv[2] && !process.argv[2].split(',').includes(name)) continue;
    if(mode==='day' && !['lake','mycelium','science-ad'].includes(name)) continue;
    await page.evaluate(([x,z,yaw]) => window.__livistone.teleport(x,z,yaw),[x,z,yaw]);
    if(pitch) { await page.mouse.move(640,400); await page.mouse.down(); await page.mouse.move(640,400-pitch/.0028,{steps:4}); await page.mouse.up(); }
    await page.waitForTimeout(500); await page.screenshot({path:out+'/'+mode+'-'+name+'.png'}); console.log(mode,name);
  }
}
console.log(await page.evaluate(()=>window.__livistone.snapshot())); await browser.close();
