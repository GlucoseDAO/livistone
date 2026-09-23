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
  // Three metres in front of the participation sign beside the climb.
  const x=93.4+Math.sin(1)*3,z=-157.5+Math.cos(1)*3,y=1.05;
  await page.evaluate(({x,y,z})=>(window as any).__livistone.teleport(x,z,1,y),{x,y,z});
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

test('posters show a hand cursor and open enhancement.bio in a new tab',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 try{
  await context.route('https://enhancement.bio/**',route=>route.fulfill({contentType:'text/html',body:'<title>enhancement.bio</title>'}));
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const cursor=()=>page.evaluate(()=>(document.querySelector('#world') as HTMLElement).style.cursor);
  await page.goto('/');await expect(page.locator('#view-toggle')).toBeEnabled({timeout:60000});await page.locator('#view-toggle').click();
  await page.evaluate(()=>(window as any).__livistone.teleport(88.5,-156.2,0));
  await page.mouse.move(600,380);await page.mouse.move(640,400);await expect.poll(cursor).toBe('pointer');
  // Looking around hides the hand; releasing over the poster restores it without another move.
  await page.mouse.down();await page.mouse.move(700,400,{steps:3});await page.mouse.move(640,400,{steps:3});await expect.poll(cursor).toBe('');
  await page.mouse.up();await expect.poll(cursor).toBe('pointer');
  // Turning away re-evaluates the still mouse; nothing clickable remains under it.
  await page.evaluate(()=>(window as any).__livistone.teleport(88.5,-156.2,Math.PI));await expect.poll(cursor).toBe('');
  await page.evaluate(()=>(window as any).__livistone.teleport(88.5,-156.2,0));await expect.poll(cursor).toBe('pointer');
  const popup=context.waitForEvent('page');await page.mouse.click(640,400);
  const tab=await popup;await tab.waitForLoadState();expect(tab.url()).toBe('https://enhancement.bio/');
  await expect(page.locator('#lore')).toBeHidden();
  // Other towns' posters share the same cue: the City Hall catalogue photograph.
  await page.bringToFront();await page.evaluate(()=>(window as any).__livistone.teleport(2.51,-18.21,-2.409));
  await page.mouse.move(600,380);await page.mouse.move(640,400);await expect.poll(cursor).toBe('pointer');
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
