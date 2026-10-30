begin;

-- Draft-only additive contract for the canonical Limitless Maia follow-up pipeline.
-- Existing follow_ups rows remain individual scheduled steps; sequence_id links
-- those steps to exactly one tenant/customer/property sequence.
create table if not exists public.limitless_maia_followup_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  lead_id uuid,
  property_id uuid,
  sequence_key text not null,
  status text not null default 'active',
  consent_state text not null default 'unknown',
  consent_at timestamptz,
  consent_source text,
  consent_actor text,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  stop_actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

alter table public.follow_ups add column if not exists sequence_id uuid;
alter table public.follow_ups add column if not exists customer_id uuid;
alter table public.follow_ups add column if not exists property_id uuid;
alter table public.follow_ups add column if not exists sequence_key text;
alter table public.follow_ups add column if not exists sequence_step_key text;
alter table public.follow_ups add column if not exists due_at timestamptz;
alter table public.follow_ups add column if not exists consent_state text not null default 'unknown';
alter table public.follow_ups add column if not exists consent_at timestamptz;
alter table public.follow_ups add column if not exists consent_source text;
alter table public.follow_ups add column if not exists consent_actor text;
alter table public.follow_ups add column if not exists claim_token uuid;
alter table public.follow_ups add column if not exists claimed_at timestamptz;
alter table public.follow_ups add column if not exists send_authorized_at timestamptz;
alter table public.follow_ups add column if not exists attempt_count integer not null default 0;
alter table public.follow_ups add column if not exists last_attempt_at timestamptz;
alter table public.follow_ups add column if not exists last_error text;
alter table public.follow_ups add column if not exists control_reason text;
alter table public.follow_ups add column if not exists control_actor text;
alter table public.follow_ups add column if not exists completed_at timestamptz;

-- Keep the shared table usable for every tenant, but make Limitless canonical
-- sequence rows service-runtime-only even under existing permissive browser RLS.
alter table public.follow_ups enable row level security;
drop policy if exists limitless_canonical_followups_server_only on public.follow_ups;
create policy limitless_canonical_followups_server_only
on public.follow_ups as restrictive
for all to anon, authenticated
using (organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid or sequence_id is null)
with check (organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid or sequence_id is null);

create table if not exists public.limitless_maia_followup_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid,
  lead_id uuid,
  property_id uuid,
  sequence_id uuid,
  step_id uuid,
  event_type text not null,
  reason text,
  source text not null,
  actor text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.limitless_maia_followup_events alter column customer_id drop not null;

create unique index if not exists limitless_maia_active_sequence_scope_unique
  on public.limitless_maia_followup_sequences
    (organization_id, customer_id, coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid), sequence_key)
  where status in ('active', 'paused');

create unique index if not exists limitless_maia_followup_step_identity_unique
  on public.follow_ups (organization_id, customer_id, sequence_id, stage)
  where sequence_id is not null;

-- A step key is the durable idempotency key. Initial rows use day-N and each
-- rolling row uses nurture:<successful-prior-step-id>; no backfill is performed.
create unique index if not exists limitless_maia_followup_sequence_step_key_unique
  on public.follow_ups (organization_id, sequence_id, sequence_step_key)
  where sequence_id is not null and sequence_step_key is not null;

create index if not exists limitless_maia_followup_due_scope_idx
  on public.follow_ups (organization_id, customer_id, property_id, sequence_id, status, scheduled_at);

create index if not exists limitless_maia_followup_event_scope_idx
  on public.limitless_maia_followup_events (organization_id, customer_id, sequence_id, occurred_at desc);

create index if not exists limitless_maia_followup_lead_status_idx
  on public.limitless_maia_followup_sequences (organization_id, lead_id, customer_id, status, property_id);

-- Sequence completion is controlled explicitly by the worker/admin RPCs.
-- No status trigger is installed: ordinary follow-up step updates must not
-- implicitly complete a sequence or add a redundant no-op trigger.

-- These identity/event tables are server-runtime state, never browser tables.
alter table public.limitless_maia_followup_sequences enable row level security;
alter table public.limitless_maia_followup_events enable row level security;

revoke all on table public.limitless_maia_followup_sequences from public, anon, authenticated;
revoke all on table public.limitless_maia_followup_events from public, anon, authenticated;
grant select, insert, update on table public.limitless_maia_followup_sequences to service_role;
grant select, insert on table public.limitless_maia_followup_events to service_role;

drop policy if exists limitless_maia_followup_sequences_service_role on public.limitless_maia_followup_sequences;
create policy limitless_maia_followup_sequences_service_role
on public.limitless_maia_followup_sequences
for all
to service_role
using (true)
with check (true);

drop policy if exists limitless_maia_followup_events_service_role on public.limitless_maia_followup_events;
create policy limitless_maia_followup_events_service_role
on public.limitless_maia_followup_events
for all
to service_role
using (true)
with check (true);

-- Enrollment, consent audit, and all six initial steps are one transaction.
create or replace function public.create_limitless_maia_followup_sequence(
  p_organization_id uuid,
  p_customer_id uuid,
  p_lead_id uuid,
  p_property_id uuid,
  p_sequence_id uuid,
  p_sequence_key text,
  p_consent_at timestamptz,
  p_consent_source text,
  p_consent_actor text,
  p_renewed_consent boolean,
  p_steps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_step record;
  v_followups jsonb;
  v_lead_opted_out boolean;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or p_customer_id is null or p_lead_id is null or p_property_id is null
     or p_sequence_id is null or p_sequence_key is distinct from 'maia_limitless_property_sales_followup_v1'
     or p_consent_at is null or p_consent_at > now()
     or nullif(trim(p_consent_source), '') is null
     or nullif(trim(p_consent_actor), '') is null
     or p_renewed_consent is null then
    raise exception 'Valid tenant, customer, property, sequence, and explicit consent are required.';
  end if;
  if p_steps is null or jsonb_typeof(p_steps) is distinct from 'array'
     or jsonb_array_length(p_steps) <> 6 then
    raise exception 'The initial six-step follow-up schedule is incomplete.';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'The organization is not available.';
  end if;
  if not exists (select 1 from public.properties p where p.organization_id = p_organization_id and p.id = p_property_id) then
    raise exception 'The property is not available in the active organization.';
  end if;
  if not exists (
    select 1 from public.tenant_customer_contacts c
    where c.organization_id = p_organization_id and c.id = p_customer_id
  ) then
    raise exception 'The customer is not available in the active organization.';
  end if;
  select coalesce(l.opted_out, false) into v_lead_opted_out
  from public.leads l
  where l.organization_id = p_organization_id and l.id = p_lead_id
  for update;
  if not found then
    raise exception 'The lead is not available in the active organization.';
  end if;
  if p_renewed_consent is distinct from v_lead_opted_out then
    raise exception 'A previously opted-out lead requires explicit renewed customer consent.';
  end if;
  if p_renewed_consent then
    update public.leads set opted_out = false, updated_at = now()
    where organization_id = p_organization_id and id = p_lead_id;
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_steps) as s(sequence_step_key text, stage integer, scheduled_at timestamptz, due_at timestamptz, message_sent text)
    where s.stage not between 1 and 6
       or s.sequence_step_key is distinct from case s.stage
            when 1 then 'day-1' when 2 then 'day-3' when 3 then 'day-7'
            when 4 then 'day-14' when 5 then 'day-21' when 6 then 'day-30' end
       or s.scheduled_at is null or s.due_at is null
       or nullif(trim(s.message_sent), '') is null
  ) or (
    select count(distinct s.stage)
    from jsonb_to_recordset(p_steps) as s(sequence_step_key text, stage integer, scheduled_at timestamptz, due_at timestamptz, message_sent text)
  ) <> 6 then
    raise exception 'The follow-up steps do not match the approved day 1/3/7/14/21/30 schedule contract.';
  end if;

  insert into public.limitless_maia_followup_sequences(
    id, organization_id, customer_id, lead_id, property_id, sequence_key,
    status, consent_state, consent_at, consent_source, consent_actor
  ) values (
    p_sequence_id, p_organization_id, p_customer_id, p_lead_id, p_property_id, p_sequence_key,
    'active', 'opted_in', p_consent_at, trim(p_consent_source), trim(p_consent_actor)
  );

  insert into public.limitless_maia_followup_events(
    organization_id, customer_id, lead_id, property_id, sequence_id,
    event_type, source, actor, occurred_at, metadata
  ) values (
    p_organization_id, p_customer_id, p_lead_id, p_property_id, p_sequence_id,
    'opt_in', trim(p_consent_source), trim(p_consent_actor), p_consent_at,
    jsonb_build_object('sequence_key', p_sequence_key, 'initial_step_count', 6, 'renewed_consent', p_renewed_consent)
  );

  for v_step in
    select * from jsonb_to_recordset(p_steps) as s(
      sequence_step_key text, stage integer, scheduled_at timestamptz,
      due_at timestamptz, message_sent text
    )
  loop
    insert into public.follow_ups(
      organization_id, lead_id, customer_id, property_id, sequence_id,
      sequence_key, sequence_step_key, stage, scheduled_at, due_at,
      message_sent, status, channel, agent_key, template_name,
      consent_state, consent_at, consent_source, consent_actor
    ) values (
      p_organization_id, p_lead_id, p_customer_id, p_property_id, p_sequence_id,
      p_sequence_key, v_step.sequence_step_key, v_step.stage, v_step.scheduled_at,
      v_step.due_at, v_step.message_sent, 'pending', 'whatsapp', 'maia',
      'follow_up_outside_24h', 'opted_in', p_consent_at,
      trim(p_consent_source), trim(p_consent_actor)
    );
  end loop;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', f.id, 'scheduled_at', f.scheduled_at, 'due_at', f.due_at,
      'status', f.status, 'lead_id', f.lead_id, 'customer_id', f.customer_id,
      'property_id', f.property_id, 'organization_id', f.organization_id,
      'sequence_id', f.sequence_id, 'sequence_step_key', f.sequence_step_key,
      'stage', f.stage
    ) order by f.stage), '[]'::jsonb
  ) into v_followups
  from public.follow_ups f
  where f.organization_id = p_organization_id and f.sequence_id = p_sequence_id;

  return jsonb_build_object('sequence_id', p_sequence_id, 'followups', v_followups);
end;
$function$;

-- Lock the parent and step together so stop/pause and competing drains serialize.
create or replace function public.claim_limitless_maia_followup_step(
  p_organization_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_sequence_id uuid,
  p_step_id uuid,
  p_lead_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_sequence public.limitless_maia_followup_sequences%rowtype;
  v_attempt_count integer;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_organization');
  end if;
  if p_claim_token is null then return jsonb_build_object('claimed', false, 'reason', 'missing_claim_token'); end if;
  select * into v_sequence
  from public.limitless_maia_followup_sequences s
  where s.organization_id = p_organization_id and s.id = p_sequence_id
    and s.customer_id = p_customer_id and s.property_id is not distinct from p_property_id
    and s.lead_id is not distinct from p_lead_id
  for update;
  if not found or v_sequence.status <> 'active' or v_sequence.consent_state <> 'opted_in' then
    return jsonb_build_object('claimed', false, 'reason', 'sequence_not_sendable');
  end if;
  if not exists (
    select 1 from public.tenant_customer_contacts c
    where c.organization_id = p_organization_id and c.id = p_customer_id
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'customer_unavailable');
  end if;
  if p_lead_id is not null and not exists (
    select 1 from public.leads l where l.organization_id = p_organization_id
      and l.id = p_lead_id and coalesce(l.opted_out, false) = false
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'lead_opted_out_or_unavailable');
  end if;
  select f.attempt_count into v_attempt_count
  from public.follow_ups f
  where f.organization_id = p_organization_id and f.id = p_step_id
    and f.customer_id = p_customer_id and f.property_id is not distinct from p_property_id
    and f.sequence_id = p_sequence_id and f.lead_id is not distinct from p_lead_id
    and f.status = 'pending'
  for update;
  if not found then return jsonb_build_object('claimed', false, 'reason', 'step_not_pending'); end if;

  update public.follow_ups f
  set status = 'processing', claim_token = p_claim_token, claimed_at = now(),
      last_attempt_at = now(), attempt_count = f.attempt_count + 1,
      send_authorized_at = null
  where f.organization_id = p_organization_id and f.id = p_step_id
    and f.customer_id = p_customer_id and f.sequence_id = p_sequence_id
    and f.status = 'pending'
  returning f.attempt_count into v_attempt_count;
  if not found then return jsonb_build_object('claimed', false, 'reason', 'step_claim_conflict'); end if;
  return jsonb_build_object('claimed', true, 'claim_token', p_claim_token, 'attempt_count', v_attempt_count);
end;
$function$;

-- This is the linearization point before the external provider call. A pause/stop
-- committed first denies the send; a later control action sees it as in flight.
create or replace function public.authorize_limitless_maia_followup_send(
  p_organization_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_sequence_id uuid,
  p_step_id uuid,
  p_lead_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_sequence public.limitless_maia_followup_sequences%rowtype;
  v_step_id uuid;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_organization');
  end if;
  select * into v_sequence
  from public.limitless_maia_followup_sequences s
  where s.organization_id = p_organization_id and s.id = p_sequence_id
    and s.customer_id = p_customer_id and s.property_id is not distinct from p_property_id
    and s.lead_id is not distinct from p_lead_id
  for update;
  if not found or v_sequence.status <> 'active' or v_sequence.consent_state <> 'opted_in'
     or v_sequence.consent_at is null or v_sequence.consent_source is null or v_sequence.consent_actor is null then
    return jsonb_build_object('authorized', false, 'reason', 'sequence_not_sendable', 'sequence_status', v_sequence.status);
  end if;
  if not exists (
    select 1 from public.tenant_customer_contacts c
    where c.organization_id = p_organization_id and c.id = p_customer_id
  ) then
    return jsonb_build_object('authorized', false, 'reason', 'customer_unavailable', 'sequence_status', v_sequence.status);
  end if;
  if not exists (select 1 from public.properties p where p.organization_id = p_organization_id and p.id = p_property_id) then
    return jsonb_build_object('authorized', false, 'reason', 'property_unavailable', 'sequence_status', v_sequence.status);
  end if;
  if p_lead_id is not null and not exists (
    select 1 from public.leads l where l.organization_id = p_organization_id
      and l.id = p_lead_id and coalesce(l.opted_out, false) = false
  ) then
    return jsonb_build_object('authorized', false, 'reason', 'lead_opted_out_or_unavailable', 'sequence_status', v_sequence.status);
  end if;
  select f.id into v_step_id
  from public.follow_ups f
  where f.organization_id = p_organization_id and f.id = p_step_id
    and f.customer_id = p_customer_id and f.property_id is not distinct from p_property_id
    and f.sequence_id = p_sequence_id and f.lead_id is not distinct from p_lead_id
    and f.status = 'processing' and f.claim_token = p_claim_token
    and f.send_authorized_at is null
  for update;
  if not found then return jsonb_build_object('authorized', false, 'reason', 'step_claim_not_current', 'sequence_status', v_sequence.status); end if;

  update public.follow_ups set send_authorized_at = now()
  where organization_id = p_organization_id and id = v_step_id and claim_token = p_claim_token;
  insert into public.limitless_maia_followup_events(
    organization_id, customer_id, lead_id, property_id, sequence_id, step_id,
    event_type, reason, source, actor, metadata
  ) values (
    p_organization_id, p_customer_id, p_lead_id, p_property_id, p_sequence_id, p_step_id,
    'delivery.authorized', 'sequence_active_at_send_authorization',
    'system:limitless-followup-drain', 'system:limitless-followup-drain', '{}'::jsonb
  );
  return jsonb_build_object('authorized', true, 'authorized_at', now());
end;
$function$;

-- Every admin state transition and its audit event commit or roll back together.
create or replace function public.control_limitless_maia_followup_sequence(
  p_organization_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_sequence_id uuid,
  p_step_id uuid,
  p_action text,
  p_reason text,
  p_actor text,
  p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_sequence public.limitless_maia_followup_sequences%rowtype;
  v_step_status text;
  v_now timestamptz := now();
  v_changed jsonb := '[]'::jsonb;
  v_changed_count integer := 0;
  v_sequence_status text;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or p_customer_id is null or p_property_id is null
     or p_sequence_id is null
     or nullif(trim(p_reason), '') is null or nullif(trim(p_actor), '') is null
     or p_action is null or p_action not in ('pause','resume','stop','close','cancel','complete','reschedule','retry')
     or (p_step_id is null and p_action not in ('pause','resume','stop','close')) then
    raise exception 'Exact sequence scope, supported action, reason, and actor are required.';
  end if;
  select * into v_sequence
  from public.limitless_maia_followup_sequences s
  where s.organization_id = p_organization_id and s.id = p_sequence_id
    and s.customer_id = p_customer_id and s.property_id is not distinct from p_property_id
  for update;
  if not found then raise exception 'The exact follow-up sequence was not found.'; end if;
  if p_step_id is not null then
    select f.status into v_step_status
    from public.follow_ups f
    where f.organization_id = p_organization_id and f.id = p_step_id
      and f.customer_id = p_customer_id and f.property_id is not distinct from p_property_id
      and f.sequence_id = p_sequence_id
    for update;
    if not found then raise exception 'The exact follow-up step was not found.'; end if;
  end if;

  if p_action = 'pause' then
    if v_sequence.status <> 'active' then raise exception 'Only an active sequence can be paused.'; end if;
    update public.limitless_maia_followup_sequences set status='paused', paused_at=v_now,
      stop_reason=trim(p_reason), stop_actor=trim(p_actor), updated_at=v_now
    where organization_id=p_organization_id and id=p_sequence_id;
    with changed as (
      update public.follow_ups set status='paused', control_reason=trim(p_reason), control_actor=trim(p_actor),
        claim_token=null, claimed_at=null
      where organization_id=p_organization_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id
        and (status in ('pending','scheduled','queued') or (status='processing' and send_authorized_at is null))
      returning id,status,scheduled_at
    ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at)), '[]'::jsonb)
      into v_changed from changed;
  elsif p_action = 'resume' then
    if v_sequence.status = 'opted_out' or v_sequence.consent_state = 'opted_out' then raise exception 'An opted-out sequence cannot be resumed.'; end if;
    if v_sequence.consent_state <> 'opted_in' then raise exception 'Current explicit consent is required to resume.'; end if;
    if v_sequence.status <> 'paused' then raise exception 'Only a paused sequence can be resumed.'; end if;
    update public.limitless_maia_followup_sequences set status='active', paused_at=null,
      stop_reason=null, stop_actor=trim(p_actor), updated_at=v_now
    where organization_id=p_organization_id and id=p_sequence_id;
    with changed as (
      update public.follow_ups set status='pending', control_reason=trim(p_reason), control_actor=trim(p_actor)
      where organization_id=p_organization_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id and status='paused'
      returning id,status,scheduled_at
    ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at)), '[]'::jsonb)
      into v_changed from changed;
  elsif p_action in ('stop','close') then
    if v_sequence.status not in ('active','paused') then raise exception 'Only an active or paused sequence can be stopped or closed.'; end if;
    if p_action='close' then
      update public.limitless_maia_followup_sequences set status='completed', completed_at=v_now,
        stop_reason='deal_closed', stop_actor=trim(p_actor), updated_at=v_now
      where organization_id=p_organization_id and id=p_sequence_id;
    else
      update public.limitless_maia_followup_sequences set status='stopped', stopped_at=v_now,
        stop_reason=trim(p_reason), stop_actor=trim(p_actor), updated_at=v_now
      where organization_id=p_organization_id and id=p_sequence_id;
    end if;
    with changed as (
      update public.follow_ups set status='cancelled',
        control_reason=case when p_action='close' then 'deal_closed' else trim(p_reason) end,
        control_actor=trim(p_actor), claim_token=null, claimed_at=null
      where organization_id=p_organization_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id
        and (status in ('pending','scheduled','queued','paused','failed') or (status='processing' and send_authorized_at is null))
      returning id,status,scheduled_at
    ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at)), '[]'::jsonb)
      into v_changed from changed;
  else
    if v_sequence.status <> 'active' or v_sequence.consent_state <> 'opted_in' then
      raise exception 'Only an active, explicitly opted-in sequence may change an individual step.';
    end if;
    if p_action='cancel' then
      update public.follow_ups set status='cancelled', control_reason=trim(p_reason), control_actor=trim(p_actor), claim_token=null, claimed_at=null
      where organization_id=p_organization_id and id=p_step_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id
        and (status in ('pending','scheduled','queued','paused','failed') or (status='processing' and send_authorized_at is null))
      returning jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at) into v_changed;
    elsif p_action='complete' then
      update public.follow_ups set status='sent', sent_at=v_now, completed_at=v_now, control_reason=trim(p_reason), control_actor=trim(p_actor)
      where organization_id=p_organization_id and id=p_step_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id and status in ('pending','paused','failed')
      returning jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at) into v_changed;
    elsif p_action='reschedule' then
      if p_scheduled_at is null or p_scheduled_at <= v_now then raise exception 'A future schedule time is required.'; end if;
      update public.follow_ups set status='pending', scheduled_at=p_scheduled_at, due_at=p_scheduled_at,
        control_reason=trim(p_reason), control_actor=trim(p_actor), claim_token=null, claimed_at=null, send_authorized_at=null
      where organization_id=p_organization_id and id=p_step_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id and status in ('pending','paused','failed')
      returning jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at) into v_changed;
    else
      if v_step_status <> 'failed' then raise exception 'Only an explicit failed step may be retried.'; end if;
      update public.follow_ups set status='pending', last_error=null, claim_token=null, claimed_at=null,
        send_authorized_at=null, control_reason=trim(p_reason), control_actor=trim(p_actor)
      where organization_id=p_organization_id and id=p_step_id and customer_id=p_customer_id
        and property_id is not distinct from p_property_id and sequence_id=p_sequence_id and status='failed'
      returning jsonb_build_object('id',id,'status',status,'scheduled_at',scheduled_at) into v_changed;
    end if;
    if v_changed is null then raise exception 'The exact follow-up step has already transitioned.'; end if;
    if jsonb_typeof(v_changed) <> 'array' then v_changed := jsonb_build_array(v_changed); end if;
  end if;

  v_changed_count := jsonb_array_length(v_changed);
  select s.status into v_sequence_status from public.limitless_maia_followup_sequences s
  where s.organization_id=p_organization_id and s.id=p_sequence_id;
  insert into public.limitless_maia_followup_events(
    organization_id,customer_id,lead_id,property_id,sequence_id,step_id,
    event_type,reason,source,actor,occurred_at,metadata
  ) values (
    p_organization_id,p_customer_id,v_sequence.lead_id,p_property_id,p_sequence_id,p_step_id,
    'control.'||p_action,case when p_action='close' then 'deal_closed' else trim(p_reason) end,
    'followup_control',trim(p_actor),v_now,jsonb_build_object('action',p_action,'changed_count',v_changed_count)
  );
  return jsonb_build_object('sequence_status',v_sequence_status,'changed',v_changed);
end;
$function$;

-- A STOP is one transaction across lead consent, every active property sequence,
-- eligible future steps, and its consent audit. Already-authorized sends remain
-- processing so their provider result can be persisted under the authorization
-- linearization point; all not-yet-authorized work is cancelled.
create or replace function public.record_limitless_maia_opt_out(
  p_organization_id uuid,
  p_lead_id uuid,
  p_external_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := now();
  v_lead_id uuid;
  v_sequence record;
  v_sequence_count integer := 0;
  v_cancelled_steps integer := 0;
  v_rows integer := 0;
  v_metadata jsonb := jsonb_strip_nulls(jsonb_build_object('external_event_id', nullif(left(p_external_event_id, 200), '')));
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid or p_lead_id is null then
    raise exception 'A valid Limitless tenant and lead identity are required for opt-out.';
  end if;
  select l.id into v_lead_id
  from public.leads l
  where l.organization_id = p_organization_id and l.id = p_lead_id
  for update;
  if not found then raise exception 'The lead is not available in the active organization.'; end if;

  update public.leads set opted_out = true, updated_at = v_now
  where organization_id = p_organization_id and id = p_lead_id;

  for v_sequence in
    select s.id, s.customer_id, s.property_id
    from public.limitless_maia_followup_sequences s
    where s.organization_id = p_organization_id and s.lead_id = p_lead_id
      and s.status in ('active','paused')
    order by s.id
    for update
  loop
    update public.limitless_maia_followup_sequences
    set status='opted_out', consent_state='opted_out', consent_at=v_now,
        consent_source='maia_whatsapp_inbound', consent_actor='customer:whatsapp',
        stopped_at=v_now, stop_reason='customer_opted_out', stop_actor='customer:whatsapp', updated_at=v_now
    where organization_id=p_organization_id and id=v_sequence.id and status in ('active','paused');

    update public.follow_ups
    set status='cancelled', control_reason='customer_opted_out', control_actor='customer:whatsapp',
        claim_token=null, claimed_at=null
    where organization_id=p_organization_id and customer_id=v_sequence.customer_id
      and property_id is not distinct from v_sequence.property_id and sequence_id=v_sequence.id
      and (status in ('pending','scheduled','queued','paused','failed')
        or (status='processing' and send_authorized_at is null));
    get diagnostics v_rows = row_count;
    v_cancelled_steps := v_cancelled_steps + v_rows;

    insert into public.limitless_maia_followup_events(
      organization_id, customer_id, lead_id, property_id, sequence_id,
      event_type, reason, source, actor, occurred_at, metadata
    ) values (
      p_organization_id, v_sequence.customer_id, p_lead_id, v_sequence.property_id, v_sequence.id,
      'opt_out', 'customer_opted_out', 'maia_whatsapp_inbound',
      'customer:' || v_sequence.customer_id::text, v_now, v_metadata
    );
    v_sequence_count := v_sequence_count + 1;
  end loop;

  if v_sequence_count = 0 then
    insert into public.limitless_maia_followup_events(
      organization_id, customer_id, lead_id, property_id, sequence_id,
      event_type, reason, source, actor, occurred_at, metadata
    ) values (
      p_organization_id, null, p_lead_id, null, null,
      'opt_out', 'customer_opted_out', 'maia_whatsapp_inbound', 'customer:whatsapp', v_now, v_metadata
    );
  end if;

  return jsonb_build_object('opted_out', true, 'sequences_updated', v_sequence_count, 'steps_cancelled', v_cancelled_steps);
end;
$function$;

revoke all on function public.create_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.claim_limitless_maia_followup_step(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.authorize_limitless_maia_followup_send(uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.control_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.record_limitless_maia_opt_out(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,timestamptz,text,text,boolean,jsonb) to service_role;
grant execute on function public.claim_limitless_maia_followup_step(uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.authorize_limitless_maia_followup_send(uuid,uuid,uuid,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.control_limitless_maia_followup_sequence(uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.record_limitless_maia_opt_out(uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';

commit;
