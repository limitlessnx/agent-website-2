import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rolesSource = await readFile(new URL("../lib/leo-agent-roles.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/leo/agent-roles/route.ts", import.meta.url), "utf8");

const expectedRoles = ["leo", "maia", "crm", "campaign", "workflow", "analytics", "support", "platform"];

test("Phase 9A defines the frozen workforce roles", () => {
  for (const key of expectedRoles) assert.match(rolesSource, new RegExp(`key: \\\"${key}\\\"`));
});

test("Phase 9A roles cannot self-approve or autonomously execute consequential actions", () => {
  assert.match(rolesSource, /mayExecuteConsequentially:\s*false/g);
  assert.match(rolesSource, /maySelfApprove:\s*false/g);
  assert.doesNotMatch(rolesSource, /mayExecuteConsequentially:\s*true/);
  assert.doesNotMatch(rolesSource, /maySelfApprove:\s*true/);
});

test("Phase 9A preserves exact workspace isolation and evidence boundaries", () => {
  assert.match(rolesSource, /exact organization ID/);
  assert.match(rolesSource, /Missing evidence must be reported as unknown or insufficient data/);
  assert.match(rolesSource, /does not grant tool access, permission, approval, tenant access or provider authority/);
});

test("Phase 9A leaves human escalation deferred", () => {
  assert.match(rolesSource, /cannot invent a human escalation team while Phase 7F remains deferred/);
});

test("Phase 9A API is Super Admin protected", () => {
  assert.match(routeSource, /identity\.scope !== "super_admin"/);
  assert.match(routeSource, /Super Admin authorization required/);
});
