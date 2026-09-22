import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("phase 6 motion is restrained and reduced-motion safe", () => {
  const fidelity = read("components/admin/DashboardReferenceFidelity.module.css");
  const chrome = read("components/admin/PlatformChrome.module.css");
  const desktop = read("components/admin/SuperAdminDesktop.module.css");

  assert.match(fidelity, /fkReferencePageIn/);
  assert.match(fidelity, /prefers-reduced-motion:reduce/);
  assert.match(chrome, /fkDrawerIn/);
  assert.match(chrome, /fkSheetIn/);
  assert.match(chrome, /prefers-reduced-motion:reduce/);
  assert.match(desktop, /grid-template-columns 200ms/);
  assert.match(desktop, /transition:none!important/);
});

test("activity drawer behaves as an accessible modal dialog", () => {
  const chrome = read("components/admin/PlatformChrome.tsx");
  assert.match(chrome, /useDialogFocusTrap/);
  assert.match(chrome, /role="dialog"/);
  assert.match(chrome, /aria-modal="true"/);
  assert.match(chrome, /aria-labelledby="activity-center-title"/);
  assert.match(chrome, /aria-controls="dashboard-activity-drawer"/);
  assert.match(chrome, /aria-expanded=\{activityOpen\}/);
});

test("mobile navigation is removed from sequential focus when closed", () => {
  const sidebar = read("components/admin/AdminSidebar.tsx");
  assert.match(sidebar, /setAttribute\("inert", ""\)/);
  assert.match(sidebar, /removeAttribute\("inert"\)/);
  assert.match(sidebar, /useDialogFocusTrap\(mobileOpen/);
  assert.match(sidebar, /role=\{mobileOpen \? "dialog"/);
});

test("agent builder exposes filter selection and save result semantics", () => {
  const agents = read("components/admin/AgentManagementCenter.tsx");
  assert.match(agents, /aria-pressed=\{statusFilter === "all"\}/);
  assert.match(agents, /aria-label="Search agents, roles or workspaces"/);
  assert.match(agents, /aria-label="Filter agents by workspace"/);
  assert.match(agents, /role="status" aria-live="polite"/);
});

test("functional regression anchors remain connected to existing business logic", () => {
  const crm = read("app/dashboard/crm/page.tsx");
  const agents = read("components/admin/AgentManagementCenter.tsx");
  const integrations = read("app/dashboard/integrations/page.tsx");
  const settings = read("app/dashboard/settings/page.tsx");
  const conversations = read("app/dashboard/conversations/page.tsx");

  assert.match(crm, /requireTenant\(\)/);
  assert.match(crm, /\.eq\("organization_id", organizationId\)/);
  assert.match(agents, /fetch\("\/api\/agents"/);
  assert.match(integrations, /IntegrationCredentialControl/);
  assert.match(settings, /getWorkflowRegistrySummary/);
  assert.match(settings, /WorkflowRegistryClient/);
  assert.match(conversations, /getLeads\(200\)/);
  assert.match(conversations, /getCampaignReports\(30\)/);
});

test("phase 9 visual contract preserves reference compositions and viewport families", () => {
  const fidelity = read("components/admin/DashboardReferenceFidelity.module.css");
  const overview = read("components/admin/DashboardReferenceOverview.module.css");

  assert.match(fidelity, /grid-template-columns:minmax\(250px,.78fr\) minmax\(340px,1.2fr\) minmax\(250px,.78fr\)/);
  assert.match(fidelity, /integration-marketplace/);
  assert.match(fidelity, /settings-layout/);
  assert.match(fidelity, /max-width:1180px/);
  assert.match(fidelity, /max-width:900px/);
  assert.match(fidelity, /max-width:560px/);
  assert.match(fidelity, /max-width:340px/);
  assert.match(overview, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(overview, /mainGrid/);
});
