import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const followups = await readFile(
  new URL("../app/api/limitless/maia/followups/route.ts", import.meta.url),
  "utf8",
);

test("Maia follow-ups require a recorded customer inbound message", () => {
  assert.match(followups, /latestCustomerMessageAt\(/);
  assert.match(followups, /no_customer_message_context/);
  assert.match(followups, /maia_inbound_events/);
  assert.match(followups, /external_conversation_id/);
});

test("Maia follow-ups cancel when the customer replied after scheduling", () => {
  assert.match(followups, /customer_replied_after_schedule/);
  assert.match(followups, /lastCustomerMessageMs >= scheduledMs/);
});

test("Maia follow-ups enforce the configured inactivity window", () => {
  assert.match(followups, /organization_follow_up_policies/);
  assert.match(followups, /inactivity_hours/);
  assert.match(followups, /DEFAULT_INACTIVITY_HOURS = 24/);
  assert.match(followups, /inactivity_window_not_reached/);
});

test("Maia follow-ups preserve opt-out and human-handoff hard stops", () => {
  assert.match(followups, /opted_out/);
  assert.match(followups, /ai_paused/);
  assert.match(followups, /human_handoff/);
  assert.match(followups, /status === "cancelled"|status: "cancelled"/);
});

test("Maia follow-ups remain tenant-scoped and protected", () => {
  assert.match(followups, /LIMITLESS_REALTY_SLUG = "limitless-realty"/);
  assert.match(followups, /verify_maia_scheduler_secret/);
  assert.match(followups, /\.eq\("organization_id", organization\.id\)/);
});

test("Maia follow-up guardrails do not introduce a second WhatsApp route", () => {
  assert.match(followups, /sendViaCanonicalMaia\(/);
  assert.doesNotMatch(followups, /graph\.facebook\.com/);
});
