import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = fs.readFileSync("lib/customer-agent-catalog.ts", "utf8");

test("customer agent catalogue defines the seven canonical customer-facing categories", () => {
  for (const key of [
    '"whatsapp"',
    '"web_support"',
    '"call"',
    '"receipt"',
    '"social_media"',
    '"email"',
    '"customise"',
  ]) {
    assert.match(catalog, new RegExp(`key: ${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  assert.match(catalog, /name: "WhatsApp Agent"/);
  assert.match(catalog, /name: "Web Support Agent"/);
  assert.match(catalog, /name: "Call Agent"/);
  assert.match(catalog, /name: "Receipt Agent"/);
  assert.match(catalog, /name: "Social Media Agent"/);
  assert.match(catalog, /name: "Email Agent"/);
  assert.match(catalog, /name: "Customise Agent"/);
});

test("unverified products fail closed and are excluded from visible catalogue results", () => {
  assert.match(catalog, /availability: "unverified"/);
  assert.match(catalog, /if \(agent\.availability !== "implemented"\) return false/);
  assert.match(catalog, /allocated\.has\(agent\.key\) && isCustomerAgentPlanEligible\(agent, planCode\)/);
});

test("catalogue eligibility checks both plan channel and feature entitlements", () => {
  assert.match(catalog, /planIncludesChannel\(planCode, agent\.channel\)/);
  assert.match(catalog, /planIncludesFeature\(planCode, agent\.requiredFeature\)/);
  assert.match(catalog, /Outbound AI calling is not currently available/);
});
