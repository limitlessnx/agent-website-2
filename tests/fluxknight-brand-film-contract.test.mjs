import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("landscape film exists independently of vertical reel", () => {
  const root = read("src/remotion/index.tsx");
  assert.match(root, /id="FluxknightBrandFilm"/);
  assert.match(root, /width=\{1920\}/);
  assert.match(root, /height=\{1080\}/);
  assert.match(root, /id="FluxSocialReel"/);
  assert.match(root, /width=\{1080\}/);
  assert.match(root, /height=\{1920\}/);
});
test("uses approved brand identity and actual media inputs rather than fabricated dashboard captures", () => {
  const film = read("src/remotion/FluxknightBrandFilm.tsx");
  const renderer = read("scripts/render-fluxknight-brand-film.mjs");
  assert.match(film, /logoUrl/);
  assert.match(film, /actual-product/);
  assert.match(film, /OffthreadVideo/);
  assert.match(film, /narrationUrl/);
  assert.match(renderer, /missing approved visual footage/);
  assert.match(renderer, /missing its narration clip/);
  assert.match(renderer, /getVideoMetadata/);
  assert.match(renderer, /audioCodec/);
});
test("existing Reel renderer remains in its own task", () => {
  const worker = read("src/trigger/social-reel-renderer.ts");
  assert.match(worker, /id: "FluxSocialReel"/);
  assert.match(worker, /flux-social-render-reel/);
});
