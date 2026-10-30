import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Limitless Realty follow-up API is authenticated, tenant-scoped, and atomically claimed", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /verify_maia_scheduler_secret/);
  assert.match(route, /LIMITLESS_REALTY_SLUG = \"limitless-realty\"/);
  assert.match(route, /follow_ups/);
  assert.match(route, /status.*pending/);
  assert.match(route, /status.*processing/);
  assert.match(route, /\.eq\("organization_id", organization\.id\)/);
  assert.match(route, /admin\.rpc\("claim_limitless_maia_followup_step"/);
  assert.match(route, /admin\.rpc\("authorize_limitless_maia_followup_send"/);
  assert.match(route, /p_claim_token: claimToken/);
  assert.match(route, /sendWhatsAppMessage/);
});

test("Follow-up API uses the 24-hour direct path only for a verified customer window and strict approved templates outside it", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /getRealEstateDirectWindowLastInboundAt/);
  assert.match(route, /deliveryMode: withinCustomerServiceWindow \? "direct" : "template"/);
  assert.match(route, /lastCustomerMessageAt,/);
  assert.match(route, /FOLLOWUP_TEMPLATE_PURPOSE = "follow_up_outside_24h"/);
  assert.match(route, /templatePurpose: FOLLOWUP_TEMPLATE_PURPOSE/);
  assert.match(route, /strictTemplateContract: \{ approvedVariableOrder:/);
  assert.match(route, /follow_up_outside_24h/);
  assert.doesNotMatch(route, /n8n|N8N/);
  assert.match(route, /export async function GET/);
});

test("Strict Limitless template contract blocks blank variables, missing order metadata, and order mismatches before provider fetch", () => {
  const helper = read("lib/whatsapp-delivery.ts");
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /strictTemplateContract: \{ approvedVariableOrder:/);
  assert.match(route, /No objection recorded/);
  assert.match(route, /Location details not listed/);
  assert.match(helper, /strictLimitlessLookup/);
  assert.match(helper, /approved_variable_order/);
  assert.match(helper, /validVariableKeys\(approvedOrder\).*validVariableKeys\(configuredKeys\).*validVariableKeys\(approvedMetadata\)/s);
  assert.match(helper, /exactVariableOrder\(configuredKeys, approvedOrder\).*exactVariableOrder\(approvedMetadata, approvedOrder\)/s);
  assert.match(helper, /configuredKeys\.some\(\(key\) => String\(input\.variables\?\.\[key\] \?\? ""\)\.trim\(\) === ""\)/);
  const validationCall = helper.indexOf("validateStrictTemplateContract(config, input)");
  const providerFetch = helper.indexOf("fetch(`https://graph.facebook.com", validationCall);
  assert.ok(validationCall >= 0, "strict validation must be called");
  assert.ok(providerFetch > validationCall, "strict validation must precede provider delivery");
});

test("Canonical follow-ups suppress opt-out but do not pause on normal reply or human handoff", () => {
  const api = read("app/api/limitless/maia/followups/route.ts");
  const trigger = read("src/trigger/system-orchestrator.ts");
  assert.match(api, /sequence\.consent_state !== "opted_in"/);
  assert.match(api, /lead\?\.opted_out/);
  assert.match(api, /customer_opted_out/);
  assert.doesNotMatch(api, /ai_paused|human_handoff_active|status.*handoff|customer\.replied|human\.handoff/);
  assert.match(trigger, /\.is\("sequence_id", null\)/);
  assert.match(trigger, /id: "limitless-followup-drain"/);
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

test("Inbound STOP uses shared Nigerian phone normalization and one tenant-scoped opt-out transaction", () => {
  const runtime = read("src/trigger/maia-runtime.ts");
  const contract = read("lib/limitless-followup-contract.ts");
  const migration = read("supabase/migrations/20261030191816_limitless_maia_followup_sequence_identity.sql");
  assert.match(runtime, /admin\.rpc\("record_limitless_maia_opt_out"/);
  assert.doesNotMatch(runtime, /\.from\("follow_ups"\)\.update/);
  assert.doesNotMatch(runtime, /\.from\("limitless_maia_followup_sequences"\)\.update/);
  assert.match(runtime, /opted_out/);
  assert.match(runtime, /normalizeLimitlessPhone\(rawPhone\)/);
  assert.match(runtime, /limitlessPhoneCandidates\(rawPhone\)/);
  assert.match(runtime, /uniqueLimitlessPhoneMatchId\(normalizedMatches\)/);
  assert.match(runtime, /\.eq\("organization_id", payload\.organizationId\)\s*\.in\("phone", phoneVariants\)/);
  assert.match(contract, /event_type:\s*FollowupConsentEventType/);
  assert.match(migration, /create or replace function public\.record_limitless_maia_opt_out/);
  assert.match(migration, /status='opted_out', consent_state='opted_out'/);
  assert.match(migration, /processing' and send_authorized_at is null/);
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
  const migration = read("supabase/migrations/20261030191816_limitless_maia_followup_sequence_identity.sql");
  assert.match(control, /follow_ups\?organization_id=eq/);
  assert.match(control, /pending.*scheduled.*queued/);
  assert.match(control, /sent.*completed/);
  assert.match(control, /paused/);
  assert.match(control, /cancelled/);
  assert.match(control, /failed/);
  assert.match(control, /organization_id/);
  assert.match(control, /updateEnrollment/);
  assert.match(control, /rpc\/control_limitless_maia_followup_sequence/);
  assert.match(migration, /create or replace function public\.control_limitless_maia_followup_sequence/);
  assert.match(control, /Custom follow-up sequences are not enabled/);
});

test("Follow-up dashboard exposes only runtime-aligned controls", () => {
  const page = read("app/dashboard/limitless/followups/page.tsx");
  const component = read("components/admin/FollowupControlCenter.tsx");
  assert.match(page, /Built-in cadence/);
  assert.match(page, /1, 3, 7, 14, 21, 30/);
  assert.match(component, /Client-property follow-ups/);
  assert.match(component, /Safe error summary/);
  assert.match(component, /delivery attempts/);
  assert.match(component, /Pause sequence/);
  assert.match(component, /Resume sequence/);
  assert.match(component, /Stop sequence/);
  assert.match(component, /Close deal/);
  assert.match(component, /Customer opt-out is active/);
  assert.match(component, /Needs review/);
  assert.doesNotMatch(component, /Create sequence/);
  assert.doesNotMatch(component, /Enroll leads/);
});

test("Maia safety net forwards to existing runners and gates inspections behind the verified external scheduler", () => {
  const route = read("app/api/cron/maia-safety-net/route.ts");
  assert.match(route, /verify_maia_scheduler_secret/);
  assert.match(route, /api\/maia\/autonomous/);
  assert.match(route, /api\/limitless\/maia\/followups/);
  assert.match(route, /api\/cron\/limitless-installment-reminders/);
  assert.match(route, /externalSchedulerAuthorized\) tasks\.push\(\{ task: "real-estate-inspections"/);
  assert.match(route, /api\/cron\/real-estate-inspections/);
  assert.match(route, /daily Vercel fallback does not dispatch property-inspection reminders/);
  assert.match(route, /Promise\.allSettled/);
});

test("Vercel cron keeps the safety net daily while high-frequency scheduling remains external", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.crons.find((x) => x.path === "/api/cron/maia-safety-net")?.schedule, "0 10 * * *");
});
