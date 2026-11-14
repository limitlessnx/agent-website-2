import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("all post approvals require the media Preview route", () => {
  const social = read("lib/social.ts");
  const posts = read("app/dashboard/social/posts/page.tsx");
  const review = read("app/dashboard/social/review/page.tsx");
  assert.match(social, /Open Review & Approval to inspect the final media before approving/);
  assert.doesNotMatch(social, /review: \["draft", "approved"\]/);
  assert.match(posts, /Preview media & approve/);
  assert.doesNotMatch(posts, /status: "approved", label: "Approve"/);
  assert.match(review, /approveSocialPostReviewAction/);
  assert.match(review, /disabled=\{!approvalReady\}/);
});
