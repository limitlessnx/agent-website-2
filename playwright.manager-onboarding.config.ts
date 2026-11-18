import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/manager-onboarding",testMatch:"*.spec.ts",timeout:90000,workers:1,retries:0,forbidOnly:!!process.env.CI,
 reporter:[["list"],["json",{outputFile:"test-results/manager-onboarding-results.json"}]],outputDir:"test-results/manager-onboarding",
 use:{baseURL:"http://127.0.0.1:4700",headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"/usr/bin/chromium"}},
 projects:[360,430,768,1024,1440,1920].map(width=>({name:`chromium-${width}`,use:{browserName:"chromium",viewport:{width,height:1000}}})),
 webServer:{command:"node tests/manager-onboarding/start-fixture.cjs",url:"http://127.0.0.1:4700/account/signup",timeout:180000,reuseExistingServer:false},
});
