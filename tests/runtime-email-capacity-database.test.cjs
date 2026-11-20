/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const f = require('./helpers/communication-outcome-database.cjs');

const migration = fs.readdirSync('supabase/migrations').find(file => file.endsWith('_runtime_email_capacity_owner.sql'));
const migrationSql = fs.readFileSync('supabase/migrations/' + migration, 'utf8');
const modelSchema = 'create table runtime_model_requests(id uuid default gen_random_uuid(), organization_id uuid, execution_id uuid, status text, response_payload jsonb, completed_at timestamptz);';
const key = 'phase12-provider:' + f.execution;
const fingerprint = 'a'.repeat(64);
const responseId = 'synthetic-provider-response';
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';

async function prepare(sql, step = 1, { balance = step > 1 ? 2 : 3, progress = true, source = 'outbound_email_runtime' } = {}) {
  const { body } = f.normalized('email', { sequence_step: step });
  await sql(modelSchema);
  await sql(migrationSql);
  await sql(`update flux_credit_wallets set balance=${balance} where organization_id='${f.org}';
    update runtime_executions set input=${json({ workflow_key: 'outbound_email_crm_v5', channel: 'email', customer_key: body.customer_key, email: body.input.email, sequence_step: step, event_type: body.event_type })} where id='${f.execution}';
    insert into command_queue(organization_id,agent_id,execution_id,command_type,idempotency_key)
      values('${f.org}','${f.agent}','${f.execution}','agent.respond','synthetic-operation');`);
  const action = source === 'phase12_provider_runtime' ? 'web_ai' : step > 1 ? 'email_follow_up' : 'ai_email';
  await sql(`select reserve_flux_credit_capacity('${f.org}','${key}','${fingerprint}','${action}',${balance},'${source}')`);
  await sql(`insert into runtime_model_requests(organization_id,execution_id,status,response_payload,completed_at)
      select '${f.org}','${f.execution}','succeeded',jsonb_build_object('credit_reservation_id',id,'credit_request_fingerprint',request_fingerprint,'provider','synthetic','id','${responseId}'), now()
      from flux_credit_reservations where idempotency_key='${key}'`);
  if (progress) await sql(`insert into runtime_progress_events(organization_id,execution_id,event_type,payload)
    select '${f.org}','${f.execution}','provider.completed',response_payload||jsonb_build_object('provider_response_id','${responseId}') from runtime_model_requests`);
}
function persistSql(step = 1, changes = {}) {
  const { body, billing, workflow } = f.normalized('email', { sequence_step: step, provider_response_id: responseId, ...changes });
  return `select persist_runtime_communication_outcome('${f.org}','${f.agent}','${f.execution}','${workflow}',${json(body)},${json(billing)}) as outcome`;
}

for (const step of [1, 2]) {
  test('email sequence step ' + step + ' settles its exact hold inside the outcome transaction', async t => {
    const db = await f.fixture(t);
    await prepare(query => db.exec(query), step);
    await assert.rejects(db.query(persistSql(step, {provider_response_id: 'other'})), /outcome_evidence_unavailable/);
    await assert.rejects(f.persist(db, 'voice'), /outcome_scope_mismatch/);
    const first = (await db.query(persistSql(step))).rows[0].outcome;
    const retry = (await db.query(persistSql(step))).rows[0].outcome;
    assert.equal(first.ok, true);
    assert.equal(retry.duplicate, true);
    assert.deepEqual((await db.query('select credit_delta from flux_credit_ledger')).rows, [{ credit_delta: step === 1 ? -3 : -2 }]);
    assert.equal((await db.query('select status from flux_credit_reservations')).rows[0].status, 'settled');
  });
}

for (const [name, options, expected] of [
  ['missing provider audit', { progress: false }, /outcome_evidence_unavailable/],
  ['historical generic billing', { balance: 2, source: 'phase12_provider_runtime' }, /legacy_outcome_requires_review/],
]) {
  test(name + ' leaves email capacity and CRM state untouched', async t => {
    const db = await f.fixture(t);
    await prepare(query => db.exec(query), 1, options);
    await assert.rejects(db.query(persistSql()), expected);
    assert.equal((await db.query('select count(*)::int n from flux_credit_ledger')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int n from crm_customers')).rows[0].n, 0);
    assert.equal((await db.query('select status from flux_credit_reservations')).rows[0].status, 'held');
  });
}

const database = process.env.FLUX_EMAIL_TEST_DATABASE_URL;
if (database) {
  const target = new URL(database);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/flux_email_test') {
    throw new Error('Email SQL concurrency tests require the disposable localhost flux_email_test database.');
  }
}
test('independent PostgreSQL sessions roll back a failed audit and settle the email hold once', { skip: !database }, async () => {
  const run = promisify(execFile);
  const sql = async query => (await run(process.env.PSQL_BIN || 'psql', [database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query])).stdout.trim();
  for (const statement of [f.rolesSQL, f.schemaSQL, f.capacitySQL, f.outcomeSQL, f.seedSQL]) await sql(statement);
  await prepare(sql);
  await sql('alter table audit_logs add constraint synthetic_reject_audit check(false)');
  const failed = await Promise.allSettled(Array.from({ length: 6 }, () => sql(persistSql())));
  assert.ok(failed.every(result => result.status === 'rejected' && /synthetic_reject_audit/.test(String(result.reason))));
  assert.equal(await sql('select count(*) from flux_credit_ledger'), '0');
  assert.equal(await sql('select count(*) from crm_customers'), '0');
  assert.equal(await sql('select status from flux_credit_reservations'), 'held');
  await sql('alter table audit_logs drop constraint synthetic_reject_audit');
  const committed = (await Promise.all(Array.from({ length: 8 }, () => sql(persistSql())))).map(JSON.parse);
  assert.equal(committed.filter(result => result.duplicate).length, 7);
  assert.equal(await sql('select count(*) from flux_credit_ledger'), '1');
  assert.equal(await sql('select count(*) from audit_logs'), '1');
  assert.equal(await sql('select status from flux_credit_reservations'), 'settled');
});
