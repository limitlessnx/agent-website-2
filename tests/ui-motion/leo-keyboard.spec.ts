import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';

async function visualViewport(page:Page) {
  await page.addInitScript(() => {
    // Mobile WebKit starts at 980px before parsing the viewport meta tag.
    // Follow real layout dimensions until the test explicitly simulates a change.
    const geometry:Record<string,number> = {};
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      width:{get:()=>geometry.width ?? innerWidth},
      height:{get:()=>geometry.height ?? innerHeight},
      offsetLeft:{get:()=>geometry.offsetLeft ?? 0},
      offsetTop:{get:()=>geometry.offsetTop ?? 0},
      scale:{get:()=>geometry.scale ?? 1},
    });
    Object.defineProperty(window, 'visualViewport', { configurable:true, get:()=>viewport });
    Object.assign(window, { __setLeoViewport: (values:Record<string,number>) => {
      Object.assign(geometry, values);viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));
    }});
  });
}
async function setViewport(page:Page, values:Record<string,number>) {
  await page.evaluate(values => {
    (window as unknown as {__setLeoViewport:(v:Record<string,number>)=>void}).__setLeoViewport(values);
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }, values);
}
async function contained(page:Page, selector:string, bounds:{left:number;top:number;width:number;height:number}) {
  await expect(async () => {
    const r=await page.locator(selector).boundingBox();expect(r).not.toBeNull();
    expect(r!.x).toBeGreaterThanOrEqual(bounds.left-1);expect(r!.y).toBeGreaterThanOrEqual(bounds.top-1);
    expect(r!.x+r!.width).toBeLessThanOrEqual(bounds.left+bounds.width+1);expect(r!.y+r!.height).toBeLessThanOrEqual(bounds.top+bounds.height+1);
  }).toPass({timeout:3000});
}
async function capture(page:Page, name:string) {
  mkdirSync('test-results/leo-keyboard',{recursive:true});
  const engine=page.context().browser()!.browserType().name();
  await page.screenshot({path:`test-results/leo-keyboard/${process.env.LEO_BASELINE?'before':'after'}-${name}-${page.viewportSize()!.width}-${engine}.png`,animations:'disabled',style:'nextjs-portal{display:none!important}'});
}
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4400')return route.abort();
    if(url.pathname==='/api/leo/public')return route.fulfill({json:{ok:true,sessionId:'synthetic-session',reply:'Synthetic reply: '+('long-reference-without-spaces'.repeat(24))}});
    if(url.pathname==='/api/leo')return route.fulfill({json:{reply:'Synthetic private reply',toolCalls:[]}});
    if(url.pathname==='/api/leo/monitor')return route.fulfill({json:{alerts:[]}});
    if(url.pathname==='/api/leo/orchestration')return route.fulfill({status:404,json:{}});
    if(!['GET','HEAD'].includes(route.request().method()))return route.abort();return route.continue();
  });
});
test('public chat keeps header, messages and composer in the keyboard visual viewport',async({page})=>{
  await visualViewport(page);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#talk-to-leo',{waitUntil:'networkidle'});
  const input=page.getByRole('textbox',{name:'Message Leo',exact:true});await expect(input).toBeVisible();await input.fill('Synthetic visitor');
  const scrollBefore=await page.evaluate(()=>scrollY),width=page.viewportSize()!.width;
  await setViewport(page,{height:330,offsetTop:70});
  for(const icon of await page.locator('.public-leo-close svg,.public-leo-input button svg').all())expect((await icon.boundingBox())!.width).toBeGreaterThanOrEqual(16);
  await expect(page.locator('.public-leo-header')).toHaveAttribute('data-mode','CHAT');await capture(page,'keyboard');
  await contained(page,'.public-leo-header',{left:0,top:70,width,height:330});await contained(page,'.public-leo-input',{left:0,top:70,width,height:330});
  expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(input).toHaveValue('Synthetic visitor');await input.press('Enter');await expect(page.getByText(/Synthetic reply:/)).toBeVisible();
  for(const message of await page.locator('.public-leo-message p').all())expect(await message.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>scrollY)).toBe(scrollBefore);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await contained(page,'.public-leo-input',{left:0,top:70,width,height:330});
  await page.getByRole('button',{name:'Close Leo',exact:true}).first().click();await setViewport(page,{height:1000,offsetTop:0});
  await expect(page.getByRole('button',{name:'Open Leo',exact:true})).toBeFocused();await page.getByRole('button',{name:'Open Leo',exact:true}).click();await expect(input).toHaveValue('');
});
test('public chat respects panned zoom and narrow landscape without disabling browser scaling',async({page})=>{
  await visualViewport(page);await page.goto('/#talk-to-leo',{waitUntil:'networkidle'});const input=page.getByRole('textbox',{name:'Message Leo',exact:true});await expect(input).toBeVisible();
  const width=page.viewportSize()!.width,left=Math.floor(width/4),visible=Math.floor(width/2);
  await setViewport(page,{width:visible,height:470,offsetLeft:left,offsetTop:35,scale:2});await capture(page,'zoom');
  await contained(page,'.public-leo-panel',{left,top:35,width:visible,height:470});await contained(page,'.public-leo-input',{left,top:35,width:visible,height:470});
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(/user-scalable=no|maximum-scale=1(?:,|$)/);
  await setViewport(page,{width,height:300,offsetLeft:0,offsetTop:0,scale:1});await input.focus();
  await contained(page,'.public-leo-input',{left:0,top:0,width,height:300});
});

test('public chat handles viewport-resizing keyboards without VisualViewport and keeps the draft',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'visualViewport',{configurable:true,value:undefined}));
  await page.goto('/#talk-to-leo',{waitUntil:'networkidle'});const input=page.getByRole('textbox',{name:'Message Leo',exact:true});await expect(input).toBeVisible();await input.fill('Unsent synthetic draft');
  const width=page.viewportSize()!.width;await page.setViewportSize({width,height:360});await expect(page.locator('#talk-to-leo')).toHaveAttribute('data-chat-compact','true');
  await contained(page,'.public-leo-input',{left:0,top:0,width,height:360});await expect(input).toHaveValue('Unsent synthetic draft');
  await page.getByRole('button',{name:'Close Leo',exact:true}).first().click();await page.setViewportSize({width,height:1000});await page.getByRole('button',{name:'Open Leo',exact:true}).click();await expect(input).toHaveValue('Unsent synthetic draft');
});
for(const tenant of [false,true])test(`${tenant?'tenant':'admin'} chat keeps the composer above an offset keyboard`,async({page,context})=>{
  await visualViewport(page);
  const data=tenant?{userId:'30000000-0000-4000-8000-000000000001',email:'owner@example.test',organizationId:'10000000-0000-4000-8000-000000000001',organizationSlug:'qa-general',membershipId:'qa-membership',role:'owner',issuedAt:Date.now()}:{email:'admin@example.test',name:'Demo Admin',issuedAt:Date.now()};
  const token=Buffer.from(JSON.stringify(data)).toString('base64url');await context.addCookies([{name:tenant?'fluxknight_client_session':'limitless_admin_session',value:token+'.'+createHmac('sha256','synthetic-local-test-secret').update(token).digest('base64url'),url:'http://127.0.0.1:4400'}]);
  await page.goto(tenant?'/portal':'/dashboard/platform',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:tenant?'Super Leo':'Open Agent Leo',exact:true}).click();
  const selector=tenant?'#tenant-leo-chat':'#leo-assistant-panel';const input=page.locator(selector+' textarea');await expect(input).toBeVisible();await input.fill('Synthetic question');
  await setViewport(page,{height:360,offsetTop:40});await expect(page.locator(selector)).toHaveAttribute('data-chat-compact','true');
  const bounds={left:0,top:40,width:page.viewportSize()!.width,height:360};await contained(page,selector+' header',bounds);await contained(page,selector+' form',bounds);expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const send=page.locator(selector).getByRole('button',{name:'Send message',exact:true});const buttonBox=(await send.boundingBox())!,iconBox=(await send.locator('svg').boundingBox())!;expect(iconBox.width).toBeGreaterThanOrEqual(12);expect(Math.abs(iconBox.y+iconBox.height/2-buttonBox.y-buttonBox.height/2)).toBeLessThanOrEqual(1);
  await capture(page,tenant?'tenant-keyboard':'admin-keyboard');await page.locator(selector).getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator(selector).getByText('Synthetic private reply',{exact:true})).toBeVisible();await contained(page,selector+' form',bounds);
});
