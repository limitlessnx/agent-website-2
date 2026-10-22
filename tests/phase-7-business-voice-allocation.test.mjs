import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plans = readFileSync("lib/fluxknight-plans.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261009230000_phase2_plan_channel_allocations.sql", "utf8");
const upgradeMigration = readFileSync("supabase/migrations/20261011143000_phase7_business_voice_allocation.sql", "utf8");

test("Phase 7 keeps Basic and Plus voice-ineligible", () => {
  const basic = plans.slice(plans.indexOf("basic: {"), plans.indexOf("plus: {"));
  const plus = plans.slice(plans.indexOf("plus: {"), plans.indexOf("business: {"));
  assert.doesNotMatch(basic, /"voice"/);
  assert.doesNotMatch(plus, /"voice"/);
  assert.doesNotMatch(basic, /voice_automation|leo_voice/);
  assert.doesNotMatch(plus, /voice_automation|leo_voice/);
});

test("Phase 7 gives Business exactly WhatsApp and Voice allocations", () => {
  const business = plans.slice(plans.indexOf("business: {"), plans.indexOf("business_plus: {"));
  assert.match(business, /maxChannels: 2/);
  assert.match(business, /selectableChannels: \["whatsapp", "voice"\]/);
  assert.match(plans, /const BUSINESS_CHANNEL_AGENTS = \[WHATSAPP_AGENT, VOICE_AGENT\]/);
  assert.match(business, /availableAgents: BUSINESS_CHANNEL_AGENTS/);
  assert.doesNotMatch(business, /email_automation|web_chat_automation/);
});

test("Phase 7 reserves Email and Web Chat agents for Business+", () => {
  const businessPlus = plans.slice(plans.indexOf("business_plus: {"));
  assert.match(plans, /const BUSINESS_PLUS_CHANNEL_AGENTS = \[\.\.\.BUSINESS_CHANNEL_AGENTS, EMAIL_AGENT, WEB_CHAT_AGENT\]/);
  assert.match(businessPlus, /availableAgents: BUSINESS_PLUS_CHANNEL_AGENTS/);
  assert.match(businessPlus, /selectableChannels: \["web_chat", "whatsapp", "voice", "email"\]/);
});

test("Phase 7 database synchronization matches the canonical allocation", () => {
  assert.match(migration, /when 'basic' then 1 when 'plus' then 1 when 'business' then 2 else 4 end/);
  assert.match(migration, /when 'basic' then array\['whatsapp'\]/);
  assert.match(migration, /when 'plus' then array\['whatsapp'\]/);
  assert.match(migration, /when 'business' then array\['whatsapp','voice'\]/);
});

test("Phase 7 includes a forward migration for existing organizations", () => {
  assert.match(upgradeMigration, /update public\.organization_plan_allocations/);
  assert.match(upgradeMigration, /paused_by', 'phase7_plan_correction'/);
  assert.match(upgradeMigration, /when 'plus' then 1 when 'business' then 2 else 4 end/);
  assert.match(upgradeMigration, /when 'business' then array\['whatsapp','voice'\]/);
  assert.match(upgradeMigration, /revoke all on function public\.sync_organization_plan_allocation/);
  assert.match(upgradeMigration, /grant execute on function public\.sync_organization_plan_allocation\(uuid,text,uuid\) to service_role/);
});
