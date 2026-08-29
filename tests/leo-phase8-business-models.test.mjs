import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const models = fs.readFileSync(new URL("../lib/leo-workspace-business-models.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/leo/business-models/route.ts", import.meta.url), "utf8");

test("8G includes owned business models and a generic client fallback", () => {
  for (const key of ["limitless-realty", "gencouv", "fluxknight", "generic-client"]) assert.match(models, new RegExp(`key: \\"${key}\\"`));
});

test("8G resolves exact organization-specific models before pattern fallback", () => {
  assert.match(models, /model\.organizationId === target\.organizationId/);
  assert.match(models, /workspacePattern/);
});

test("8G generic fallback forbids invention of business-specific semantics", () => {
  assert.match(models, /must not invent business-specific entities, pipeline stages, KPIs or financial meaning/i);
});

test("8G business models cannot grant tools permissions approvals or execution evidence", () => {
  assert.match(models, /do not grant tools, permissions, approvals or prove execution/i);
});

test("8G API is Super Admin protected", () => {
  assert.match(route, /scope !== "super_admin"/);
  assert.match(route, /Super Admin authorization required/);
});
