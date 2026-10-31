const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const A = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const B = '7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const PLAN_A = '10000000-0000-4000-8000-000000000001';
const PLAN_B = '10000000-0000-4000-8000-000000000002';
const PLAN_C = '10000000-0000-4000-8000-000000000003';
const PLAN_D = '10000000-0000-4000-8000-000000000004';
const LEAD_A = '30000000-0000-4000-8000-000000000001';
const ATTEMPT_A = '40000000-0000-4000-8000-000000000001';
const ATTEMPT_B = '40000000-0000-4000-8000-000000000002';
const ATTEMPT_C = '40000000-0000-4000-8000-000000000003';
const TEMPLATE_BEFORE = '20000000-0000-4000-8000-000000000001';
const TEMPLATE_ON = '20000000-0000-4000-8000-000000000002';
const TEMPLATE_AFTER = '20000000-0000-4000-8000-000000000003';
const MIGRATION = 'supabase/migrations/20261030191938_limitless_installment_reminder_contract_positive_guard.sql';
const FLEXIBLE_MIGRATION = 'supabase/migrations/20261031120000_limitless_flexible_installment_reminders.sql';

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create table organizations(id uuid primary key, status text not null default 'active');
    insert into organizations(id) values ('${A}'), ('${B}');
    create table payment_plans(
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      contact_id uuid,
      client_name text not null default 'Synthetic client',
      client_phone text not null default '08123456789',
      property_title text not null default 'Synthetic property',
      currency text not null default 'NGN',
      handover_agent_name text not null default 'Agent',
      handover_agent_phone text not null default '2348000000000',
      agreed_price numeric(18,2) not null,
      total_paid numeric(18,2) not null default 0,
      outstanding_balance numeric(18,2) generated always as (greatest(agreed_price-total_paid,0)) stored,
      installment_amount numeric(18,2) not null,
      payment_type text not null default 'installment',
      frequency text not null,
      next_due_date date,
      final_due_date date,
      status text not null default 'active',
      reminders_enabled boolean not null default true,
      reminder_template_id uuid,
      last_reminder_at timestamptz,
      next_reminder_at timestamptz,
      updated_at timestamptz not null default now(),
      constraint payment_plans_installment_amount_check check (installment_amount >= 0)
    );
    create table leads(
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      phone text,
      opted_out boolean not null default false,
      updated_at timestamptz not null default now()
    );
    create table payment_records(
      id uuid primary key default gen_random_uuid(),
      payment_plan_id uuid not null references payment_plans(id),
      organization_id uuid not null references organizations(id),
      amount numeric(18,2) not null,
      payment_date date not null default current_date,
      notes text,
      created_at timestamptz not null default now()
    );
    create table reminder_templates(
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      timing_direction text not null,
      timing_days integer not null,
      channel text not null,
      enabled boolean not null default true
    );
    create table reminder_attempts(
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id),
      payment_plan_id uuid not null references payment_plans(id),
      reminder_template_id uuid,
      scheduled_for timestamptz,
      sent_at timestamptz,
      channel text,
      status text not null default 'pending',
      provider_reference text,
      error_message text,
      payload jsonb not null default '{}',
      send_authorized_at timestamptz,
      created_at timestamptz not null default now()
    );
    create function public.installment_frequency_interval(p_frequency text)
    returns interval language sql immutable as $$
      select case lower(p_frequency) when 'weekly' then interval '7 days'
        when 'biweekly' then interval '14 days' when 'monthly' then interval '30 days'
        else interval '14 days' end
    $$;
  `);
  await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
  await db.exec(fs.readFileSync(FLEXIBLE_MIGRATION, 'utf8'));
  await db.exec(`
    create trigger payment_records_sync_plan
    after insert or update or delete on payment_records
    for each row execute function public.sync_payment_plan_total();
  `);
  return db;
}

async function addPlan(db, id, organizationId, options = {}) {
  await db.query(
    `insert into payment_plans(id,organization_id,agreed_price,installment_amount,frequency,next_due_date,final_due_date,status,reminders_enabled)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, organizationId, options.agreed ?? 5000, options.installment ?? 1000, options.frequency ?? 'biweekly', options.due === undefined ? '2026-10-01' : options.due, options.final ?? '2026-12-31', options.status ?? 'active', options.reminders ?? true],
  );
}

async function plan(db, id) {
  return (await db.query('select organization_id,total_paid,outstanding_balance,next_due_date,status,reminders_enabled,last_reminder_at,next_reminder_at from payment_plans where id=$1', [id])).rows[0];
}

test('draft migration preserves zero placeholders and computes a future due-date cursor only for Limitless', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into reminder_templates(id,organization_id,timing_direction,timing_days,channel,enabled)
       values ($1,$4,'before',3,'whatsapp',true),($2,$4,'on',0,'whatsapp',true),($3,$4,'after',3,'whatsapp',true)`,
      [TEMPLATE_BEFORE, TEMPLATE_ON, TEMPLATE_AFTER, A],
    );
    const dueA = (await db.query("select (current_date + 20)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_A, A, { due: dueA });
    const expectedA = (await db.query("select (((($1::date - 3)::timestamp + interval '16 hours 30 minutes') at time zone 'Africa/Lagos')) as at", [dueA])).rows[0].at;
    const insertedPlan = await plan(db, PLAN_A);
    assert.ok(insertedPlan.next_reminder_at);
    assert.equal(insertedPlan.next_reminder_at.toISOString(), expectedA.toISOString());

    const dueB = (await db.query("select (current_date + 30)::text as due_date")).rows[0].due_date;
    await db.query('update payment_plans set next_due_date=$1 where id=$2', [dueB, PLAN_A]);
    const expectedB = (await db.query("select (((($1::date - 3)::timestamp + interval '16 hours 30 minutes') at time zone 'Africa/Lagos')) as at", [dueB])).rows[0].at;
    assert.equal((await plan(db, PLAN_A)).next_reminder_at.toISOString(), expectedB.toISOString());

    await addPlan(db, PLAN_B, B, { due: dueA });
    assert.equal((await plan(db, PLAN_B)).next_reminder_at, null);

    await addPlan(db, PLAN_C, A, { installment: 0, due: dueA });
    assert.equal((await plan(db, PLAN_C)).next_reminder_at.toISOString(), expectedA.toISOString());
    await db.query('update payment_plans set next_due_date=null where id=$1', [PLAN_C]);
    assert.equal((await plan(db, PLAN_C)).next_due_date, null);
    assert.equal((await plan(db, PLAN_C)).next_reminder_at, null);
  } finally {
    await db.close();
  }
});

test('reminder idempotency index is scoped to Limitless and permits legacy tenant repeats', async () => {
  const db = await createDatabase();
  try {
    await addPlan(db, PLAN_A, A);
    await addPlan(db, PLAN_D, B);
    const key = [A, PLAN_A, TEMPLATE_BEFORE, '2026-10-07T08:00:00Z'];
    await db.query('insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for) values($1,$2,$3,$4)', key);
    await assert.rejects(
      db.query('insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for) values($1,$2,$3,$4)', key),
      /limitless_reminder_attempts_schedule_unique/,
    );
    for (let i = 0; i < 2; i += 1) {
      await db.query('insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for) values($1,$2,$3,$4)', [B, PLAN_D, TEMPLATE_BEFORE, '2026-10-07T08:00:00Z']);
    }
    assert.equal((await db.query('select count(*)::int as count from reminder_attempts where organization_id=$1', [B])).rows[0].count, 2);
  } finally {
    await db.close();
  }
});

test('installment payment sync advances only when cumulative payments cross full installments', async () => {
  const db = await createDatabase();
  try {
    await addPlan(db, PLAN_A, A);
    await db.query('insert into payment_records(payment_plan_id,organization_id,amount,advances_installment_schedule) values($1,$2,1000,false)', [PLAN_A, A]);
    assert.equal((await plan(db, PLAN_A)).next_due_date.toISOString().slice(0, 10), '2026-10-01');
    await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,600)', [PLAN_A, A]);
    assert.equal((await plan(db, PLAN_A)).next_due_date.toISOString().slice(0, 10), '2026-10-01');
    const partial = await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,400) returning id', [PLAN_A, A]);
    assert.equal((await plan(db, PLAN_A)).next_due_date.toISOString().slice(0, 10), '2026-10-15');
    await db.query('update payment_records set notes=$1 where id=$2', ['metadata correction only', partial.rows[0].id]);
    assert.equal((await plan(db, PLAN_A)).next_due_date.toISOString().slice(0, 10), '2026-10-15');
    assert.equal(Number((await plan(db, PLAN_A)).total_paid), 2000);
  } finally {
    await db.close();
  }
});

test('installment sync clamps to final due date, completes paid plans, and rejects cross-tenant payment records', async () => {
  const db = await createDatabase();
  try {
    await addPlan(db, PLAN_B, A, { final: '2026-10-10', frequency: 'weekly' });
    await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,2000)', [PLAN_B, A]);
    const clamped = await plan(db, PLAN_B);
    assert.equal(clamped.next_due_date.toISOString().slice(0, 10), '2026-10-10');

    await addPlan(db, PLAN_C, A, { agreed: 1000, installment: 1000, due: '2026-10-01' });
    await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,1000)', [PLAN_C, A]);
    const completed = await plan(db, PLAN_C);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.reminders_enabled, false);

    await assert.rejects(
      db.query('insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,1000)', [PLAN_C, B]),
      /outside the active organization scope/,
    );
  } finally {
    await db.close();
  }
});

test('deleting a payment record recalculates balance without rewinding the due date', async () => {
  const db = await createDatabase();
  try {
    await addPlan(db, PLAN_A, A);
    const inserted = await db.query(
      'insert into payment_records(payment_plan_id,organization_id,amount) values($1,$2,1000) returning id',
      [PLAN_A, A],
    );
    assert.equal((await plan(db, PLAN_A)).next_due_date.toISOString().slice(0, 10), '2026-10-15');
    await db.query('delete from payment_records where id=$1', [inserted.rows[0].id]);
    const afterDelete = await plan(db, PLAN_A);
    assert.equal(Number(afterDelete.total_paid), 0);
    assert.equal(afterDelete.next_due_date.toISOString().slice(0, 10), '2026-10-15');
  } finally {
    await db.close();
  }
});

test('reminder migration preserves existing queued/cancelled states and adds ambiguous unknown outcomes', async () => {
  const db = await createDatabase();
  try {
    await addPlan(db, PLAN_A, A);
    for (const status of ['queued', 'cancelled', 'skipped', 'unknown']) {
      await db.query(
        'insert into reminder_attempts(organization_id,payment_plan_id,status) values($1,$2,$3)',
        [A, PLAN_A, status],
      );
    }
    await assert.rejects(
      db.query('insert into reminder_attempts(organization_id,payment_plan_id,status) values($1,$2,$3)', [A, PLAN_A, 'unsupported']),
      /reminder_attempts_status_check/,
    );
  } finally {
    await db.close();
  }
});

test('confirmed sends recur every two weeks at 16:30 Lagos until paid; missed windows skip forward and failures do not', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into reminder_templates(id,organization_id,timing_direction,timing_days,channel,enabled)
       values ($1,$4,'before',3,'whatsapp',true),($2,$4,'on',0,'whatsapp',true),($3,$4,'after',3,'whatsapp',true)`,
      [TEMPLATE_BEFORE, TEMPLATE_ON, TEMPLATE_AFTER, A],
    );
    const dueA = (await db.query("select (current_date + 10)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_A, A, { due: dueA });
    await db.query('update payment_plans set reminder_template_id=$1 where id=$2', [TEMPLATE_ON, PLAN_A]);
    const firstAt = (await plan(db, PLAN_A)).next_reminder_at;
    const expectedFirst = (await db.query("select (((($1::date)::timestamp + interval '16 hours 30 minutes') at time zone 'Africa/Lagos')) as at", [dueA])).rows[0].at;
    assert.equal(firstAt.toISOString(), expectedFirst.toISOString());

    const first = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,$4,'pending') returning id`,
      [A, PLAN_A, TEMPLATE_ON, firstAt],
    );
    const firstSentAt = new Date(firstAt.getTime() + 5 * 60 * 1000);
    await db.query("update reminder_attempts set status='sent',sent_at=$2 where id=$1", [first.rows[0].id, firstSentAt]);
    let state = await plan(db, PLAN_A);
    const secondAt = new Date(firstAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    assert.equal(state.last_reminder_at.toISOString(), firstSentAt.toISOString());
    assert.equal(state.next_reminder_at.toISOString(), secondAt.toISOString());
    assert.equal(state.next_due_date.toISOString().slice(0, 10), dueA);

    const second = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,$4,'pending') returning id`,
      [A, PLAN_A, TEMPLATE_ON, secondAt],
    );
    await db.query("update reminder_attempts set status='sent',sent_at=$2 where id=$1", [second.rows[0].id, secondAt]);
    state = await plan(db, PLAN_A);
    const thirdAt = new Date(secondAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    assert.equal(state.next_reminder_at.toISOString(), thirdAt.toISOString());
    assert.equal(state.next_due_date.toISOString().slice(0, 10), dueA);

    await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values ($1,$2,1000)', [PLAN_A, A]);
    state = await plan(db, PLAN_A);
    const advancedDueDate = (await db.query("select ($1::date + interval '14 days')::date as due_date", [dueA])).rows[0].due_date;
    const nextInstallmentAt = (await db.query("select (((($1::date)::timestamp + interval '16 hours 30 minutes') at time zone 'Africa/Lagos')) as at", [advancedDueDate])).rows[0].at;
    assert.equal(state.next_due_date.toISOString().slice(0, 10), advancedDueDate.toISOString().slice(0, 10));
    assert.equal(state.next_reminder_at.toISOString(), nextInstallmentAt.toISOString());

    const dueB = (await db.query("select (current_date + 20)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_B, A, { due: dueB, frequency: 'monthly' });
    await db.query('update payment_plans set reminder_template_id=$1 where id=$2', [TEMPLATE_ON, PLAN_B]);
    const monthlyFirstAt = (await plan(db, PLAN_B)).next_reminder_at;
    const monthlySuccess = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,$4,'pending') returning id`,
      [A, PLAN_B, TEMPLATE_ON, monthlyFirstAt],
    );
    await db.query("update reminder_attempts set status='sent',sent_at=$2 where id=$1", [monthlySuccess.rows[0].id, monthlyFirstAt]);
    state = await plan(db, PLAN_B);
    const scheduledBeforeFailure = new Date(monthlyFirstAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    assert.equal(state.next_reminder_at.toISOString(), scheduledBeforeFailure.toISOString());
    const failed = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,$4,'pending') returning id`,
      [A, PLAN_B, TEMPLATE_ON, scheduledBeforeFailure],
    );
    await db.query("update reminder_attempts set status='failed',error_message='safe reason' where id=$1", [failed.rows[0].id]);
    state = await plan(db, PLAN_B);
    assert.equal(state.last_reminder_at.toISOString(), monthlyFirstAt.toISOString());
    assert.equal(state.next_reminder_at.toISOString(), scheduledBeforeFailure.toISOString());

    const missedDueDate = (await db.query("select (current_date - 40)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_C, A, { due: missedDueDate });
    await db.query('update payment_plans set reminder_template_id=$1 where id=$2', [TEMPLATE_ON, PLAN_C]);
    const missedAt = (await db.query("select (((($1::date)::timestamp + interval '16 hours 30 minutes') at time zone 'Africa/Lagos')) as at", [missedDueDate])).rows[0].at;
    await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status,error_message)
       values ($1,$2,$3,$4,'skipped','missed_reminder_window')`,
      [A, PLAN_C, TEMPLATE_ON, missedAt],
    );
    state = await plan(db, PLAN_C);
    assert.ok(state.next_reminder_at.getTime() > Date.now());
    assert.equal(state.last_reminder_at, null);
    assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(state.next_reminder_at), '16:30');

    const crossTenant = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,'2026-10-07T08:00:00Z','pending') returning id`,
      [B, PLAN_C, TEMPLATE_BEFORE],
    );
    await assert.rejects(
      db.query("update reminder_attempts set status='sent',sent_at=now() where id=$1", [crossTenant.rows[0].id]),
      /outside the active organization scope/,
    );

    const dueD = (await db.query("select (current_date + 10)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_D, B, { due: dueD });
    await db.query('insert into payment_records(payment_plan_id,organization_id,amount) values ($1,$2,100)', [PLAN_D, B]);
    state = await plan(db, PLAN_D);
    assert.equal(state.next_due_date.toISOString().slice(0, 10), dueD);
    const otherTenantReminder = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,scheduled_for,status)
       values ($1,$2,'2026-10-07T08:00:00Z','pending') returning id`,
      [B, PLAN_D],
    );
    await db.query("update reminder_attempts set status='sent',sent_at='2026-10-07T08:01:00Z' where id=$1", [otherTenantReminder.rows[0].id]);
    state = await plan(db, PLAN_D);
    assert.equal(state.last_reminder_at, null);
    assert.equal(state.next_reminder_at, null);
  } finally {
    await db.close();
  }
});

test('a one-time catch-up send preserves the explicitly configured next reminder date', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into reminder_templates(id,organization_id,timing_direction,timing_days,channel,enabled)
       values ($1,$2,'on',0,'whatsapp',true)`,
      [TEMPLATE_ON, A],
    );
    await addPlan(db, PLAN_A, A, { due: '2026-11-12', installment: 0 });
    const catchUpAt = new Date('2026-10-31T15:30:00.000Z');
    const expectedNextAt = new Date('2026-11-12T15:30:00.000Z');
    await db.query('update payment_plans set reminder_template_id=$1,next_reminder_at=$2 where id=$3', [TEMPLATE_ON, catchUpAt, PLAN_A]);
    const attempt = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status,payload)
       values ($1,$2,$3,$4,'pending',$5::jsonb) returning id`,
      [A, PLAN_A, TEMPLATE_ON, catchUpAt, JSON.stringify({ catch_up: true, catch_up_for: '2026-10-28', catch_up_next_date: '2026-11-12' })],
    );
    await db.query("update reminder_attempts set status='sent',sent_at=$2 where id=$1", [attempt.rows[0].id, catchUpAt]);
    const state = await plan(db, PLAN_A);
    assert.equal(state.last_reminder_at.toISOString(), catchUpAt.toISOString());
    assert.equal(state.next_reminder_at.toISOString(), expectedNextAt.toISOString());
  } finally {
    await db.close();
  }
});

test('installment send authorization is tenant-scoped, STOP-first safe, idempotent, and rejects an ineligible plan', async () => {
  const db = await createDatabase();
  try {
    await db.query(
      `insert into reminder_templates(id,organization_id,timing_direction,timing_days,channel,enabled)
       values ($1,$2,'before',3,'whatsapp',true),($3,$2,'on',0,'whatsapp',true),($4,$2,'after',3,'whatsapp',true)`,
      [TEMPLATE_BEFORE, A, TEMPLATE_ON, TEMPLATE_AFTER],
    );
    const dueDate = (await db.query("select (current_date + 10)::text as due_date")).rows[0].due_date;
    await addPlan(db, PLAN_A, A, { due: dueDate });
    await db.query('update payment_plans set reminder_template_id=$1 where id=$2', [TEMPLATE_ON, PLAN_A]);
    await db.query('insert into leads(id,organization_id,phone,opted_out) values($1,$2,$3,false)', [LEAD_A, A, '08123456789']);
    await db.query('update payment_plans set contact_id=$1 where id=$2', [LEAD_A, PLAN_A]);
    const scheduledFor = (await plan(db, PLAN_A)).next_reminder_at;
    const insertAttempt = async (id, templateId, at) => db.query(
      `insert into reminder_attempts(id,organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values($1,$2,$3,$4,$5,'pending')`, [id, A, PLAN_A, templateId, at],
    );

    const crossTenant = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [B, PLAN_A, ATTEMPT_A, TEMPLATE_ON, scheduledFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(crossTenant.authorized, false);
    assert.equal(crossTenant.reason, 'invalid_authorization_scope');

    await insertAttempt(ATTEMPT_A, TEMPLATE_ON, scheduledFor);
    await db.query('update leads set opted_out=true where id=$1', [LEAD_A]);
    const stopFirst = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, ATTEMPT_A, TEMPLATE_ON, scheduledFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(stopFirst.authorized, false);
    assert.equal(stopFirst.reason, 'lead_opted_out');
    assert.equal((await db.query('select send_authorized_at,status from reminder_attempts where id=$1', [ATTEMPT_A])).rows[0].send_authorized_at, null);

    await db.query('update leads set opted_out=false where id=$1', [LEAD_A]);
    const offTimeFor = new Date(scheduledFor.getTime() + 30 * 60 * 1000);
    const offTimeAttempt = await db.query(
      `insert into reminder_attempts(organization_id,payment_plan_id,reminder_template_id,scheduled_for,status)
       values ($1,$2,$3,$4,'pending') returning id`,
      [A, PLAN_A, TEMPLATE_ON, offTimeFor],
    );
    const offTimeDenied = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, offTimeAttempt.rows[0].id, TEMPLATE_ON, offTimeFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(offTimeDenied.authorized, false);
    assert.equal(offTimeDenied.reason, 'schedule_not_current');
    await db.query('update payment_plans set next_reminder_at=$1 where id=$2', [offTimeFor, PLAN_A]);
    assert.equal((await plan(db, PLAN_A)).next_reminder_at.toISOString(), offTimeFor.toISOString());
    const malformedStoredCursor = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, offTimeAttempt.rows[0].id, TEMPLATE_ON, offTimeFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(malformedStoredCursor.authorized, false);
    assert.equal(malformedStoredCursor.reason, 'cursor_time_invalid');

    const dueAfterStop = (await db.query("select ($1::date + interval '1 day')::date as due_date", [dueDate])).rows[0].due_date;
    await db.query('update payment_plans set next_due_date=$1 where id=$2', [dueAfterStop, PLAN_A]);
    const secondScheduledFor = (await plan(db, PLAN_A)).next_reminder_at;
    await db.query('update payment_plans set installment_amount=0 where id=$1', [PLAN_A]);
    const flexibleScheduledFor = (await plan(db, PLAN_A)).next_reminder_at;
    await insertAttempt(ATTEMPT_B, TEMPLATE_ON, flexibleScheduledFor);
    const authorized = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, ATTEMPT_B, TEMPLATE_ON, flexibleScheduledFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(authorized.authorized, true);
    assert.equal(Number((await db.query('select installment_amount from payment_plans where id=$1', [PLAN_A])).rows[0].installment_amount), 0);
    assert.ok((await db.query('select send_authorized_at from reminder_attempts where id=$1', [ATTEMPT_B])).rows[0].send_authorized_at);
    const replay = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, ATTEMPT_B, TEMPLATE_ON, secondScheduledFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(replay.authorized, false);
    assert.equal(replay.reason, 'attempt_not_pending');

    const finalDueDate = (await db.query("select ($1::date + interval '1 day')::date as due_date", [dueAfterStop])).rows[0].due_date;
    await db.query('update payment_plans set next_due_date=$1 where id=$2', [finalDueDate, PLAN_A]);
    const finalScheduledFor = (await plan(db, PLAN_A)).next_reminder_at;
    await insertAttempt(ATTEMPT_C, TEMPLATE_ON, finalScheduledFor);
    await db.query('update payment_plans set reminders_enabled=false where id=$1', [PLAN_A]);
    const stalePlan = (await db.query(
      `select public.authorize_limitless_installment_reminder_send($1,$2,$3,$4,$5,$6) as result`,
      [A, PLAN_A, ATTEMPT_C, TEMPLATE_ON, finalScheduledFor, ['08123456789', '2348123456789']],
    )).rows[0].result;
    assert.equal(stalePlan.authorized, false);
    assert.equal(stalePlan.reason, 'plan_not_sendable');
  } finally {
    await db.close();
  }
});

test('Limitless installment runtime uses the same 16:30 Lagos cursor as the database', () => {
  const runtime = fs.readFileSync('lib/limitless-installment-reminder-runtime.ts', 'utf8');
  assert.match(runtime, /const REMINDER_LOCAL_TIME = "16:30:00"/);
  assert.doesNotMatch(runtime, /const REMINDER_LOCAL_TIME = "10:00:00"/);
});
