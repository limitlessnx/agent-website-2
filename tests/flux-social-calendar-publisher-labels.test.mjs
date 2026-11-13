import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Flux Social calendar identifies mock jobs without presenting them as published", () => {
  const page = read("app/dashboard/social/calendar/page.tsx");
  const social = read("lib/social.ts");
  assert.match(page, /job\.metadata\?\.publisher === "mock-v1"/);
  assert.match(page, /simulated test/);
  assert.match(page, /do not confirm a live social-media post/);
  assert.match(social, /export type SocialPublishJob = \{/);
  assert.match(social, /metadata: Record<string, unknown>;/);
});
