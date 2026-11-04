import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const subId = '10000000-0000-0000-0000-000000000001';
const token = '30000000-0000-0000-0000-000000000001';
const replacement = '30000000-0000-0000-0000-000000000002';
const migration = readdirSync('supabase/migrations').find(n => n.endsWith('_flutterwave_atomic_renewals.sql'));
assert.ok(migration, 'generated migration must be present');

async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(readFileSync('tests/fixtures/flutterwave-billing.sql', 'utf8'));
  await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
  const claim = async (external = 'charge.completed:1', owner = token) =>
    (await db.query(`select claim_flutterwave_webhook($1,'charge.completed','{}',$2) as result`, [external,owner])).rows[0].result;
  const renew = async (ev, { transaction='1', status='successful', paid='2028-01-31T12:34:56Z', owner=token, amount=100, email='client@example.com', provider='provider-1', subscription=subId, currency='NGN' } = {}) =>
    (await db.query(`select apply_flutterwave_renewal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null) as result`,
      [subscription,provider,ev.id,owner,transaction,status,paid,amount,currency,email])).rows[0].result;
  const sub = async () => (await db.query(`select *,current_period_end::text as ending from organization_subscriptions where id=$1`,[subId])).rows[0];
  return {db,claim,renew,sub};
}

test('claims reject live duplicates, reclaim crashes and legacy rows, and fence stale workers', async t => {
  const {db,claim,renew}=await fixture(t);
  const event=await claim();
  assert.equal(event.state,'claimed');
  assert.equal((await claim('charge.completed:1',replacement)).state,'busy');
  await db.query(`update payment_webhook_events set processing_started_at=now()-interval '6 minutes' where id=$1`,[event.id]);
  assert.equal((await claim('charge.completed:1',replacement)).state,'claimed');
  await assert.rejects(renew(event),/no longer owned/);
  assert.equal((await renew(event,{owner:replacement})).renewed,true);
  assert.equal((await db.query(`update payment_webhook_events set processed_at=now() where id=$1 and processing_token=$2 returning id`,[event.id,token])).rows.length,0);
  await db.query(`update payment_webhook_events set processed_at=now() where id=$1`,[event.id]);
  assert.equal((await claim()).state,'processed');
  await db.exec(`insert into payment_webhook_events(provider,external_event_id,event_type,signature_valid,payload) values('flutterwave','legacy','charge.completed',true,'{}')`);
  assert.equal((await claim('legacy')).state,'claimed');
});

test('renewals dedupe transactions across event types and beyond the old 24-entry window', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  const ev=await claim();
  assert.equal((await renew(ev)).renewed,true);
  assert.equal((await sub()).current_period_end.toISOString(),'2028-02-29T12:34:56.000Z');
  for(let i=2;i<=27;i++) await renew(await claim(`charge.completed:${i}`),{transaction:String(i)});
  const before=(await sub()).current_period_end.toISOString();
  assert.equal((await renew(await claim('charge.failed:1'))).duplicate,true);
  assert.equal((await sub()).current_period_end.toISOString(),before);
  assert.equal((await db.query('select count(*)::int as count from flutterwave_renewal_transactions')).rows[0].count,27);
  assert.equal((await sub()).metadata.keep,'yes');
});

test('distinct simultaneous renewal requests each extend once; identical requests extend once', async t => {
  const {claim,renew,sub}=await fixture(t);
  const a=await claim('a'), b=await claim('b');
  await Promise.all([renew(a,{transaction:'a'}),renew(b,{transaction:'b'})]);
  assert.equal((await sub()).current_period_end.toISOString(),'2028-03-29T12:34:56.000Z');
  const c=await claim('c'),d=await claim('d');
  const results=await Promise.all([renew(c,{transaction:'c'}),renew(d,{transaction:'c'})]);
  assert.equal(results.filter(r=>r.duplicate).length,1);
  assert.equal((await sub()).current_period_end.toISOString(),'2028-04-29T12:34:56.000Z');
});

test('wallet failure rolls back dates and ledger; retry after lost response does not extend twice', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  const ev=await claim();
  await db.exec(`set test.fail_wallet='yes'`);
  await assert.rejects(renew(ev),/wallet unavailable/);
  assert.equal((await sub()).current_period_end.toISOString(),'2028-01-31T12:34:56.000Z');
  assert.equal((await db.query('select * from flutterwave_renewal_transactions')).rows.length,0);
  await db.exec(`set test.fail_wallet='no'`);
  await renew(ev);
  assert.equal((await renew(ev)).duplicate,true);
  assert.equal((await db.query('select * from test_wallet')).rows[0].period_end.toISOString(),'2028-02-29T12:34:56.000Z');
});

test('month boundaries are UTC safe under DST and non-UTC database sessions', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  for(const [zone,start,end] of [
    ['America/New_York','2027-01-31T23:30:00Z','2027-02-28T23:30:00.000Z'],
    ['America/New_York','2028-03-10T01:30:00Z','2028-04-10T01:30:00.000Z'],
    ['Asia/Dhaka','2028-12-31T23:30:00Z','2029-01-31T23:30:00.000Z'],
  ]) {
    await db.exec(`set timezone='${zone}'`);
    await db.query(`update organization_subscriptions set current_period_end=$1,metadata=metadata-'provider_transaction_id' where id=$2`,[start,subId]);
    await renew(await claim(start),{transaction:start,paid:start});
    assert.equal((await sub()).current_period_end.toISOString(),end);
  }
});

test('failures do not extend grace on retry or downgrade a later success', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  const failure=await claim('failed');
  await renew(failure,{transaction:'failed',status:'failed',paid:'2028-02-01T00:00:00Z'});
  const grace=(await sub()).grace_period_end.toISOString();
  assert.equal(grace,'2028-02-02T00:00:00.000Z');
  await renew(failure,{transaction:'failed',status:'failed',paid:'2028-02-02T00:00:00Z'});
  assert.equal((await sub()).grace_period_end.toISOString(),grace);
  await renew(failure,{transaction:'failed',paid:'2028-02-03T00:00:00Z'});
  assert.equal((await sub()).status,'active');
  await renew(await claim('delayed'),{transaction:'delayed',status:'failed',paid:'2028-02-02T00:00:00Z'});
  assert.equal((await sub()).status,'active');
  assert.equal((await db.query('select payment_status from flutterwave_renewal_transactions where transaction_id=$1',['failed'])).rows[0].payment_status,'successful');
});

test('identity, tenant, amount, currency and cancelled-state guards fail closed', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  const ev=await claim();
  for(const invalid of [{provider:'wrong'},{amount:99},{currency:'USD'},{email:'another@example.com'},{paid:null}]) {
    await assert.rejects(renew(ev,invalid));
  }
  assert.equal((await sub()).current_period_end.toISOString(),'2028-01-31T12:34:56.000Z');
  await db.exec(`update organization_subscriptions set status='cancelled'`);
  assert.equal((await renew(ev)).ignored,true);
  assert.equal((await sub()).status,'cancelled');
});

test('new functions and ledger are restricted to the server role', async t => {
  const {db}=await fixture(t);
  assert.equal((await db.query(`select relrowsecurity from pg_class where oid='public.flutterwave_renewal_transactions'::regclass`)).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated']) {
    const {rows}=await db.query(`select has_function_privilege($1,'public.claim_flutterwave_webhook(text,text,jsonb,uuid)','execute') as allowed`,[role]);
    assert.equal(rows[0].allowed,false);
  }
});

test('cancellation rolls back on wallet failure, retries safely and prevents subsequent renewal', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  const ev=await claim('cancel');
  const cancel=()=>db.query(`select cancel_flutterwave_subscription($1,'provider-1',$2,$3) as result`,[subId,ev.id,token]);
  await db.exec(`set test.fail_wallet='yes'`);
  await assert.rejects(cancel(),/wallet unavailable/);
  assert.equal((await sub()).status,'active');
  await db.exec(`set test.fail_wallet='no'`);
  assert.equal((await cancel()).rows[0].result.cancelled,true);
  assert.equal((await cancel()).rows[0].result.duplicate,true);
  assert.equal((await renew(await claim('after-cancel'))).ignored,true);
  assert.equal((await db.query('select status from test_wallet')).rows[0].status,'cancelled');
});

test('historical and initial charge identities remain deduplicated during rollout', async t => {
  const {db,claim,renew,sub}=await fixture(t);
  await db.exec(`update organization_subscriptions set metadata=metadata || '{"provider_transaction_id":"initial","processed_flutterwave_transaction_ids":["old"]}'`);
  for(const transaction of ['initial','old'])assert.equal((await renew(await claim(transaction),{transaction})).duplicate,true);
  assert.equal((await sub()).current_period_end.toISOString(),'2028-01-31T12:34:56.000Z');
});

test('a transaction can never be credited to two tenants', async t => {
  const {db,claim,renew}=await fixture(t);
  await renew(await claim('tenant-a'));
  const other='10000000-0000-0000-0000-000000000002';
  await db.query(`insert into organization_subscriptions select $1,$1,plan_id,provider,'provider-2',status,current_period_start,current_period_end,grace_period_end,
    metadata-'provider_transaction_id',updated_at from organization_subscriptions where id=$2`,[other,subId]);
  await assert.rejects(renew(await claim('tenant-b'),{subscription:other,provider:'provider-2'}),/another subscription/);
  assert.equal((await db.query('select count(*)::int as count from flutterwave_renewal_transactions')).rows[0].count,1);
});

