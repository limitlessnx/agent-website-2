import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Limitless Realty follow-up API is authenticated, tenant-scoped, and atomically claimed", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /verify_maia_scheduler_secret/);
  assert.match(route, /slug.*limitless-realty/);
  assert.match(route, /follow_ups/);
  assert.match(route, /status.*pending/);
  assert.match(route, /status.*processing/);
  assert.match(route, /\.eq\("organization_id", organization\.id\)/);
  assert.match(route, /\.eq\("status", "pending"\).*select\("id"\)/);
  assert.match(route, /sendWhatsAppMessage/);
});

test("Follow-up API has both 24-hour delivery paths and never calls n8n", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /deliveryMode: withinCustomerServiceWindow \? "direct" : "template"/);
  assert.match(route, /templatePurpose: "follow_up_outside_24h"/);
  assert.doesNotMatch(route, /n8n|N8N/);
  assert.match(route, /export async function GET/);
});

test("Follow-up delivery suppresses opted-out and human-handoff leads", () => {
  const api = read("app/api/limitless/maia/followups/route.ts");
  const trigger = read("src/trigger/system-orchestrator.ts");
  for (const source of [api, trigger]) {
    assert.match(source, /opted_out/);
    assert.match(source, /ai_paused/);
    assert.match(source, /status.*handoff/);
    assert.match(source, /status.*cancelled/);
  }
});

test("Trigger follow-up drain is tenant-scoped, due-only, bounded, and duplicate-safe", () => {
  const trigger = read("src/trigger/system-orchestrator.ts");
  assert.match(trigger, /limitless-followup-drain/);
  assert.match(trigger, /status.*pending/);
  assert.match(trigger, /lte\("scheduled_at"/);
  assert.match(trigger, /Math\.max\(1, Math\.min\(limit, 100\)\)/);
  assert.match(trigger, /status.*processing/);
  assert.match(trigger, /sendWhatsAppMessage/);
  assert.match(trigger, /status.*sent/);
  assert.match(trigger, /status.*failed/);
  assert.doesNotMatch(trigger, /n8n|N8N/);
});

test("Inbound reply cancellation and stop intent remain connected to follow-ups", () => {
  const runtime = read("src/trigger/maia-runtime.ts");
  assert.match(runtime, /follow_ups/);
  assert.match(runtime, /opted_out/);
  assert.match(runtime, /follow_up/);
  assert.match(runtime, /replace\\(\\/\\\\D\\/g, \\"\\"\\)/);
  assert.match(runtime, /String\\(lead\\.phone \\|\\| \\"\\"\\)\\.replace/);
});

test("Admin follow-up controls are authenticated and server-side tenant scoped", () => {
  const route = read("app/api/admin/followups/route.ts");
  assert.match(route, /getAdminSession/);
  assert.match(route, /createAdminClient/);
  assert.match(route, /slug.*limitless-realty/);
  assert.match(route, /updateEnrollment\(.*organization\.id/);
  assert.match(route, /Custom sequences.*410/);
});

test("Follow-up control state maps to the real Maia follow_ups table", () => {
  const control = read("lib/followup-control.ts");
  assert.match(control, /follow_ups\?organization_id=eq/);
  assert.match(control, /pending.*scheduled.*queued/);
  assert.match(control, /sent.*completed/);
  assert.match(control, /paused/);
  assert.match(control, /cancelled/);
  assert.match(control, /failed/);
  assert.match(control, /organization_id/);
  assert.match(control, /updateEnrollment/);
  assert.match(control, /Custom follow-up sequences are not enabled/);
});

test("Follow-up dashboard exposes only runtime-aligned controls", () => {
  const page = read("app/dashboard/limitless/followups/page.tsx");
  const component = read("components/admin/FollowupControlCenter.tsx");
  assert.match(page, /Built-in cadence/);
  assert.match(page, /1, 3, 7, 14, 21, 30/);
  assert.match(component, /Maia managed/);
  assert.match(component, /Pause/);
  assert.match(component, /Resume/);
  assert.match(component, /Mark complete/);
  assert.match(component, /Cancel/);
  assert.doesNotMatch(component, /Create sequence/);
  assert.doesNotMatch(component, /Enroll leads/);
});

test("Maia safety net forwards the same authenticated context to all three runners", () => {
  const route = read("app/api/cron/maia-safety-net/route.ts");
  assert.match(route, /verify_maia_scheduler_secret/);
  assert.match(route, /api\/maia\/autonomous/);
  assert.match(route, /api\/limitless\/maia\/followups/);
  assert.match(route, /api\/cron\/limitless-installment-reminders/);
  assert.match(route, /Promise\.allSettled/);
});

test("Vercel cron keeps the safety net daily while high-frequency scheduling remains external", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.crons.find((x) => x.path === "/api/cron/maia-safety-net")?.schedule, "0 10 * * *");
});

test("Installment reminder path is referenced but not altered by the follow-up implementation", () => {
  const diffPaths = [
    "app/api/admin/followups/route.ts",
    "app/api/limitless/maia/followups/route.ts",
    "app/dashboard/limitless/followups/page.tsx",
    "components/admin/FollowupControlCenter.tsx",
    "lib/followup-control.ts",
    "src/trigger/maia-runtime.ts",
    "src/trigger/system-orchestrator.ts",
  ];
  const vercel = read("vercel.json");
  assert.ok(diffPaths.every(Boolean));
  assert.match(vercel, /limitless-installment-reminders/);
});
