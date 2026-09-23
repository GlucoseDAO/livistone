import { test,expect } from '@playwright/test';

for(const mobile of [false,true])test(`hill participation and optional radio (${mobile?'touch':'desktop'})`,async({browser})=>{
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
 try{
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const Original=window.Audio;window.Audio=class extends Original{constructor(){super();(window as any).__radio=this;}};});
  await page.goto('/');await expect(page.locator('#view-toggle')).toBeEnabled({timeout:60000});
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#map-origins')).toContainText('real, existing');await expect(page.locator('.landmark-item').first()).toHaveAttribute('data-action','landmark:station');await expect(page.locator('.landmark-number').last()).toHaveText('10');
  await page.locator('#map-panel').getByRole('button',{name:'Go to Materialized Enhancements',exact:true}).click();
  const x=98.8,z=-154.6,y=1.05;
  await page.evaluate(({x,y,z})=>(window as any).__livistone.teleport(x,z,0,y),{x,y,z});
  await expect(page.locator('#interact')).toContainText('Materialized');await page.locator('#interact').click();
  await expect(page.locator('#lore-title')).toHaveText('Materialized Enhancements');await expect(page.getByRole('link',{name:/Join here/})).toHaveAttribute('href','https://enhancement.bio/');
  await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  const sound=page.locator('#sound-toggle');await expect(sound).toContainText('Radio: on');
  await expect.poll(()=>page.evaluate(()=>(window as any).__radio?.paused)).toBe(false);
  await expect(page.locator('.menu-note')).toContainText('recorded on her phone');
  await sound.click();await expect(sound).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>(window as any).__radio.paused)).toBe(true);
  await sound.click();await expect(sound).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{const audio=(window as any).__radio as HTMLAudioElement;audio.currentTime=audio.duration-.2;});
  await expect.poll(()=>page.evaluate(()=>(window as any).__radio?.currentSrc),{timeout:15000}).toContain('kalimba-02.m4a');
  await page.getByLabel('Time of day').selectOption('night');await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
  await page.screenshot({path:`output/testing/extension/enhancement-${mobile?'touch':'desktop'}.png`});expect(errors).toEqual([]);
 }finally{await context.close();}
});
