import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/responsive', testMatch:'*.spec.ts', timeout:120_000,
  workers:1, forbidOnly:!!process.env.CI, retries:0,
  reporter:[['list'],['json',{outputFile:'test-results/responsive-results.json'}],['html',{open:'never',outputFolder:'playwright-report'}]],
  outputDir:'test-results/responsive',
  use:{baseURL:'http://127.0.0.1:4400',headless:true,trace:'retain-on-failure',
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
  projects:[360,430,768,1024,1440,1920].map(width=>({name:`chromium-${width}`,use:{browserName:'chromium',viewport:{width,height:1000}}})),
  webServer:{command:'node tests/responsive/start-fixture.cjs',url:'http://127.0.0.1:4400/login',timeout:180_000,reuseExistingServer:false},
});
