import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {createHmac} from 'node:crypto';
const origin='http://127.0.0.1:4400';
async function authenticate(context:BrowserContext,tenant=false,organization=1){
  const payload=tenant?{userId:'30000000-0000-4000-8000-000000000001',email:'owner@example.test',organizationId:`10000000-0000-4000-8000-00000000000${organization}`,organizationSlug:organization===4?'qa-hotels':'qa-general',membershipId:'qa-membership',role:'owner',issuedAt:Date.now()}:{email:'admin@example.test',name:'Synthetic Admin',issuedAt:Date.now()};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  await context.addCookies([{name:tenant?'fluxknight_client_session':'limitless_admin_session',value:body+'.'+createHmac('sha256','synthetic-local-test-secret').update(body).digest('base64url'),url:origin}]);
}
async function fit(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);}
test.beforeEach(async({context})=>{
  await context.request.get('http://127.0.0.1:4401/__qa/integration-management?value=1');
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin||!['GET','HEAD'].includes(request.method()))return route.abort();
    if(url.pathname==='/api/admin/appointment-availability-settings')return route.fulfill({json:{maxConcurrentAppointments:1}});
    return route.continue();
  });
});
test.afterEach(async({context})=>{await context.request.get('http://127.0.0.1:4401/__qa/integration-management?value=0');});
test('WhatsApp setup labels, validation, pending and failure remain accessible',async({page,context})=>{
  await authenticate(context,true);let payload:Record<string,unknown>|undefined;
  await page.route('**/api/integrations/whatsapp/twilio/bootstrap',async route=>{payload=route.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,400));await route.fulfill({status:503,json:{error:'Synthetic provider configuration unavailable'}});});
  await page.goto('/portal/integrations',{waitUntil:'networkidle'});
  const panel=page.locator('section.portal-card').filter({has:page.getByRole('heading',{name:'WhatsApp',exact:true})});
  await panel.getByRole('button',{name:'Connect WhatsApp with Meta',exact:true}).click();
  await expect(panel.getByRole('alert')).toContainText('E.164');expect(payload).toBeUndefined();
  await panel.getByLabel('WhatsApp phone number',{exact:true}).fill('+2348000000001');
  await panel.getByLabel('Business display name',{exact:true}).fill('Synthetic long international business display name for configuration checks');
  await panel.getByRole('button',{name:'Connect WhatsApp with Meta',exact:true}).click();await expect(panel.getByRole('button',{name:'Connecting...',exact:true})).toBeDisabled();
  await expect(panel.getByRole('alert')).toHaveText('Synthetic provider configuration unavailable');
  expect(payload).toEqual({numberSource:'customer',senderPhoneE164:'+2348000000001',senderProfileName:'Synthetic long international business display name for configuration checks'});
  expect(await page.locator('#facebook-jssdk').count()).toBe(0);await fit(page);
  await context.request.get('http://127.0.0.1:4401/__qa/integration-management?value=0');await page.reload({waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'Connect WhatsApp with Meta',exact:true})).toHaveCount(0);
});
test('Voice configuration distinguishes plan lock, save failure and saved pending readiness',async({page,context})=>{
  await authenticate(context,true);await context.request.get('http://127.0.0.1:4401/__qa/plan?value=basic');
  try{
    await page.goto('/portal/integrations',{waitUntil:'networkidle'});
    let panel=page.locator('section.portal-card').filter({has:page.getByRole('heading',{name:'Voice Calling',exact:true})});await expect(panel).toContainText('Locked on the current plan.');await expect(panel.locator('input')).toHaveCount(0);
    await context.request.get('http://127.0.0.1:4401/__qa/plan?value=business');await page.reload({waitUntil:'networkidle'});
    panel=page.locator('section.portal-card').filter({has:page.getByRole('heading',{name:'Voice Calling',exact:true})});
    let fail=true;const payloads:unknown[]=[];await page.route('**/api/integrations/voice/readiness',async route=>{payloads.push(route.request().postDataJSON());await new Promise(resolve=>setTimeout(resolve,400));return route.fulfill(fail?{status:503,json:{error:'Synthetic voice setup unavailable'}}:{json:{gate:{ready:false,checks:[{key:'provider_activation',ok:false,detail:'Provider activation remains pending'}]}}});});
    const save=panel.getByRole('button',{name:'Confirm Voice setup details',exact:true});await expect(save).toBeDisabled();
    await panel.getByLabel('Business phone number',{exact:true}).fill('+2348000000002');await panel.getByLabel('Human transfer number (optional)',{exact:true}).fill('+2348000000003');
    await save.click();await expect(panel.getByRole('button',{name:'Saving...',exact:true})).toBeDisabled();await expect(panel.getByRole('alert')).toHaveText('Synthetic voice setup unavailable');
    fail=false;await save.click();await expect(panel.getByRole('status')).toContainText('Phone details saved.');await expect(panel).toContainText('Setup in progress');await expect(panel).toContainText('Provider activation remains pending');
    expect(payloads).toEqual([{businessPhone:'+2348000000002',transferNumber:'+2348000000003'},{businessPhone:'+2348000000002',transferNumber:'+2348000000003'}]);await fit(page);
  }finally{await context.request.get('http://127.0.0.1:4401/__qa/plan?value=basic');}
});
test('actual browser-engine pinch zoom keeps public Leo controls in the visible viewport',async({page,context},info)=>{
  const cdp=await context.newCDPSession(page);
  await page.goto('/#talk-to-leo',{waitUntil:'networkidle'});const input=page.getByRole('textbox',{name:'Message Leo',exact:true});await expect(input).toBeVisible();await input.fill('Synthetic zoom draft (not sent)');
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await expect.poll(()=>page.evaluate(()=>visualViewport!.scale)).toBe(2);
  await expect(async()=>{const v=await page.evaluate(()=>({x:visualViewport!.offsetLeft,y:visualViewport!.offsetTop,width:visualViewport!.width,height:visualViewport!.height}));for(const selector of ['.public-leo-header','.public-leo-input']){const r=(await page.locator(selector).boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(v.x-1);expect(r.y).toBeGreaterThanOrEqual(v.y-1);expect(r.x+r.width).toBeLessThanOrEqual(v.x+v.width+1);expect(r.y+r.height).toBeLessThanOrEqual(v.y+v.height+1);}}).toPass({timeout:4000});
  await expect(input).toHaveValue('Synthetic zoom draft (not sent)');await info.attach('browser-engine-pinch-zoom',{body:await page.screenshot({animations:'disabled',style:'nextjs-portal{display:none!important}'}),contentType:'image/png'});
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
});
test('six-times client CPU slowdown preserves settings interaction and layout stability',async({page,context},info)=>{
  await authenticate(context);await page.addInitScript(()=>{const scope=window as unknown as {__closureCLS:number};scope.__closureCLS=0;new PerformanceObserver(list=>{for(const item of list.getEntries()){const entry=item as PerformanceEntry & {hadRecentInput:boolean;value:number};if(!entry.hadRecentInput)scope.__closureCLS+=entry.value;}}).observe({type:'layout-shift',buffered:true});});
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await cdp.send('Performance.enable');
  await page.goto('/dashboard/settings',{waitUntil:'networkidle'});const field=page.getByLabel('Maximum simultaneous appointments',{exact:true});await field.fill('3');await page.getByRole('button',{name:'Reset changes',exact:true}).click();await expect(field).toHaveValue('1');await fit(page);
  const cls=await page.evaluate(()=>(window as unknown as {__closureCLS:number}).__closureCLS);expect(cls).toBeLessThanOrEqual(0.1);
  await info.attach('client-performance',{body:JSON.stringify({cpuSlowdown:6,cls,metrics:await cdp.send('Performance.getMetrics')}),contentType:'application/json'});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
});


test('hotel room and service catalogue configuration is readable without saving data',async({page,context},info)=>{
  await authenticate(context,true,4);await page.goto('/portal/hotel/catalog',{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Hotel Catalog',exact:true})).toBeVisible();await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button',{name:'Services',exact:true}).click();await expect(page.getByRole('button',{name:'Services',exact:true})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'Add service',exact:true}).click();await expect(page.getByLabel('Facility or experience name',{exact:true})).toBeVisible();
  await page.getByLabel('Facility or experience name',{exact:true}).fill('Synthetic international guest wellness and concierge experience');await fit(page);
  await info.attach('catalog-configuration',{body:await page.screenshot({animations:'disabled',style:'nextjs-portal{display:none!important}'}),contentType:'image/png'});
});
