const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const tools = readFileSync('lib/ai/maia-property-tools.ts', 'utf8');
const dispatch = readFileSync('lib/ai/maia-property-media-dispatch.ts', 'utf8');
const delivery = readFileSync('lib/whatsapp-delivery.ts', 'utf8');

test('Maia property media resolves the canonical CRM conversation created by the active runtime', () => {
  assert.match(tools, /\.from\("crm_conversations"\)/);
  assert.match(tools, /\.eq\("id", ctx\.conversationId\)/);
  assert.match(tools, /\.eq\("organization_id", ctx\.organizationId\)/);
  assert.match(tools, /\.from\("crm_messages"\)/);
  assert.match(tools, /\.eq\("direction", "inbound"\)/);
  assert.doesNotMatch(tools, /\.from\("agent_conversations"\)/);
});

test('Maia property media uses tenant-scoped WhatsApp delivery and verified service-window timestamp', () => {
  assert.match(tools, /organizationId: ctx\.organizationId/);
  assert.match(tools, /lastCustomerMessageAt: recipient\.lastInboundAt/);
  assert.match(dispatch, /sendWhatsAppMessage/);
  assert.match(dispatch, /deliveryMode: "direct"/);
  assert.match(dispatch, /organizationId: command\.organizationId/);
  assert.match(delivery, /Direct WhatsApp messages are only available while the customer's 24-hour service window is open/);
});

test('Maia property media cannot accept an arbitrary recipient or media URL from the model', () => {
  assert.match(tools, /properties: \{\s*assetId: \{ type: "string" \}/);
  assert.match(tools, /\.eq\("organization_id", ctx\.organizationId\)/);
  assert.match(tools, /\.eq\("id", assetId\)/);
  assert.match(tools, /approvedMedia\(asset\.metadata\)/);
  assert.match(tools, /resolveTrustedWhatsAppRecipient\(ctx\)/);
});
