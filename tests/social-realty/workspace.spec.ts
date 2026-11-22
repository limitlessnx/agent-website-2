import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {createHmac} from 'node:crypto';
import {mkdirSync} from 'node:fs';
async function signIn(context:BrowserContext,workspace='limitless-realty'){
  const body=Buffer.from(JSON.stringify({email:'admin@example.test',name:'Synthetic Admin',issuedAt:Date.now()})).toString('base64url');
  await context.addCookies([{name:'limitless_admin_session',value:body+'.'+createHmac('sha256','synthetic-local-test-secret').update(body).digest('base64url'),url:'http://127.0.0.1:4400'},{name:'fluxknight_admin_organization',value:'system:'+workspace,url:'http://127.0.0.1:4400'}]);
}
async function capture(page:Page,name:string,width:number){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);mkdirSync('test-results/social-realty-captures',{recursive:true});await page.screenshot({path:`test-results/social-realty-captures/${name}-${width}.png`,fullPage:true,animations:'disabled',style:'nextjs-portal{display:none!important}'});}
test.beforeEach(async({context})=>{await context.request.get('http://127.0.0.1:4401/__qa/reset');await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4400'?route.continue():route.abort());});
test('manual idea creates an unapproved draft with its original brief and own brand',async({page,context},info)=>{
  await signIn(context);await page.goto('/dashboard/social/create',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Real estate content studio'})).toBeVisible();
  await page.getByLabel('Post idea or brief').fill('Synthetic buyer questions for land inspection in Benin City');await page.getByRole('button',{name:'Generate a draft from my idea'}).click();await expect(page.getByRole('button',{name:'Preparing draft…'})).toBeDisabled();
  await expect(page).toHaveURL(/social\/review\?week=all/,{timeout:30000});await expect(page.getByRole('heading',{name:'Synthetic property education draft 1'})).toBeVisible();await page.getByText('Original post idea',{exact:true}).click();await expect(page.getByText('Synthetic buyer questions for land inspection in Benin City',{exact:true})).toBeVisible();
  await expect(page.getByText('Prepare the final graphic, then review its copy and sources.',{exact:false})).toBeVisible();const state=await (await context.request.get('http://127.0.0.1:4401/__qa/state')).json();expect(state.calls).toBe(1);expect(state.posts).toHaveLength(1);expect(state.posts[0].status).toBe('review');expect(state.posts[0].approved_at).toBeNull();await capture(page,'manual-review',info.project.use.viewport!.width);
});
test('research produces cited candidates and never claims verified popularity or approval',async({page,context},info)=>{
  await signIn(context);await page.goto('/dashboard/social/create',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Research topics and draft posts'}).click();await expect(page.getByRole('button',{name:'Researching and drafting…'})).toBeDisabled();await expect(page).toHaveURL(/social\/review\?week=all/,{timeout:30000});
  await expect(page.getByRole('link',{name:'Synthetic Nigerian property report'})).toHaveCount(3);await expect(page.getByRole('heading',{name:/Synthetic property education draft/})).toHaveCount(3);
  const state=await (await context.request.get('http://127.0.0.1:4401/__qa/state')).json();expect(state.calls).toBe(2);expect(state.posts.every((p:{status:string;metadata:{popularity_verified:boolean}})=>p.status==='review'&&p.metadata.popularity_verified===false)).toBeTruthy();await capture(page,'research-review',info.project.use.viewport!.width);
});
test('provider outage retains manual idea, announces failure and allows recovery',async({page,context},info)=>{
  await signIn(context);await context.request.get('http://127.0.0.1:4401/__qa/fail?value=1');await page.goto('/dashboard/social/create');const field=page.getByLabel('Post idea or brief');await field.fill('Synthetic draft to retain after a failed generation');await page.getByRole('button',{name:'Generate a draft from my idea'}).click();await expect(page.getByRole('alert').filter({hasText:'Content provider unavailable'})).toBeVisible();await expect(field).toHaveValue('Synthetic draft to retain after a failed generation');await capture(page,'generation-error',info.project.use.viewport!.width);
  await context.request.get('http://127.0.0.1:4401/__qa/fail?value=0');await page.getByRole('button',{name:'Generate a draft from my idea'}).click();await expect(page).toHaveURL(/social\/review\?week=all/,{timeout:30000});const state=await (await context.request.get('http://127.0.0.1:4401/__qa/state')).json();expect(state.posts).toHaveLength(1);
});
test('first setup remains draft-only and provider controls do not expose Fluxknight credentials',async({page,context},info)=>{
  await context.request.get('http://127.0.0.1:4401/__qa/reset?configured=0');await signIn(context);await page.goto('/dashboard/social');await page.getByRole('button',{name:'Set up Limitless Realty Social'}).click();await expect(page.getByRole('heading',{name:'Real estate content studio'})).toBeVisible();
  await page.goto('/dashboard/social/integrations');await expect(page.getByRole('heading',{name:'Social connection status'})).toBeVisible();await expect(page.locator('input[type="password"]')).toHaveCount(0);await capture(page,'connections',info.project.use.viewport!.width);
  const state=await (await context.request.get('http://127.0.0.1:4401/__qa/state')).json();expect(state.calls).toBe(0);expect(state.posts).toHaveLength(0);
});
test('Fluxknight keeps its current workspace and unrelated organizations remain blocked',async({page,context},info)=>{
  await signIn(context,'fluxknight');await page.goto('/dashboard/social/create');await expect(page.getByRole('heading',{name:'AI Content Brain'})).toBeVisible();await expect(page.getByLabel('Post idea or brief')).toHaveCount(0);await expect(page.locator('#admin-mobile-navigation a[href="/dashboard/social"]')).toHaveCount(1);
  await signIn(context,'gencouv');await page.goto('/dashboard/social');await expect(page.getByRole('heading',{name:'Socials',exact:true})).toBeVisible();await expect(page.getByText('Not configured',{exact:true})).toBeVisible();await expect(page.locator('#admin-mobile-navigation a[href="/dashboard/social"]')).toHaveCount(0);await capture(page,'other-workspace',info.project.use.viewport!.width);
});
test('unconfigured provider application reports a recoverable error without leaving the workspace',async({page,context},info)=>{
  await signIn(context);await page.goto('/dashboard/social/integrations');await page.getByLabel('Limitless Realty Instagram handle').fill('@limitless_realty_test');await page.getByRole('button',{name:'Connect Limitless Realty Instagram'}).click();await expect(page.getByRole('alert').filter({hasText:'Instagram provider application is not configured'})).toBeVisible();expect(new URL(page.url()).origin).toBe('http://127.0.0.1:4400');await capture(page,'provider-setup-error',info.project.use.viewport!.width);
});
test('configured content agent is discoverable on the Limitless Realty overview',async({page,context},info)=>{
  await signIn(context);await page.goto('/dashboard',{waitUntil:'networkidle'});const quickAction=page.getByRole('navigation',{name:'Limitless Realty quick actions'}).getByRole('link',{name:/Flux Social/});await expect(quickAction).toBeVisible();await expect(quickAction).toHaveAttribute('href','/dashboard/social');
  const section=page.getByRole('region',{name:'Limitless Realty Flux Social'});await expect(section).toBeVisible();await expect(section).toContainText("Connect Limitless Realty's own Instagram account");const link=section.getByRole('link',{name:'Open content studio'});const bounds=await section.boundingBox(),action=await link.boundingBox();expect(action!.x+action!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width);expect(action!.height).toBeGreaterThanOrEqual(44);await capture(page,'workspace-overview',info.project.use.viewport!.width);await link.click();await expect(page.getByRole('heading',{name:'Real estate content studio'})).toBeVisible();
});
test('Flux Social opens from the existing workspace navigation and closes the mobile menu',async({page,context},info)=>{
  const width=info.project.use.viewport!.width;await signIn(context);await page.goto('/dashboard',{waitUntil:'networkidle'});
  if(width<=900)await page.getByRole('button',{name:'Open full navigation menu',exact:true}).click();
  const sidebar=page.locator('#admin-mobile-navigation');await sidebar.getByRole('button',{name:'Communications & Integrations',exact:true}).click();const entry=sidebar.getByRole('link',{name:'Flux Social',exact:true});await expect(entry).toBeVisible();await entry.click();await expect(page.getByRole('heading',{name:'Real estate content studio'})).toBeVisible();
  if(width<=900)await expect(page.getByRole('button',{name:'Open full navigation menu',exact:true})).toHaveAttribute('aria-expanded','false');
  else await expect(page.getByRole('navigation',{name:'Limitless Realty quick navigation'}).getByRole('link',{name:'Flux Social',exact:true})).toHaveAttribute('aria-current','page');
  await capture(page,'navigation-studio',width);
});
