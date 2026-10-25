const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const load = require('./helpers/load-typescript.cjs');

const migration = fs.readFileSync('supabase/migrations/20261024141300_handoff_notification_receipt_states.sql', 'utf8');
const retryStateMigration = fs.readFileSync('supabase/migrations/20261024141600_handoff_notification_retry_safety.sql', 'utf8');
const retryApprovalMigration = fs.readFileSync('supabase/migrations/20261024141700_handoff_notification_retry_approvals.sql', 'utf8');
const adapter = fs.readFileSync('lib/human-operations.ts', 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.organizations (id uuid PRIMARY KEY, slug text, status text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE public.organization_memberships (id uuid PRIMARY KEY, organization_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL);
    CREATE TABLE public.human_handoffs (id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL, UNIQUE(organization_id,id));
    CREATE TABLE handoff_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      handoff_id uuid NOT NULL,
      membership_id uuid,
      channel text NOT NULL CHECK(channel IN ('dashboard','whatsapp','email')),
      recipient text,
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','skipped')),
      provider_message_id text,
      error_message text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz
    );
  `);
  await db.exec(migration);
  await db.exec(retryStateMigration);
  await db.exec(retryApprovalMigration);
  return db;
}

async function receipt(db, id, status, errorMessage = null, errorCode = null, organizationId = '10000000-0000-4000-8000-000000000001') {
  const result = await db.query(
    'SELECT public.apply_handoff_notification_receipt($1,$2,$3,$4,$5) AS receipt',
    [organizationId, id, status, errorMessage, errorCode],
  );
  return result.rows[0].receipt;
}

async function add(db, id, status = 'pending') {
  return db.query(
    'INSERT INTO handoff_notifications(organization_id,handoff_id,channel,status,recipient,provider_message_id) VALUES($1,$2,$3,$4,$5,$6)',
    ['10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','whatsapp',status,'2348000000000',id],
  );
}

test('handoff receipts progress monotonically through sent, delivered and read', async () => {
  const db = await database();
  try {
    await add(db, 'provider-msg-1');
    let result = await receipt(db, 'provider-msg-1', 'sent');
    assert.equal(result.applied, true); assert.equal(result.status, 'sent');
    result = await receipt(db, 'provider-msg-1', 'delivered');
    assert.equal(result.applied, true); assert.equal(result.status, 'delivered');
    result = await receipt(db, 'provider-msg-1', 'sent');
    assert.equal(result.applied, false); assert.equal(result.status, 'delivered');
    result = await receipt(db, 'provider-msg-1', 'failed', 'late failure');
    assert.equal(result.applied, false); assert.equal(result.status, 'delivered');
    result = await receipt(db, 'provider-msg-1', 'read');
    assert.equal(result.applied, true); assert.equal(result.status, 'read');
    result = await receipt(db, 'provider-msg-1', 'failed', 'replayed failure');
    assert.equal(result.applied, false); assert.equal(result.status, 'read');
    const stored = (await db.query('SELECT status,error_message FROM handoff_notifications WHERE provider_message_id=$1',['provider-msg-1'])).rows[0];
    assert.equal(stored.status, 'read'); assert.equal(stored.error_message, null);
  } finally { await db.close(); }
});

test('a definite failed state can be repaired by later delivered/read receipts, but not by stale sent', async () => {
  const db = await database();
  try {
    await add(db, 'provider-msg-2', 'sent');
    let result = await receipt(db, 'provider-msg-2', 'failed', 'provider rejected message', '131047');
    assert.equal(result.applied, true); assert.equal(result.status, 'failed');
    assert.equal(result.errorMessage, 'provider rejected message');
    assert.equal((await db.query('SELECT error_code FROM handoff_notifications WHERE provider_message_id=$1',['provider-msg-2'])).rows[0].error_code,'131047');
    result = await receipt(db, 'provider-msg-2', 'sent');
    assert.equal(result.applied, false); assert.equal(result.status, 'failed');
    result = await receipt(db, 'provider-msg-2', 'delivered');
    assert.equal(result.applied, true); assert.equal(result.status, 'delivered');
  } finally { await db.close(); }
});

test('unmatched or ambiguous provider IDs fail closed without mutating rows', async () => {
  const db = await database();
  try {
    await add(db, 'provider-duplicate', 'sent');
    await add(db, 'provider-duplicate', 'sent');
    assert.equal((await receipt(db, 'not-found', 'delivered')).status, 'unmatched');
    assert.equal((await receipt(db, '', 'delivered')).status, 'unmatched');
    assert.equal((await receipt(db, 'provider-duplicate', 'delivered', null, null, '10000000-0000-4000-8000-000000000002')).status, 'unmatched');
    assert.equal((await receipt(db, 'provider-duplicate', 'delivered')).status, 'ambiguous');
    const rows = (await db.query('SELECT status FROM handoff_notifications ORDER BY id')).rows;
    assert.deepEqual(rows.map(row => row.status), ['sent','sent']);
    await assert.rejects(receipt(db, 'provider-duplicate', 'queued'), /Unsupported handoff delivery status/);
  } finally { await db.close(); }
});

test('receipt RPC is service-role-only and shared TypeScript adapter uses the atomic state machine', async () => {
  const db = await database();
  try {
    const privs = (await db.query(`
      SELECT has_function_privilege('anon','public.apply_handoff_notification_receipt(uuid,text,text,text,text)','EXECUTE') AS anon_exec,
             has_function_privilege('authenticated','public.apply_handoff_notification_receipt(uuid,text,text,text,text)','EXECUTE') AS auth_exec,
             has_function_privilege('service_role','public.apply_handoff_notification_receipt(uuid,text,text,text,text)','EXECUTE') AS service_exec
      LIMIT 1
    `)).rows[0];
    assert.equal(privs.anon_exec,false); assert.equal(privs.auth_exec,false); assert.equal(privs.service_exec,true);
    await add(db, 'provider-msg-3');
    await db.exec('SET ROLE anon');
    await assert.rejects(receipt(db,'provider-msg-3','delivered'),/permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');
    assert.equal((await receipt(db,'provider-msg-3','delivered')).status,'delivered');
    await db.exec('RESET ROLE');

    const start = adapter.indexOf('export async function syncHandoffNotificationStatus');
    const end = adapter.indexOf('\nexport type HumanHandoffRow', start);
    const body = adapter.slice(start, end);
    assert.match(body,/rpc\("apply_handoff_notification_receipt"/);
    assert.match(body,/p_organization_id:input\.organizationId/);
    assert.match(body,/p_error_code:input\.errorCode/);
    assert.match(body,/parseHandoffNotificationReceipt/);
    assert.match(body,/receipt\.applied/);
    assert.match(body,/receipt\.organizationId!==input\.organizationId/);
    assert.match(body,/eq\("status","failed"\)/);
    assert.doesNotMatch(body,/update\(\{status:input\.status/);
  } finally { await db.close(); }
});

test('receipt adapter rejects arrays, snake-case payloads, and cross-tenant identities', async () => {
  const moduleFor = (data) => {
    const calls = [];
    const admin = {
      rpc: async () => ({ data, error: null }),
      from: () => { calls.push('from'); throw new Error('unexpected database write'); },
    };
    const operations = load(path.resolve(__dirname, '../lib/human-operations.ts'), {
      '@/lib/supabase/admin': { createAdminClient: () => admin },
      '@/lib/organization-membership': {
        getOrganizationAccessContext: async () => ({}),
        assertAnyOrganizationPermission() {},
        listOrganizationMembers: async () => [],
      },
      '@/lib/whatsapp-delivery': { sendWhatsAppMessage: async () => { throw new Error('unexpected send'); } },
      '@/lib/ai/limitless-handoff-policy.mjs': {
        LIMITLESS_REALTY_ORGANIZATION_ID: 'org-1',
        createLimitlessHumanHandoff: async () => ({}),
      },
    });
    return { operations, calls };
  };
  const input = { organizationId: 'org-1', providerMessageId: 'provider-1', status: 'delivered' };

  const arrayResponse = moduleFor([{ applied: true }]);
  await assert.rejects(arrayResponse.operations.syncHandoffNotificationStatus(input), /non-object payload/);
  assert.deepEqual(arrayResponse.calls, []);

  const snakeCaseResponse = moduleFor({ applied: true, status: 'delivered', notification_id: 'notification-1', organization_id: 'org-1', handoff_id: 'handoff-1' });
  await assert.rejects(snakeCaseResponse.operations.syncHandoffNotificationStatus(input), /tenant-bound identifiers/);
  assert.deepEqual(snakeCaseResponse.calls, []);

  const otherTenantResponse = moduleFor({ applied: true, status: 'delivered', notificationId: 'notification-1', organizationId: 'org-2', handoffId: 'handoff-1', recipient: '2348000000000', metadata: {} });
  await assert.rejects(otherTenantResponse.operations.syncHandoffNotificationStatus(input), /organization did not match/);
  assert.deepEqual(otherTenantResponse.calls, []);
});


const RETRY_ORG='10000000-0000-4000-8000-000000000001';
const RETRY_HANDOFF='20000000-0000-4000-8000-000000000001';
const RETRY_NOTIFICATION='30000000-0000-4000-8000-000000000001';
const RETRY_USER='40000000-0000-4000-8000-000000000001';
const RETRY_MEMBER='50000000-0000-4000-8000-000000000001';
const RETRY_APPROVAL='60000000-0000-4000-8000-000000000001';
const MESSAGE_HASH='a'.repeat(64);
const RECIPIENT_HASH='b'.repeat(64);

async function retryFixture(db,{handoffStatus='assigned',retryCount=0}={}){
  await db.query('INSERT INTO organizations(id,slug,status,metadata) VALUES($1,$2,$3,$4::jsonb)',[RETRY_ORG,'replica-realty','active',JSON.stringify({industry:'real-estate'})]);
  await db.query('INSERT INTO auth.users(id) VALUES($1)',[RETRY_USER]);
  await db.query('INSERT INTO organization_memberships(id,organization_id,user_id,status) VALUES($1,$2,$3,$4)',[RETRY_MEMBER,RETRY_ORG,RETRY_USER,'active']);
  await db.query('INSERT INTO human_handoffs(id,organization_id,status) VALUES($1,$2,$3)',[RETRY_HANDOFF,RETRY_ORG,handoffStatus]);
  await db.query(`INSERT INTO handoff_notifications(id,organization_id,handoff_id,membership_id,channel,recipient,status,error_code,retry_count,provider_message_id)
    VALUES($1,$2,$3,$4,'whatsapp','2348000000000','failed','131047',$5,'old-provider-id')`,[RETRY_NOTIFICATION,RETRY_ORG,RETRY_HANDOFF,RETRY_MEMBER,retryCount]);
  await db.query(`INSERT INTO handoff_notification_retry_approvals(id,organization_id,handoff_id,notification_id,actor_user_id,actor_membership_id,message_digest,recipient_digest,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '2 minutes')`,[RETRY_APPROVAL,RETRY_ORG,RETRY_HANDOFF,RETRY_NOTIFICATION,RETRY_USER,RETRY_MEMBER,MESSAGE_HASH,RECIPIENT_HASH]);
}

async function claimRetry(db,{approvalId=RETRY_APPROVAL,organizationId=RETRY_ORG,handoffId=RETRY_HANDOFF,notificationId=RETRY_NOTIFICATION,actorUserId=RETRY_USER,membershipId=RETRY_MEMBER,messageDigest=MESSAGE_HASH,recipientDigest=RECIPIENT_HASH,recipient='2348000000000'}={}){
  const result=await db.query(`SELECT public.claim_real_estate_handoff_notification_retry($1,$2,$3,$4,$5,$6,$7,$8,$9) AS claim`,[
    approvalId,organizationId,handoffId,notificationId,actorUserId,membershipId,messageDigest,recipientDigest,recipient,
  ]);
  return result.rows[0].claim;
}

test('retry claim consumes the exact preview once and transitions only the still-failed row',async()=>{
  const db=await database();
  try{
    await retryFixture(db);
    const result=await claimRetry(db);
    assert.equal(result.claimed,true);
    assert.equal(result.retryCount,1);
    const row=(await db.query('SELECT status,retry_count,error_code,provider_message_id FROM handoff_notifications WHERE id=$1',[RETRY_NOTIFICATION])).rows[0];
    assert.deepEqual(row,{status:'pending',retry_count:1,error_code:null,provider_message_id:null});
    await assert.rejects(claimRetry(db),/Retry approval expired, changed, or already used/);
    const permissions=(await db.query(`SELECT has_function_privilege('anon','public.claim_real_estate_handoff_notification_retry(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') AS anon_exec,
      has_function_privilege('authenticated','public.claim_real_estate_handoff_notification_retry(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') AS auth_exec,
      has_function_privilege('service_role','public.claim_real_estate_handoff_notification_retry(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') AS service_exec`)).rows[0];
    assert.equal(permissions.anon_exec,false);assert.equal(permissions.auth_exec,false);assert.equal(permissions.service_exec,true);
  }finally{await db.close();}
});

test('changed message, recipient, tenant or closed handoff cannot consume a retry approval',async()=>{
  const db=await database();
  try{
    await retryFixture(db);
    await assert.rejects(claimRetry(db,{messageDigest:'c'.repeat(64)}),/Retry approval expired, changed, or already used/);
    await assert.rejects(claimRetry(db,{recipient:'2348000000001'}),/Staff destination changed after preview/);
    await assert.rejects(claimRetry(db,{organizationId:'10000000-0000-4000-8000-000000000002'}),/Retry is limited to active real-estate organizations/);
    await db.query('UPDATE human_handoffs SET status=$1 WHERE id=$2',['resolved',RETRY_HANDOFF]);
    await assert.rejects(claimRetry(db),/Handoff is no longer open/);
    const row=(await db.query('SELECT status,retry_count FROM handoff_notifications WHERE id=$1',[RETRY_NOTIFICATION])).rows[0];
    assert.equal(row.status,'failed');assert.equal(row.retry_count,0);
  }finally{await db.close();}
});

test('retry membership must belong to the exact human user principal',async()=>{
  const db=await database();
  try{
    await retryFixture(db);
    const otherUser='40000000-0000-4000-8000-000000000002';
    await db.query('INSERT INTO auth.users(id) VALUES($1)',[otherUser]);
    await db.query('UPDATE handoff_notification_retry_approvals SET actor_user_id=$1 WHERE id=$2',[otherUser,RETRY_APPROVAL]);
    await assert.rejects(claimRetry(db,{actorUserId:otherUser}),/Retry actor is not an active member of this organization/);
    const row=(await db.query('SELECT status,retry_count FROM handoff_notifications WHERE id=$1',[RETRY_NOTIFICATION])).rows[0];
    assert.equal(row.status,'failed');assert.equal(row.retry_count,0);
  }finally{await db.close();}
});

test('expired approvals, ambiguous unknown sends and retry limit cannot be claimed',async()=>{
  const db=await database();
  try{
    await retryFixture(db,{retryCount:3});
    await assert.rejects(claimRetry(db),/Handoff notification retry limit reached/);
    await db.query('UPDATE handoff_notifications SET retry_count=0,status=$1 WHERE id=$2',['unknown',RETRY_NOTIFICATION]);
    await assert.rejects(claimRetry(db),/Only a definitive provider rejection can be retried/);
    await db.query('UPDATE handoff_notifications SET status=$1,error_code=$2 WHERE id=$3',['failed','131047',RETRY_NOTIFICATION]);
    await db.query('UPDATE handoff_notification_retry_approvals SET expires_at=now()-interval \'1 second\' WHERE id=$1',[RETRY_APPROVAL]);
    await assert.rejects(claimRetry(db),/Retry approval expired, changed, or already used/);
  }finally{await db.close();}
});
