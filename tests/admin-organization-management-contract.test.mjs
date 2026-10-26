import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/dashboard/clients/[organizationId]/manage/page.tsx", "utf8");
const registry = fs.readFileSync("app/dashboard/clients/page.tsx", "utf8");
const navigation = fs.readFileSync("components/admin/navigationConfig.ts", "utf8");

test("organization management page requires a Super Admin session and scopes reads to organizationId", () => {
  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /if \(!session\) redirect\("\/login\?next=\/dashboard\/clients"\)/);
  assert.match(page, /\.eq\("organization_id", organizationId\)/);
  assert.match(page, /if \(organizationResult\.error \|\| !organizationResult\.data\) notFound\(\)/);
});

test("organization hub summarizes profile, lifecycle, subscription, allocations, integrations, and roles", () => {
  for (const expected of [
    "Organization profile",
    "Lifecycle status",
    "Subscription & credits",
    "Agents & allocations",
    "Integrations",
    "Users & roles",
    "Lifecycle safeguards",
  ]) assert.ok(page.includes(expected), "Missing section: " + expected);
  assert.match(page, /ClientStatusControl/);
  assert.match(page, /organization_agent_selections/);
  assert.match(page, /organization_memberships/);
});

test("organization hub does not expose destructive deletion and clearly defers it behind safeguards", () => {
  assert.match(page, /Deletion is intentionally not exposed in this draft/);
  assert.doesNotMatch(page, /fetch\([^)]*(delete-organization|\/organizations\/delete)/i);
});

test("client registry links directly to management and primary Super Admin nav is renamed", () => {
  assert.match(registry, /Manage organization/);
  assert.match(registry, /\/manage/);
  assert.match(navigation, /label:"Organization Management",exact:true/);
});
