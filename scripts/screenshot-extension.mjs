import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out='output/testing/extension';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:process.platform==='win32'?['--use-angle=d3d11','--ignore-gpu-blocklist']:['--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(90000);page.on('pageerror',e=>console.log('ERROR',e.message));
await page.goto('http://127.0.0.1:5173');console.log('loaded');await page.waitForFunction(()=>window.__livistone?.snapshot().ready);console.log('ready');await page.locator('#view-toggle').click();console.log('walking');
const views=[['tower',32,-22,.69,.46,1.05],['tower-summit',10.5,-39,Math.PI,.1,26.55],['future',-38,-84,.79,.3,1.05],['future-interior',-61,-107,0,0,12.86],['lake-plants',-10,-86,0,.15,1.05],['moon',-10,-90,-.34,.44,1.05],['science-ad',3,79,-Math.PI/2,0,1.05],['art-ad',-31,79,Math.PI/2,0,1.05]];
for(const mode of ['day','night']) {
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByLabel('Time of day').selectOption(mode);await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
 for(const [name,x,z,yaw,pitch,y] of views){
  if(process.argv[2]&&!process.argv[2].split(',').includes(name))continue;
  await page.evaluate(([x,z,yaw,y])=>window.__livistone.teleport(x,z,yaw,y),[x,z,yaw,y]);
  if(pitch){await page.mouse.move(720,450);await page.mouse.down();await page.mouse.move(720,450-pitch/.0028,{steps:3});await page.mouse.up();}
  await page.waitForTimeout(500);await page.screenshot({path:`${out}/${mode}-${name}.png`});console.log(mode,name);
 }
}
console.log(await page.evaluate(()=>window.__livistone.snapshot()));await browser.close();
