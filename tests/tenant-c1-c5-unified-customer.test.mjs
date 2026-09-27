import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("C1 canonical customer identity uses tenant-scoped identifiers and conflict review",()=>{
  const migration=read("supabase/migrations/20260927000230_c1_c5_unified_customer_conversation_timeline.sql");
  assert.match(migration,/customer_identifiers/);
  assert.match(migration,/unique\(organization_id,identifier_type,normalized_value\)/);
  assert.match(migration,/resolve_crm_customer/);
  assert.match(migration,/Provided identifiers resolve to different customers/);
  assert.match(migration,/customer_identity_conflicts/);
  assert.match(migration,/status','conflict'/);
});

test("C2 canonical conversations use CRM conversation and message tables",()=>{
  const migration=read("supabase/migrations/20260927000230_c1_c5_unified_customer_conversation_timeline.sql");
  const helper=read("lib/canonical-customer.ts");
  assert.match(migration,/get_or_create_crm_conversation/);
  assert.match(helper,/crm_messages/);
  assert.match(helper,/externalThreadId/);
  assert.match(helper,/externalMessageId/);
});

test("C3 timeline receives messages appointments and tasks",()=>{
  const base=read("supabase/migrations/20260927000230_c1_c5_unified_customer_conversation_timeline.sql");
  const tasks=read("supabase/migrations/20260927000632_c3_c5_customer_task_timeline_identity_review.sql");
  assert.match(base,/crm_message_customer_timeline/);
  assert.match(base,/appointment_customer_timeline/);
  assert.match(tasks,/crm_task_customer_timeline/);
  assert.match(base,/customer_timeline_events/);
});

test("C3 tenant customer detail page reads unified timeline and conversations",()=>{
  const page=read("app/portal/customers/[id]/page.tsx");
  assert.match(page,/customer_timeline_events/);
  assert.match(page,/crm_conversations/);
  assert.match(page,/Unified timeline/);
});

test("C4 Public Leo lead capture links to canonical CRM and backfills history",()=>{
  const leads=read("lib/leo-public-leads.ts");
  const helper=read("lib/canonical-customer.ts");
  const route=read("app/api/leo/public/route.ts");
  assert.match(leads,/canonicalizePublicLeoLead/);
  assert.match(helper,/backfillPublicLeoConversation/);
  assert.match(helper,/public-leo-message:/);
  assert.match(route,/syncPublicLeoMessage/);
});

test("C4 website evaluation uses service client and canonical CRM",()=>{
  const route=read("app/api/evaluation/route.ts");
  assert.match(route,/createAdminClient/);
  assert.match(route,/canonicalizeEvaluationLead/);
  assert.doesNotMatch(route,/SUPABASE_ANON_KEY/);
  assert.doesNotMatch(route,/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("C4 tenant WhatsApp runtime uses canonical customer and conversation services",()=>{
  const runtime=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(runtime,/resolveCanonicalCustomer/);
  assert.match(runtime,/getOrCreateCanonicalConversation/);
  assert.match(runtime,/addCanonicalCrmMessage/);
  assert.match(runtime,/whatsapp-inbound:/);
});

test("C5 identity conflicts are manage-only and visible for human review",()=>{
  const migration=read("supabase/migrations/20260927000632_c3_c5_customer_task_timeline_identity_review.sql");
  const page=read("app/portal/customers/page.tsx");
  assert.match(migration,/customers\.manage/);
  assert.match(page,/Identity review/);
  assert.match(page,/does not silently merge/);
});
