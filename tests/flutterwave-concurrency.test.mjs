import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, readdirSync } from 'node:fs';

const run = promisify(execFile);
const database = process.env.BILLING_TEST_DATABASE_URL;
// This fixture creates tables. Only an explicitly configured disposable local
// PostgreSQL database is accepted; it must never target a hosted project.
if (database && !['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname)) {
  throw new Error('Billing concurrency tests require a disposable localhost database');
}
const sql = async query => (await run(process.env.PSQL_BIN || 'psql', [database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',query], {timeout:30000})).stdout.trim();
const lit = value => `'${String(value).replaceAll("'","''")}'`;
const token = '30000000-0000-0000-0000-000000000001';
const sub = '10000000-0000-0000-0000-000000000001';
const claim = async name => JSON.parse(await sql(`select public.claim_flutterwave_webhook(${lit(name)},'charge.completed','{}','${token}')`));
const renewal = (event,transaction) => sql(`select public.apply_flutterwave_renewal('${sub}','provider-1','${event.id}','${token}',${lit(transaction)},'successful','2028-01-31T12:34:56Z',100,'NGN','client@example.com',null)`);

test('PostgreSQL sessions serialize overlapping renewals and transaction duplicates', {skip:!database}, async()=>{
  const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_flutterwave_atomic_renewals.sql'));
  await sql(readFileSync('tests/fixtures/flutterwave-billing.sql','utf8'));
  await sql(readFileSync(`supabase/migrations/${migration}`,'utf8'));

  const claims=await Promise.all(Array.from({length:8},()=>claim('same-event')));
  assert.equal(claims.filter(c=>c.state==='claimed').length,1);
  assert.equal(claims.filter(c=>c.state==='busy').length,7);

  const events=await Promise.all(Array.from({length:8},(_,i)=>claim(`renewal-${i}`)));
  // A test wallet delay keeps transactions overlapping across independent
  // connections, exercising real row-lock contention (PGlite queues queries).
  await sql(`create function public.delay_test_wallet() returns trigger language plpgsql as $$ begin perform pg_sleep(0.1); return new; end; $$;
    create trigger delay_wallet before insert or update on public.test_wallet for each row execute function public.delay_test_wallet();`);
  const results=await Promise.all(events.map((ev,i)=>renewal(ev,`transaction-${Math.floor(i/2)}`)));
  assert.equal(results.map(JSON.parse).filter(r=>r.renewed).length,4);
  assert.equal(results.map(JSON.parse).filter(r=>r.duplicate).length,4);
  assert.equal(await sql(`select to_char(current_period_end at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') from public.organization_subscriptions where id='${sub}'`),'2028-05-29 12:34:56');
  assert.equal(await sql('select count(*) from public.flutterwave_renewal_transactions'),'4');
  assert.equal(await sql(`select count(*) from public.test_wallet w join public.organization_subscriptions s on s.id=w.subscription_id where w.period_end=s.current_period_end`),'1');
});
