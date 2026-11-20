import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const route = read("app/api/dashboard/gencouv/contact-import/route.ts");
const component = read("components/gencouv/GencouvContactImport.tsx");

test("Gencouv contact imports are isolated to the intended admin organization", () => {
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /requireAdminSystemScope\("gencouv"\)/);
  assert.match(route, /request\.headers\.get\("origin"\) !== request\.nextUrl\.origin/);
  assert.match(route, /\.eq\("organization_id", organizationId\)/);
  assert.match(route, /marketing_consent: "unknown"/);
  assert.match(route, /No marketing consent is inferred/);
});

test("preview and save use a file-and-category fingerprint, never a blind save", () => {
  assert.match(route, /createHash\("sha256"\)\.update\(bytes\)\.update\("\\0"\)\.update\(categoryId\)\.digest\("hex"\)/);
  assert.match(route, /preview_fingerprint/);
  assert.match(route, /File or category changed since preview/);
  assert.match(component, /if \(!isPreview && preview\) data\.set\("preview_fingerprint", preview\.fingerprint\)/);
  assert.match(component, /setPreview\(null\)/);
});

test("quality and failure counts are distinct and partial failures remain retryable", () => {
  assert.match(route, /missingEmail\+\+/);
  assert.match(route, /invalid\+\+/);
  assert.match(route, /duplicatesInFile\+\+/);
  assert.match(route, /failed_contacts: failedContacts, failed_assignments: failedAssignments/);
  assert.match(route, /status: failedContacts \|\| failedAssignments \? 207 : 200/);
  assert.match(component, /result\.failed_contacts/);
  assert.match(component, /result\.failed_assignments/);
  assert.match(component, /The file is retained so you can preview and retry safely/);
});

test("upload remains capped, manual and does not send or enroll campaigns", () => {
  assert.match(route, /maxBytes = 2 \* 1024 \* 1024/);
  assert.match(route, /maxContacts = 500/);
  assert.match(route, /No marketing emails have been sent or scheduled/);
  assert.doesNotMatch(route, /resendApi\(|sendGencouvBrevoIndividual\(/);
});
