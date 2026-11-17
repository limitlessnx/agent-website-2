import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui-motion", testMatch: "*.spec.ts", timeout: 120000, workers: 1,
  retries: 0, forbidOnly: !!process.env.CI, updateSnapshots: "none",
  reporter: [["list"], ["json", {outputFile:"test-results/ui-motion-results.json"}]],
  outputDir: "test-results/ui-motion",
  use: {baseURL:"http://127.0.0.1:4400", headless:true, trace:"retain-on-failure", launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"/usr/bin/chromium"}},
  projects:[360,430,768,1024,1440,1920].map(width=>({name:`chromium-${width}`,use:{browserName:"chromium",viewport:{width,height:1000}}})),
  webServer:{command:"node tests/ui-motion/start-fixture.cjs",url:"http://127.0.0.1:4400/account/login",timeout:180000,reuseExistingServer:false}
});
