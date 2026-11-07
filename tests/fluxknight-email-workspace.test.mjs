import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL("../" + file, import.meta.url),"utf8");

test("mail routes enforce Fluxknight organization and session",()=>{
  const route=read("app/api/dashboard/email/route.ts");
  const page=read("app/dashboard/email/page.tsx");
  assert.match(route,/getAdminSession/);
  assert.match(route,/context\.id === "fluxknight"/);
  assert.match(route,/context\.kind === "system"/);
  assert.match(page,/redirect\("\/dashboard"\)/);
});

test("Resend API key remains server-side and account data is mailbox-scoped",()=>{
  const adapter=read("lib/fluxknight-mail.ts");
  const route=read("app/api/dashboard/email/route.ts");
  assert.match(adapter,/process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(adapter,/NEXT_PUBLIC_RESEND/);
  assert.match(route,/row\.to\.some/);
  assert.match(route,/row\.from\.toLowerCase/);
  assert.match(route,/Message not found/);
});

test("sending requires a recipient, explicit approval and permitted sender",()=>{
  const route=read("app/api/dashboard/email/route.ts");
  assert.match(route,/isFluxknightAddress\(from\)/);
  assert.match(route,/body\.confirmed !== true/);
  assert.match(route,/origin !== request\.nextUrl\.origin/);
  assert.match(route,/Only one PDF attachment up to 4 MB/);
  assert.match(route,/Replace proposal placeholders before sending/);
});

test("dashboard navigation and workforce email card lead to workspace",()=>{
  assert.match(read("components/admin/navigationConfig.ts"),/href:"\/dashboard\/email"/);
  assert.match(read("lib/admin-organization-data.ts"),/href: "\/dashboard\/email",\s*note: emailWorkflows/);
  const component=read("components/admin/EmailWorkspace.tsx");
  assert.match(component,/Hotel Automation/);
  assert.match(component,/Real Estate Automation/);
  assert.match(component,/type="file"/);
});

test("server-side drafts are owner-scoped and require same-origin writes",()=>{
  const route=read("app/api/dashboard/email/drafts/route.ts");
  const migration=read("supabase/migrations/20261107145518_fluxknight_email_drafts.sql");
  assert.match(route,/getAdminSession/);
  assert.match(route,/organization\.id !== "fluxknight"/);
  assert.match(route,/\.eq\("owner_email",owner\)/);
  assert.match(route,/sameOrigin\(request\)/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public\.fluxknight_email_drafts/);
});
test("mail workspace supports drafts and incremental history",()=>{
  const component=read("components/admin/EmailWorkspace.tsx");
  const route=read("app/api/dashboard/email/route.ts");
  assert.match(component,/Save draft/);
  assert.match(component,/Saved drafts/);
  assert.match(component,/Load older messages/);
  assert.match(component,/type="search"/);
  assert.match(route,/next_cursor/);
  assert.match(route,/Invalid cursor/);
});

test("sent email UI differentiates accepted, delivered and bounced outcomes",()=>{
  const component=read("components/admin/EmailWorkspace.tsx");
  assert.match(component,/state==="bounced"/);
  assert.match(component,/state==="delivered"/);
  assert.match(component,/state==="delivery_delayed"/);
  assert.match(component,/Delivery is not confirmed/);
  assert.match(component,/Resend email ID/);
});
