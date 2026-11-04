import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import load from './helpers/load-typescript.cjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const goal = { id: 'goal-1', organization_id: 'org-1', agent_id: 'agent-1', title: 'Queued task', input: { instructions: 'Approved task' } };
function setup({ claims = [null], assigned = true, authorized = true, claimError = null } = {}) {
  const calls = { claims: 0, queries: [], runs: [], errors: [] };
  const admin = {
    rpc: async () => { const data = claims[calls.claims++] ?? null; return { data, error: claimError }; },
    from: table => {
      const query = { table, filters: [] }; calls.queries.push(query);
      const chain = {
        select: () => chain,
        update: values => { query.update = values; return chain; },
        eq: (field, value) => { query.filters.push([field, value]); return chain; },
        then: (resolve, reject) => Promise.resolve({
          data: table === 'organization_agent_selections' ? (assigned ? [{ status: 'active', configuration: { provisioned_agent_id: 'agent-1' } }] : []) : null,
          error: null,
        }).then(resolve, reject),
      };
      return chain;
    },
  };
  const route = load(path.resolve(testDirectory, '../app/api/maia/autonomous/route.ts'), {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/ai/maia-runtime': { runMaia: async input => { calls.runs.push(input); return { steps: 2 }; } },
  }, '', { process: { env: { CRON_SECRET: 'test-only' } }, console: { error: (...args) => calls.errors.push(args) } });
  return { calls, post: () => route.POST({ headers: { get: name => authorized && name === 'authorization' ? 'Bearer test-only' : null } }) };
}

for (const [label, response] of [
  ['null', null], ['empty array', []], ['null row', [null]],
  ['all-null composite array', [{ id: null, organization_id: null, agent_id: null, title: null, input: null }]],
  ['all-null composite object', { id: null, organization_id: null, agent_id: null, title: null }],
]) test(`idle queue: ${label} exits quietly without processing`, async () => {
  const { calls, post } = setup({ claims: [response] });
  const result = await post();
  assert.equal(result.status, 200); assert.equal(result.body.processed, 0);
  assert.equal(calls.claims, 1); assert.equal(calls.errors.length, 0);
  assert.equal(calls.runs.length, 0); assert.equal(calls.queries.length, 0);
});

for (const [label, response] of [['array', [goal]], ['object', goal]]) test(`valid ${label} goal executes once and completes within its tenant`, async () => {
  const { calls, post } = setup({ claims: [response, []] });
  const result = await post();
  assert.equal(result.body.processed, 1); assert.equal(result.body.results[0].status, 'completed');
  assert.equal(calls.runs.length, 1); assert.equal(calls.runs[0].organizationId, 'org-1');
  assert.equal(calls.runs[0].agentId, 'agent-1'); assert.match(calls.runs[0].message, /Approved task/);
  assert.equal(calls.claims, 2); assert.equal(calls.errors.length, 0);
  const update = calls.queries.find(q => q.update);
  assert.deepEqual(update.filters, [['id', 'goal-1'], ['organization_id', 'org-1'], ['status', 'running']]);
  assert.equal(update.update.status, 'completed');
});

for (const [label, response] of [
  ['empty object', {}], ['incomplete goal', { id: 'goal-1', title: 'Missing tenant' }],
  ['multiple rows', [goal, goal]], ['scalar', true], ['nested array', [[goal]]],
]) test(`malformed ${label} still stops before tenant access or execution`, async () => {
  const { calls, post } = setup({ claims: [response] });
  const result = await post();
  assert.equal(result.body.results[0].reason, 'invalid_claimed_goal_payload');
  assert.equal(calls.errors.length, 1); assert.equal(calls.claims, 1);
  assert.equal(calls.runs.length, 0); assert.equal(calls.queries.length, 0);
});

test('an unassigned agent cannot execute after array normalization', async () => {
  const { calls, post } = setup({ claims: [[goal], null], assigned: false });
  const result = await post();
  assert.equal(result.body.results[0].status, 'failed'); assert.equal(calls.runs.length, 0);
  assert.equal(calls.queries.find(q => q.update).update.status, 'failed');
});

test('claim errors remain retryable and unauthorized requests cannot claim', async () => {
  const failed = setup({ claimError: { message: 'Database unavailable' } });
  assert.equal((await failed.post()).status, 500); assert.equal(failed.calls.queries.length, 0);
  const denied = setup({ authorized: false });
  assert.equal((await denied.post()).status, 401); assert.equal(denied.calls.claims, 0);
});
