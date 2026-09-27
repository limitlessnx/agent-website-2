import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("A7 tenant navigation exposes canonical resources only",()=>{
  const sidebar=read("app/portal/PortalSidebar.tsx");
  for(const href of ["/portal/customers","/portal/conversations","/portal/systems","/portal/appointments","/portal/analytics","/portal/team","/portal/support","/portal/settings"]){
    assert.match(sidebar,new RegExp(href.replaceAll("/","\\/")));
  }
  for(const legacy of ["/portal/marketplace","/portal/agents","/portal/runtime","/portal/execution"]){
    assert.doesNotMatch(sidebar,new RegExp(legacy.replaceAll("/","\\/")));
  }
});

test("A7 tenant routes are permission and installed-system driven",()=>{
  const access=read("lib/portal-access.ts");
  assert.match(access,/getOrganizationAccessContext/);
  assert.match(access,/organization_systems/);
  assert.match(access,/appointment-system/);
  assert.match(access,/customers\.view/);
  assert.match(access,/conversations\.view/);
  assert.match(access,/analytics\.view/);
  assert.match(access,/members\.view/);
});

test("A7 hides legacy tenant control planes behind redirects",()=>{
  const expected=[
    ["app/portal/agents/page.tsx","/portal/systems"],
    ["app/portal/marketplace/page.tsx","/portal/systems"],
    ["app/portal/runtime/page.tsx","/portal/systems"],
    ["app/portal/execution/page.tsx","/portal/conversations"],
  ];
  for(const [path,target] of expected){
    const file=read(path);
    assert.match(file,/redirect\(/);
    assert.match(file,new RegExp(target.replaceAll("/","\\/")));
  }
});

test("A7 Super Admin navigation is organized around canonical control planes",()=>{
  const nav=read("components/admin/navigationConfig.ts");
  for(const label of ["Overview","Clients","Systems","Operations","Billing","Security"]){
    assert.match(nav,new RegExp(`label:"${label}"`));
  }
  assert.doesNotMatch(nav,/label:"Retention"/);
  assert.doesNotMatch(nav,/label:"Growth"/);
  assert.doesNotMatch(nav,/label:"Usage & Value"/);
});

test("A8 Tenant Super Leo is globally mounted and organization scoped",()=>{
  const layout=read("app/portal/layout.tsx");
  const leo=read("components/portal/TenantLeoFloatingButton.tsx");
  assert.match(layout,/LeoConversationProvider/);
  assert.match(layout,/TenantLeoFloatingButton/);
  assert.match(leo,/Tenant Super Leo/);
  assert.match(leo,/locked to this organization/i);
});

test("A8 Tenant Super Leo uses live A3 permissions rather than role-only authority",()=>{
  const core=read("lib/leo-core.ts");
  assert.match(core,/getOrganizationAccessContext/);
  assert.match(core,/permissions\?: string\[\]/);
  assert.match(core,/TENANT_TOOL_PERMISSIONS/);
  assert.match(core,/requiredPermissions\) return tenantHasAnyPermission/);
  const supportPolicy=read("lib/leo-support-policy.ts");
  assert.match(supportPolicy,/getOrganizationAccessContext/);
  assert.match(supportPolicy,/permissions: \[\.\.\.access\.permissions\]/);
});

test("A8 Tenant Super Leo diagnostics are permission filtered and critical issues escalate",()=>{
  const context=read("lib/leo-context.ts");
  const support=read("app/api/support/leo/route.ts");
  assert.match(context,/permissionScope/);
  assert.match(context,/canAgents/);
  assert.match(context,/canIntegrations/);
  assert.match(context,/canWorkflows/);
  assert.match(support,/escalationRequired/);
  assert.match(support,/super-admin-support/);
  assert.match(support,/tenant-super-leo/);
});

test("A9 Super Admin Leo keeps global reads but requires exact tenant target for consequential writes",()=>{
  const route=read("app/api/leo/tool/route.ts");
  assert.match(route,/requireSuperAdminOrganizationTarget/);
  assert.match(route,/Super Admin Leo requires an explicit organization_id/);
  assert.match(route,/!tool\.readOnly/);
  assert.match(route,/super_admin_target_context_resolved/);
  assert.match(route,/organization_id/);
});

test("A8 and A9 support surfaces use the defined Leo roles",()=>{
  assert.match(read("app/portal/support/page.tsx"),/Tenant Super Leo/);
  assert.match(read("app/dashboard/support/page.tsx"),/Super Admin Leo/);
});
