import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sidebar = fs.readFileSync("app/portal/PortalSidebar.tsx", "utf8");
const layout = fs.readFileSync("app/portal/layout.tsx", "utf8");
const billing = fs.readFileSync("app/portal/billing/page.tsx", "utf8");
const entitlements = fs.readFileSync("components/portal/PlanEntitlementsPanel.tsx", "utf8");

test("Flux Credits navigation is visible only when billing capability is granted", () => {
  assert.match(sidebar, /billing:boolean/);
  assert.match(sidebar, /capabilities\.billing\?<Link href="\/portal\/billing"/);
  assert.match(layout, /billing:capabilities\.billing/);
});

test("billing page enforces tenant billing permissions and keeps admin preview read-only", () => {
  assert.match(billing, /getOrganizationAccessContext\(session\.organizationId, session\.userId\)/);
  assert.match(billing, /\["billing\.view", "billing\.manage"\]/);
  assert.match(billing, /const canManageBilling = Boolean\(access\?\.permissions\.has\("billing\.manage"\)\)/);
  assert.match(billing, /canManageBilling && wallet\.canTopUp \? <FluxCreditTopUpForm \/>/);
});

test("business value uses configured tenant analytics and does not invent ROI", () => {
  assert.match(billing, /getTenantBusinessValueAnalytics\(session\.organizationId, 30\)\.catch\(\(\) => null\)/);
  assert.match(billing, /businessValue\?\.configured/);
  assert.match(billing, /These estimates are not guaranteed revenue/);
  assert.match(billing, /ROI estimates are not configured for this workspace yet/);
});

test("plan entitlement panel exposes email follow-up and full channel automation separately", () => {
  assert.match(entitlements, /"email_follow_up"/);
  assert.match(entitlements, /"email_automation"/);
  assert.match(entitlements, /"web_chat_automation"/);
  assert.match(entitlements, /"human_handoff"/);
});
