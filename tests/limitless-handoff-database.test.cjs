const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const ORG_A = '10000000-0000-4000-8000-000000000001';
const ORG_B = '20000000-0000-4000-8000-000000000001';
const CUSTOMER_A = '30000000-0000-4000-8000-000000000001';
const CONVERSATION_A = '40000000-0000-4000-8000-000000000001';
const AGENT_A = '50000000-0000-4000-8000-000000000001';
const AGENT_B = '60000000-0000-4000-8000-000000000001';
const migration = fs.readFileSync('supabase/migrations/20261024140400_real_estate_handoff_idempotency.sql', 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE TABLE crm_conversations (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'active'
    );
    CREATE TABLE agents(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE human_handoffs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      customer_id uuid NOT NULL,
      conversation_id uuid NOT NULL,
      correlation_id uuid,
      reason text NOT NULL,
      category text NOT NULL,
      priority text NOT NULL,
      source_agent_id uuid,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO crm_conversations(id, organization_id, customer_id) VALUES ('${CONVERSATION_A}','${ORG_A}','${CUSTOMER_A}');
    INSERT INTO agents(id, organization_id) VALUES ('${AGENT_A}','${ORG_A}'),('${AGENT_B}','${ORG_B}');
    CREATE FUNCTION public.create_human_handoff(
      p_organization_id uuid, p_customer_id uuid, p_conversation_id uuid,
      p_reason text, p_category text, p_priority text,
      p_source_system_id uuid, p_source_agent_id uuid, p_correlation_id uuid,
      p_sla_due_at timestamptz, p_created_by_type text, p_created_by_id text,
      p_metadata jsonb
    ) RETURNS uuid LANGUAGE plpgsql AS $$
    DECLARE v_id uuid;
    BEGIN
      INSERT INTO public.human_handoffs(
        organization_id,customer_id,conversation_id,correlation_id,reason,
        category,priority,source_agent_id,status
      ) VALUES (
        p_organization_id,p_customer_id,p_conversation_id,p_correlation_id,p_reason,
        p_category,p_priority,p_source_agent_id,'open'
      ) RETURNING id INTO v_id;
      RETURN v_id;
    END; $$;
  `);
  await db.exec(migration);
  return db;
}

function call(db, { organizationId = ORG_A, customerId = CUSTOMER_A, conversationId = CONVERSATION_A, agentId = AGENT_A, correlationId = '70000000-0000-4000-8000-000000000001' } = {}) {
  return db.query(`
    SELECT public.create_real_estate_handoff_once(
      $1,$2,$3,'Customer requested human assistance','documentation','high',
      NULL,$4,$5,now()+interval '1 hour','agent',$6,'{}'::jsonb
    ) AS result
  `, [organizationId, customerId, conversationId, agentId, correlationId, String(agentId)]);
}

test('real SQL handoff RPC serializes duplicate requests and returns one canonical handoff', async () => {
  const db = await database();
  try {
    const results = await Promise.all([call(db), call(db)]);
    const payloads = results.map(result => result.rows[0].result);
    assert.equal(payloads.filter(result => result.created).length, 1);
    assert.equal(payloads.filter(result => !result.created).length, 1);
    assert.equal(payloads[0].handoffId, payloads[1].handoffId);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM human_handoffs')).rows[0].count, 1);

    const replay = (await call(db)).rows[0].result;
    assert.equal(replay.created, false);
    assert.equal(replay.handoffId, payloads[0].handoffId);

    await db.query("UPDATE human_handoffs SET status='resolved' WHERE id=$1", [replay.handoffId]);
    const sameCorrelation = (await call(db)).rows[0].result;
    assert.equal(sameCorrelation.created, false);
    assert.equal(sameCorrelation.handoffId, replay.handoffId);
    const newCorrelation = (await call(db, { correlationId: '70000000-0000-4000-8000-000000000002' })).rows[0].result;
    assert.equal(newCorrelation.created, true);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM human_handoffs')).rows[0].count, 2);
  } finally { await db.close(); }
});

test('real SQL handoff RPC rejects cross-tenant conversations and foreign agents', async () => {
  const db = await database();
  try {
    await assert.rejects(call(db, { organizationId: ORG_B }), /Conversation does not belong to the customer organization/);
    await assert.rejects(call(db, { agentId: AGENT_B }), /Agent does not belong to organization/);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM human_handoffs')).rows[0].count, 0);
  } finally { await db.close(); }
});

test('real handoff RPC grants execution only to the service role', async () => {
  const db = await database();
  try {
    const privileges = (await db.query(`
      SELECT has_function_privilege('anon','public.create_real_estate_handoff_once(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb)','EXECUTE') AS anon_exec,
             has_function_privilege('authenticated','public.create_real_estate_handoff_once(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb)','EXECUTE') AS auth_exec,
             has_function_privilege('service_role','public.create_real_estate_handoff_once(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb)','EXECUTE') AS service_exec
      LIMIT 1
    `)).rows[0];
    assert.equal(privileges.anon_exec, false);
    assert.equal(privileges.auth_exec, false);
    assert.equal(privileges.service_exec, true);

    await db.exec('SET ROLE anon');
    await assert.rejects(call(db), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');
    assert.equal((await call(db)).rows[0].result.created, true);
    await db.exec('RESET ROLE');
  } finally { await db.close(); }
});
