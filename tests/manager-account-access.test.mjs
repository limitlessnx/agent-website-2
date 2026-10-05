import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(path,"utf8");

test("account mode offers organization and manager paths",()=>{
 const page=read("app/account/choose-mode/AccountModeClient.tsx");
 assert.match(page,/Start an Organization/);
 assert.match(page,/Manage Organizations/);
 assert.match(page,/account_mode/);
});

test("new account signup routes to account mode selection",()=>{
 const route=read("app/api/client-auth/signup/route.ts");
 assert.match(route,/\/account\/choose-mode/);
 assert.match(route,/pending-selection/);
});

test("Google callback routes existing manager accounts to manager workspace",()=>{
 const route=read("app/auth/callback/route.ts");
 assert.match(route,/getClientAccountMode/);
 assert.match(route,/accountMode==="manager"/);
 assert.match(route,/\/manage-organizations/);
});

test("manager access requires approval before membership is created",()=>{
 const migration=read("supabase/migrations/20261005_manager_account_access_mvp.sql");
 assert.match(migration,/organization_access_requests/);
 assert.match(migration,/request_organization_access/);
 assert.match(migration,/approve_organization_access_request/);
 assert.match(migration,/status = 'pending'/);
 assert.match(migration,/insert into public\.organization_memberships/);
});

test("organization admin can expose an access ID and review manager requests",()=>{
 const page=read("app/portal/team/page.tsx");
 const client=read("app/portal/team/AccessRequestsClient.tsx");
 assert.match(page,/manager_access_code/);
 assert.match(client,/Organization Access ID/);
 assert.match(client,/Approve/);
 assert.match(client,/Reject/);
});

test("manager MVP receives full portal capability set",()=>{
 const access=read("lib/portal-access.ts");
 assert.match(access,/managerFullAccess/);
 assert.match(access,/access\.roles\.includes\("manager"\)/);
});
