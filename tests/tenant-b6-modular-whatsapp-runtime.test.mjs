import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(path,"utf8");

test("B6 generic inbound events are tenant scoped and service only",()=>{
  const migration=read("supabase/migrations/20260926202633_b6_generic_channel_inbound_runtime.sql");
  assert.match(migration,/channel_inbound_events/);
  assert.match(migration,/foreign key \(organization_id, agent_id\)/i);
  assert.match(migration,/foreign key \(organization_id, source_system_id\)/i);
  assert.match(migration,/unique \(organization_id, channel, provider, external_event_id\)/i);
  assert.match(migration,/claim_channel_inbound_event/);
  assert.match(migration,/to service_role/);
});

test("B6 internal runtime exposes only explicit safe system request tools",()=>{
  const core=read("lib/leo-core.ts");
  assert.match(core,/flux\.system\.appointment\.request/);
  assert.match(core,/flux\.system\.followup\.request/);
  assert.match(core,/scopes: \["internal_service"\]/);
  assert.match(core,/This requests handling; it does not claim a booking exists/);
  assert.match(core,/This requests handling; it does not send a message by itself/);
});

test("B6 event executors bind emission to the executing agent installed system",()=>{
  const executors=read("lib/ai-runtime/production-executors.ts");
  assert.match(executors,/sourceSystemForAgent/);
  assert.match(executors,/provisioned_agent_id/);
  assert.match(executors,/organization_systems/);
  assert.match(executors,/status=eq\.active/);
  assert.match(executors,/publishSystemEvent/);
});

test("B6 modular WhatsApp runtime executes only no-approval system request tools",()=>{
  const worker=read("src/trigger/tenant-channel-runtime.ts");
  assert.match(worker,/tenant-whatsapp-process-inbound-message/);
  assert.match(worker,/claim_channel_inbound_event/);
  assert.match(worker,/runPhase12Agent/);
  assert.match(worker,/call\.toolKey\.startsWith\("flux\.system\."\)/);
  assert.match(worker,/call\.approval !== "none"/);
  assert.match(worker,/sendWhatsAppMessage/);
});

test("B6 WhatsApp webhook keeps Maia and modular tenants on separate Trigger paths",()=>{
  const webhook=read("app/api/whatsapp/webhook/route.ts");
  assert.match(webhook,/mode: "maia"/);
  assert.match(webhook,/mode: "modular"/);
  assert.match(webhook,/maia-process-inbound-message/);
  assert.match(webhook,/tenant-whatsapp-process-inbound-message/);
  assert.match(webhook,/sourceSystemId/);
  assert.doesNotMatch(webhook,/channels\.includes\("whatsapp"\)/);
});
