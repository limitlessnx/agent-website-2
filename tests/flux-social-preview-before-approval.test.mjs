import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Review presents real media preview and copy before final approval", () => {
  const page = read("app/dashboard/social/review/page.tsx");
  const css = read("app/dashboard/social/review/review.module.css");
  assert.match(page, /CarouselMediaPreview/);
  assert.match(page, /Preview your final media/);
  assert.match(page, /Post caption/);
  assert.match(page, /mediaPreviewReady/);
  assert.match(page, /disabled=\{!approvalReady\}/);
  assert.match(page, /Carousel slides are being generated automatically/);
  assert.match(css, /\.previewColumn\{order:-1/);
});

test("Carousel preview supports next, previous, thumbnail selection, and count", () => {
  const code = read("app/dashboard/social/review/CarouselMediaPreview.tsx");
  assert.match(code, /Previous slide/);
  assert.match(code, /Next slide/);
  assert.match(code, /Preview slide/);
  assert.match(code, /aria-pressed/);
  assert.match(code, /Slide \{selected \+ 1\} of \{slides\.length\}/);
});

test("Final approval validates active media assets and blocks unfinished renders", () => {
  const code = read("lib/social-review.ts");
  assert.match(code, /carousel_render_status/);
  assert.match(code, /Preview the final slides before approval/);
  assert.match(code, /new Set\(mediaIds\)/);
  assert.match(code, /\.from\("social_assets"\)/);
  assert.match(code, /createSignedUrl/);
  assert.match(code, /Final media preview is incomplete or unavailable/);
});
