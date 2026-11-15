import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, renderMedia } from "@remotion/renderer";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = "/workspace/reel-repair-preview";
await mkdir(output, { recursive: true });
const plan = JSON.parse(await readFile("tests/fixtures/flux-social-support-reel.json", "utf8"));
const logo = await readFile("public/fluxknight-mark.svg", "utf8");
const inputProps = { plan, logoUrl: `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`, brandName: "Fluxknight" };
const serveUrl = await bundle({ entryPoint: path.join(root, "src/remotion/index.tsx"),
  webpackOverride: (config) => ({ ...config, resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": root } } }),
});
const options = { serveUrl, inputProps, browserExecutable: "/usr/bin/chromium", chromiumOptions: { gl: "angle" } };
const composition = await selectComposition({ ...options, id: "FluxSocialReel" });
let cursor = 0;
for (let index = 0; index < plan.scenes.length; index++) {
  await renderStill({ ...options, composition, frame: cursor + Math.min(60, Math.round(plan.scenes[index].duration_seconds * 15)),
    output: `${output}/scene-${index + 1}.png`, imageFormat: "png" });
  cursor += Math.round(plan.scenes[index].duration_seconds * composition.fps);
}
if (process.argv.includes("--video")) await renderMedia({ ...options, composition, codec: "h264", crf: 24,
  outputLocation: `${output}/visual-preview.mp4`, concurrency: 2 });
console.log(JSON.stringify({ output, scenes: plan.scenes.length, frames: composition.durationInFrames }));
