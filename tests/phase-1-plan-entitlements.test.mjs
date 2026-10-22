import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plans = readFileSync("lib/fluxknight-plans.ts", "utf8");

test("Phase 1 defines homepage-aligned channel limits and allocations", () => {
  assert.match(plans, /export type FluxAgentChannel = "web_chat" \| "whatsapp" \| "voice" \| "email"/);
  assert.match(plans, /maxChannels: 1/);
  assert.match(plans, /maxChannels: 2/);
  assert.match(plans, /maxChannels: 4/);
  assert.match(plans, /availableAgents: BUSINESS_CHANNEL_AGENTS/);
  assert.match(plans, /selectableChannels: \["web_chat", "whatsapp", "voice", "email"\]/);
});

test("Phase 1 keeps Basic to one selected customer channel", () => {
  const basic = plans.slice(plans.indexOf("basic: {"), plans.indexOf("plus: {"));
  assert.match(basic, /maxChannels: 1/);
  assert.match(basic, /selectableChannels: \["whatsapp"\]/);
  assert.match(basic, /"human_handoff"/);
  assert.doesNotMatch(basic, /"email_automation"|"follow_ups"|"reminders"/);
});

test("Phase 1 keeps Plus WhatsApp-only and adds follow-up automation", () => {
  const plus = plans.slice(plans.indexOf("plus: {"), plans.indexOf("business: {"));
  assert.match(plus, /maxChannels: 1/);
  assert.match(plus, /selectableChannels: \["whatsapp"\]/);
  assert.match(plus, /"follow_ups"/);
  assert.match(plus, /"reminders"/);
});

test("Phase 1 gives Business WhatsApp plus Voice", () => {
  const business = plans.slice(plans.indexOf("business: {"), plans.indexOf("business_plus: {"));
  assert.match(business, /maxChannels: 2/);
  assert.match(business, /selectableChannels: \["whatsapp", "voice"\]/);
  assert.match(business, /"voice_automation"/);
});

test("Phase 1 reserves deeper operational capabilities for Business+", () => {
  const business = plans.slice(plans.indexOf("business: {"), plans.indexOf("business_plus: {"));
  const businessPlus = plans.slice(plans.indexOf("business_plus: {"));
  assert.doesNotMatch(business, /"industry_database"|"client_database"|"advanced_workflows"|"custom_integrations"/);
  assert.match(businessPlus, /"industry_database"/);
  assert.match(businessPlus, /"advanced_workflows"/);
  assert.match(businessPlus, /"custom_integrations"/);
});

test("Phase 1 exposes reusable allocation and entitlement helpers", () => {
  assert.match(plans, /export function getPlanAgentAllocation/);
  assert.match(plans, /export function getMaxChannelCount/);
  assert.match(plans, /export function getSelectableChannels/);
  assert.match(plans, /export function planIncludesChannel/);
  assert.match(plans, /export function getRequiredPlanForChannel/);
});
