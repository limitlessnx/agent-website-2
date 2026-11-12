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

test("Gencouv page section navigation points to real targets", () => {
  const anchors = new Set([...page.matchAll(/\\bid="([^"]+)"/g)].map(x => x[1]));
  const targets = [...page.matchAll(/href:"(#.*?)"/g)].map(x => x[1].slice(1));
  assert.ok(targets.length >= 5);
  for (const target of targets) assert.ok(anchors.has(target), "Missing section: " + target);
  assert.match(page, /href:"\\/dashboard\\/gencouv\\/categories"/);
});

test("mobile workspace header and bottom nav follow Gencouv routes", () => {
  assert.match(header, /pathname\\.startsWith\\("\\/dashboard\\/gencouv"\\)/);
  assert.match(header, /const label = isGencouv/);
  assert.match(bottom, /const navigationItems = gencouv/);
  assert.match(bottom, /\\/dashboard\\/gencouv#email-inbox/);
  assert.match(sidebar, /id: "gencouv", href: "\\/dashboard\\/gencouv"/);
  assert.match(rail, /\\/dashboard\\/gencouv#email-inbox/);
});

test("mobile metric cards use balanced columns and navigable targets", () => {
  assert.match(css, /grid-template-columns:repeat\\(2,minmax\\(0,1fr\\)\\)/);
  assert.match(home, /isGencouv/);
  assert.match(home, /\\/dashboard\\/gencouv#email-inbox/);
});

test("feed warning is compact and safe on mobile", () => {
  assert.match(page, /<details/);
  assert.match(page, /overflowWrap:"anywhere"/);
  assert.doesNotMatch(page, /Dashboard feed setup needed/);
});
