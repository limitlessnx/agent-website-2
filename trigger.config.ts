import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_ckweruqrgwndssqpjdvg",
  runtime: "node-24",
  dirs: ["./src/trigger"],
  maxDuration: 300,
  build: {
    external: ["@remotion/bundler", "@remotion/renderer", "remotion"],
    autoDetectExternal: false,
  },
});
