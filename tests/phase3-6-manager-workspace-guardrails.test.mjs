import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("Phase 3 payment lifecycle remains tenant scoped and installment-only for reminders",()=>{
 const actions=read("app/dashboard/limitless/payments/actions.ts");
 const payments=read("lib/limitless-payments.ts");
 const cron=read("app/api/cron/limitless-installment-reminders/route.ts");
 assert.match(actions,/resolveScope/);
 assert.match(actions,/organization_id: organizationId/);
 assert.match(actions,/\.eq\("organization_id", organizationId\)/);
 assert.match(payments,/payment_plans\?organization_id=eq/);
 assert.match(payments,/payment_records\?organization_id=eq/);
 assert.match(cron,/payment_type/);
 assert.match(cron,/installment/);
});

test("Phase 4 manager workspace requires a signed manager session",()=>{
 const page=read("app/manage-organizations/page.tsx");
 const route=read("app/api/client-auth/manager-access/route.ts");
 const client=read("app/manage-organizations/ManagerOrganizationsClient.tsx");
 assert.match(page,/getManagerSession/);
 assert.ok(page.includes('redirect("/account/login")'));
 assert.match(route,/getManagerSession/);
 assert.match(route,/Manager session required/);
 assert.match(client,/Organization Access ID/);
 assert.match(client,/Request Access/);
 assert.match(client,/Enter Workspace/);
});

test("Phase 5 manager approval, removal and entry are organization scoped",()=>{
 const teamRoute=read("app/api/portal/team/access-requests/route.ts");
 const managerRoute=read("app/api/client-auth/manager-access/route.ts");
 const sql=read("supabase/migrations/20261005_manager_account_access_mvp.sql");
 assert.match(teamRoute,/session\.organizationId/);
 assert.match(teamRoute,/p_organization_id:session\.organizationId/);
 assert.match(teamRoute,/p_status:"removed"/);
 assert.match(managerRoute,/getMembershipForOrganization\(session\.userId,organizationId\)/);
 assert.match(sql,/organization_id = v_request\.organization_id/);
 assert.match(sql,/organization_id = v_request\.organization_id/);
});

test("Phase 5 removal invalidates workspace entry without deleting the user account",()=>{
 const auth=read("lib/client-auth.ts");
 const route=read("app/api/portal/team/access-requests/route.ts");
 assert.match(auth,/status=eq\.active/);
 assert.match(auth,/if\(!live\)return null/);
 assert.match(route,/p_status:"removed"/);
 assert.doesNotMatch(route,/delete.*auth/i);
});

test("Phase 6 manager workspace exposes only active organizations belonging to the manager",()=>{
 const auth=read("lib/client-auth.ts");
 const layout=read("app/portal/layout.tsx");
 const switcher=read("app/portal/ManagerWorkspaceSwitcher.tsx");
 assert.match(auth,/getActiveManagerOrganizations/);
 assert.match(auth,/user_id=eq\./);
 assert.match(auth,/status=eq\.active/);
 assert.match(auth,/organizations\(id,name,slug\)/);
 assert.match(layout,/session\.role === "manager"/);
 assert.match(layout,/getActiveManagerOrganizations\(session\.userId\)/);
 assert.match(switcher,/action:"enter"/);
 assert.match(switcher,/organization_id:organizationId/);
 assert.match(switcher,/\/api\/client-auth\/manager-access/);
});

test("Phase 6 workspace switching cannot bypass membership authorization",()=>{
 const switcher=read("app/portal/ManagerWorkspaceSwitcher.tsx");
 const route=read("app/api/client-auth/manager-access/route.ts");
 assert.match(switcher,/switchWorkspace/);
 assert.match(route,/action==="enter"/);
 assert.match(route,/getMembershipForOrganization\(session\.userId,organizationId\)/);
 assert.match(route,/if\(!membership\)/);
 assert.match(route,/status:403/);
 assert.match(route,/setClientSession/);
});

test("Phase 6 portal shell remains tenant-scoped after switching",()=>{
 const layout=read("app/portal/layout.tsx");
 const auth=read("lib/client-auth.ts");
 assert.match(layout,/getClientSession/);
 assert.match(layout,/session\.organizationId/);
 assert.match(layout,/getPortalCapabilities\(session\)/);
 assert.match(auth,/organization_memberships\?id=eq\./);
 assert.match(auth,/organization_id=eq\./);
 assert.match(auth,/status=eq\.active/);
});

test("Phase 6 switcher has a responsive UI guardrail",()=>{
 const css=read("app/portal/portal.css");
 const switcher=read("app/portal/ManagerWorkspaceSwitcher.tsx");
 assert.match(switcher,/aria-expanded/);
 assert.match(switcher,/disabled=\{Boolean\(loading\)\}/);
 assert.match(css,/portal-workspace-switcher/);
 assert.match(css,/@media \(max-width:720px\)/);
});
