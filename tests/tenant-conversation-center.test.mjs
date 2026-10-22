import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("tenant conversation center reads only organization-scoped CRM records", () => {
  const helper = read("lib/organization-conversation-center.ts");
  const page = read("app/dashboard/conversations/page.tsx");
  assert.match(helper, /getTenantConversationCenter\(organizationId: string\)/);
  assert.match(helper, /\.from\("crm_conversations"\)[\s\S]*?\.eq\("organization_id", organizationId\)/);
  assert.match(helper, /\.from\("crm_customers"\)[\s\S]*?\.eq\("organization_id", organizationId\)/);
  assert.match(helper, /crmMessages\(admin, organizationId/);
  assert.match(page, /scope\.kind === "tenant"[\s\S]*?getTenantConversationCenter\(scope\.organizationId\)/);
  assert.match(page, /Client conversations/);
});

test("tenant conversation center does not replace system-specific source selection", () => {
  const page = read("app/dashboard/conversations/page.tsx");
  assert.match(page, /getOrganizationConversationCenter\(systemId, scope\.organizationId\)/);
  assert.match(page, /systemId === "limitless-realty"/);
  assert.match(page, /systemId === "gencouv"/);
  assert.match(page, /systemId === "fluxknight"/);
});
