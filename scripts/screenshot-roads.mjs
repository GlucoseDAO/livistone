import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(90000);
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__livistone?.snapshot().ready);
await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByLabel('Time of day').selectOption('day');await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
await page.screenshot({path:'output/testing/roads-map.png'});
await page.locator('#view-toggle').click();
for(const [name,x,z,yaw] of [['glucose',38,-57,Math.PI],['west-join',-44,-88,0],['bridge-join',-45,-9,Math.PI/2]]){
 await page.evaluate(([x,z,yaw])=>window.__livistone.teleport(x,z,yaw),[x,z,yaw]);await page.waitForTimeout(400);await page.screenshot({path:`output/testing/roads-${name}.png`});
}
await browser.close();
