import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("tenant preview is admin-only, signed, and available across portal navigation", () => {
  const route = read("app/dashboard/preview/tenant/[id]/route.ts");
  const auth = read("lib/client-auth.ts");
  const portal = read("lib/portal-access.ts");
  assert.match(route, /getAdminSession/);
  assert.match(route, /createAdminTenantPreviewToken/);
  assert.match(route, /path: "\/"/);
  assert.match(route, /sameSite: process\.env\.NODE_ENV === "production" \? "none" : "lax"/);
  assert.match(auth, /isAdminPreview/);
  assert.match(auth, /getAdminSession/);
  assert.match(portal, /if \(session\.isAdminPreview\)/);
  assert.match(portal, /Tenant preview is read-only/);
});

test("Super Admin surfaces expose both tenant preview and admin workspace access", () => {
  const clients = read("app/dashboard/clients/page.tsx");
  const sidebar = read("components/admin/AdminSidebar.tsx");
  assert.match(clients, /dashboard\/preview\/tenant/);
  assert.match(clients, /dashboard\/switch\/tenant/);
  assert.match(sidebar, /dashboard\/preview\/tenant/);
});

test("preview can be exited without destroying the admin session", () => {
  const exit = read("app/dashboard/preview/exit/route.ts");
  assert.match(exit, /getAdminSession/);
  assert.match(exit, /maxAge: 0/);
  assert.match(exit, /path: "\/portal"/);
  assert.match(exit, /path: "\/"/);
  assert.match(exit, /\/dashboard/);
});
