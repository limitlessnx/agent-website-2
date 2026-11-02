const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");

test("Limitless Realty reminder is selectable and exposes its four approved campaign fields", () => {
  const ui = read("components/admin/WhatsAppCampaignCenterV2.tsx");
  assert.match(ui, /value: "limitless_realty_reminder", label: "Reminder", template: "limitless_realty_reminder · APPROVED CONTRACT"/);
  assert.doesNotMatch(ui, /value: "limitless_realty_reminder"[^\n]*unavailable: true/);
  assert.match(ui, /const isReminderCampaign = campaignType === "limitless_realty_reminder"/);
  assert.match(ui, /Follow-up context/);
  assert.match(ui, /Property details/);
  assert.match(ui, /Next step/);
});

test("campaign API accepts the reminder template and preserves its exact template name", () => {
  const route = read("app/api/limitless/campaigns/send/route.ts");
  assert.match(route, /"limitless_realty_reminder"/);
  assert.match(route, /limitless_realty_reminder: "limitless_realty_reminder"/);
});

test("Maia gateway dispatches reminder with the registered four-variable contract", () => {
  const gateway = read("lib/maia-action-gateway.ts");
  assert.match(gateway, /isReminderCampaign = command\.campaignType === "limitless_realty_reminder"/);
  assert.match(gateway, /isReminderCampaign \? "follow_up_outside_24h"/);
  assert.match(gateway, /\["customer_name", "followup_context", "property_details", "next_step"\]/);
  assert.match(gateway, /followup_context: paragraphs\[0\]/);
  assert.match(gateway, /property_details: paragraphs\[1\]/);
  assert.match(gateway, /next_step: paragraphs\[2\]/);
});

test("database migration aligns configured and approved reminder variable order", () => {
  const migration = read("supabase/migrations/20261102130000_align_limitless_reminder_campaign_template_contract.sql");
  assert.match(migration, /purpose = 'follow_up_outside_24h'/);
  assert.match(migration, /template_name = 'limitless_realty_reminder'/);
  assert.match(migration, /metadata->>'provider_status' = 'approved'/);
  assert.equal((migration.match(/'followup_context'/g) || []).length, 4);
  assert.equal((migration.match(/'property_details'/g) || []).length, 2);
  assert.equal((migration.match(/'next_step'/g) || []).length, 2);
});
