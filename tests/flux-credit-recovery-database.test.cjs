/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserved,evidence,reconcile,count,available,other,finish,recoverySQL}=require('./helpers/flux-recovery-database.cjs');
test('matching completed evidence reconciles once with actor, reason and outcome in the same transaction',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 assert.equal((await reconcile(db,r)).outcome,'settled');assert.equal((await reconcile(db,r)).outcome,'already_settled');assert.equal(await count(db),1);
 assert.equal((await available(db)).balance,2);const audits=(await db.query('select * from audit_logs order by created_at')).rows;
 assert.equal(audits.length,2);assert.equal(audits[0].metadata.actor_email,'admin@example.test');assert.equal(audits[0].metadata.outcome,'settled');assert.equal(audits[0].reason,'Reviewed synthetic completed result');
 const ledger=(await db.query('select * from flux_credit_ledger')).rows[0];assert.equal(ledger.metadata.credit_reservation_id,r.id);assert.equal(ledger.metadata.actor_email,'admin@example.test');assert.equal(Number(ledger.provider_cost_cents),1);
});
for(const table of ['runtime_model_requests','usage_ledger','runtime_progress_events'])test(table+' missing or ambiguous never settles or releases',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 await db.exec('delete from '+table);assert.equal((await reconcile(db,r)).outcome,'blocked');assert.equal(await count(db),0);assert.equal((await available(db)).reserved,2);
});
for(const table of ['runtime_model_requests','usage_ledger','runtime_progress_events'])test('duplicate '+table+' requires review',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 const cols={runtime_model_requests:'organization_id,execution_id,status,response_payload,completed_at',usage_ledger:'organization_id,execution_id,usage_type,quantity,metadata,occurred_at',runtime_progress_events:'organization_id,execution_id,event_type,payload,created_at'}[table];
 await db.exec('insert into '+table+'('+cols+') select '+cols+' from '+table);assert.equal((await reconcile(db,r)).outcome,'blocked');assert.equal(await count(db),0);
});
for(const mutation of ["update runtime_model_requests set response_payload=response_payload-'credit_reservation_id'", "update runtime_model_requests set response_payload=jsonb_set(response_payload,'{credit_request_fingerprint}','\"wrong\"')", "update runtime_model_requests set status='failed'", "update runtime_model_requests set completed_at='2020-01-01'", "update usage_ledger set metadata='{}'", "update runtime_progress_events set payload='{}'", "update usage_ledger set quantity=999", "update usage_ledger set metadata=jsonb_set(metadata,'{provider}','\"wrong\"')", "update runtime_model_requests set organization_id='10000000-0000-4000-8000-000000000002'"])
 test('missing, stale, conflicting or foreign proof is blocked: '+mutation.split(' set ')[0],async t=>{
  const db=await fixture(t),r=await reserved(db);await evidence(db,r);await db.exec(mutation);assert.equal((await reconcile(db,r)).outcome,'blocked');assert.equal(await count(db),0);assert.equal((await available(db)).reserved,2);
 });
test('wrong organization, identity and invalid reasons fail without mutation',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 await assert.rejects(reconcile(db,r,{organization:other}),/inside organization/);await assert.rejects(reconcile(db,r,{email:''}),/identity/);await assert.rejects(reconcile(db,r,{reason:'short'}),/reason/);assert.equal(await count(db),0);
});
test('audit insertion failure rolls back debit, reservation and settlement history',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 await db.exec("create function fail_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger audit_failure before insert on audit_logs for each row execute function fail_audit();");
 await assert.rejects(reconcile(db,r),/audit failure/);assert.equal(await count(db),0);assert.equal((await available(db)).reserved,2);
 await db.exec('drop trigger audit_failure on audit_logs');assert.equal((await reconcile(db,r)).outcome,'settled');assert.equal(await count(db),1);
});
for(const mutation of ["update flux_credit_wallets set current_period_start='2026-11-02'", "update flux_credit_wallets set plan_code='plus'", "update flux_credit_wallets set status='suspended'", "update flux_credit_wallets set trial_ends_at='2020-01-01'", "update organizations set status='archived'"])
 test('changed billing or organization eligibility stays in review: '+mutation.split(' set ')[1],async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);await db.exec(mutation);const result=await reconcile(db,r);assert.notEqual(result.status,'settled');assert.equal(await count(db),0);assert.equal((await available(db)).reserved,2);assert.equal((await db.query('select count(*) as n from audit_logs')).rows[0].n,1);
 });
test('released reservations never become charged and deployment replay preserves evidence',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);await finish(db,r,'released');await db.exec(recoverySQL);assert.equal((await reconcile(db,r)).code,'reservation_released');assert.equal(await count(db),0);
});
test('RPC is invoker and only the service role may execute it',async t=>{
 const db=await fixture(t),r=await reserved(db);await evidence(db,r);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(reconcile(db,r),/permission denied/);await db.exec('reset role');}
 const f=(await db.query("select prosecdef,proconfig from pg_proc where proname='reconcile_flux_credit_capacity'")).rows[0];assert.equal(f.prosecdef,false);assert.ok(f.proconfig.some(x=>x.includes('search_path')));
 await db.exec('set role service_role');assert.equal((await reconcile(db,r)).outcome,'settled');await db.exec('reset role');
});
