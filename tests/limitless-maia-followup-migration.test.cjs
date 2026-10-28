const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const A = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const B = '7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const CUSTOMER = '20000000-0000-4000-8000-000000000001';
const CUSTOMER_B = '20000000-0000-4000-8000-000000000002';
const SEQUENCE = '30000000-0000-4000-8000-000000000001';
const SEQUENCE_B = '30000000-0000-4000-8000-000000000002';
const STEP = '40000000-0000-4000-8000-000000000001';
const STEP_B = '40000000-0000-4000-8000-000000000002';
const LEAD_B = '50000000-0000-4000-8000-000000000002';
const PROPERTY_B = '60000000-0000-4000-8000-000000000002';
const MIGRATION = 'supabase/migrations/20261027220100_limitless_maia_followup_sequence_identity.sql';

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create table organizations(id uuid primary key);
    insert into organizations(id) values ('${A}'), ('${B}');
    create table leads(
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      opted_out boolean default false,
      updated_at timestamptz default now()
    );
    create table properties(
      id uuid primary key,
      organization_id uuid not null references organizations(id)
    );
    create table tenant_customer_contacts(
      id uuid primary key,
      organization_id uuid not null references organizations(id)
    );
    insert into tenant_customer_contacts(id,organization_id) values ('${CUSTOMER}','${A}'), ('${CUSTOMER_B}','${B}');
    insert into leads(id,organization_id,opted_out) values
      ('50000000-0000-4000-8000-000000000001','${A}',false),
      ('${LEAD_B}','${B}',false);
    insert into properties(id,organization_id) values
      ('60000000-0000-4000-8000-000000000001','${A}'),
      ('${PROPERTY_B}','${B}');
    create table follow_ups(
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      lead_id uuid not null,
      stage integer not null,
      scheduled_at timestamptz not null,
      sent_at timestamptz,
      message_sent text,
      status text not null default 'pending',
      channel text not null default 'whatsapp',
      agent_key text not null default 'maia',
      template_name text,
      created_at timestamptz not null default now()
    );
    alter table follow_ups enable row level security;
    create policy fixture_existing_followup_access on follow_ups
      for all to anon, authenticated using (true) with check (true);
    grant all privileges on table follow_ups to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
  return db;
}

test('day-30 completion remains non-terminal and one stable nurture step key is unique', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into limitless_maia_followup_sequences(id,organization_id,customer_id,lead_id,property_id,sequence_key,consent_state,consent_at,consent_source,consent_actor)
       values($1,$2,$3,$4,$5,'maia_limitless_property_sales_followup_v1','opted_in',now(),'fixture','fixture')`,
      [SEQUENCE, A, CUSTOMER, '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'],
    );
    await db.query(
      `insert into follow_ups(id,organization_id,lead_id,customer_id,property_id,sequence_id,sequence_key,sequence_step_key,stage,scheduled_at,due_at,consent_state)
       values($1,$2,$3,$4,$5,$6,'maia_limitless_property_sales_followup_v1','day-30',6,now(),now(),'opted_in')`,
      [STEP, A, '50000000-0000-4000-8000-000000000001', CUSTOMER, '60000000-0000-4000-8000-000000000001', SEQUENCE],
    );
    await db.query('update follow_ups set status=$1 where id=$2', ['sent', STEP]);
    const parent = (await db.query('select status from limitless_maia_followup_sequences where id=$1', [SEQUENCE])).rows[0];
    assert.equal(parent.status, 'active');
    await assert.rejects(
      db.query(
        `insert into follow_ups(organization_id,lead_id,customer_id,property_id,sequence_id,sequence_key,sequence_step_key,stage,scheduled_at,due_at,consent_state)
         values($1,$2,$3,$4,$5,'maia_limitless_property_sales_followup_v1','day-30',7,now(),now(),'opted_in')`,
        [A, '50000000-0000-4000-8000-000000000001', CUSTOMER, '60000000-0000-4000-8000-000000000001', SEQUENCE],
      ),
      /unique constraint/,
    );
  } finally {
    await db.close();
  }
});

test('follow-up sequence and event tables are not readable by browser roles', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into limitless_maia_followup_sequences(organization_id,customer_id,sequence_key)
       values($1,$2,'fixture-sequence')`,
      [A, CUSTOMER],
    );
    await db.query(
      `insert into limitless_maia_followup_events(organization_id,customer_id,event_type,source,actor)
       values($1,$2,'opt_in','fixture','fixture')`,
      [A, CUSTOMER],
    );
    await db.exec('set role anon');
    await assert.rejects(db.query('select count(*) from limitless_maia_followup_sequences'), /permission denied/);
    await assert.rejects(db.query('select count(*) from limitless_maia_followup_events'), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select count(*) from limitless_maia_followup_sequences')).rows[0].count, 1);
    assert.equal((await db.query('select count(*) from limitless_maia_followup_events')).rows[0].count, 1);
  } finally {
    await db.close();
  }
});


const LEAD = '50000000-0000-4000-8000-000000000001';
const PROPERTY = '60000000-0000-4000-8000-000000000001';
const SEQUENCE_KEY = 'maia_limitless_property_sales_followup_v1';
const DAY_KEYS = ['day-1', 'day-3', 'day-7', 'day-14', 'day-21', 'day-30'];

function scheduledSteps() {
  return DAY_KEYS.map((sequence_step_key, index) => {
    const scheduled_at = new Date(Date.now() + (index + 1) * 86_400_000).toISOString();
    return { sequence_step_key, stage: index + 1, scheduled_at, due_at: scheduled_at, message_sent: `Checking in about the verified property, step ${index + 1}.` };
  });
}

async function enroll(db, steps = scheduledSteps(), renewedConsent = false, customerId = CUSTOMER) {
  const consentAt = new Date().toISOString();
  const result = await db.query(
    `select public.create_limitless_maia_followup_sequence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) as result`,
    [A, customerId, LEAD, PROPERTY, SEQUENCE, SEQUENCE_KEY, consentAt, 'explicit_customer_opt_in', `customer:${customerId}`, renewedConsent, JSON.stringify(steps)],
  );
  return result.rows[0].result;
}

async function claimStep(db, stepId = STEP) {
  const result = await db.query(
    `select public.claim_limitless_maia_followup_step($1,$2,$3,$4,$5,$6,$7) as result`,
    [A, CUSTOMER, PROPERTY, SEQUENCE, stepId, LEAD, '70000000-0000-4000-8000-000000000001'],
  );
  return result.rows[0].result;
}

async function authorizeStep(db, stepId = STEP) {
  const result = await db.query(
    `select public.authorize_limitless_maia_followup_send($1,$2,$3,$4,$5,$6,$7) as result`,
    [A, CUSTOMER, PROPERTY, SEQUENCE, stepId, LEAD, '70000000-0000-4000-8000-000000000001'],
  );
  return result.rows[0].result;
}

async function controlSequence(db, action = 'stop', stepId = STEP) {
  const result = await db.query(
    `select public.control_limitless_maia_followup_sequence($1,$2,$3,$4,$5,$6,$7,$8,$9) as result`,
    [A, CUSTOMER, PROPERTY, SEQUENCE, stepId, action, 'operator requested stop', 'fixture-admin', null],
  );
  return result.rows[0].result;
}

async function optOutLead(db, leadId = LEAD, organizationId = A) {
  const result = await db.query(
    `select public.record_limitless_maia_opt_out($1,$2,$3) as result`,
    [organizationId, leadId, 'fixture-provider-event'],
  );
  return result.rows[0].result;
}

test('atomic enrollment commits the sequence, opt-in event, and complete six-step schedule together', async () => {
  const db = await createDatabase();
  try {
    await db.query('update leads set opted_out=null where id=$1', [LEAD]);
    const result = await enroll(db);
    assert.equal(result.sequence_id, SEQUENCE);
    assert.equal(result.followups.length, 6);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_sequences')).rows[0].count, 1);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_events where event_type=$1', ['opt_in'])).rows[0].count, 1);
    assert.equal((await db.query('select count(*) as count from follow_ups where sequence_id=$1 and status=$2', [SEQUENCE, 'pending'])).rows[0].count, 6);
    assert.equal((await claimStep(db, result.followups[0].id)).claimed, true);
  } finally {
    await db.close();
  }
});

test('explicit renewed customer consent alone clears opt-out and is audited before a new sequence can send', async () => {
  const db = await createDatabase();
  try {
    await db.query('update leads set opted_out=true where id=$1', [LEAD]);
    await assert.rejects(enroll(db), /explicit renewed customer consent/);
    assert.equal((await db.query('select opted_out from leads where id=$1', [LEAD])).rows[0].opted_out, true);
    const renewed = await enroll(db, scheduledSteps(), true);
    assert.equal(renewed.followups.length, 6);
    assert.equal((await db.query('select opted_out from leads where id=$1', [LEAD])).rows[0].opted_out, false);
    assert.equal((await db.query("select metadata->>'renewed_consent' as renewed from limitless_maia_followup_events where event_type='opt_in' limit 1")).rows[0].renewed, 'true');
    assert.equal((await claimStep(db, renewed.followups[0].id)).claimed, true);
  } finally {
    await db.close();
  }
});

test('atomic enrollment rejects a customer contact that belongs to another organization', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(enroll(db, scheduledSteps(), false, CUSTOMER_B), /customer is not available in the active organization/);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_sequences')).rows[0].count, 0);
    assert.equal((await db.query('select count(*) as count from follow_ups')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('claim, authorize, and control RPCs fail closed for non-Limitless organization arguments', async () => {
  const db = await createDatabase();
  const claimToken = '70000000-0000-4000-8000-000000000002';
  try {
    await db.query(
      `insert into limitless_maia_followup_sequences(
         id,organization_id,customer_id,lead_id,property_id,sequence_key,
         status,consent_state,consent_at,consent_source,consent_actor
       ) values($1,$2,$3,$4,$5,'other-tenant-sequence','active','opted_in',now(),'fixture','fixture')`,
      [SEQUENCE_B, B, CUSTOMER_B, LEAD_B, PROPERTY_B],
    );
    await db.query(
      `insert into follow_ups(
         id,organization_id,lead_id,customer_id,property_id,sequence_id,
         sequence_key,sequence_step_key,stage,scheduled_at,due_at,consent_state
       ) values($1,$2,$3,$4,$5,$6,'other-tenant-sequence','day-1',1,now(),now(),'opted_in')`,
      [STEP_B, B, LEAD_B, CUSTOMER_B, PROPERTY_B, SEQUENCE_B],
    );

    const claim = (await db.query(
      `select public.claim_limitless_maia_followup_step($1,$2,$3,$4,$5,$6,$7) as result`,
      [B, CUSTOMER_B, PROPERTY_B, SEQUENCE_B, STEP_B, LEAD_B, claimToken],
    )).rows[0].result;
    assert.deepEqual(claim, { claimed: false, reason: 'invalid_organization' });
    assert.equal((await db.query('select status,attempt_count from follow_ups where id=$1', [STEP_B])).rows[0].status, 'pending');

    await db.query('update follow_ups set status=$1,claim_token=$2 where id=$3', ['processing', claimToken, STEP_B]);
    const authorization = (await db.query(
      `select public.authorize_limitless_maia_followup_send($1,$2,$3,$4,$5,$6,$7) as result`,
      [B, CUSTOMER_B, PROPERTY_B, SEQUENCE_B, STEP_B, LEAD_B, claimToken],
    )).rows[0].result;
    assert.deepEqual(authorization, { authorized: false, reason: 'invalid_organization' });
    assert.equal((await db.query('select send_authorized_at from follow_ups where id=$1', [STEP_B])).rows[0].send_authorized_at, null);

    await assert.rejects(
      db.query(
        `select public.control_limitless_maia_followup_sequence($1,$2,$3,$4,$5,$6,$7,$8,$9) as result`,
        [B, CUSTOMER_B, PROPERTY_B, SEQUENCE_B, STEP_B, 'stop', 'other-tenant stop', 'fixture-admin', null],
      ),
      /Exact sequence scope, supported action, reason, and actor are required\./,
    );
    assert.equal((await db.query('select status,stop_reason from limitless_maia_followup_sequences where id=$1', [SEQUENCE_B])).rows[0].status, 'active');
    assert.equal((await db.query('select status from follow_ups where id=$1', [STEP_B])).rows[0].status, 'processing');
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where organization_id=$1", [B])).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('an opt-in audit failure rolls back the active sequence and every step', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      create function reject_opt_in_event() returns trigger language plpgsql as $$
      begin
        if new.event_type = 'opt_in' then raise exception 'fixture audit failure'; end if;
        return new;
      end; $$;
      create trigger reject_opt_in_event before insert on limitless_maia_followup_events
      for each row execute function reject_opt_in_event();
    `);
    await assert.rejects(enroll(db), /fixture audit failure/);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_sequences')).rows[0].count, 0);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_events')).rows[0].count, 0);
    assert.equal((await db.query('select count(*) as count from follow_ups')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('a failure after partial step insertion rolls back the sequence, consent event, and prior steps', async () => {
  const db = await createDatabase();
  try {
    await db.exec(`
      create function reject_fourth_followup_step() returns trigger language plpgsql as $$
      begin
        if new.stage = 4 then raise exception 'fixture step failure'; end if;
        return new;
      end; $$;
      create trigger reject_fourth_followup_step before insert on follow_ups
      for each row execute function reject_fourth_followup_step();
    `);
    await assert.rejects(enroll(db), /fixture step failure/);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_sequences')).rows[0].count, 0);
    assert.equal((await db.query('select count(*) as count from limitless_maia_followup_events')).rows[0].count, 0);
    assert.equal((await db.query('select count(*) as count from follow_ups')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('a failed admin audit insert rolls back the parent and child state transition', async () => {
  const db = await createDatabase();
  try {
    const created = await enroll(db);
    await db.exec(`
      create function reject_control_event() returns trigger language plpgsql as $$
      begin
        if new.event_type like 'control.%' then raise exception 'fixture control audit failure'; end if;
        return new;
      end; $$;
      create trigger reject_control_event before insert on limitless_maia_followup_events
      for each row execute function reject_control_event();
    `);
    await assert.rejects(controlSequence(db, 'stop', created.followups[0].id), /fixture control audit failure/);
    assert.equal((await db.query('select status from limitless_maia_followup_sequences where id=$1', [SEQUENCE])).rows[0].status, 'active');
    assert.equal((await db.query('select count(*) as count from follow_ups where sequence_id=$1 and status=$2', [SEQUENCE, 'pending'])).rows[0].count, 6);
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where event_type='control.stop'")).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('stop committed before send authorization prevents provider delivery', async () => {
  const db = await createDatabase();
  try {
    const created = await enroll(db);
    const stepId = created.followups[0].id;
    const claim = await claimStep(db, stepId);
    assert.equal(claim.claimed, true);
    const stopped = await controlSequence(db, 'stop', stepId);
    assert.equal(stopped.sequence_status, 'stopped');
    const authorization = await authorizeStep(db, stepId);
    assert.equal(authorization.authorized, false);
    assert.equal(authorization.sequence_status, 'stopped');
    assert.equal((await db.query('select status from follow_ups where id=$1', [stepId])).rows[0].status, 'cancelled');
  } finally {
    await db.close();
  }
});

test('an already authorized provider call is recorded as in-flight and is not rewritten by a later stop', async () => {
  const db = await createDatabase();
  try {
    const created = await enroll(db);
    const stepId = created.followups[0].id;
    assert.equal((await claimStep(db, stepId)).claimed, true);
    assert.equal((await authorizeStep(db, stepId)).authorized, true);
    assert.equal((await controlSequence(db, 'stop', stepId)).sequence_status, 'stopped');
    const step = (await db.query('select status,send_authorized_at from follow_ups where id=$1', [stepId])).rows[0];
    assert.equal(step.status, 'processing');
    assert.ok(step.send_authorized_at);
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where event_type='delivery.authorized'")).rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('atomic customer STOP preserves an authorized in-flight send and cancels every not-yet-authorized step', async () => {
  const db = await createDatabase();
  try {
    const created = await enroll(db);
    const authorizedStep = created.followups[0].id;
    assert.equal((await claimStep(db, authorizedStep)).claimed, true);
    assert.equal((await authorizeStep(db, authorizedStep)).authorized, true);

    const result = await optOutLead(db);
    assert.equal(result.opted_out, true);
    assert.equal(result.sequences_updated, 1);
    assert.equal(result.steps_cancelled, 5);
    assert.equal((await db.query('select opted_out from leads where id=$1', [LEAD])).rows[0].opted_out, true);
    assert.equal((await db.query('select status,consent_state from limitless_maia_followup_sequences where id=$1', [SEQUENCE])).rows[0].status, 'opted_out');
    const inFlight = (await db.query('select status,send_authorized_at from follow_ups where id=$1', [authorizedStep])).rows[0];
    assert.equal(inFlight.status, 'processing');
    assert.ok(inFlight.send_authorized_at);
    assert.equal((await db.query("select count(*) as count from follow_ups where sequence_id=$1 and status='cancelled'", [SEQUENCE])).rows[0].count, 5);
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where event_type='opt_out' and sequence_id=$1", [SEQUENCE])).rows[0].count, 1);

    await db.query('update follow_ups set status=$1,sent_at=now() where organization_id=$2 and id=$3 and status=$4 and send_authorized_at is not null', ['sent', A, authorizedStep, 'processing']);
    assert.equal((await db.query('select status from follow_ups where id=$1', [authorizedStep])).rows[0].status, 'sent');
  } finally {
    await db.close();
  }
});

test('customer STOP before send authorization cancels the claim and authorization is denied', async () => {
  const db = await createDatabase();
  try {
    const created = await enroll(db);
    const stepId = created.followups[0].id;
    assert.equal((await claimStep(db, stepId)).claimed, true);
    await optOutLead(db);
    const authorization = await authorizeStep(db, stepId);
    assert.equal(authorization.authorized, false);
    assert.equal(authorization.sequence_status, 'opted_out');
    assert.equal((await db.query('select status from follow_ups where id=$1', [stepId])).rows[0].status, 'cancelled');
  } finally {
    await db.close();
  }
});

test('an opt-out audit failure rolls back the lead, sequence, and step changes together', async () => {
  const db = await createDatabase();
  try {
    await enroll(db);
    await db.exec(`
      create function reject_opt_out_event() returns trigger language plpgsql as $$
      begin
        if new.event_type = 'opt_out' then raise exception 'fixture opt-out audit failure'; end if;
        return new;
      end; $$;
      create trigger reject_opt_out_event before insert on limitless_maia_followup_events
      for each row execute function reject_opt_out_event();
    `);
    await assert.rejects(optOutLead(db), /fixture opt-out audit failure/);
    assert.equal((await db.query('select opted_out from leads where id=$1', [LEAD])).rows[0].opted_out, false);
    assert.equal((await db.query('select status from limitless_maia_followup_sequences where id=$1', [SEQUENCE])).rows[0].status, 'active');
    assert.equal((await db.query("select count(*) as count from follow_ups where sequence_id=$1 and status='pending'", [SEQUENCE])).rows[0].count, 6);
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where event_type='opt_out'")).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('STOP without an existing canonical sequence still records a lead-scoped audit event', async () => {
  const db = await createDatabase();
  try {
    const result = await optOutLead(db);
    assert.equal(result.opted_out, true);
    const event = (await db.query("select organization_id,customer_id,lead_id,sequence_id,event_type from limitless_maia_followup_events where event_type='opt_out' limit 1")).rows[0];
    assert.equal(event.organization_id, A);
    assert.equal(event.customer_id, null);
    assert.equal(event.lead_id, LEAD);
    assert.equal(event.sequence_id, null);
  } finally {
    await db.close();
  }
});

test('sequence-level close works without a step id and remains atomic', async () => {
  const db = await createDatabase();
  try {
    await enroll(db);
    const result = await controlSequence(db, 'close', null);
    assert.equal(result.sequence_status, 'completed');
    assert.equal((await db.query("select count(*) as count from follow_ups where sequence_id=$1 and status='cancelled'", [SEQUENCE])).rows[0].count, 6);
    assert.equal((await db.query("select count(*) as count from limitless_maia_followup_events where event_type='control.close' and step_id is null")).rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('RLS hides Limitless canonical follow-up rows from browser roles but preserves other tenant and legacy access', async () => {
  const db = await createDatabase();
  const legacyId = '80000000-0000-4000-8000-000000000001';
  const limitlessSequenceRowId = '80000000-0000-4000-8000-000000000002';
  const otherTenantRowId = '80000000-0000-4000-8000-000000000003';
  try {
    await db.query(
      `insert into follow_ups(id,organization_id,lead_id,customer_id,property_id,sequence_id,sequence_key,sequence_step_key,stage,scheduled_at,consent_state,consent_source)
       values($1,$2,$3,$4,$5,null,null,null,1,now(),'unknown',null),
             ($6,$2,$3,$4,$5,$7,'maia_limitless_property_sales_followup_v1','day-1',1,now(),'opted_in','sensitive-limitless-value'),
             ($8,$9,$3,$10,$5,$11,'other-tenant-sequence','day-1',1,now(),'opted_in','other-tenant-value')`,
      [legacyId, A, LEAD, CUSTOMER, PROPERTY, limitlessSequenceRowId, SEQUENCE, otherTenantRowId, B, CUSTOMER_B, '90000000-0000-4000-8000-000000000001'],
    );
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      const visible = (await db.query('select id,organization_id,sequence_id,consent_source from follow_ups order by id')).rows;
      assert.equal(visible.some((row) => row.id === limitlessSequenceRowId), false, `${role} must not read the canonical Limitless row`);
      assert.equal(visible.some((row) => row.id === legacyId), true, `${role} keeps legacy Limitless access`);
      assert.equal(visible.find((row) => row.id === otherTenantRowId)?.consent_source, 'other-tenant-value', `${role} access for other tenants is preserved`);
      assert.equal((await db.query('update follow_ups set status=$1 where id=$2 returning id', ['cancelled', limitlessSequenceRowId])).rows.length, 0);
      assert.equal((await db.query('update follow_ups set status=$1 where id=$2 returning id', ['cancelled', otherTenantRowId])).rows.length, 1);
      await db.exec('reset role');
    }
  } finally {
    await db.close();
  }
});

test('atomic sequence/control/claim/send RPCs are service-role-only', async () => {
  const db = await createDatabase();
  try {
    const checks = await db.query(`
      select
        has_function_privilege('anon','public.create_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text,boolean,jsonb)','execute') as anon_enroll,
        has_function_privilege('anon','public.control_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz)','execute') as anon_control,
        has_function_privilege('anon','public.claim_limitless_maia_followup_step(uuid,uuid,uuid,uuid,uuid,uuid,uuid)','execute') as anon_claim,
        has_function_privilege('anon','public.authorize_limitless_maia_followup_send(uuid,uuid,uuid,uuid,uuid,uuid,uuid)','execute') as anon_authorize,
        has_function_privilege('anon','public.record_limitless_maia_opt_out(uuid,uuid,text)','execute') as anon_opt_out,
        has_function_privilege('service_role','public.create_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text,boolean,jsonb)','execute') as service_enroll,
        has_function_privilege('service_role','public.control_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz)','execute') as service_control,
        has_function_privilege('service_role','public.claim_limitless_maia_followup_step(uuid,uuid,uuid,uuid,uuid,uuid,uuid)','execute') as service_claim,
        has_function_privilege('service_role','public.authorize_limitless_maia_followup_send(uuid,uuid,uuid,uuid,uuid,uuid,uuid)','execute') as service_authorize
        ,has_function_privilege('service_role','public.record_limitless_maia_opt_out(uuid,uuid,text)','execute') as service_opt_out
    `);
    const row = checks.rows[0];
    assert.equal(row.anon_enroll, false);
    assert.equal(row.anon_control, false);
    assert.equal(row.anon_claim, false);
    assert.equal(row.anon_authorize, false);
    assert.equal(row.anon_opt_out, false);
    assert.equal(row.service_enroll, true);
    assert.equal(row.service_control, true);
    assert.equal(row.service_claim, true);
    assert.equal(row.service_authorize, true);
    assert.equal(row.service_opt_out, true);
  } finally {
    await db.close();
  }
});
