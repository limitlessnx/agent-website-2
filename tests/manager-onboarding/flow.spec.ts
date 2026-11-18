import {test,expect,type Page} from '@playwright/test';
import {createHmac} from 'node:crypto';

async function screenshot(page:Page,name:string){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath(`${name}.png`),fullPage:true,animations:'disabled',caret:'initial'});
}
test.beforeEach(async({context})=>{
 await context.route('**/*',route=>{
  const host=new URL(route.request().url()).hostname;
  return ['127.0.0.1','localhost'].includes(host)?route.continue():route.abort();
 });
 const payload=Buffer.from(JSON.stringify({userId:'synthetic-manager',email:'very.long.manager.email.address.for.responsive.testing@example.test',issuedAt:Date.now()})).toString('base64url');
 const token=payload+'.'+createHmac('sha256','synthetic-manager-onboarding-only').update(payload).digest('base64url');
 await context.addCookies([{name:'fluxknight_manager_session',value:token,url:'http://127.0.0.1:4700',httpOnly:true,sameSite:'Lax'}]);
});
test('email signup reaches role choice, and manager enters the Access ID request flow',async({page})=>{
 await page.route('**/api/client-auth/signup',r=>r.fulfill({json:{ok:true,redirect_to:'/account/choose-mode',requires_account_choice:true}}));
 await page.route('**/api/client-auth/account-mode',async r=>{expect(r.request().postDataJSON()).toEqual({account_mode:'manager'});await r.fulfill({json:{ok:true,redirect_to:'/manage-organizations'}});});
 await page.route('**/api/client-auth/manager-access',r=>r.fulfill({json:{requests:[],organizations:[]}}));
 await page.goto('/account/signup');await screenshot(page,'signup');
 await page.getByLabel('Full name').fill('Synthetic Manager');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.test');
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByLabel('Confirm password',{exact:true}).fill('synthetic-password');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page).toHaveURL(/account\/choose-mode/);
 await expect(page.getByRole('button',{name:/Organization owner/})).toBeVisible();await screenshot(page,'account-choice');
 await page.getByRole('button',{name:/^Manager/}).click();await expect(page).toHaveURL(/manage-organizations/);
 await expect(page.locator('footer')).toHaveCount(0);
 await expect(page.getByLabel('Organization Access ID')).toBeVisible();await expect(page.getByText('No approved organizations yet.',{exact:false})).toBeVisible();await screenshot(page,'manager-empty');
});
test('owner choice continues to existing business setup',async({page})=>{
 await page.route('**/api/client-auth/account-mode',async r=>{expect(r.request().postDataJSON()).toEqual({account_mode:'organization'});await r.fulfill({json:{ok:true,redirect_to:'/account/setup'}});});
 await page.goto('/account/choose-mode');await page.getByRole('button',{name:/Organization owner/}).click();await expect(page).toHaveURL(/account\/setup/);await screenshot(page,'owner-setup');
});
test('code remains pending until approval; long organization names and revoked access remain readable',async({page})=>{
 let requested=false,approved=false;
 const name='A Very Long Organization Name for Property Photography and Hotel Operations '+ 'Z'.repeat(100);
 await page.route('**/api/client-auth/manager-access',async r=>{
  const body=r.request().method()==='POST'?r.request().postDataJSON():null;
  if(body?.action==='enter'){expect(body.organization_id).toBe('synthetic-org');return r.fulfill({status:403,json:{error:'Approved organization membership not found.'}});}
  if(body){expect(body).toEqual({access_code:'FLX-TEST1234'});requested=true;return r.fulfill({status:201,json:{ok:true,status:'pending'}});}
  await r.fulfill({json:{organizations:approved?[{organizationId:'synthetic-org',organizationName:name,role:'manager'}]:[],requests:requested?[{id:'request',organization_id:'synthetic-org',organization_name:name,status:approved?'approved':'pending'}]:[]}});
 });
 await page.goto('/manage-organizations');await page.getByLabel('Organization Access ID').fill('flx-test1234');await page.getByLabel('Organization Access ID').press('Enter');
 await expect(page.getByText('pending',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Enter Workspace/})).toHaveCount(0);await screenshot(page,'pending');
 approved=true;await page.getByRole('button',{name:'Refresh access'}).click();await expect(page.getByRole('button',{name:/Enter Workspace/})).toBeVisible();await screenshot(page,'approved');
 await page.getByRole('button',{name:/Enter Workspace/}).click();await expect(page.getByRole('alert').filter({hasText:'Approved organization membership not found.'})).toBeVisible();await screenshot(page,'entry-denied');
});
test('request-loading errors are visible and recover without misleading empty states',async({page})=>{
 let fail=true;
 await page.route('**/api/client-auth/manager-access',r=>r.fulfill({status:fail?503:200,json:fail?{error:'Access service temporarily unavailable.'}:{requests:[],organizations:[]}}));
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/manage-organizations');await expect(page.getByRole('alert').filter({hasText:'Access service temporarily unavailable.'})).toBeVisible();
 await expect(page.getByText('No organization access requests yet.')).toHaveCount(0);await screenshot(page,'load-error');fail=false;
 await page.getByRole('button',{name:'Retry loading access'}).click();await expect(page.getByText('No organization access requests yet.')).toBeVisible();await screenshot(page,'recovered');
});
