import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("D4 customer stages are organization scoped and auditable",()=>{
  const migration=read("supabase/migrations/20260927011048_d4_handoff_continuity_stages_notifications.sql");
  assert.match(migration,/organization_customer_stages/);
  assert.match(migration,/customer_stage_history/);
  assert.match(migration,/update_customer_stage/);
  assert.match(migration,/unique\(organization_id,key\)/);
});

test("D4 handoff continuity stores summary stage next action and follow-up state",()=>{
  const migration=read("supabase/migrations/20260927011048_d4_handoff_continuity_stages_notifications.sql");
  assert.match(migration,/conversation_summary/);
  assert.match(migration,/stage_id_at_handoff/);
  assert.match(migration,/next_action/);
  assert.match(migration,/follow_up_required/);
  assert.match(migration,/follow_up_status/);
});

test("D4 AI can request handoff and update tenant-defined customer stages",()=>{
  const core=read("lib/leo-core.ts");
  const executors=read("lib/ai-runtime/production-executors.ts");
  assert.match(core,/flux\.system\.handoff\.request/);
  assert.match(core,/flux\.system\.customer\.stage\.update/);
  assert.match(executors,/eventType: "handoff\.requested"/);
  assert.match(executors,/update_customer_stage/);
});

test("D4 handoff assignment resolves rules agent destination and staff notifications",()=>{
  const operations=read("lib/human-operations.ts");
  assert.match(operations,/handoff_assignment_rules/);
  assert.match(operations,/human_handoff_destination/);
  assert.match(operations,/organization_member_notification_preferences/);
  assert.match(operations,/deliveryMode:"direct"/);
  assert.match(operations,/recipientType:"internal_staff"/);
  assert.doesNotMatch(operations,/templatePurpose:"internal_handoff"/);
  assert.doesNotMatch(operations,/templatePurpose:"follow_up_outside_24h"/);
  assert.match(operations,/conversation_summary/);
});

test("D4 WhatsApp runtime suppresses AI while human owns the conversation",()=>{
  const runtime=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(runtime,/paused_for_handoff/);
  assert.match(runtime,/human_takeover/);
  assert.match(runtime,/aiResponseSuppressed:true/);
  assert.match(runtime,/"stopped"/);
});

test("D4 WhatsApp coexistence echoes record human replies and activate takeover",()=>{
  const webhook=read("app/api/whatsapp/webhook/route.ts");
  const coexistence=read("lib/whatsapp-coexistence.ts");
  assert.match(webhook,/smb_message_echoes/);
  assert.match(webhook,/message_echoes/);
  assert.match(webhook,/recordWhatsAppBusinessAppEcho/);
  assert.match(coexistence,/senderType:"human"/);
  assert.match(coexistence,/ai_response_mode:"human_takeover"/);
  assert.match(coexistence,/whatsapp_business_app/);
});

test("D4 post-handoff check-in remains callable while automatic schedules are paused",()=>{
  const followup=read("lib/handoff-followup.ts");
  const trigger=read("src/trigger/system-orchestrator.ts");
  assert.match(followup,/lastCustomerMessageAt/);
  assert.match(followup,/deliveryMode:"auto"/);
  assert.match(followup,/templatePurpose:"handoff_follow_up"/);
  assert.match(followup,/handoff_follow_up/);
  assert.match(trigger,/id: "handoff-followup-drain"/);
  assert.doesNotMatch(trigger,/schedules\.task/);
});

test("D4 customer and handoff settings are tenant-managed in existing portal surfaces",()=>{
  const customer=read("app/portal/customers/[id]/page.tsx");
  const settings=read("app/portal/settings/page.tsx");
  const handoffPanel=read("app/portal/settings/HandoffContinuityPanel.tsx");
  const stagePanel=read("app/portal/settings/CustomerStagesPanel.tsx");
  assert.match(customer,/CustomerStageControl/);
  assert.match(settings,/CustomerStagesPanel/);
  assert.match(settings,/HandoffContinuityPanel/);
  assert.match(handoffPanel,/Assignment rules/);
  assert.match(stagePanel,/Customer stages/);
});

test("D4 Needs Attention shows structured handoff context and explicit AI resume choice",()=>{
  const panel=read("app/portal/notifications/HumanOperationsPanel.tsx");
  assert.match(panel,/Summary:/);
  assert.match(panel,/Next action:/);
  assert.match(panel,/Assigned to:/);
  assert.match(panel,/Resolve & resume AI/);
  assert.match(panel,/Resolve & keep AI off/);
});

test("D4 WhatsApp readiness detects coexistence instead of assuming API-only",()=>{
  const integration=read("lib/whatsapp-integration.ts");
  const ui=read("components/integrations/WhatsAppIntegrationPanel.tsx");
  assert.match(integration,/is_on_biz_app/);
  assert.match(integration,/platform_type/);
  assert.match(integration,/coexistenceActive/);
  assert.match(ui,/coexistence/);
});


test("D4 dashboard handoff keeps WhatsApp communication external to Maia",()=>{
  const page=read("app/portal/conversations/[id]/page.tsx");
  const operations=read("lib/human-operations.ts");
  assert.match(page,/Human communication remains external to Maia after handoff/);
  assert.match(page,/Human handoff/);
  assert.match(operations,/notifyHandoffAssignee/);
  assert.match(operations,/notifyWhatsApp:true/);
  assert.doesNotMatch(page,/HumanWhatsAppComposer/);
  assert.doesNotMatch(page,/Send on WhatsApp/);
});

test("D4 WhatsApp system tools carry canonical conversation context for handoff",()=>{
  const runtime=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(runtime,/conversation_id:conversationId/);
  assert.match(runtime,/customerStage:continuity\.customerStage/);
  assert.match(runtime,/lastHumanHandoff:continuity\.lastHumanHandoff/);
});

test("D4 new organizations automatically receive default customer stages",()=>{
  const migration=read("supabase/migrations/20260927012333_d4_future_organization_customer_stages.sql");
  assert.match(migration,/seed_customer_stages_on_organization_insert/);
  assert.match(migration,/seed_default_customer_stages/);
});

test("D4 stage history uses exact inserted history id for timeline linkage",()=>{
  const migration=read("supabase/migrations/20260927012456_d4_stage_history_exact_timeline_link.sql");
  assert.match(migration,/returning id into v_history_id/);
  assert.match(migration,/v_history_id/);
});


test("D4 Maia handoff stores a structured customer context contract and exposes it in the portal",()=>{
  const operations=read("lib/human-operations.ts");
  const panel=read("app/portal/notifications/HumanOperationsPanel.tsx");
  const conversation=read("app/portal/conversations/[id]/page.tsx");
  assert.match(operations,/structured_handoff/);
  assert.match(operations,/customerIntent/);
  assert.match(operations,/customerQuestions/);
  assert.match(operations,/requestedDate/);
  assert.match(operations,/availability/);
  assert.match(panel,/structured.customerIntent/);
  assert.match(panel,/structured.property/);
  assert.match(conversation,/Customer context/);
  assert.match(conversation,/Key points/);
  assert.match(conversation,/Customer questions/);
});

test("D4 Maia handoff contract keeps AI takeover and tenant isolation explicit",()=>{
  const operations=read("lib/human-operations.ts");
  const runtime=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(operations,/eq\("organization_id",event.organizationId\)/);
  assert.match(operations,/active_handoff_id/);
  assert.match(runtime,/human_takeover/);
  assert.match(runtime,/aiResponseSuppressed:true/);
});


test("D4 staff handoff WhatsApp alerts use direct internal messaging",()=>{
  const operations=read("lib/human-operations.ts");
  const delivery=read("lib/whatsapp-delivery.ts");
  const settings=read("app/portal/settings/HandoffContinuityPanel.tsx");
  assert.match(operations,/deliveryMode:"direct"/);
  assert.match(operations,/recipientType:"internal_staff"/);
  assert.match(delivery,/recipientType === "customer" \? outsideCustomerWindow/);
  assert.match(delivery,/Message text is required while the 24-hour service window is open/);
  assert.ok(settings.includes("direct internal messaging"));
  assert.doesNotMatch(operations,/templatePurpose:"internal_handoff"/);
});
