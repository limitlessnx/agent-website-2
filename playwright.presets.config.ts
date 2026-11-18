import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir:"./tests/industry-presets",testMatch:"*.spec.ts",timeout:120000,workers:1,retries:0,forbidOnly:!!process.env.CI,
  reporter:[["list"],["json",{outputFile:process.env.PRESET_CAPTURE_BEFORE==="1"?"test-results/preset-before-results.json":"test-results/preset-results.json"}]],outputDir:"test-results/industry-presets",
  use:{baseURL:"http://127.0.0.1:4800",headless:true,launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
  projects:[360,430,768,1024,1440,1920].map(width=>({name:`chromium-${width}`,use:{browserName:"chromium",viewport:{width,height:1000}}})),
  webServer:{command:"node tests/industry-presets/start-fixture.cjs",url:"http://127.0.0.1:4800/account/login",timeout:180000,reuseExistingServer:false},
});
