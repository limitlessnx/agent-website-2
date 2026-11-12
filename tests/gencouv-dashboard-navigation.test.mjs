import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const page = read("app/dashboard/gencouv/page.tsx");
const home = read("components/admin/DashboardHomeExperience.tsx");
const css = read("components/admin/DashboardHomeExperience.module.css");
const header = read("components/admin/MobileAdminHeader.tsx");
const bottom = read("components/admin/MobileBottomNav.tsx");
const sidebar = read("components/admin/AdminSidebar.tsx");
const rail = read("components/admin/WorkspaceRail.tsx");

test("Gencouv section navigation targets exist", () => {
  for (const anchor of ["lead-contacts","email-inbox","email-control","website-funnel","lead-board"]) {
    assert.ok(page.includes('id="' + anchor + '"'), "Missing section: " + anchor);
    assert.ok(page.includes('href:"#' + anchor + '"'), "Missing navigation: " + anchor);
  }
  assert.ok(page.includes('href:"/dashboard/gencouv/categories"'));
});

test("mobile header and navigation route to Gencouv", () => {
  assert.ok(header.includes('pathname.startsWith("/dashboard/gencouv")'));
  assert.ok(header.includes("const label = isGencouv"));
  assert.ok(bottom.includes("const navigationItems = gencouv"));
  assert.ok(bottom.includes("/dashboard/gencouv#email-inbox"));
  assert.ok(sidebar.includes('id: "gencouv", href: "/dashboard/gencouv"'));
  assert.ok(rail.includes("/dashboard/gencouv#email-inbox"));
});

test("metric grid is balanced and card destinations exist", () => {
  assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
  assert.ok(home.includes("isGencouv"));
  assert.ok(home.includes("/dashboard/gencouv#email-inbox"));
});

test("feed warning is compact and wraps on mobile", () => {
  assert.ok(page.includes("<details"));
  assert.ok(page.includes('overflowWrap:"anywhere"'));
  assert.ok(!page.includes("Dashboard feed setup needed"));
});
