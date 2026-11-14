import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("review displays media before editing or approving", () => {
  const page = read("app/dashboard/social/review/page.tsx");
  assert.ok(page.indexOf('className={styles.previewColumn}') < page.indexOf('className={styles.editorColumn}'));
  assert.match(page, /1\. Review generated media/);
  assert.match(page, /2\. Final decision/);
  assert.match(page, /disabled=\{!approvalReady\}/);
  assert.match(page, /createSocialAssetSignedUrl/);
  assert.match(page, /<CarouselMediaPreview/);
  assert.match(page, /<video controls/);
});

test("review never calls a partial carousel a complete preview", () => {
  const page = read("app/dashboard/social/review/page.tsx");
  assert.match(page, /activeCarouselIds\.length >= 2/);
  assert.match(page, /new Set\(activeCarouselIds\)\.size === activeCarouselIds\.length/);
  assert.match(page, /carouselAssets\.length === activeCarouselIds\.length/);
  assert.match(page, /visibleCarouselAssets\.length === activeCarouselIds\.length/);
});

test("review shows images, story assets and thumbnails as appropriate", () => {
  const page = read("app/dashboard/social/review/page.tsx");
  assert.match(page, /\["image", "thumbnail", "story"\]\.includes\(asset\.asset_type\)/);
  const readiness = read("lib/social-review.ts");
  assert.match(readiness, /mediaAssets\.length !== mediaIds\.length/);
  assert.match(readiness, /createSignedUrl\(asset\.storage_path, 300\)/);
});
