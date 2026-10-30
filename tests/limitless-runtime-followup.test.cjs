const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

function fixture(lead = null) {
  const writes = [];
  const selects = [];
  const admin = {
    from(table) {
      const query = {
        select(value) { selects.push([table, value]); return this; },
        eq() { return this; },
        insert(value) { writes.push([table, value]); return this; },
        maybeSingle() { return Promise.resolve({ data: lead, error: null }); },
        single() { return Promise.resolve({ data: { id: 'synthetic-task' }, error: null }); },
      };
      return query;
    },
  };
  const module = load('lib/ai/maia-runtime.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/ai/maia-estate-tools': {},
    '@/lib/real-estate-access': {},
    '@/lib/real-estate-inspections': {},
    '@/lib/ai/maia-property-tools': { maiaPropertyTools: () => [] },
    '@/lib/ai/maia-appointment-tools': { maiaAppointmentTools: () => [] },
    '@/lib/ai/limitless-handoff-policy.mjs': { buildLimitlessHandoffAcknowledgement: () => 'Handoff recorded.' },
    '@/lib/flux-ai-metering-core': {},
    '@/lib/limitless-inspections': {},
    '@/lib/human-operations': {},
    '@/lib/whatsapp-integration': {},
  }, 'export { toolSet };');
  return { tool: module.toolSet().find((item) => item.name === 'create_followup_task'), writes, selects };
}

const args = { leadId: 'synthetic-lead', title: 'Approved follow-up', description: 'Check inspection preference', dueAt: '2099-01-01T12:00:00Z' };
const ctx = { organizationId: org, agentId: 'synthetic-agent', sessionId: 'synthetic-session' };

test('legacy generic follow-up tool refuses Limitless CRM-task writes and directs callers to the canonical sequence', async () => {
  const { tool, writes, selects } = fixture();
  await assert.rejects(tool.execute(args, ctx), /canonical tenant\/customer\/property sequence identity and explicit consent/);
  assert.equal(writes.length, 0);
  assert.equal(selects.length, 0);
});

test('ordinary and opted-out lead profiles cannot bypass the Limitless sequence consent gate', async () => {
  for (const lead of [{ opted_out: false }, { opted_out: true }]) {
    const { tool, writes, selects } = fixture(lead);
    await assert.rejects(tool.execute(args, ctx), /canonical tenant\/customer\/property sequence identity and explicit consent/);
    assert.equal(writes.length, 0);
    assert.equal(selects.length, 0);
  }
});

test('invalid or missing due-time inputs cannot create a legacy active Limitless schedule', async () => {
  for (const dueAt of [undefined, 'invalid', '2000-01-01T00:00:00Z']) {
    const { tool, writes } = fixture();
    await assert.rejects(tool.execute({ ...args, dueAt }, ctx), /canonical tenant\/customer\/property sequence identity and explicit consent/);
    assert.equal(writes.length, 0);
  }
});
