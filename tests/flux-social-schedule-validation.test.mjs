import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Flux Social schedule requires a future time and explicit destination", () => {
  const social = read("lib/social.ts");
  assert.match(social, /scheduledAt\.getTime\(\) <= Date\.now\(\)/);
  assert.match(social, /Past times cannot be scheduled/);
  assert.match(social, /\[\.\.\.new Set\(input\.platforms \|\| \[\]\)\]/);
  assert.match(social, /Select Instagram before scheduling this post/);
  assert.doesNotMatch(social, /const publishPlatforms = requestedPlatforms\.length/);
  assert.match(social, /platform !== "instagram"/);
});

test("Flux Social does not claim Facebook auto-sharing is guaranteed", () => {
  const posts = read("app/dashboard/social/posts/page.tsx");
  assert.match(posts, /Facebook delivery depends on your Instagram-to-Facebook sharing settings/);
});
