import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("client profile editing validates input and scopes reads and writes to the active organization", () => {
  const route = read("app/api/portal/customers/[id]/route.ts");
  const form = read("app/portal/customers/[id]/CustomerProfileForm.tsx");
  assert.match(route, /customers\.manage/);
  assert.match(route, /\.eq\("organization_id", session\.organizationId\)/);
  assert.match(route, /\.eq\("id", id\)/);
  assert.match(route, /customerStatuses/);
  assert.match(route, /23505/);
  assert.match(route, /profile:\s*\{/);
  assert.match(form, /Save client profile/);
  assert.match(form, /preferredChannel/);
  assert.match(form, /serviceInterest/);
  assert.match(form, /notes/);
});

test("enquiry pipeline stage updates are tenant scoped and use the CRM stage contract", () => {
  const route = read("app/api/portal/leads/[id]/route.ts");
  const control = read("app/portal/customers/LeadStageControl.tsx");
  assert.match(route, /customers\.manage/);
  assert.match(route, /\.eq\("organization_id", session\.organizationId\)/);
  assert.match(route, /\.eq\("id", id\)/);
  for (const stage of ["new", "qualified", "contacted", "nurturing", "appointment", "won", "lost", "disqualified"]) {
    assert.ok(route.includes('"' + stage + '"'));
    assert.ok(control.includes('"' + stage + '"'));
  }
});

test("new enquiries reuse matching tenant clients and guard against conflicting identities", () => {
  const route = read("app/api/portal/leads/route.ts");
  const form = read("app/portal/customers/NewEnquiryForm.tsx");
  assert.match(route, /customers\.manage/);
  assert.match(route, /\.eq\("organization_id", session\.organizationId\)/);
  assert.match(route, /emailMatch\.data && phoneMatch\.data/);
  assert.match(route, /reusedExistingClient/);
  assert.match(route, /createdCustomer/);
  assert.match(form, /New enquiry/);
  assert.match(form, /serviceInterest/);
  assert.match(form, /source/);
});


test("client detail page renders the editable profile component with permission gating", () => {
  const page = read("app/portal/customers/[id]/page.tsx");
  assert.match(page, /<CustomerProfileForm customer=\{customer\} canManage=\{access\.permissions\.has\("customers\.manage"\)\} \/>/);
  assert.match(page, /<CustomerStageControl/);
});

test("failed enquiry reports cleanup failure instead of falsely claiming rollback succeeded", () => {
  const route = read("app/api/portal/leads/route.ts");
  assert.match(route, /cleanupError \|\| !deletedCustomer/);
  assert.match(route, /Cleanup could not be confirmed/);
  assert.match(route, /customerId,/);
  assert.match(route, /The new client record was removed/);
});
