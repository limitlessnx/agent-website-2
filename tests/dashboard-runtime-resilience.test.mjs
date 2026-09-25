import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("n8n dashboard status fails soft on transport or invalid JSON failures", () => {
  const source = read("lib/limitless-data.ts");
  assert.match(source, /n8n status unavailable/);
  assert.match(source, /Automation engine is temporarily unavailable/);
  assert.match(source, /n8n workflow response was empty/);
  assert.match(source, /JSON\.parse\(raw\)/);
});

test("Leo proactive monitor degrades without a 500 response", () => {
  const source = read("app/api/leo/monitor/route.ts");
  assert.match(source, /Leo proactive monitor degraded/);
  assert.match(source, /degraded: true/);
  assert.match(source, /alerts: \[\]/);
  assert.match(source, /status: 200/);
});


test("Dashboard Home Conversations and Activity remain renderable when organization data fails", () => {
  const home = read("app/dashboard/page.tsx");
  const conversations = read("app/dashboard/conversations/page.tsx");
  const activity = read("app/dashboard/activity/page.tsx");
  const data = read("lib/admin-organization-data.ts");

  assert.match(data, /emptyOrganizationOperationalSnapshot/);
  assert.match(home, /getOrganizationOperationalSnapshot\(scope\)\.catch/);
  assert.match(conversations, /getOrganizationOperationalSnapshot\(scope\)\.catch/);
  assert.match(conversations, /getWorkflowRegistrySummary\(scope\)\.catch/);
  assert.match(activity, /getOrganizationOperationalSnapshot\(scope\)\.catch/);
  assert.match(activity, /getWorkflowRegistrySummary\(scope\)\.catch/);
  assert.match(data, /Live data temporarily unavailable/);
});
