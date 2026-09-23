import { test, expect } from '@playwright/test';
import { towerPoint } from '../src/world/elevated-layout';
for (const mobile of [false,true]) test(`elevated galleries show new works and preserve altitude (${mobile?'touch':'desktop'})`,async({browser})=>{
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},hasTouch:mobile,isMobile:mobile});
 try {
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeEnabled({ timeout: 60000 }); await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.locator('#map-panel').getByRole('button',{name:'Go to Timeface Tower',exact:true}).click();await expect(page.locator('#location')).toHaveText('Timeface Tower');
  const p=towerPoint(.08,7.25),yaw=Math.atan2(p.x-17,p.z+39);
  await page.evaluate(({x,z,y,yaw})=>(window as any).__livistone.teleport(x,z,yaw,y),{x:p.x,z:p.z,y:p.y+.85,yaw});
  await expect(page.locator('#interact')).toContainText('Timeface');await page.locator('#interact').click();await expect(page.locator('#lore-title')).toContainText('Timeface');await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
  const altitude=await page.evaluate(()=>(window as any).__livistone.snapshot().position.y);await page.locator('#view-toggle').click();await page.locator('#view-toggle').click();expect(await page.evaluate(()=>(window as any).__livistone.snapshot().position.y)).toBeCloseTo(altitude,1);
  await page.evaluate(()=>(window as any).__livistone.teleport(-60,-112.4,0,12.85));await expect(page.locator('#location')).toHaveText('Future House');await expect(page.locator('#interact')).toContainText('Camel');await page.locator('#interact').click();await expect(page.locator('#lore-title')).toHaveText('Camel Dalí');await expect(page.locator('#exhibit-catalogue img')).toHaveAttribute('src','/images/jewelry/archive/camel-dali.webp');
  await page.screenshot({path:`output/testing/extension/camel-source-${mobile?'touch':'desktop'}.png`});expect(errors).toEqual([]);
 }finally{await context.close();}
});
