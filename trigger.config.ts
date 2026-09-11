import { defineConfig } from "@trigger.dev/sdk";
import { cp } from "node:fs/promises";
import path from "node:path";

function remotionSourceFiles() {
  return {
    name: "remotionSourceFiles",
    async onBuildComplete(context: { workingDir: string; logger: { log: (...args: unknown[]) => void } }, manifest: { outputPath: string }) {
      await cp(path.join(context.workingDir, "src", "remotion"), path.join(manifest.outputPath, "src", "remotion"), {
        recursive: true,
      });
      context.logger.log("Copied Remotion source files into the Trigger build image.");
    },
  };
}

export default defineConfig({
  project: "proj_ckweruqrgwndssqpjdvg",
  runtime: "node-24",
  dirs: ["./src/trigger"],
  maxDuration: 300,
  build: {
    external: ["@remotion/bundler", "@remotion/renderer", "remotion"],
    autoDetectExternal: false,
    extensions: [remotionSourceFiles()],
  },
});
