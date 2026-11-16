#!/usr/bin/env node
/**
 * Render one approved Fluxknight brand film manifest to MP4.
 * Example: node scripts/render-fluxknight-brand-film.mjs ./brand-film.json ./brand-film.mp4
 * The manifest must contain approved HTTPS logo, narration and scene media URLs.
 * Keep signed URLs in an untracked local file; never commit them.
 */
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { getVideoMetadata, renderMedia, selectComposition } from "@remotion/renderer";

const [manifestPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !outputPath) {
  console.error("Usage: node scripts/render-fluxknight-brand-film.mjs manifest.json output.mp4");
  process.exit(2);
}
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const https = (s) => typeof s === "string" && s.startsWith("https://");
if (!https(manifest.logoUrl)) throw new Error("Approved canonical Fluxknight logo URL is required.");
if (!Array.isArray(manifest.scenes) || manifest.scenes.length < 2) throw new Error("At least two approved scenes are required.");
const ids = manifest.scenes.map((s) => s.id);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate scene ID.");
for (const scene of manifest.scenes) {
  if (!scene.id || !scene.title || !(scene.durationSeconds > 0) || !Number.isFinite(scene.durationSeconds))
    throw new Error("Invalid scene metadata.");
  if (!https(scene.mediaUrl) || !["video", "image"].includes(scene.mediaType))
    throw new Error(`Scene ${scene.id} is missing approved visual footage.`);
  if (!https(scene.narrationUrl)) throw new Error(`Scene ${scene.id} is missing its narration clip.`);
}
if (manifest.musicUrl && !https(manifest.musicUrl)) throw new Error("Background music must be an approved HTTPS asset.");
const entryPoint = resolve("src/remotion/index.tsx");
const serveUrl = await bundle({ entryPoint });
const composition = await selectComposition({ serveUrl, id: "FluxknightBrandFilm", inputProps: manifest });
const outputLocation = resolve(outputPath);
await renderMedia({
  composition, serveUrl, inputProps: manifest, outputLocation,
  codec: "h264", crf: 19, x264Preset: "veryfast",
  concurrency: 1, logLevel: "warn",
});
const [metadata, file] = await Promise.all([getVideoMetadata(outputLocation), stat(outputLocation)]);
if (!metadata.audioCodec || metadata.audioCodec === "unknown" || file.size < 20_000)
  throw new Error("Output validation failed: missing audio or unusually small MP4.");
if (metadata.durationInSeconds == null || Math.abs(metadata.durationInSeconds - composition.durationInFrames / composition.fps) > 1.2)
  throw new Error("Output duration does not match storyboard.");
console.log(JSON.stringify({ outputLocation, durationSeconds: metadata.durationInSeconds, bytes: file.size, width: composition.width, height: composition.height }));
