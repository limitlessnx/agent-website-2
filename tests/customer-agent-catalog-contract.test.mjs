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

test("visible catalogue respects the plan's simultaneous channel cap", () => {
  assert.match(catalog, /const maxChannels = getMaxChannelCount\(planCode\)/);
  assert.match(catalog, /\.slice\(0, maxChannels\)/);
  assert.match(plans, /business:[\s\S]*?maxChannels: 2/);
  assert.match(plans, /business_plus:[\s\S]*?maxChannels: 4/);
});

test("catalogue eligibility checks both plan channel and feature entitlements", () => {
  assert.match(catalog, /planIncludesChannel\(planCode, agent\.channel\)/);
  assert.match(catalog, /planIncludesFeature\(planCode, agent\.requiredFeature\)/);
  assert.match(catalog, /Outbound AI calling is not currently available/);
});

const plans = fs.readFileSync("lib/fluxknight-plans.ts", "utf8");
const emailRuntime = fs.readFileSync("app/api/internal/runtime/actions/outbound-email/route.ts", "utf8");

test("outbound email runtime enforces scoped follow-up vs full automation entitlements", () => {
  assert.match(emailRuntime, /feature: followUpCharge \? "email_follow_up" : "email_automation"/);
  assert.match(emailRuntime, /action: followUpCharge \? "email_follow_up" : "ai_email"/);
  assert.doesNotMatch(emailRuntime, /assertFluxFeatureAccess\(organizationId, "cross_channel"\)/);
});

test("Basic and Plus allow one selected WhatsApp or web support channel", () => {
  assert.match(plans, /basic:[\s\S]*?selectableChannels: \["whatsapp", "web_chat"\]/);
  assert.match(plans, /plus:[\s\S]*?selectableChannels: \["whatsapp", "web_chat"\]/);
  assert.match(catalog, /key: "web_support",[\s\S]*?channel: "web_chat",[\s\S]*?requiredFeature: "core_ai_support"/);
});

test("Business plan includes email follow-up without unlocking full email automation", () => {
  assert.match(plans, /business:[\s\S]*?selectableChannels: \["whatsapp", "voice", "email"\]/);
  assert.match(plans, /business:[\s\S]*? "email_follow_up",/);
  assert.match(plans, /business_plus:[\s\S]*? "email_automation",/);
  assert.match(catalog, /key: "email",[\s\S]*?channel: "email",[\s\S]*?requiredFeature: "email_follow_up"/);
});
