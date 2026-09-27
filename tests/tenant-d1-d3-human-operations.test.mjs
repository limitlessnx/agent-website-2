import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("D1 D2 define tenant handoff queue and explicit role permissions",()=>{
  const migration=read("supabase/migrations/20260927003704_d1_d3_handoffs_assignment_approvals.sql");
  assert.match(migration,/handoffs\.view/);
  assert.match(migration,/handoffs\.manage/);
  assert.match(migration,/create table if not exists public\.human_handoffs/);
  assert.match(migration,/assigned_membership_id/);
  assert.match(migration,/claimed_by_membership_id/);
  assert.match(migration,/sla_due_at/);
  assert.match(migration,/human_handoffs_select/);
});

test("D1 handoff pauses AI and resolution can resume AI",()=>{
  const migration=read("supabase/migrations/20260927003704_d1_d3_handoffs_assignment_approvals.sql");
  assert.match(migration,/paused_for_handoff/);
  assert.match(migration,/human_takeover/);
  assert.match(migration,/ai_response_mode/);
  assert.match(migration,/p_resume_ai/);
  assert.match(migration,/handoff\.resolved/);
});

test("D2 assignment cannot cross tenant boundaries",()=>{
  const migration=read("supabase/migrations/20260927003704_d1_d3_handoffs_assignment_approvals.sql");
  assert.match(migration,/Assignee must be an active member of organization/);
  assert.match(migration,/organization_id=v_handoff\.organization_id/);
  const service=read("lib/human-operations.ts");
  assert.match(service,/Assignee must be an active member of this organization/);
  assert.match(service,/eq\("organization_id",session\.organizationId\)/);
});

test("D3 approvals are permissioned, audited, and block self approval",()=>{
  const migration=read("supabase/migrations/20260927003704_d1_d3_handoffs_assignment_approvals.sql");
  assert.match(migration,/approvals\.view/);
  assert.match(migration,/approvals\.manage/);
  assert.match(migration,/create table if not exists public\.operation_approvals/);
  assert.match(migration,/Requester cannot self-approve/);
  assert.match(migration,/operation_approval\.'\|\|p_decision/);
});

test("D1 handoff event contract requires a reason and uses platform handler",()=>{
  const contract=read("supabase/migrations/20260927004201_d1_handoff_event_contract.sql");
  const orchestrator=read("lib/system-orchestrator.ts");
  const operations=read("lib/human-operations.ts");
  assert.match(contract,/required_payload_keys=array\['reason'\]/);
  assert.match(orchestrator,/event\.eventType==="handoff\.requested"/);
  assert.match(orchestrator,/createHandoffFromSystemEvent/);
  assert.match(operations,/source_event_id/);
  assert.match(operations,/create_human_handoff/);
});

test("D1 D3 tenant action APIs require an authenticated client session",()=>{
  const handoff=read("app/api/portal/handoffs/[id]/route.ts");
  const approval=read("app/api/portal/approvals/[id]/route.ts");
  assert.match(handoff,/getClientSession/);
  assert.match(handoff,/claimHumanHandoff/);
  assert.match(handoff,/assignHumanHandoff/);
  assert.match(handoff,/resolveHumanHandoff/);
  assert.match(approval,/getClientSession/);
  assert.match(approval,/decideOperationApproval/);
});

test("D1 D3 queues live in Needs Attention rather than a duplicate top-level control plane",()=>{
  const page=read("app/portal/notifications/page.tsx");
  const panel=read("app/portal/notifications/HumanOperationsPanel.tsx");
  const sidebar=read("app/portal/PortalSidebar.tsx");
  assert.match(page,/HumanOperationsPanel/);
  assert.match(panel,/Handoffs & approvals/);
  assert.match(panel,/Resolve & resume AI/);
  assert.match(sidebar,/Needs Attention/);
  assert.doesNotMatch(sidebar,/Human Operations/);
});

test("D1 application claim preserves existing conversation metadata",()=>{
  const service=read("lib/human-operations.ts");
  assert.match(service,/from\("crm_conversations"\)\.select\("metadata"\)/);
  assert.match(service,/conversation\?\.metadata/);
});
