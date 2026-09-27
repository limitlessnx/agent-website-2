import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("phase 5 preserves client authentication onboarding and tenant isolation", () => {
  const layout = read("app/portal/layout.tsx");
  const data = read("lib/client-portal-data.ts");
  assert.match(layout, /getClientSession\(\)/);
  assert.match(layout, /redirect\("\/account\/login"\)/);
  assert.match(layout, /profile\.status\s*===\s*"in_progress"/);
  assert.match(layout, /redirect\("\/onboarding"\)/);
  assert.match(data, /getClientPortalSummary\(organizationId: string\)/);
  assert.match(data, /organization_id=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
  assert.match(data, /organization_uuid=eq\.\$\{encodeURIComponent\(organizationId\)\}/);
});

test("phase 5 client shell remains compatible with the A7 canonical tenant navigation", () => {
  const sidebar = read("app/portal/PortalSidebar.tsx");
  for (const route of [
    "/portal",
    "/portal/notifications",
    "/portal/customers",
    "/portal/conversations",
    "/portal/systems",
    "/portal/appointments",
    "/portal/analytics",
    "/portal/team",
    "/portal/support",
    "/portal/settings",
  ]) assert.match(sidebar, new RegExp(route.replaceAll("/", "\\/")));
  for (const legacy of ["/portal/agents", "/portal/agents/setup", "/portal/marketplace", "/portal/runtime", "/portal/execution"]) {
    assert.doesNotMatch(sidebar, new RegExp(legacy.replaceAll("/", "\\/")));
  }
  assert.match(sidebar, /Needs Attention/);
  assert.match(sidebar, /Customers/);
  assert.match(sidebar, /Conversations/);
  assert.match(sidebar, /Systems/);
});

test("phase 5 command center uses only tenant-scoped real evidence", () => {
  const page = read("app/portal/page.tsx");
  assert.match(page, /getClientPortalSummary\(session\.organizationId\)/);
  assert.match(page, /getFluxWalletSummary\(session\.organizationId\)/);
  assert.match(page, /summary\.agents/);
  assert.match(page, /summary\.workflows/);
  assert.match(page, /summary\.runs/);
  assert.match(page, /wallet\.balance/);
  assert.doesNotMatch(page, /Math\.random|fake metric|mock metric/i);
});

test("phase 5 attention state does not treat queued or running work as failure", () => {
  const page = read("app/portal/page.tsx");
  assert.match(page, /\["failed", "timed_out", "cancelled", "error"\]/);
  assert.doesNotMatch(page, /!\["succeeded", "completed", "success"\]\.includes/);
  assert.match(page, /\["error", "disabled", "paused"\]/);
});

test("phase 5 keeps the client workspace available when credits data is unavailable", () => {
  const page = read("app/portal/page.tsx");
  assert.match(page, /getFluxWalletSummary\(session\.organizationId\)\.catch\(\(\) => null\)/);
  assert.match(page, /Usage data temporarily unavailable/);
  assert.match(page, /workspace remains available/);
  assert.match(page, /PlanEntitlementsPanel/);
});

test("phase 5 implements the approved command-center hierarchy", () => {
  const page = read("app/portal/page.tsx");
  for (const phrase of [
    "Business command center",
    "Needs your attention",
    "Your AI Team",
    "What your systems have been doing",
  ]) assert.match(page, new RegExp(phrase));
  assert.match(page, /portal-business-metrics/);
  assert.match(page, /portal-command-grid/);
});

test("phase 5 TasteSkill responsive and accessibility guardrails are present", () => {
  const css = read("app/portal/portal.css");
  const sidebar = read("app/portal/PortalSidebar.tsx");
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /width:46px;height:46px/);
  assert.match(css, /:focus-visible/);
  assert.match(sidebar, /aria-label="Open client dashboard navigation"/);
  assert.match(sidebar, /aria-label="Close client dashboard navigation"/);
});
