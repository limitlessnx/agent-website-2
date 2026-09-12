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

function socialMediaRuntimeAssets() {
  return {
    name: "socialMediaRuntimeAssets",
    onBuildComplete(context: {
      target: "dev" | "deploy" | "unmanaged";
      addLayer: (layer: {
        id: string;
        image: { instructions?: string[] };
      }) => void;
    }) {
      if (context.target === "dev") return;
      context.addLayer({
        id: "flux-social-runtime-assets",
        image: {
          instructions: [
            "RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libglib2.0-0 libx11-6 libxcb1 libxext6 && rm -rf /var/lib/apt/lists/*",
          ],
        },
      });
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
    extensions: [remotionSourceFiles(), socialMediaRuntimeAssets()],
  },
});
