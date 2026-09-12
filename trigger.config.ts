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
      target: "dev" | "deploy";
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
            "RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && mkdir -p /app/node_modules/next/dist/compiled/@vercel/og && cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /app/node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf && rm -rf /var/lib/apt/lists/*",
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
