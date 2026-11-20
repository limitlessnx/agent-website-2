import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261120040000_gencouv_resend_bulk_campaigns.sql");
const api = read("app/api/dashboard/gencouv/bulk-campaigns/route.ts");
const unsubscribe = read("app/api/gencouv/bulk-unsubscribe/route.ts");
const token = read("lib/gencouv-bulk-unsubscribe.ts");
const ui = read("components/gencouv/GencouvBulkCampaignComposer.tsx");
const marketing = read("components/gencouv/GencouvMarketingWorkspace.tsx");
const consentRoute = read("app/api/dashboard/gencouv/contact-consent/route.ts");
const importUI = read("components/gencouv/GencouvContactImport.tsx");

test("campaign storage has tenant-bound recipients, reservation uniqueness and RLS", () => {
  assert.match(migration, /create table if not exists public\.gencouv_bulk_campaigns/);
  assert.match(migration, /create table if not exists public\.gencouv_bulk_recipients/);
  assert.match(migration, /foreign key \(campaign_id,organization_id\)/);
  assert.match(migration, /foreign key \(customer_id,organization_id\)/);
  assert.match(migration, /unique \(campaign_id,normalized_email\)/);
  assert.match(migration, /alter table public\.gencouv_bulk_campaigns enable row level security/);
  assert.match(migration, /alter table public\.gencouv_bulk_recipients enable row level security/);
  assert.match(migration, /consent_confirmed_by text not null/);
  assert.match(migration, /gencouv_contact_consent_audit/);
  assert.match(migration, /gencouv_record_imported_contact_consent/);
});

test("a service-role-only atomic claim has a lock and conservative UTC daily cap", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /100 - v_used/);
  assert.match(migration, /status = 'ready' and consent_confirmed = true/);
  assert.match(migration, /revoke all on function public\.gencouv_claim_bulk_batch/);
  assert.match(migration, /grant execute on function public\.gencouv_claim_bulk_batch.*to service_role/);
});

test("Gencouv admin session, CSRF, org isolation, and consent required before any send", () => {
  assert.match(api, /getAdminSession\(\)/);
  assert.match(api, /requireAdminSystemScope\("gencouv"\)/);
  assert.match(api, /request\.headers\.get\("origin"\) !== request\.nextUrl\.origin/);
  assert.match(api, /input\.consent_accepted !== "yes"/);
  assert.match(api, /marketing_consent === "granted"/);
  assert.match(api, /marketing_consent_source \?\? meta\.consent_source/);
  assert.match(api, /consent_confirmed_by: admin\.email/);
  assert.match(api, /GENCOUV_BULK_SEND_ENABLED !== "true"/);
  assert.match(api, /\.rpc\("gencouv_claim_bulk_batch"/);
  assert.match(api, /\.eq\("organization_id", org\)/);
});

test("Resend dispatch uses per-recipient idempotency and ambiguous outcomes are not retried", () => {
  assert.match(api, /"Idempotency-Key": batchKey/);
  assert.match(api, /"\\/emails\\/batch"/);
  assert.match(api, /status: "unknown", error_code: "verify_provider_before_retry"/);
  assert.match(api, /List-Unsubscribe-Post/);
  assert.match(api, /suppress\(db, org, job\.normalized_email\)/);
  assert.match(api, /hasConsent\(contact\.metadata\)/);
  assert.match(api, /accepted, suppressed,/);
  assert.doesNotMatch(api, /resend\.batch\.send/);
});

test("signed unsubscribe requires POST mutation; GET does not suppress", () => {
  assert.match(token, /createHmac\("sha256"/);
  assert.match(token, /timingSafeEqual/);
  assert.match(unsubscribe, /export async function GET/);
  assert.match(unsubscribe, /GET does not alter preferences/);
  assert.match(unsubscribe, /export async function POST/);
  assert.match(unsubscribe, /gencouv_suppression_list/);
  assert.match(unsubscribe, /onConflict: "organization_id,normalized_email"/);
});

test("Gencouv UI offers Yes/No consent, campaign review and manual batch sends", () => {
  assert.match(marketing, /<GencouvBulkCampaignComposer \/>/);
  assert.match(ui, /Consent accepted for these recipients\?/);
  assert.match(ui, /Yes, previously obtained/);
  assert.match(ui, /No<\/label>/);
  assert.match(ui, /consent !== "yes"/);
  assert.match(ui, /consent_basis: consentBasis/);
  assert.match(ui, /Send up to 100 with Resend/);
  assert.match(ui, /sendingEnabled/);
});

test("imported contacts have individually auditable permission confirmations", () => {
  assert.match(consentRoute, /requireAdminSystemScope\("gencouv"\)/);
  assert.match(consentRoute, /getAdminSession\(\)/);
  assert.match(consentRoute, /gencouv_record_imported_contact_consent/);
  assert.match(importUI, /Review imported list consent/);
  assert.match(importUI, /Save consent for entire import group/);
  assert.match(importUI, /Where and when did everyone in this list agree to marketing/);
  assert.match(consentRoute, /gencouv_record_import_group_consent/);
  assert.match(migration, /gencouv_record_import_group_consent/);
  assert.match(migration, /gencouv_suppression_list/);
});
