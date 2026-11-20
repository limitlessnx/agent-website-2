import { defineConfig, devices } from "@playwright/test";
import motion from "./playwright.motion.config";

export default defineConfig(motion, {
  testMatch: "leo-keyboard.spec.ts",
  reporter: [["list"], ["json", { outputFile: "test-results/leo-keyboard-results.json" }]],
  outputDir: "test-results/leo-keyboard-traces",
  use: { launchOptions: {} },
  projects: [
    ...[360, 430, 768, 1024, 1440, 1920].map(width => ({
      name: `chromium-${width}`,
      use: { browserName: "chromium" as const, viewport: { width, height: 1000 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium" } },
    })),
    ...[360, 430, 768].map(width => ({
      name: `webkit-${width}`,
      use: { ...devices[width === 768 ? "iPad Mini" : "iPhone 13"], browserName: "webkit" as const, viewport: { width, height: 1000 }, launchOptions: {} },
    })),
  ],
});
