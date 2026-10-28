import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import load from "./helpers/load-typescript.cjs";

const read = (path) => readFileSync(path, "utf8");
const contract = load("lib/limitless-followup-contract.ts", {}, "export { qualifyLimitlessFollowup, isNonTerminalFollowupEvent, isAllowedFollowupControl, assertExactFollowupTarget, consentEvent, sequenceScopeKey, followupOutboundIdempotencyKey, followupErrorSummary, normalizeLimitlessPhone, limitlessPhoneCandidates, uniqueLimitlessPhoneMatchId, isExplicitLimitlessOptInMessage, uniqueRenewalPropertyId };");
const policyHelpers = load("lib/follow-up-policy.ts", { "@/lib/supabase/admin": { createAdminClient: () => ({}) } }, "export { DEFAULT_FOLLOW_UP_POLICY, computeInitialFollowUpDueAt, computeSequenceStepDueAt };");

const identity = {
  organization_id: "b15f21b4-5697-4d21-9421-8a34eae3476d",
  customer_id: "customer-1",
  lead_id: "lead-1",
  property_id: "property-1",
  sequence_id: "sequence-1",
};

test("qualification requires explicit opt-in, meaningful conversation, specific property interest, and excludes campaign-only contacts", () => {
  assert.equal(JSON.stringify(contract.qualifyLimitlessFollowup({ explicitOptIn: false, meaningfulConversation: true, specificPropertyInterest: "property-1", campaignOnly: false })), JSON.stringify({ eligible: false, reasons: ["explicit_opt_in_required"] }));
  assert.equal(JSON.stringify(contract.qualifyLimitlessFollowup({ explicitOptIn: true, meaningfulConversation: false, specificPropertyInterest: "property-1", campaignOnly: false })), JSON.stringify({ eligible: false, reasons: ["meaningful_conversation_required"] }));
  assert.equal(JSON.stringify(contract.qualifyLimitlessFollowup({ explicitOptIn: true, meaningfulConversation: true, specificPropertyInterest: "", campaignOnly: false })), JSON.stringify({ eligible: false, reasons: ["specific_property_interest_required"] }));
  assert.equal(JSON.stringify(contract.qualifyLimitlessFollowup({ explicitOptIn: true, meaningfulConversation: true, specificPropertyInterest: "property-1", campaignOnly: true })), JSON.stringify({ eligible: false, reasons: ["campaign_only_excluded"] }));
  assert.equal(contract.qualifyLimitlessFollowup({ explicitOptIn: true, meaningfulConversation: true, specificPropertyInterest: "property-1", campaignOnly: false }).eligible, true);
});

test("ordinary reply, viewing, purchase progress, handoff, and status changes are non-terminal", () => {
  for (const event of ["customer.replied", "viewing.booked", "appointment.booked", "purchase.started", "purchase.progressed", "human.handoff", "lead.status_changed", "lead.won", "lead.lost"]) assert.equal(contract.isNonTerminalFollowupEvent(event), true, event);
});

test("exact controls reject missing property scope and ambiguous retry is not an allowed lifecycle event", () => {
  assert.throws(() => contract.assertExactFollowupTarget({ organization_id: identity.organization_id, customer_id: identity.customer_id, sequence_id: identity.sequence_id, actor: "admin-1", reason: "pause" }), /property scope/);
  assert.doesNotThrow(() => contract.assertExactFollowupTarget({ ...identity, step_id: "step-1", actor: "admin-1", reason: "pause requested by operator" }));
  assert.equal(contract.isAllowedFollowupControl("retry"), true);
  assert.equal(contract.isAllowedFollowupControl("close"), true);
  assert.equal(contract.isAllowedFollowupControl("mass_cancel"), false);
});

test("opt-out and re-opt-in are explicit audited events; a normal reply cannot synthesize consent", () => {
  const optOut = contract.consentEvent({ identity, event_type: "opt_out", source: "maia_whatsapp_inbound", actor: "customer:customer-1" });
  assert.equal(optOut.event_type, "opt_out");
  assert.equal(optOut.source, "maia_whatsapp_inbound");
  assert.equal(optOut.actor, "customer:customer-1");
  const reOptIn = contract.consentEvent({ identity: { ...identity, sequence_id: "new-sequence-2" }, event_type: "opt_in", source: "maia_whatsapp_inbound", actor: "customer:customer-1" });
  assert.notEqual(reOptIn.sequence_id, optOut.sequence_id);
  assert.equal(contract.sequenceScopeKey({ ...identity, sequence_key: "maia_limitless_property_sales_followup_v1" }), `${identity.organization_id}:${identity.customer_id}:${identity.property_id}:maia_limitless_property_sales_followup_v1`);
});

test("a direct request for updates about a specific property is valid renewed consent without purchase phrasing", () => {
  assert.equal(contract.isExplicitLimitlessOptInMessage("Please keep me updated about Palm Grove Estate."), true);
  assert.equal(contract.isExplicitLimitlessOptInMessage("I like Palm Grove Estate."), false);
  assert.equal(contract.isExplicitLimitlessOptInMessage("STOP messaging me."), false);
  assert.equal(contract.uniqueRenewalPropertyId([{ property_id: "property-1" }, { property_id: "property-1" }]), "property-1");
  assert.equal(contract.uniqueRenewalPropertyId([{ property_id: "property-1" }, { property_id: "property-2" }]), null);
  assert.equal(contract.uniqueRenewalPropertyId([{ property_id: null }]), null);
  const trigger = read("src/trigger/maia-runtime.ts");
  const api = read("app/api/limitless/maia/route.ts");
  assert.match(trigger, /if\s*\(explicitOptIn\s*&&\s*customerId\)/);
  assert.match(trigger, /specificPropertyMentioned:\s*propertyMentioned/);
  assert.doesNotMatch(trigger, /propertyMentioned\s*&&\s*buyingIntent\s*&&\s*explicitOptIn/);
  assert.match(api, /isExplicitLimitlessOptInMessage\(message\)/);
  assert.match(api, /hasQualifiedPropertyInterest\(message, propertyContext, explicitOptIn\)/);
  assert.match(api, /if\s*\(!handoff\s*&&\s*explicitOptIn\)/);
  assert.match(api, /specificPropertyMentioned/);
});

test("Maia creates the active sequence, opt-in audit, and six steps through one transactional enrollment RPC", () => {
  const enrollment = read("lib/ai/limitless-realty-maia.ts");
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  const trigger = read("src/trigger/maia-runtime.ts");
  const api = read("app/api/limitless/maia/route.ts");
  assert.match(enrollment, /admin\.rpc\("create_limitless_maia_followup_sequence"/);
  assert.match(enrollment, /p_renewed_consent: renewedConsent/);
  assert.match(enrollment, /explicitRenewedConsent/);
  assert.match(enrollment, /specificPropertyMentioned === true/);
  assert.match(enrollment, /uniqueRenewalPropertyId\(priorSequences/);
  assert.match(enrollment, /\.eq\("status", "opted_out"\)/);
  assert.match(enrollment, /limitlessPhoneCandidates\(args\.customerPhone/);
  assert.match(enrollment, /uniqueLimitlessPhoneMatchId\(normalizedMatches\)/);
  assert.doesNotMatch(enrollment, /from\("limitless_maia_followup_sequences"\)\.insert/);
  assert.doesNotMatch(enrollment, /from\("limitless_maia_followup_events"\)\.insert/);
  assert.match(trigger, /explicitRenewedConsent: explicitOptIn/);
  assert.match(trigger, /admin\.rpc\("record_limitless_maia_opt_out"/);
  assert.doesNotMatch(trigger, /\.from\("follow_ups"\)\.update/);
  assert.match(api, /explicitRenewedConsent:\s*explicitOptIn/);
  assert.doesNotMatch(trigger, /payload:\s*\{\s*eventId,\s*result:\s*followup/);
  assert.match(migration, /jsonb_array_length\(p_steps\) <> 6/);
  assert.match(migration, /'opt_in'/);
  assert.match(migration, /'renewed_consent', p_renewed_consent/);
  assert.match(migration, /tenant_customer_contacts c[\s\S]*?c\.organization_id = p_organization_id and c\.id = p_customer_id/);
  assert.match(migration, /grant execute on function public\.create_limitless_maia_followup_sequence/);
});

test("Limitless STOP phone identity normalizes local/international variants inside the exact tenant", () => {
  const canonical = "2348123456789";
  for (const phone of ["08123456789", "+234 08123456789", "002348123456789"]) {
    assert.equal(contract.normalizeLimitlessPhone(phone), canonical);
    assert.ok(contract.limitlessPhoneCandidates(phone).includes(canonical));
  }
  const trigger = read("src/trigger/maia-runtime.ts");
  assert.match(trigger, /const phone = normalizeLimitlessPhone\(rawPhone\)/);
  assert.match(trigger, /const phoneVariants = limitlessPhoneCandidates\(rawPhone\)/);
  assert.match(trigger, /\.eq\("organization_id", payload\.organizationId\)\s*\.in\("phone", phoneVariants\)/);
  assert.match(trigger, /normalizeLimitlessPhone\(lead\.phone\) === phone/);
  assert.match(trigger, /uniqueLimitlessPhoneMatchId\(normalizedMatches\)/);
  assert.equal(contract.uniqueLimitlessPhoneMatchId([{ id: "lead-1" }]), "lead-1");
  assert.throws(() => contract.uniqueLimitlessPhoneMatchId([{ id: "lead-1" }, { id: "lead-2" }]), /multiple lead records/);
});

test("canonical Limitless drain uses follow_ups sequence rows only and does not cancel on normal reply or handoff", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  const legacyDrain = read("src/trigger/system-orchestrator.ts");
  assert.match(route, /sequence_id/);
  assert.match(route, /customer_id/);
  assert.match(route, /property_id/);
  assert.match(route, /\.not\("sequence_id", "is", null\)/);
  assert.match(legacyDrain, /\.is\("sequence_id", null\)/);
  assert.match(route, /claim_token/);
  assert.match(route, /admin\.rpc\("claim_limitless_maia_followup_step"/);
  assert.match(route, /admin\.rpc\("authorize_limitless_maia_followup_send"/);
  assert.match(route, /status.*processing/);
  assert.match(route, /ambiguous.*not retried automatically/i);
  assert.doesNotMatch(route, /agent_runtime_goals/);
  assert.doesNotMatch(route, /crm_tasks/);
  assert.doesNotMatch(route, /human_handoff|customer_replied|appointment_booked/);
});

test("Limitless controls are exact-scope, audited, and lifecycle events are non-terminal", () => {
  const control = read("app/api/internal/runtime/follow-up/control/route.ts");
  const helper = read("lib/followup-control.ts");
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  assert.match(control, /customer_id/);
  assert.match(control, /property_id/);
  assert.match(control, /sequence_id/);
  assert.match(control, /step_id/);
  assert.match(control, /reason/);
  assert.match(control, /actor/);
  assert.match(control, /non_terminal_followup_event/);
  assert.match(control, /admin\.rpc\("control_limitless_maia_followup_sequence"/);
  assert.match(control, /record_limitless_maia_opt_out/);
  assert.doesNotMatch(control, /\.from\("follow_ups"\)\.update/);
  assert.match(helper, /rpc\/control_limitless_maia_followup_sequence/);
  assert.match(migration, /status='stopped'/);
  assert.match(migration, /An opted-out sequence cannot be resumed/);
  assert.match(migration, /insert into public\.limitless_maia_followup_events/);
  assert.match(migration, /for update/);
  assert.match(control, /eventType === "admin\.close" \? "close"/);
  assert.match(migration, /deal_closed/);
  assert.doesNotMatch(control, /crm_tasks/);
});

test("dashboard shows property, consent, pause/close reasons and attempts without displaying raw provider details", () => {
  const control = read("components/admin/FollowupControlCenter.tsx");
  const summary = read("lib/followup-control.ts");
  assert.match(control, /Customer opted out/);
  assert.match(control, /Close deal/);
  assert.match(control, /error_summary/);
  assert.match(control, /Attempts/);
  assert.match(summary, /followupErrorSummary\(row\.last_error\)/);
  assert.doesNotMatch(summary, /last_error: row\.last_error/);
});

test("dashboard marks unknown provider outcomes for review without making them retryable", () => {
  const control = read("components/admin/FollowupControlCenter.tsx");
  assert.match(control, /const warningStatuses = new Set\(\["failed", "error", "blocked", "unknown"\]\)/);
  assert.match(control, /warningStatuses\.has\(String\(entry\.status\)\.toLowerCase\(\)\) \? "warning" : "live"/);
  assert.match(control, /item\.status === "failed" \? <button[^>]*>.*Retry failed step/s);
  assert.doesNotMatch(control, /item\.status === "unknown"[^\n]*Retry/);
});

test("dashboard filters by canonical sequence and consent state and hides controls without a property identity", () => {
  const control = read("components/admin/FollowupControlCenter.tsx");
  assert.match(control, /function statusFilterKey\(item: FollowupEnrollment\)/);
  assert.match(control, /item\.sequence_status === "opted_out" \|\| item\.consent_state === "opted_out"/);
  assert.match(control, /item\.sequence_status === "stopped"/);
  assert.match(control, /item\.sequence_status === "completed" && item\.stop_reason === "deal_closed"/);
  assert.match(control, /item\.status === "unknown" \|\| item\.consent_state === "unknown"/);
  assert.match(control, /statusFilterKey\(entry\) === statusFilter/);
  assert.match(control, /Boolean\(item\.customer_id && item\.property_id\)/);
});

test("drain cleanup leaves send-authorized in-flight steps for provider-result persistence", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.equal((route.match(/\.is\("send_authorized_at", null\)/g) || []).length, 3);
});

test("closing one client-property sequence never mutates a sibling property sequence", async () => {
  const calls = [];
  const supabaseServerRequest = async (path, init = {}) => {
    calls.push({ path, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (path === "rpc/control_limitless_maia_followup_sequence" && init.method === "POST") {
      return { sequence_status: "completed", changed: [{ id: "step-a", status: "cancelled", scheduled_at: "2026-10-28T09:30:00.000Z" }] };
    }
    return [];
  };
  const controls = load("lib/followup-control.ts", {
    "@/lib/supabase-server-rest": { isServerSupabaseConfigured: () => true, supabaseServerRequest },
    "@/lib/limitless-data": { LIMITLESS_REALTY_ORGANIZATION_ID: identity.organization_id },
    "@/lib/limitless-followup-contract": { followupErrorSummary: () => null },
  }, "export { updateEnrollment };");
  await controls.updateEnrollment({ organizationId: identity.organization_id, customerId: identity.customer_id, propertyId: "property-a", sequenceId: "sequence-a", stepId: "step-a", action: "close", reason: "deal_closed", actor: "admin:test" });
  const mutationCalls = calls.filter((call) => call.method === "POST");
  assert.equal(mutationCalls.length, 1);
  assert.equal(mutationCalls[0].path, "rpc/control_limitless_maia_followup_sequence");
  assert.equal(mutationCalls[0].body.p_organization_id, identity.organization_id);
  assert.equal(mutationCalls[0].body.p_customer_id, identity.customer_id);
  assert.equal(mutationCalls[0].body.p_property_id, "property-a");
  assert.equal(mutationCalls[0].body.p_sequence_id, "sequence-a");
  assert.equal(mutationCalls[0].body.p_step_id, "step-a");
  assert.equal(mutationCalls[0].body.p_action, "close");
  assert.equal(JSON.stringify(mutationCalls[0].body).includes("property-b"), false);
});

test("Limitless Maia no longer auto-cancels pending steps on inbound activity and does not enqueue runtime goals", () => {
  const api = read("app/api/limitless/maia/route.ts");
  const trigger = read("src/trigger/maia-runtime.ts");
  assert.doesNotMatch(api, /cancelPendingFollowupsForInbound/);
  assert.doesNotMatch(api, /\.from\("follow_ups"\).*update/);
  assert.doesNotMatch(trigger, /agent_runtime_goals/);
  assert.match(trigger, /customer_opted_out/);
  assert.match(trigger, /admin\.rpc\("record_limitless_maia_opt_out"/);
  assert.doesNotMatch(trigger, /\.from\("limitless_maia_followup_sequences"\)\.update/);
});

test("legacy CRM-task follow-up routes refuse the Limitless tenant", () => {
  for (const path of ["app/api/internal/runtime/follow-up/advance/route.ts", "app/api/internal/runtime/follow-up/due/route.ts", "app/api/internal/runtime/follow-up/sync-sales/route.ts"]) {
    assert.match(read(path), /b15f21b4-5697-4d21-9421-8a34eae3476d/);
    assert.match(read(path), /crm_tasks/);
    assert.match(read(path), /Limitless.*follow.?ups/i);
  }
});

test("Limitless schedule honors Africa/Lagos preferred send time and the configured day cadence", () => {
  const policy = { ...policyHelpers.DEFAULT_FOLLOW_UP_POLICY, timezone: "Africa/Lagos", preferred_send_time: "10:30" };
  const anchor = "2026-10-01T23:45:00.000Z";
  const initial = policyHelpers.computeInitialFollowUpDueAt(policy, anchor);
  const laterAnchor = new Date(Date.parse(anchor) + 24 * 60 * 60 * 1000).toISOString();
  const day3 = policyHelpers.computeSequenceStepDueAt(policy, laterAnchor, 2);
  const localParts = (value) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  const firstLocal = localParts(initial);
  const thirdLocal = localParts(day3);
  assert.ok(Date.parse(initial) >= Date.parse(anchor) + 24 * 60 * 60 * 1000);
  assert.equal(`${firstLocal.hour}:${firstLocal.minute}`, "10:30");
  assert.equal(`${thirdLocal.hour}:${thirdLocal.minute}`, "10:30");
  assert.equal(`${thirdLocal.year}-${thirdLocal.month}-${thirdLocal.day}`, "2026-10-05");

  const nurturePolicy = { ...policy, sequence: [{ step: 1, day: 15 }] };
  const nurture = policyHelpers.computeSequenceStepDueAt(nurturePolicy, "2026-10-27T09:30:00.000Z", 1);
  const nurtureLocal = localParts(nurture);
  assert.equal(`${nurtureLocal.hour}:${nurtureLocal.minute}`, "10:30");
  assert.equal(`${nurtureLocal.year}-${nurtureLocal.month}-${nurtureLocal.day}`, "2026-11-10");
});

test("day-30 success creates the same-sequence nurture step at the preferred time 14 local days after sent_at", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  const ai = read("lib/ai/limitless-realty-maia.ts");
  assert.match(route, /const DAY_30_STAGE = 6/);
  assert.match(route, /row\.stage < DAY_30_STAGE/);
  assert.match(route, /const sequenceStepKey = `nurture:\$\{row\.id\}`/);
  assert.match(route, /const dueAt = computeSequenceStepDueAt\(nurturePolicy, sentAt, 1\)/);
  assert.match(route, /sequence: \[\{ step: 1, day: 15 \}\]/);
  assert.match(route, /status: sequence\.status === "paused" \? "paused" : "pending"/);
  assert.match(route, /due_at: dueAt/);
  assert.match(route, /confirmSuccessfulFollowup\(admin, rawRow, claimToken, sentAt\)/);
  assert.match(ai, /sequence_step_key: `day-\$\{days\}`/);
  assert.match(ai, /due_at: scheduledAt/);
  assert.match(ai, /computeInitialFollowUpDueAt\(policy, sequenceStartedAt\)/);
  assert.match(ai, /computeSequenceStepDueAt\(policy, laterStepAnchor, index \+ 1\)/);
});

test("nurture success advances one step and schedules the next 14-day check-in", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /stage: row\.stage \+ 1/);
  assert.match(route, /sequence_id: row\.sequence_id/);
  assert.match(route, /scheduled_at: dueAt/);
  assert.match(route, /template_name: FOLLOWUP_TEMPLATE_PURPOSE/);
  assert.match(route, /resolveFollowUpPolicy\(row\.organization_id, LIMITLESS_REALTY_SLUG\)/);
  assert.match(route, /computeSequenceStepDueAt\(nurturePolicy, sentAt, 1\)/);
});

test("rolling nurture creation is idempotent and uses the approved variable order", () => {
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  const route = read("app/api/limitless/maia/followups/route.ts");
  const ai = read("lib/ai/limitless-realty-maia.ts");
  assert.match(migration, /limitless_maia_followup_sequence_step_key_unique/);
  assert.match(migration, /sequence_id, sequence_step_key/);
  assert.match(route, /if \(!isUniqueViolation\(inserted\.error\)\)/);
  assert.match(route, /\.eq\("sequence_step_key", sequenceStepKey\)/);
  assert.match(route, /templatePurpose: FOLLOWUP_TEMPLATE_PURPOSE/);
  assert.match(route, /customer_name: String\(lead\?\.name \|\| ""\)/);
  assert.match(route, /last_topic: String\(property\.title \|\| "your property enquiry"\)/);
  assert.match(route, /property_name:/);
  assert.match(route, /property_location:/);
  assert.match(route, /customer_interest:/);
  assert.match(route, /customer_goal:/);
  assert.match(route, /objection:/);
  assert.doesNotMatch(ai, /maia_limitless_followup_day/);
});

test("only explicit opt-out or exact admin stop/close can cancel an active sequence", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  assert.match(route, /sequence\.status === "opted_out"/);
  assert.match(route, /\["stopped", "closed", "completed"\]\.includes/);
  assert.match(route, /admin_stop_or_close/);
  assert.doesNotMatch(route, /followupStopReason/);
  assert.doesNotMatch(route, /customer\.replied|appointment\.booked|human\.handoff|lead\.status_changed/);
  assert.match(migration, /natural day-30 completion is not a terminal event/);
  assert.match(migration, /return new;/);
});

test("new sequence and event tables are RLS-protected from browser roles", () => {
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /limitless_canonical_followups_server_only[\s\S]*?as restrictive[\s\S]*?organization_id is distinct from/);
  assert.match(migration, /revoke all on table public\.limitless_maia_followup_sequences from public, anon, authenticated/);
  assert.match(migration, /revoke all on table public\.limitless_maia_followup_events from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.limitless_maia_followup_sequences to service_role/);
  assert.match(migration, /grant select, insert on table public\.limitless_maia_followup_events to service_role/);
});

test("canonical follow-up send requires the exact tenant property and explicit current consent", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  const ai = read("lib/ai/limitless-realty-maia.ts");
  assert.match(route, /sequence\.property_id !== rawRow\.property_id/);
  assert.match(route, /sequence\.lead_id !== rawRow\.lead_id/);
  assert.match(route, /sequence\.consent_state !== "opted_in"/);
  assert.match(route, /!sequence\.consent_at \|\| !sequence\.consent_source \|\| !sequence\.consent_actor/);
  assert.match(route, /\.eq\("organization_id", organization\.id\)[\s\S]*?\.eq\("id", rawRow\.property_id\)/);
  assert.match(ai, /specificPropertyInterest: propertyId/);
  assert.match(ai, /property_not_found_in_organization/);
});

test("explicit failed retries get a new idempotency key but persistence recovery reuses the accepted key", () => {
  const args = { organizationId: identity.organization_id, sequenceId: identity.sequence_id, stepId: "step-1" };
  const base = `limitless-followup:${args.organizationId}:${args.sequenceId}:${args.stepId}`;
  assert.equal(contract.followupOutboundIdempotencyKey({ ...args, attempt: 1 }), base);
  assert.equal(contract.followupOutboundIdempotencyKey({ ...args, attempt: 2, lastError: "HTTP 400: explicit rejection" }), `${base}:attempt:2`);
  assert.equal(contract.followupOutboundIdempotencyKey({ ...args, attempt: 2, lastError: "Provider-confirmed send requires persistence retry: database timeout" }), base);
  assert.match(read("app/api/limitless/maia/followups/route.ts"), /followupOutboundIdempotencyKey\(/);
});

test("provider errors are sanitized and scheduled responses omit customer, sequence and provider identifiers", () => {
  const summary = contract.followupErrorSummary("Meta template rejection for fake-recipient with fake-token");
  assert.equal(summary, "WhatsApp template was rejected or is not configured.");
  assert.doesNotMatch(summary, /fake-recipient|fake-token/);
  const route = read("app/api/limitless/maia/followups/route.ts");
  assert.match(route, /followupErrorSummary\(error\)/);
  assert.match(route, /status_counts: statusCounts/);
  assert.doesNotMatch(route, /return NextResponse\.json\(\{ ok: true, processed: results\.length, results \}\)/);
});

test("ambiguous provider errors are non-retryable and dashboard Stop ends the exact sequence", () => {
  const route = read("app/api/limitless/maia/followups/route.ts");
  const admin = read("app/api/admin/followups/route.ts");
  const controls = read("lib/followup-control.ts");
  const migration = read("supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql");
  const ui = read("components/admin/FollowupControlCenter.tsx");
  assert.match(route, /explicitlyRejectedByProvider\(error\) \? "failed" : "unknown"/);
  assert.match(admin, /actor:`admin:\$\{String\(session\.email/);
  assert.match(controls, /rpc\/control_limitless_maia_followup_sequence/);
  assert.match(migration, /status='stopped'/);
  assert.match(migration, /An opted-out sequence cannot be resumed/);
  assert.match(migration, /insert into public\.limitless_maia_followup_events/);
  assert.match(ui, /customer_id:\s*item\.customer_id/);
  assert.match(ui, /property_id:\s*item\.property_id/);
  assert.match(ui, /request\("stop",\s*item/);
  assert.match(ui, /Stop sequence/);
});
