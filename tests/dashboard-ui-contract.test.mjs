import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("dashboard theme stays isolated to the dashboard root", () => {
  const source = read("components/admin/ThemeToggle.tsx");
  assert.match(source, /getElementById\("dashboard-theme-root"\)/);
  assert.match(source, /dataset\.dashboardTheme/);
  assert.doesNotMatch(source, /document\.documentElement\.dataset\.theme/);
});

test("dashboard shell keeps reference-fidelity and responsive layers active", () => {
  const shell = read("components/admin/AdminShell.tsx");
  assert.match(shell, /DashboardReferenceFidelity\.module\.css/);
  assert.match(shell, /referenceFidelity\.referenceFidelity/);
  assert.match(shell, /MobileBottomNav/);
  assert.match(shell, /MobileAdminHeader/);
});

test("desktop navigation supports persistent collapsed state without removing mobile drawer", () => {
  const sidebar = read("components/admin/AdminSidebar.tsx");
  const css = read("components/admin/AdminSidebar.module.css");
  assert.match(sidebar, /fluxknight-dashboard-sidebar/);
  assert.match(sidebar, /dataset\.sidebarCollapsed/);
  assert.match(css, /data-sidebar-collapsed="true"/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /sidebarOpen/);
});

test("mobile primary navigation preserves the locked five destinations", () => {
  const nav = read("components/admin/MobileBottomNav.tsx");
  for (const label of ["Home", "Agents", "Conversations", "Activity", "Menu"]) {
    assert.match(nav, new RegExp(label));
  }
  assert.match(nav, /\/dashboard\/conversations/);
});

test("phase 1-5 fidelity layer contains phone tablet and desktop composition rules", () => {
  const css = read("components/admin/DashboardReferenceFidelity.module.css");
  assert.match(css, /@media\(max-width:1180px\) and \(min-width:901px\)/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /conversation-workspace/);
  assert.match(css, /integration-marketplace/);
  assert.match(css, /settings-layout/);
});

test("dashboard home uses live operating inputs and does not hard-code fake KPI values", () => {
  const page = read("app/dashboard/page.tsx");
  const home = read("components/admin/DashboardHomeExperience.tsx");
  assert.match(page, /value: newLeads\.length/);
  assert.match(page, /value: engagedLeads\.length/);
  assert.match(page, /value: followUpLeads\.length/);
  assert.match(page, /value: qualifiedLeads\.length/);
  assert.match(page, /notices=\{notifications\}/);
  assert.match(page, /name: "Maia"/);
  assert.match(page, /name: "Leo"/);
  assert.match(home, /Your AI Team/);
  assert.doesNotMatch(home, /94%|138 conversations|42 new leads|31 follow-ups/i);
});

test("mobile header preserves reference bell and account actions", () => {
  const header = read("components/admin/MobileAdminHeader.tsx");
  assert.match(header, /Bell/);
  assert.match(header, /\/dashboard\/notifications/);
  assert.match(header, /\/dashboard\/settings/);
  assert.match(header, /Open account settings/);
});
