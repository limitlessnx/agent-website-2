import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {mkdirSync} from 'node:fs';
async function signIn(context:BrowserContext) {
  const body=Buffer.from(JSON.stringify({email:'admin@example.test',name:'Synthetic Admin',issuedAt:Date.now()})).toString('base64url');
  await context.addCookies([{name:'limitless_admin_session',value:body+'.'+createHmac('sha256','synthetic-local-test-secret').update(body).digest('base64url'),url:'http://127.0.0.1:4400'},{name:'fluxknight_admin_organization',value:'system:limitless-realty',url:'http://127.0.0.1:4400'}]);
}
async function capture(page:Page, name:string) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width+1);
  mkdirSync('test-results/followup-visibility-captures',{recursive:true});
  await page.screenshot({path:`test-results/followup-visibility-captures/${name}-${page.viewportSize()!.width}.png`,fullPage:true,animations:'disabled',style:'nextjs-portal{display:none!important}'});
}
test.beforeEach(async({context,page})=>{
  await context.request.get('http://127.0.0.1:4401/__qa/unavailable?value=0'); await signIn(context);
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4400'?route.continue():route.abort());
  await page.route('**/api/limitless/followup-drafts',route=>route.fulfill({json:{drafts:[]}}));
});
test('home shows canonical active clients and current installment reminder plans',async({page})=>{
  await page.goto('/dashboard',{waitUntil:'networkidle'});
  const kpis=page.getByRole('region',{name:'Business KPIs'});
  await expect(kpis.getByRole('link',{name:/Follow-ups/}).locator('strong')).toHaveText('1');
  const reminders=kpis.getByRole('link',{name:/Installment reminders/}); await expect(reminders.locator('strong')).toHaveText('5');
  await expect(kpis.getByRole('link',{name:/Follow-ups/})).toHaveAttribute('href','/dashboard/limitless/followups'); await capture(page,'home');
  await reminders.click(); await expect(page.getByRole('heading',{name:'Installment reminder status'})).toBeVisible();
});
test('CRM and control count one active client despite stage zero and multiple scheduled steps',async({page})=>{
  await page.goto('/dashboard/limitless/leads',{waitUntil:'networkidle'}); const stat=page.locator('.leads-crm-summary > div').filter({hasText:'In Follow-up'});
  await expect(stat.locator('strong')).toHaveText('1'); await expect(page.locator('.lead-compact-card summary').getByText('Follow-up active · needs review',{exact:true})).toBeVisible(); await capture(page,'crm');
  await page.goto('/dashboard/limitless/followups',{waitUntil:'networkidle'});await expect(page.locator('.admin-metric-card').filter({hasText:'Active follow-ups'}).locator('strong')).toHaveText('1');
  await page.locator('select').filter({has:page.locator('option[value="active"]')}).selectOption('all');
  const accepted=page.locator('.followup-record').filter({hasText:'step 1'}); await accepted.locator('summary').click(); await expect(accepted.getByText('failed · review required; no automatic retry')).toBeVisible(); await expect(accepted.getByRole('button',{name:'Retry failed step'})).toHaveCount(0); await capture(page,'control');
});
test('payments distinguishes exact plan counts and accepted, failed and unknown attempts',async({page})=>{
  await page.goto('/dashboard/limitless/payments',{waitUntil:'networkidle'}); const status=page.getByRole('region',{name:'Installment reminder status'});
  for(const [label,count] of [['Active reminder plans','5'],['Pending attempts','1'],['Provider accepted','2'],['Failed attempts','1'],['Unknown outcomes','1']]) await expect(status.locator('.admin-metric-card').filter({hasText:label}).locator('strong')).toHaveText(count);
  await capture(page,'payments');await page.goto('/dashboard/limitless/payments/installments',{waitUntil:'networkidle'});await expect(page.getByRole('link',{name:/Active reminder plans/}).locator('strong')).toHaveText('5'); await capture(page,'installments');
});
test('read failures show unavailable rather than zero or healthy automation',async({page,context})=>{
  await context.request.get('http://127.0.0.1:4401/__qa/unavailable?value=1');
  try {
    await page.goto('/dashboard',{waitUntil:'networkidle'});const kpis=page.getByRole('region',{name:'Business KPIs'});await expect(kpis.getByRole('link',{name:/Follow-ups/}).locator('strong')).toHaveText('—');await expect(kpis.getByRole('link',{name:/Installment reminders/}).locator('strong')).toHaveText('—');await capture(page,'home-unavailable');
    await page.goto('/dashboard/limitless/leads',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'Follow-up status could not be loaded'})).toBeVisible();
    await page.goto('/dashboard/limitless/followups',{waitUntil:'networkidle'});await expect(page.getByText('Automations healthy',{exact:true})).toHaveCount(0);await expect(page.getByText('Follow-up data is temporarily unavailable',{exact:true})).toBeVisible();
    await page.goto('/dashboard/limitless/payments',{waitUntil:'networkidle'});await expect(page.getByRole('alert').filter({hasText:'Installment reminder counts are temporarily unavailable'})).toBeVisible();await capture(page,'payments-unavailable');
  } finally {await context.request.get('http://127.0.0.1:4401/__qa/unavailable?value=0');}
});
