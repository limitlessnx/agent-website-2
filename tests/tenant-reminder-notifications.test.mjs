import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
test("internal reminder drain claims executions within the tenant and is retry-safe",()=>{const task=read("src/trigger/tenant-reminder-execution-drain.ts");assert.match(task,/\.eq\("organization_id", row\.organization_id\)/);assert.match(task,/\.eq\("status", "queued"\)/);assert.match(task,/tenant_reminder_notifications/);assert.match(task,/onConflict: "organization_id,execution_id"/);});
test("tenant reminder notification API requires an authenticated active organization",()=>{const route=read("app/api/admin/reminder-rules/notifications/route.ts");assert.match(route,/getAdminSession/);assert.match(route,/resolveAdminOrganizationScope/);assert.match(route,/\.eq\("organization_id", scope\.organizationId\)/);});
test("reminder notifications are unique per tenant execution",()=>{const sql=read("supabase/migrations/20261024140700_tenant_reminder_notifications.sql");assert.match(sql,/unique \(organization_id, execution_id\)/);assert.match(sql,/foreign key \(organization_id, rule_id\)/);assert.match(sql,/enable row level security/);});
