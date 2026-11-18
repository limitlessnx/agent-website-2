/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only rendered baselines from the untouched main worktree, synthetic data only.
const { chromium } = require('@playwright/test');
const { createHmac } = require('node:crypto');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
  const ctx = await browser.newContext();
  const origin = 'http://127.0.0.1:4400';
  await ctx.route('**/*', r => new URL(r.request().url()).origin === origin && ['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort());
  const payload = Buffer.from(JSON.stringify({email:'admin@example.test',name:'Demo Admin',issuedAt:Date.now()})).toString('base64url');
  await ctx.addCookies([{name:'limitless_admin_session',value:payload+'.'+createHmac('sha256','synthetic-local-test-secret').update(payload).digest('base64url'),url:origin}]);
  fs.mkdirSync('docs/phase4/before', {recursive:true});
  const results = [];
  try {
    for (const width of [360,430,768,1024,1440,1920]) {
      const page = await ctx.newPage(); await page.setViewportSize({width,height:1000});
      for (const route of ['organizations','agent-operations','integrations','clients']) {
        await page.goto(origin+'/dashboard/'+route,{waitUntil:'networkidle',timeout:120000});
        const error = await page.locator('.flux-safe-error').count();
        const scrollWidth = await page.evaluate(()=>document.documentElement.scrollWidth);
        await page.screenshot({path:`docs/phase4/before/${route}-${width}.png`,fullPage:true,animations:'disabled',style:'nextjs-portal{display:none!important}'});
        results.push({route,width,scrollWidth,error,successRate:route==='agent-operations'?await page.locator('.admin-metric-card').nth(1).innerText():undefined});
      }
      await page.close();
    }
    fs.writeFileSync('docs/phase4/before/results.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
