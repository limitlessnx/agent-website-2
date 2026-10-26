import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = fs.readFileSync("lib/customer-agent-catalog.ts", "utf8");
const systemsPage = fs.readFileSync("app/portal/systems/page.tsx", "utf8");

test("customer agent catalogue defines the seven canonical customer-facing categories", () => {
  for (const name of [
    "WhatsApp Agent",
    "Web Support Agent",
    "Call Agent",
    "Receipt Agent",
    "Social Media Agent",
    "Email Agent",
    "Customise Agent",
  ]) {
    assert.ok(catalog.includes(`name: "${name}"`), `missing catalogue entry: ${name}`);
  }
});

test("unverified products fail closed and require both plan eligibility and allocation", () => {
  assert.match(catalog, /availability: "unverified"/);
  assert.match(catalog, /if \(agent\.availability !== "implemented"\) return false/);
  assert.match(catalog, /allocated\.has\(agent\.key\) && isCustomerAgentPlanEligible\(agent, planCode\)/);
});

test("organization allocation is read from that organization's active agent records", () => {
  assert.match(catalog, /agents\?organization_id=eq\.\${encodeURIComponent\(organizationId\)}/);
  assert.match(catalog, /row\.status !== "active" && row\.status !== "published"/);
  assert.match(catalog, /Unknown agent types fail closed/);
  assert.match(catalog, /"email", "email_agent", "email_ai", "email_automation"/);
  assert.match(catalog, /"voice", "voice_agent", "call", "call_agent", "voice_ai", "voice_receptionist", "outbound_call_agent"/);
});

test("tenant systems page renders only the plan-eligible allocated agent list", () => {
  assert.match(systemsPage, /getOrganizationAllocatedCustomerAgentKeys\(session\.organizationId\)/);
  assert.match(systemsPage, /getVisibleCustomerAgents\(wallet\.planCode, allocatedAgentKeys\)/);
  assert.match(systemsPage, /Customer-facing agents enabled for your plan and configured for your organization/);
});
