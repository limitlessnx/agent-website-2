import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const worker = readFileSync(new URL("../src/trigger/social-carousel-renderer.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../lib/social-review.ts", import.meta.url), "utf8");

test("carousel background rendering retries rather than failing permanently once", () => {
  assert.match(worker, /id: "flux-social-render-carousel"/);
  assert.match(worker, /maxAttempts: 3/);
  assert.match(worker, /minTimeoutInMs: 5_000/);
  assert.match(worker, /carousel_render_status: "failed"/);
});

test("a failed carousel attempt cleans up only its own partial assets", () => {
  assert.match(worker, /const uploadedPaths: string\[\] = \[\]/);
  assert.match(worker, /const insertedAssetIds: string\[\] = \[\]/);
  assert.match(worker, /uploadedPaths\.push\(storagePath\)/);
  assert.match(worker, /insertedAssetIds\.push\(asset\.id\)/);
  assert.match(worker, /\.in\("id", insertedAssetIds\)/);
  assert.match(worker, /\.remove\(uploadedPaths\)/);
  assert.match(worker, /cleanupErrors/);
});

test("render may only commit active slides while the post is in review or draft", () => {
  assert.match(worker, /\.in\("status", \["draft", "review"\]\)\.select\("id"\)/);
  assert.match(worker, /updatedPosts\?\.length !== 1/);
  assert.match(worker, /carousel_asset_ids: ids/);
  assert.match(worker, /status: "review", approved_at: null/);
  assert.match(review, /Only posts currently in Review can be approved/);
  assert.match(review, /mediaAssets\.length !== mediaIds\.length/);
});
