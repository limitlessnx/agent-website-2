import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("phone contact import is protected by the admin session and active organization scope", () => {
  const route = read("app/api/limitless/leads/phone-contacts/route.ts");
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /if \(!session\).*401/s);
  assert.match(route, /resolveAdminOrganizationScope\(\)/);
  assert.match(route, /getCampaignAudienceLeads\(scope\.organizationId/);
  assert.match(route, /importProgressiveLeadsInBatches\(scope\.organizationId/);
});

test("phone contact import deduplicates normalized numbers and tags the source", () => {
  const route = read("app/api/limitless/leads/phone-contacts/route.ts");
  assert.match(route, /normalizeLeadPhone/);
  assert.match(route, /existingPhones\.has\(phone\)/);
  assert.match(route, /seen\.has\(phone\)/);
  assert.match(route, /source: "phone_contacts"/);
});

test("phone contact import never enables campaign delivery without explicit consent confirmation", () => {
  const route = read("app/api/limitless/leads/phone-contacts/route.ts");
  assert.match(route, /body\.whatsappConsentConfirmed === true/);
  assert.match(route, /campaign_eligible: whatsappConsentConfirmed/);
  assert.match(route, /consent not confirmed; campaign eligibility disabled/i);
});

test("phone contact picker requests only user-selected contacts and offers a VCF fallback", () => {
  const component = read("components/admin/PhoneContactsImporter.tsx");
  assert.match(component, /picker\.select\(\["name", "tel", "email"\], \{ multiple: true \}\)/);
  assert.match(component, /onClick=\{chooseFromPhone\}/);
  assert.match(component, /accept="\.vcf,\.vcard,text\/vcard,text\/x-vcard,application\/vcard"/);
  assert.match(component, /Import \.vcf file/);
});
