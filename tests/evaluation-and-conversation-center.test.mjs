import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("evaluation inbox is tenant scoped and exposes a detail endpoint",()=>{
  const page=read("app/dashboard/evaluations/page.tsx");
  const helper=read("lib/evaluation-leads.ts");
  const route=read("app/api/evaluations/[id]/route.ts");
  assert.match(page,/getFluxknightPlatformOrganizationId/);
  assert.match(page,/getEvaluationLeads\(500, organizationId\)/);
  assert.match(helper,/organization_id=eq/);
  assert.match(helper,/getEvaluationLeadDetail/);
  assert.match(helper,/ai_business_evaluation_sessions/);
  assert.match(helper,/customer_timeline_events/);
  assert.match(route,/getFluxknightPlatformOrganizationId/);
  assert.match(route,/GET/);
  assert.match(route,/getEvaluationLeadDetail/);
});

test("evaluation detail keeps original session evidence and implementation opportunities",()=>{
  const helper=read("lib/evaluation-leads.ts");
  const manager=read("components/admin/EvaluationLeadsManager.tsx");
  assert.match(helper,/messages/);
  assert.match(helper,/implementation_opportunities/);
  assert.match(manager,/Original evaluation conversation/);
  assert.match(manager,/Business requirements \/ context/);
  assert.match(manager,/Requirements and follow-up history/);
  assert.match(manager,/Implementation plan/);
});

test("public Leo persistence and conversation center use public-source records",()=>{
  const migration=read("supabase/migrations/20261007193000_public_leo_session_storage.sql");
  const canonical=read("lib/canonical-customer.ts");
  const center=read("lib/organization-conversation-center.ts");
  const page=read("app/dashboard/conversations/page.tsx");
  assert.match(migration,/create table if not exists public\.leo_sessions/);
  assert.match(migration,/create table if not exists public\.leo_messages/);
  assert.match(canonical,/leo_sessions/);
  assert.match(center,/leo_public_leads/);
  assert.match(center,/source: "leo"/);
  assert.match(center,/maia-whatsapp-runtime/);
  assert.match(center,/gencouv_support_conversations/);
  assert.match(page,/Leo public conversations/);
  assert.match(page,/Maia client conversations/);
  assert.match(page,/Gencouv website conversations/);
  assert.match(page,/Internal dashboard conversations are deliberately excluded/);
});

test("conversation center does not read Fluxknight private support conversations as client Leo conversations",()=>{
  const center=read("lib/organization-conversation-center.ts");
  assert.doesNotMatch(center,/from\("support_conversations"\)/);
  assert.match(center,/from\("leo_public_leads"\)/);
});


test("evaluation session and approval are locked to the Fluxknight organization",()=>{const session=read("app/api/evaluation/session/route.ts");const approve=read("app/api/evaluation/approve/route.ts");assert.match(session,/getFluxknightPlatformOrganizationId/);assert.match(session,/organization_id:organizationId/);assert.match(session,/eq\("organization_id",organizationId\)/);assert.match(approve,/getFluxknightPlatformOrganizationId/);assert.match(approve,/eq\("organization_id",organizationId\)/);assert.match(approve,/organization_id:organizationId/);});

test("Gencouv conversation center is tenant scoped",()=>{const migration=read("supabase/migrations/20261008_gencouv_conversation_tenant_isolation.sql");const center=read("lib/organization-conversation-center.ts");assert.match(migration,/organization_id uuid/);assert.match(migration,/slug = 'gencouv'/);assert.match(migration,/set not null/);assert.match(center,/gencouvConversations\(admin, organizationId\)/);assert.match(center,/\.eq\("organization_id", organizationId\)/);});
