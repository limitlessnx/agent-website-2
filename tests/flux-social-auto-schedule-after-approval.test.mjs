import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const reviewActions = readFileSync(new URL("../app/dashboard/social/review/actions.ts", import.meta.url), "utf8");
const social = readFileSync(new URL("../lib/social.ts", import.meta.url), "utf8");

test("automatic scheduling is downstream of explicit final review approval", () => {
  const approval = reviewActions.indexOf("await approveSocialPostReview(postId)");
  const schedule = reviewActions.indexOf("await scheduleSocialPost({");
  assert.ok(approval >= 0 && schedule > approval);
  assert.match(reviewActions, /post.status === "approved"/);
  assert.match(reviewActions, /brand.name === "Fluxknight"/);
});

test("do not activate other tenants or unsupported publishing destinations", () => {
  assert.match(reviewActions, /settings.auto_schedule_enabled !== false/);
  assert.match(reviewActions, /platforms.includes\("instagram"\)/);
  assert.match(reviewActions, /platforms: \["instagram"\]/);
  assert.match(social, /Only approved posts can be scheduled/);
  assert.match(social, /platform !== "instagram"/);
});

test("failed scheduling preserves approval and exposes recoverable error", () => {
  assert.match(reviewActions, /auto_schedule_status: "failed"/);
  assert.match(reviewActions, /auto_schedule_error: message/);
  assert.match(reviewActions, /eq\("status", "approved"\)/);
});

test("scheduled posts are future-dated and use Lagos preference", () => {
  assert.match(reviewActions, /preferred_publish_hour_lagos/);
  assert.match(reviewActions, /tomorrow.setUTCDate\(tomorrow.getUTCDate\(\) \+ 1\)/);
  assert.match(reviewActions, /timezone: "Africa\/Lagos"/);
  assert.match(social, /Past times cannot be scheduled/);
});
