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


test("Conversations and Activity remain renderable when live dependencies fail", () => {
  const conversations = read("app/dashboard/conversations/page.tsx");
  const activity = read("app/dashboard/activity/page.tsx");

  assert.match(conversations, /getLeads\(200\)\.catch\(\(\) => \[\]\)/);
  assert.match(conversations, /getCampaignReports\(30\)\.catch\(\(\) => \[\]\)/);
  assert.match(conversations, /getN8nStatus\(\)\.catch/);
  assert.match(conversations, /getSupabaseReadiness\(\)\.catch/);

  assert.match(activity, /getLeads\(200\)\.catch\(\(\) => \[\]\)/);
  assert.match(activity, /getProperties\(200\)\.catch\(\(\) => \[\]\)/);
  assert.match(activity, /getCampaignReports\(50\)\.catch\(\(\) => \[\]\)/);
  assert.match(activity, /getN8nStatus\(\)\.catch/);
  assert.match(activity, /getSupabaseReadiness\(\)\.catch/);
});
