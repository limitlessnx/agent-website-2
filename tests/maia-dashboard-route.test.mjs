import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Maia conversation route exposes the operational context hierarchy", () => {
  const route = read("app/portal/conversations/[id]/page.tsx");
  for (const marker of ["aria-label=\"Customer context\"","aria-label=\"Maia summary\"","Intent / request","Property / service","Needs & key points","aria-label=\"Conversation operations\"","Follow-up","Appointment","Handoff","aria-label=\"Human handoff\"","Conversation evidence"]) assert.ok(route.includes(marker), "Missing route marker: "+marker);
});

test("Maia conversation route keeps tenant and conversation scoping on operational reads", () => {
  const route = read("app/portal/conversations/[id]/page.tsx");
  assert.match(route, /crm_conversations\?organization_id=eq/);
  assert.match(route, /crm_messages\?organization_id=eq/);
  assert.match(route, /human_handoffs\?organization_id=eq/);
  assert.match(route, /follow_ups\?organization_id=eq/);
  assert.match(route, /appointments\?organization_id=eq/);
  assert.match(route, /conversation_id=eq/);
});

test("Maia conversation route preserves authenticated access and WhatsApp human reply gating", () => {
  const route = read("app/portal/conversations/[id]/page.tsx");
  assert.match(route, /getClientSession/);
  assert.match(route, /getOrganizationAccessContext/);
  assert.match(route, /conversations\.view/);
  assert.match(route, /conversations\.reply/);
  assert.match(route, /HumanWhatsAppComposer/);
  assert.match(route, /canReply=\{access\.permissions\.has\("conversations\.reply"\)\}/);
});
