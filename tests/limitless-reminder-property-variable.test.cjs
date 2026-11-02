const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const ui = readFileSync('components/admin/WhatsAppCampaignCenterV2.tsx', 'utf8');
const sendRoute = readFileSync('app/api/limitless/campaigns/send/route.ts', 'utf8');
const gateway = readFileSync('lib/maia-action-gateway.ts', 'utf8');
const scheduled = readFileSync('app/api/limitless/maia/followups/route.ts', 'utf8');
const delivery = readFileSync('lib/whatsapp-delivery.ts', 'utf8');

test('reminder composer requires a property selected from the catalogue', () => {
  assert.match(ui, /Selected property · {{"\{\{2\}\}"}}/);
  assert.match(ui, /Choose a property from the catalogue/);
  assert.match(ui, /isReminderCampaign ? selectedProperty\?\.title && responsePrompt\.trim\(\)/);
  assert.match(sendRoute, /campaignType === "limitless_realty_reminder" && !selectedProperty/);
});

test('selected property populates reminder variables two and three from tenant-scoped server data', () => {
  assert.match(sendRoute, /propertyDetails: selectedProperty \?/);
  assert.match(gateway, /followup_context: String\(command\.propertyTitle \|\| ""\)\.trim\(\)/);
  assert.match(gateway, /property_details: String\(command\.propertyDetails \|\| ""\)\.trim\(\)/);
  assert.match(gateway, /next_step: paragraphs\[0\] \|\| command\.message\.trim\(\)/);
});

test('scheduled Maia follow-ups use the same approved four-variable order', () => {
  assert.match(scheduled, /"customer_name",\s*"followup_context",\s*"property_details",\s*"next_step"/);
  assert.doesNotMatch(scheduled, /"last_topic",\s*"property_name",\s*"property_location"/);
  assert.match(scheduled, /strictTemplateContract: \{ approvedVariableOrder: LIMITLESS_APPROVED_FOLLOWUP_VARIABLE_ORDER \}/);
});

test('Meta template locale is taken from the active provider config, never hard-coded to en_US', () => {
  assert.match(delivery, /language: \{ code: config!\.language_code \}/);
  assert.doesNotMatch(delivery, /language: \{ code: "en_US" \}/);
});
