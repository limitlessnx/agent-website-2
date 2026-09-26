import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("super admin separates system and tenant organizations through the workspace switcher", () => {
  const nav = read("components/admin/navigationConfig.ts");
  const sidebar = read("components/admin/AdminSidebar.tsx");
  assert.match(nav, /href:"\/dashboard\/clients",label:"Client Registry"/);
  assert.match(sidebar, /System Organizations/);
  assert.match(sidebar, /Tenant Organizations/);
  assert.match(sidebar, /id: "fluxknight"/);
  assert.match(sidebar, /id: "limitless-realty"/);
  assert.match(sidebar, /id: "gencouv"/);
  assert.match(sidebar, /switchOrganization\("system"/);
  assert.match(sidebar, /switchOrganization\("tenant"/);
  assert.match(sidebar, /Browse tenant organizations/);
});

test("Fluxknight owns the current agentic Socials module", () => {
  const rail = read("components/admin/WorkspaceRail.tsx");
  const social = read("app/dashboard/social/page.tsx");
  const nav = read("components/admin/navigationConfig.ts");
  const socialLayout = read("app/dashboard/social/layout.tsx");
  assert.match(rail, /href: "\/dashboard\/social", label: "Socials"/);
  assert.match(rail, /isFluxknight/);
  assert.match(social, /Fluxknight branded content/);
  assert.doesNotMatch(nav, /href: "\/dashboard\/social", label: "Social"/);
  assert.match(socialLayout, /organization\.id === "fluxknight"/);
  assert.match(socialLayout, /does not have an agentic social media system configured yet/);
});


test("organization selection persists through the admin context endpoint", () => {
  const shell = read("components/admin/AdminShell.tsx");
  const sidebar = read("components/admin/AdminSidebar.tsx");
  const context = read("lib/admin-organization-context.ts");
  const route = read("app/api/admin/organization-context/route.ts");

  assert.match(shell, /getAdminOrganizationContext/);
  assert.match(shell, /activeOrganization=\{activeOrganization\}/);
  assert.match(sidebar, /fetch\("\/api\/admin\/organization-context"/);
  assert.match(sidebar, /window\.location\.assign\(href\)/);
  assert.match(context, /fluxknight_admin_organization/);
  assert.match(context, /tenant:/);
  assert.match(route, /getAdminSession/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /path: "\/dashboard"/);
});
