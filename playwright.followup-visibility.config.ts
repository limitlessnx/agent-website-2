import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/followup-visibility',testMatch:'*.spec.ts',workers:1,retries:0,forbidOnly:!!process.env.CI,timeout:90000,
  reporter:[['list'],['json',{outputFile:'test-results/followup-visibility-results.json'}]],outputDir:'test-results/followup-visibility',
  use:{baseURL:'http://127.0.0.1:4400',trace:'retain-on-failure',headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'}},
  projects:[360,430,768,1024,1440,1920].map(width=>({name:`chromium-${width}`,use:{viewport:{width,height:1000}}})),
  webServer:{command:'node tests/followup-visibility/start-fixture.cjs',url:'http://127.0.0.1:4400/account/login',timeout:180000,reuseExistingServer:false}});
