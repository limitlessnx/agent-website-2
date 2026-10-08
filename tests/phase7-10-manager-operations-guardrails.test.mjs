import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("Phase 7: portal capabilities are permission-derived",()=>{
  const access=read("lib/portal-access.ts");
  assert.match(access,/getOrganizationAccessContext/);
  assert.match(access,/customers\.view/);
  assert.match(access,/conversations\.reply/);
  assert.match(access,/systems\.manage/);
  assert.match(access,/members\.manage/);
  assert.match(access,/analytics\.view/);
  assert.match(access,/billing\.manage/);
  assert.match(access,/support\.escalate/);
  assert.match(access,/requirePortalPermission/);
});

test("Phase 7: team access mutations remain organization-scoped and manager-only for removal",()=>{
  const route=read("app/api/portal/team/access-requests/route.ts");
  assert.match(route,/session\.organizationId/);
  assert.match(route,/members\.manage/);
  assert.match(route,/target\.role!==\"manager\"/);
  assert.match(route,/p_organization_id:\s*session\.organizationId/);
  assert.match(route,/p_actor_user_id:\s*session\.userId/);
  assert.match(route,/p_status:\s*\"removed\"/);
});

test("Phase 8: customer reads and stage mutations cannot cross tenants",()=>{
  const page=read("app/portal/customers/page.tsx");
  const detail=read("app/portal/customers/[id]/page.tsx");
  const route=read("app/api/portal/customers/[id]/stage/route.ts");
  assert.match(page,/crm_customers\?organization_id=eq/);
  assert.match(detail,/crm_customers\?organization_id=eq/);
  assert.match(detail,/customer_identity_conflicts\?organization_id=eq/);
  assert.match(route,/customers\.manage/);
  assert.match(route,/p_organization_id:session\.organizationId/);
  assert.match(route,/p_customer_id:id/);
});

test("Phase 9: Maia handoff operations require explicit handoff permissions",()=>{
  const service=read("lib/human-operations.ts");
  const route=read("app/api/portal/handoffs/[id]/route.ts");
  assert.match(service,/handoffs\.view/);
  assert.match(service,/handoffs\.manage/);
  assert.match(service,/assertAnyOrganizationPermission/);
  assert.match(service,/eq\(\"organization_id\",session\.organizationId\)/);
  assert.match(route,/claimHumanHandoff/);
  assert.match(route,/assignHumanHandoff/);
  assert.match(route,/resolveHumanHandoff/);
});

test("Phase 9: handoff assignment validates active membership inside the same tenant",()=>{
  const service=read("lib/human-operations.ts");
  assert.match(service,/Assignee must be an active member of this organization/);
  assert.match(service,/organization_memberships/);
  assert.match(service,/eq\(\"organization_id\",input\.organizationId\)/);
  assert.match(service,/eq\(\"status\",\"active\"\)/);
});

test("Phase 10: system requests require systems.manage before provisioning",()=>{
  const route=read("app/api/portal/systems/request/route.ts");
  assert.match(route,/getOrganizationAccessContext/);
  assert.match(route,/assertAnyOrganizationPermission\(access, \[\"systems\.manage\"\]\)/);
  assert.match(route,/getMarketplaceSystem\(slug, profile\?\.industry\)/);
  assert.match(route,/requestOrganizationSystem\(session\.organizationId, session\.userId, system\)/);
});

test("Phase 10: workflow requests remain industry-gated and tenant-scoped",()=>{
  const systems=read("lib/client-systems.ts");
  assert.match(systems,/getClientOnboardingProfile\(organizationId\)/);
  assert.match(systems,/allowed\.includes\(industry\)/);
  assert.match(systems,/organization_id: organizationId/);
  assert.match(systems,/requested_by: userId/);
  assert.match(systems,/status: \"awaiting_approval\"/);
});

test("Phases 7-10 keep the portal navigation capability-gated",()=>{
  const sidebar=read("app/portal/PortalSidebar.tsx");
  assert.match(sidebar,/capabilities\.customers/);
  assert.match(sidebar,/capabilities\.conversations/);
  assert.match(sidebar,/capabilities\.systems/);
  assert.match(sidebar,/capabilities\.appointments/);
  assert.match(sidebar,/capabilities\.analytics/);
  assert.match(sidebar,/capabilities\.team/);
});
