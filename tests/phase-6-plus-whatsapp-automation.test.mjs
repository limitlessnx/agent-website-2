import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

test("Phase 6 scheduling is gated by the Plus follow-up entitlement", () => {
  const service = read("lib/ai/limitless-realty-maia.ts");
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(service, /assertFluxFeatureAccess/);
  assert.match(service, /"follow_ups"/);
  assert.match(route, /assertFluxFeatureAccess/);
  assert.match(route, /"follow_ups"/);
  assert.match(route, /status: 409/);
});

test("Phase 6 meters every delivered WhatsApp follow-up separately", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /reserveFluxCredits/);
  assert.match(route, /whatsapp_follow_up_reminder/);
  assert.match(route, /source: "whatsapp_follow_up"/);
  assert.match(route, /followup_id/);
  assert.match(route, /credits: metering\.credits/);
});

test("Phase 6 installment reminders use the same Plus gate and Flux Credit action", () => {
  const runtime = read("lib/limitless-installment-reminder-runtime.ts");
  assert.match(runtime, /assertFluxFeatureAccess/);
  assert.match(runtime, /"reminders"/);
  assert.match(runtime, /reminders_not_included_in_plan/);
  assert.match(runtime, /reserveFluxCredits/);
  assert.match(runtime, /source: "installment_reminder"/);
  assert.match(runtime, /reminder_attempt_id/);
});

test("Phase 6 follow-up drain remains tenant-scoped and duplicate-safe", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /LIMITLESS_REALTY_SLUG/);
  assert.match(route, /lte\("scheduled_at"/);
  assert.match(route, /status.*pending/);
  assert.match(route, /status.*processing/);
  assert.match(route, /\.eq\("organization_id", organization\.id\)/);
  assert.match(route, /\.eq\("status", "pending"\)\.select\("id"\)/);
});

test("Phase 6 suppresses opted-out and human-handoff contacts", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /opted_out/);
  assert.match(route, /ai_paused/);
  assert.match(route, /status.*handoff/);
  assert.match(route, /status: "cancelled"/);
});

test("Phase 6 keeps the same WhatsApp agent and does not create a second agent", () => {
  const service = read("lib/ai/limitless-realty-maia.ts");
  assert.match(service, /queueLimitlessFollowup/);
  assert.match(service, /follow_ups/);
  assert.doesNotMatch(service, /insert\(.*agents/);
});
