import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {mkdirSync} from 'node:fs';
const origin='http://127.0.0.1:4400';
const org='10000000-0000-4000-8000-000000000001';
async function authenticate(context:BrowserContext) {
  const payload=Buffer.from(JSON.stringify({email:'admin@example.test',name:'Demo Admin',issuedAt:Date.now()})).toString('base64url');
  await context.addCookies([{name:'limitless_admin_session',value:payload+'.'+createHmac('sha256','synthetic-local-test-secret').update(payload).digest('base64url'),url:origin}]);
}
async function scenario(context:BrowserContext,value:string){await context.request.get('http://127.0.0.1:4401/__qa/scenario?value='+value);}
async function capture(page:Page,name:string){mkdirSync('docs/phase4/after',{recursive:true});await page.screenshot({path:`docs/phase4/after/${name}-${page.viewportSize()!.width}.png`,fullPage:true,animations:'disabled',style:'nextjs-portal{display:none!important}'});}
async function stableLayout(page:Page){
 await expect(page.locator('.flux-safe-error')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 const topbar=page.locator('.admin-topbar:visible');if(await topbar.isVisible()){const header=await topbar.boundingBox();const crumb=await page.locator('.admin-breadcrumb:visible').boundingBox();expect(crumb!.y).toBeGreaterThanOrEqual(header!.y-1);expect(crumb!.y+crumb!.height).toBeLessThanOrEqual(header!.y+header!.height+1);}
 expect(await page.content()).not.toContain('PRIVATE_PROVIDER_DIAGNOSTIC');expect(await page.content()).not.toContain('PRIVATE_AUDIT_METADATA');
 for(const action of await page.locator('main a.fk-action-button, main button.fk-action-button').all()) {
  const box=await action.boundingBox();if(!box)continue;expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);
 }
}
test.beforeEach(async({context})=>{
 await scenario(context,'normal');await authenticate(context);
 await context.route('**/*',r=>{
  const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
  if(u.pathname==='/api/leo/monitor')return r.fulfill({json:{ok:true,alerts:[]}});
  if(!['GET','HEAD'].includes(r.request().method()) && !['/api/admin/organization-context','/api/admin/billing/reservations'].includes(u.pathname))return r.abort();
  return r.continue();
 });
});
const pages=[['platform','/dashboard/platform','Super Admin Control Center'],['organizations','/dashboard/organizations','Organization Registry'],['provisioning',`/dashboard/provisioning?organizationId=${org}`,'Provisioning Control Center'],['integrations','/dashboard/integrations','Integration Center'],['agent-operations','/dashboard/agent-operations','Agent Operations'],['clients','/dashboard/clients','Tenant Organizations'],['settings','/dashboard/settings','Settings'],['billing','/dashboard/billing','Flux Credits & margins']] as const;
for(const [name,route,heading] of pages)test(`${name} preserves long content and actions`,async({page})=>{
 const response=await page.goto(route,{waitUntil:'networkidle'});expect(response?.status()).toBe(200);
 await expect(page.getByRole('heading',{level:1})).toContainText(heading);await stableLayout(page);await capture(page,name);
 if(page.viewportSize()!.width>900){const navigation=page.getByRole('button',{name:'Security & Settings',exact:true});const box=await navigation.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);}
 if(process.env.FLUX_PHASE4_COMPARE==='1' && ['platform','organizations','provisioning'].includes(name))await expect(page).toHaveScreenshot(`${name}.png`,{fullPage:true,animations:'disabled',maxDiffPixelRatio:0.002,stylePath:'tests/phase4/screenshot.css'});
});
test('readiness exposes failures, next actions, owner roles and separate subscription evidence',async({page})=>{
 await page.goto(`/dashboard/provisioning?organizationId=${org}`,{waitUntil:'networkidle'});
 await expect(page.getByText('Needs attention',{exact:true})).toBeVisible();await expect(page.getByText('failed · attempt 1/5')).toBeVisible();await expect(page.getByRole('link',{name:'Open setup & recovery'})).toHaveAttribute('href',`/dashboard/clients/${org}/setup`);
 await expect(page.getByText('active · owner',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Review required action'}).first()).toBeVisible();await expect(page.getByRole('heading',{name:'Subscription & industry template'})).toBeVisible();
});
test('empty and pending tool evidence never claim successful completion',async({page,context})=>{
 await context.addCookies([{name:'fluxknight_admin_organization',value:'tenant:'+org,url:origin}]);
 await scenario(context,'empty');await page.goto('/dashboard/agent-operations',{waitUntil:'networkidle'});const metric=page.locator('.admin-metric-card').filter({hasText:'Success rate'});await expect(metric).toContainText('—');await expect(metric).not.toContainText('100%');
 await scenario(context,'pending');await page.reload({waitUntil:'networkidle'});await expect(metric).toContainText('0 terminal runs');await expect(metric).toContainText('1 other states');await expect(metric).not.toContainText('100%');
 await capture(page,'pending-tool-runs');
});
test('source outages are explicit and unrelated registry stays available',async({page,context})=>{
 await scenario(context,'outage');await page.goto('/dashboard/platform',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'Evidence unavailable'})).toHaveCount(7);await expect(page.getByRole('link',{name:'Manage organizations'})).toBeVisible();await stableLayout(page);await capture(page,'source-outage');
 await page.goto('/dashboard/agent-operations',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'runtime evidence is unavailable'})).toBeVisible();await expect(page.locator('.admin-metric-card').filter({hasText:'Success rate'})).toContainText('—');
 await page.goto('/dashboard/integrations',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'Tenant connection evidence unavailable'})).toBeVisible();await expect(page.getByText('No tenant-owned connection is required yet.')).toHaveCount(0);
 await page.goto('/dashboard/health',{waitUntil:'networkidle'});await expect(page.getByText('Health evidence unavailable',{exact:true})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Health is unknown.'})).toBeVisible();await capture(page,'health-unavailable');
});
test('workspace switch errors stay visible and successful selection does not grant tenant membership',async({page,context})=>{
 await page.goto('/dashboard/platform',{waitUntil:'networkidle'});
 if(page.viewportSize()!.width<=900)await page.getByRole('button',{name:'Open full navigation menu'}).click();
 await page.getByRole('button',{name:/Current workspace/}).click();
 await scenario(context,'audit-failure');await page.getByRole('button',{name:'Gencouv Internal organization',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'could not be logged'})).toBeVisible();
 expect((await context.cookies()).some(c=>c.name==='fluxknight_admin_organization')).toBe(false);await capture(page,'workspace-switch-error');
 await scenario(context,'normal');await page.getByRole('button',{name:'Gencouv Internal organization',exact:true}).click();await page.waitForURL('**/dashboard/gencouv');
 const cookies=await context.cookies();expect(decodeURIComponent(cookies.find(c=>c.name==='fluxknight_admin_organization')?.value || '')).toBe('system:gencouv');expect(cookies.some(c=>c.name==='fluxknight_client_session')).toBe(false);
});
test('registry search and three organization contexts remain distinct',async({page})=>{
 await page.goto('/dashboard/organizations',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Administration contexts'})).toBeVisible();
 await page.getByRole('searchbox',{name:'Find an organization'}).fill('Demo Business');await page.getByLabel('Organization context').selectOption('customer');await page.getByRole('search').filter({has:page.getByRole('searchbox',{name:'Find an organization'})}).getByRole('button',{name:'Search',exact:true}).click();await expect(page).toHaveURL(/category=customer/);await page.waitForLoadState('networkidle');const result=page.getByText('1 matching records').filter({visible:true});await expect(result).toHaveCount(1);await expect(result).toBeVisible();await stableLayout(page);
});
test('mobile navigation, reduced motion and zoom keep actions usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/dashboard/organizations',{waitUntil:'networkidle'});await page.addStyleTag({content:'html{font-size:125%}body{zoom:1.25}'});await stableLayout(page);
 if(page.viewportSize()!.width<=900){await page.getByRole('button',{name:'Open full navigation menu'}).click();const dialog=page.getByRole('dialog',{name:'Admin navigation'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Onboarding & Provisioning'})).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();}
 await page.getByRole('button',{name:'Open Agent Leo',exact:true}).click();await expect(page.locator('#leo-assistant-panel')).toBeVisible();await stableLayout(page);await capture(page,'leo-reduced-motion');
});
test('context endpoint denies missing admin, malformed target and cross-origin attempts',async({context})=>{
 const invalid=await context.request.post('/api/admin/organization-context',{data:{kind:'tenant',id:'bad-id'}});expect(invalid.status()).toBe(400);
 const cross=await context.request.post('/api/admin/organization-context',{headers:{origin:'https://attacker.example'},data:{kind:'system',id:'fluxknight'}});expect(cross.status()).toBe(403);
 const missing=await context.request.post('/api/admin/organization-context',{data:{kind:'tenant',id:'90000000-0000-4000-8000-000000000001'}});expect(missing.status()).toBe(404);
 await context.clearCookies();const denied=await context.request.post('/api/admin/organization-context',{data:{kind:'system',id:'fluxknight'}});expect(denied.status()).toBe(401);
});

async function tenantBilling(context:BrowserContext) {
 const payload=Buffer.from(JSON.stringify({userId:'qa-owner',email:'owner@example.test',organizationId:org,organizationSlug:'qa-general',membershipId:'qa-membership',role:'owner',issuedAt:Date.now()})).toString('base64url');
 await context.addCookies([{name:'fluxknight_client_session',value:payload+'.'+createHmac('sha256','synthetic-local-test-secret').update(payload).digest('base64url'),url:origin}]);
}
test('tenant billing separates reserved credits and available funds',async({page,context})=>{
 await tenantBilling(context);await page.goto('/portal/billing',{waitUntil:'networkidle'});
 await expect(page.getByRole('heading',{name:'Flux Credits',exact:true})).toBeVisible();
 await expect(page.locator('.portal-metric').filter({hasText:'Reserved credits'})).toContainText('996');
 await expect(page.locator('.portal-metric').filter({hasText:'Available for new work'})).toContainText('4');
 await stableLayout(page);await capture(page,'tenant-billing-capacity');
 await scenario(context,'credit-held');await page.reload({waitUntil:'networkidle'});
 await expect(page.locator('.portal-metric').filter({hasText:'Available for new work'})).toContainText('0');
 await expect(page.locator('.portal-metric').filter({hasText:'Reserved credits'})).toContainText('1,000');
 await stableLayout(page);await capture(page,'tenant-billing-held');
});
test('billing capacity outages remain explicit for admin and tenant',async({page,context})=>{
 await scenario(context,'credit-unavailable');
 await page.goto('/dashboard/billing',{waitUntil:'networkidle'});
 await expect(page.getByRole('status').filter({hasText:'Credit availability could not be verified'})).toBeVisible();
 await stableLayout(page);await capture(page,'admin-billing-unavailable');
 await tenantBilling(context);await page.goto('/portal/billing',{waitUntil:'networkidle'});
 await expect(page.getByRole('status').filter({hasText:'Credit availability could not be verified'})).toBeVisible();
 await expect(page.locator('.portal-metric').filter({hasText:'Available for new work'})).toContainText('Unavailable');
 await stableLayout(page);await capture(page,'tenant-billing-unavailable');
 await scenario(context,'credit-history-unavailable');await page.reload({waitUntil:'networkidle'});
 await expect(page.getByRole('alert').filter({hasText:'Credit history could not be loaded'})).toBeVisible();
 await expect(page.getByText('No credit transactions have been recorded yet.')).toHaveCount(0);
 await stableLayout(page);await capture(page,'tenant-billing-history-unavailable');
});

test('credit recovery requires confirmation, preserves review failures and reports verified settlement',async({page,context})=>{
 await scenario(context,'recovery-blocked');await page.goto('/dashboard/billing',{waitUntil:'networkidle'});
 const recovery=page.getByRole('region',{name:'Reservation recovery'});
 const submit=recovery.locator('button[type=submit]');
 await expect(submit).toBeDisabled();await recovery.getByLabel('Reservation',{exact:true}).selectOption('20000000-0000-4000-8000-000000000001');
 await recovery.getByLabel('Review reason').fill('Reviewed synthetic completed execution evidence');await expect(submit).toBeDisabled();
 await recovery.getByRole('checkbox').check();const checkbox=await recovery.getByRole('checkbox').boundingBox();expect(checkbox!.width).toBeLessThanOrEqual(24);expect(checkbox!.height).toBeLessThanOrEqual(24);await submit.click();
 await expect(recovery.getByRole('status')).toContainText('Reservation remains in review');
 await stableLayout(page);await capture(page,'recovery-blocked');
 await scenario(context,'normal');
 let resume:()=>void=()=>{};const paused=new Promise<void>(resolve=>{resume=resolve;});
 await page.route('**/api/admin/billing/reservations',async route=>{await paused;await route.continue();});
 await submit.click();await expect(submit).toBeDisabled();resume();
 await expect(recovery.getByRole('status')).toContainText('Settlement verified');
 await expect(recovery.getByRole('button',{name:'Reconcile completed work',exact:true})).toBeDisabled();
 const entries=await(await context.request.get('http://127.0.0.1:4401/__qa/audits')).json();
 const last=entries.filter((x:{action:string})=>x.action==='billing.credit_reservation.reconcile').at(-1);
 expect(last.p_organization_id).toBe(org);expect(last.p_actor_email).toBe('admin@example.test');expect(last.outcome).toBe('settled');
 await stableLayout(page);await capture(page,'recovery-settled');
});
test('unavailable reservation reads never look like an empty recovery queue',async({page,context})=>{
 await scenario(context,'recovery-unavailable');await page.goto('/dashboard/billing',{waitUntil:'networkidle'});
 await expect(page.getByRole('alert').filter({hasText:'Reservations could not be loaded'})).toBeVisible();
 await expect(page.getByText('No unresolved reservations in this organization.')).toHaveCount(0);
 await stableLayout(page);await capture(page,'recovery-unavailable');
});
