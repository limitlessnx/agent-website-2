import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("Maia appointment availability uses the tenant scheduling engine",()=>{
  const tool=read("lib/ai/maia-appointment-tools.ts");
  assert.match(tool,/selectAppointmentResource/);
  assert.match(tool,/organizationId: ctx.organizationId/);
  assert.match(tool,/requestedResourceId/);
  assert.match(tool,/requestedMembershipId/);
  assert.match(tool,/serviceKey/);
  assert.match(tool,/branchKey/);
  assert.match(tool,/departmentKey/);
  assert.match(tool,/available: true/);
  assert.match(tool,/calendar_not_configured/);
  assert.doesNotMatch(tool,/available: null/);
  assert.doesNotMatch(tool,/live free\/busy availability is not yet queried/);
});

test("Maia appointment lookup is tenant-scoped and no longer Limitless-only",()=>{
  const tool=read("lib/ai/maia-appointment-tools.ts");
  assert.match(tool,/from\("appointments"\)/);
  assert.match(tool,/eq\("organization_id", ctx.organizationId\)/);
  assert.match(tool,/eq\("customer_id", customerId\)/);
  assert.doesNotMatch(tool,/return \{ appointments: \[\], status: "unsupported_tenant" \}/);
});

test("Limitless legacy inspection records remain tenant-scoped compatibility data",()=>{
  const tool=read("lib/ai/maia-appointment-tools.ts");
  assert.match(tool,/LIMITLESS_REALTY_ORG_ID/);
  assert.match(tool,/listLimitlessInspections/);
  assert.match(tool,/eq\("organization_id", ctx.organizationId\)/);
});
