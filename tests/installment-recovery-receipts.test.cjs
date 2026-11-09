const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const key = 'limitless-installment-recovery:baa11de9-9326-41d6-8693-4dd1c5646532';
function setup(row, conflict = false) {
  const updates = [];
  let reads = 0;
  const admin = { from: table => {
    assert.equal(table, 'whatsapp_delivery_attempts');
    const q = { writing: false, select() { return this; }, eq(k,v) { if(k === 'organization_id') assert.equal(v, org); return this; },
      contains(k,v) { assert.equal(k, 'request_payload'); assert.equal(v.installment_recovery_key,key); return this; }, is() {return this;},
      update(patch) { this.writing = true; updates.push(patch); return this; },
      maybeSingle() { reads++; return Promise.resolve({data: this.writing ? conflict ? null : {id:'ledger'} : row,error:null}); } };
    return q;
  } };
  const api = load('lib/limitless-installment-recovery-receipts.ts', {'@/lib/supabase/admin':{createAdminClient:()=>admin}});
  return {...api,updates,reads:()=>reads};
}
const input = (status='delivered') => ({organizationId:org,callbackData:key,providerMessageId:'wamid.recovered',patch:{status}});
test('receipt binds a message ID to the preclaimed ledger before the send response is processed',async()=>{
  const api=setup({id:'ledger',status:'unknown',provider_message_id:null});
  assert.equal(await api.syncLimitlessInstallmentRecoveryReceipt(input()),true);
  assert.equal(api.updates[0].provider_message_id,'wamid.recovered');
  assert.equal(api.updates[0].status,'delivered');
});
test('ordinary messages, other tenants, and Joy John never enter recovery handling',async()=>{
  const api=setup(null);
  for(const changed of [{callbackData:null},{organizationId:'other'},{callbackData:'limitless-installment-recovery:9dfbe1ed-bf9f-401d-b20e-4cdfffd8cd1d'}])
    assert.equal(await api.syncLimitlessInstallmentRecoveryReceipt({...input(),...changed}),false);
  assert.equal(api.reads(),0);
});
test('late sent/failed and duplicate delivered receipts cannot downgrade delivery',async()=>{
  const api=setup({id:'ledger',status:'delivered',provider_message_id:'wamid.recovered'});
  for(const status of ['sent','failed','delivered']) assert.equal(await api.syncLimitlessInstallmentRecoveryReceipt(input(status)),true);
  assert.equal(api.updates.length,0);
});
test('a conflicting provider message ID never overwrites the original recovery',async()=>{
  const api=setup({id:'ledger',status:'unknown',provider_message_id:'wamid.other'});
  await assert.rejects(api.syncLimitlessInstallmentRecoveryReceipt(input()),/conflict/);
  assert.equal(api.updates.length,0);
});
test('missing records and concurrent updates require webhook redelivery',async()=>{
  await assert.rejects(setup(null).syncLimitlessInstallmentRecoveryReceipt(input()),/preclaimed/);
  await assert.rejects(setup({id:'ledger',status:'unknown',provider_message_id:null},true).syncLimitlessInstallmentRecoveryReceipt(input()),/redelivery/);
});
