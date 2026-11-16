import { defineConfig } from "@trigger.dev/sdk";
import { access, cp, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

function remotionSourceFiles() {
  return {
    name: "remotionSourceFiles",
    async onBuildComplete(context: { workingDir: string; logger: { log: (...args: unknown[]) => void } }, manifest: { outputPath: string }) {
      await cp(path.join(context.workingDir, "src", "remotion"), path.join(manifest.outputPath, "src", "remotion"), {
        recursive: true,
      });
      context.logger.log("Copied Remotion source files into the Trigger build image.");

      const systemFont = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
      // @vercel/og resolves its default font from the task image root
      // (/app/Geist-Regular.ttf), not from the package directory.
      const bundledFont = path.join(manifest.outputPath, "Geist-Regular.ttf");
      const bundledResvg = path.join(manifest.outputPath, "resvg.wasm");
      const sourceResvg = path.join(
        context.workingDir,
        "node_modules",
        "next",
        "dist",
        "compiled",
        "@vercel",
        "og",
        "resvg.wasm",
      );
      // Do not allow a worker image with missing rendering dependencies to
      // deploy successfully. Vercel READY does not validate Trigger task images.
      // The paths below are resolved by the image renderer at runtime.
      await access(systemFont);
      await mkdir(path.dirname(bundledFont), { recursive: true });
      await copyFile(systemFont, bundledFont);
      await access(bundledFont);
      context.logger.log("Verified Flux Social runtime font: /app/Geist-Regular.ttf");

      await access(sourceResvg);
      await copyFile(sourceResvg, bundledResvg);
      await access(bundledResvg);
      context.logger.log("Verified Flux Social runtime WASM: /app/resvg.wasm");
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
        commands?: string[];
        image: { instructions?: string[] };
      }) => void;
    }) {
      if (context.target === "dev") return;
      context.addLayer({
        id: "flux-social-runtime-assets",
        // Trigger 4.8.1 logs and swallows onBuildComplete exceptions. These
        // commands execute in /app after COPY and fail the actual image build.
        commands: [
          "test -s /app/Geist-Regular.ttf && test -s /app/resvg.wasm && sha256sum /app/Geist-Regular.ttf /app/resvg.wasm",
        ],
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
