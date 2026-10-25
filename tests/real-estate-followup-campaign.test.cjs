const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const delivery = load(path.join(root, 'lib/real-estate-campaign-delivery.ts'));

test('follow-up stop rules cover reply, appointment, handoff, opt-out, purchase, won, and lost', () => {
  for (const status of ['replied', 'appointment', 'handoff', 'opted_out', 'purchase', 'won', 'lost']) {
    const reason = delivery.followupStopReason({ lead: { status, opted_out: status === 'opted_out' } });
    assert.ok(reason, `${status} must stop the next follow-up`);
  }
  assert.equal(delivery.followupStopReason({ lead: { status: 'new' } }), null);
  assert.equal(delivery.followupStopReason({ lead: { status: 'new' }, hasInboundReply: true }), 'replied');
  assert.equal(delivery.followupStopReason({ lead: { status: 'new' }, handoff: { ai_paused: true } }), 'human_handoff');
});

test('campaign delivery keeps provider acceptance distinct from received delivery', () => {
  const accepted = delivery.summarizeCampaignDelivery([{ providerMessageId: 'wamid-1', deliveryStatus: 'accepted', lifecycleStatus: 'executed' }]);
  assert.equal(accepted.lifecycleStatus, 'executed');
  assert.equal(accepted.deliveryStatus, 'accepted');
  assert.equal(accepted.received, 0);

  const partial = delivery.summarizeCampaignDelivery([
    { providerMessageId: 'wamid-1', deliveryStatus: 'delivered', lifecycleStatus: 'received' },
    { providerMessageId: 'wamid-2', deliveryStatus: 'unknown', lifecycleStatus: 'unknown' },
    { deliveryStatus: 'failed', lifecycleStatus: 'failed' },
  ]);
  assert.equal(partial.lifecycleStatus, 'executed');
  assert.equal(partial.deliveryStatus, 'partial');
  assert.equal(partial.unknown, 1);
  assert.equal(partial.failed, 1);
});

test('follow-up and campaign paths claim before send and never treat missing provider IDs as sent/received', () => {
  const followupRoute = source('app/api/limitless/maia/followups/route.ts');
  const trigger = source('src/trigger/system-orchestrator.ts');
  const campaignRoute = source('app/api/limitless/campaigns/send/route.ts');
  for (const file of [followupRoute, trigger]) {
    assert.match(file, /claimOutboundTracking/);
    assert.match(file, /lifecycle_status: providerMessageId \? "executed" : "unknown"/);
    assert.match(file, /status: providerMessageId \? "sent" : "unknown"/);
    assert.match(file, /followup:\$\{row\.id\}/);
  }
  assert.match(campaignRoute, /campaign:\$\{requestId\}/);
  assert.match(campaignRoute, /preparedStatus: "prepared"/);
  assert.match(campaignRoute, /approvalStatus: "approved"/);
  assert.match(campaignRoute, /deliveryStatus/);
  assert.match(campaignRoute, /duplicatePrevented/);
});

test('tenant tracking migration uses composite tenant relationships and no queue table', () => {
  const migration = source('supabase/migrations/20261024140900_real_estate_outbound_tracking.sql');
  assert.match(migration, /create table public\.real_estate_outbound_tracking/);
  assert.match(migration, /foreign key \(organization_id, follow_up_id\)/);
  assert.match(migration, /foreign key \(organization_id, lead_id\)/);
  assert.match(migration, /unique \(organization_id, idempotency_key\)/);
  assert.match(migration, /provider_message_id/);
  assert.doesNotMatch(migration, /queue/i);
});

test('follow-up controls exclude drafts from active schedules and expose unknown outcomes', () => {
  const control = source('lib/followup-control.ts');
  assert.match(control, /const active=rows\.filter\(r=>\["pending","scheduled","queued"\]/);
  assert.match(control, /unknown:rows\.filter\(r=>r\.status==="unknown"\)/);
  assert.match(control, /draft:rows\.filter\(r=>r\.status==="draft"\)/);
});
