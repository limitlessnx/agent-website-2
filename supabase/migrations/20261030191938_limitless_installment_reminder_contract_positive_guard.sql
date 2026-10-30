begin;

-- Apply the installment contract and restore the stricter positive-amount guard atomically.
alter table public.payment_plans
  add column if not exists installment_amount numeric(18,2),
  add column if not exists next_due_date date,
  add column if not exists final_due_date date,
  add column if not exists first_reminder_mode text not null default 'due_date';

-- Preserve the deployed installment_amount >= 0 constraint. Existing zero-value
-- plans require verified operator correction; this migration must not reject them.

alter table public.payment_records
  add column if not exists advances_installment_schedule boolean not null default true;

alter table public.reminder_attempts
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_retry_at timestamptz,
  add column if not exists send_authorized_at timestamptz;

alter table public.reminder_attempts
  drop constraint if exists reminder_attempts_status_check;

alter table public.reminder_attempts
  add constraint reminder_attempts_status_check
    check (status in ('pending','queued','sent','failed','cancelled','skipped','unknown'));

create unique index if not exists limitless_reminder_attempts_schedule_unique
  on public.reminder_attempts (organization_id, payment_plan_id, reminder_template_id, scheduled_for)
  where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid;

create or replace function public.sync_payment_plan_total()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  target_plan uuid;
  tenant_id uuid;
  plan_organization_id uuid;
  plan_agreed_price numeric(18,2);
  plan_frequency text;
  plan_installment_amount numeric(18,2);
  plan_next_due_date date;
  plan_final_due_date date;
  plan_status text;
  plan_reminders_enabled boolean;
  payment_row_id uuid;
  paid numeric(18,2);
  paid_before numeric(18,2);
  other_paid numeric(18,2);
  installment_crossings integer := 0;
  candidate_due_date date;
begin
  if tg_op = 'DELETE' then
    target_plan := old.payment_plan_id;
    tenant_id := old.organization_id;
    payment_row_id := old.id;
  else
    target_plan := new.payment_plan_id;
    tenant_id := new.organization_id;
    payment_row_id := new.id;
  end if;

  if tg_op = 'UPDATE'
     and (new.payment_plan_id is distinct from old.payment_plan_id
       or new.organization_id is distinct from old.organization_id) then
    raise exception 'A payment record cannot be moved between plans or organizations';
  end if;

  select organization_id, agreed_price, frequency, installment_amount, next_due_date,
         final_due_date, status, reminders_enabled
    into plan_organization_id, plan_agreed_price, plan_frequency, plan_installment_amount,
         plan_next_due_date, plan_final_due_date, plan_status, plan_reminders_enabled
  from public.payment_plans
  where id = target_plan
  for update;

  if not found or plan_organization_id is distinct from tenant_id then
    raise exception 'Payment plan is outside the active organization scope';
  end if;

  select coalesce(sum(amount), 0)
    into other_paid
  from public.payment_records
  where payment_plan_id = target_plan
    and organization_id = tenant_id
    and id <> payment_row_id;

  if tg_op = 'UPDATE' then
    paid_before := other_paid + old.amount;
  else
    paid_before := other_paid;
  end if;

  select coalesce(sum(amount), 0)
    into paid
  from public.payment_records
  where payment_plan_id = target_plan
    and organization_id = tenant_id;

  if tg_op in ('INSERT','UPDATE')
     and plan_organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     and new.advances_installment_schedule
     and plan_installment_amount > 0 then
    installment_crossings := greatest(
      floor(paid / plan_installment_amount)::integer
        - floor(paid_before / plan_installment_amount)::integer,
      0
    );
  end if;

  candidate_due_date := plan_next_due_date;
  if installment_crossings > 0
     and plan_next_due_date is not null
     and paid < plan_agreed_price then
    candidate_due_date := (
      plan_next_due_date::timestamp
        + public.installment_frequency_interval(plan_frequency) * installment_crossings
    )::date;
    if plan_final_due_date is not null then
      candidate_due_date := least(candidate_due_date, plan_final_due_date);
    end if;
  end if;

  update public.payment_plans
  set total_paid = paid,
      status = case
        when plan_agreed_price > 0 and paid >= plan_agreed_price then 'completed'
        when plan_status = 'completed' and paid < plan_agreed_price then 'active'
        else plan_status
      end,
      reminders_enabled = case
        when plan_agreed_price > 0 and paid >= plan_agreed_price then false
        when plan_status = 'completed' and paid < plan_agreed_price then true
        else plan_reminders_enabled
      end,
      next_due_date = candidate_due_date,
      updated_at = now()
  where id = target_plan
    and organization_id = tenant_id;

  return coalesce(new, old);
end;
$function$;

create or replace function public.sync_limitless_payment_plan_reminder_cursor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  next_scheduled_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and old.organization_id is not distinct from new.organization_id
     and old.payment_type is not distinct from new.payment_type
     and old.status is not distinct from new.status
     and old.reminders_enabled is not distinct from new.reminders_enabled
     and old.installment_amount is not distinct from new.installment_amount
     and old.next_due_date is not distinct from new.next_due_date
     and old.final_due_date is not distinct from new.final_due_date
     and old.reminder_template_id is not distinct from new.reminder_template_id then
    return new;
  end if;

  if new.organization_id <> 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or new.payment_type <> 'installment'
     or new.status <> 'active'
     or not new.reminders_enabled
     or greatest(coalesce(new.agreed_price, 0) - coalesce(new.total_paid, 0), 0) <= 0
     or new.next_due_date is null
     or coalesce(new.installment_amount, 0) < 0 then
    new.next_reminder_at := null;
    return new;
  end if;

  select min(
    (((new.next_due_date + case
        when template.timing_direction = 'before' then -template.timing_days
        when template.timing_direction = 'after' then template.timing_days
        else 0
      end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos')
  )
    into next_scheduled_at
  from public.reminder_templates as template
  where template.organization_id = new.organization_id
    and template.enabled = true
    and template.channel = 'whatsapp'
    and template.timing_days >= 0
    and template.timing_direction in ('before','on','after')
    and (new.reminder_template_id is null or template.id = new.reminder_template_id)
    and (((new.next_due_date + case
        when template.timing_direction = 'before' then -template.timing_days
        when template.timing_direction = 'after' then template.timing_days
        else 0
      end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos') > now();

  new.next_reminder_at := next_scheduled_at;
  return new;
end;
$function$;

revoke all on function public.sync_limitless_payment_plan_reminder_cursor() from public, anon, authenticated;
grant execute on function public.sync_limitless_payment_plan_reminder_cursor() to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.payment_plans'::regclass
      and tgname = 'sync_limitless_payment_plan_reminder_cursor'
      and not tgisinternal
  ) then
    create trigger sync_limitless_payment_plan_reminder_cursor
      before insert or update of organization_id, payment_type, status, reminders_enabled,
        installment_amount, next_due_date, final_due_date, reminder_template_id
      on public.payment_plans
      for each row execute function public.sync_limitless_payment_plan_reminder_cursor();
  end if;
end;
$$;

revoke all on function public.sync_payment_plan_total() from public, anon, authenticated;
grant execute on function public.sync_payment_plan_total() to service_role;

-- Confirmed delivery advances the independent reminder cursor by a fixed 14-day interval.
-- Missed windows are skipped forward without a catch-up send; failed/unknown outcomes
-- leave the cursor in place for review and explicit retry.
create or replace function public.sync_payment_plan_reminder_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  plan_organization_id uuid;
  plan_due_date date;
  plan_status text;
  plan_reminders_enabled boolean;
  plan_balance numeric(18,2);
  prior_last_reminder timestamptz;
  effective_sent_at timestamptz;
  next_scheduled_at timestamptz;
  reminder_interval interval := interval '14 days';
  skipped_intervals integer;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status = 'sent' then
    if new.sent_at is null then return new; end if;
  elsif new.status = 'skipped' then
    if new.error_message is distinct from 'missed_reminder_window' then return new; end if;
  else
    return new;
  end if;

  select organization_id, next_due_date, status, reminders_enabled,
         outstanding_balance, last_reminder_at
    into plan_organization_id, plan_due_date, plan_status, plan_reminders_enabled,
         plan_balance, prior_last_reminder
  from public.payment_plans
  where id = new.payment_plan_id
  for update;

  if not found or plan_organization_id is distinct from new.organization_id then
    raise exception 'Reminder attempt is outside the active organization scope';
  end if;
  if plan_organization_id <> 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid then
    return new;
  end if;

  effective_sent_at := case when new.status = 'sent'
    then greatest(coalesce(prior_last_reminder, new.sent_at), new.sent_at)
    else prior_last_reminder end;
  next_scheduled_at := null;
  if plan_status = 'active'
     and plan_reminders_enabled
     and coalesce(plan_balance, 0) > 0
     and plan_due_date is not null then
    if new.status = 'sent' then
      next_scheduled_at := ((((effective_sent_at at time zone 'Africa/Lagos')::date + reminder_interval)::date + time '10:00') at time zone 'Africa/Lagos');
    elsif new.scheduled_for is not null then
      skipped_intervals := greatest(
        floor(greatest(extract(epoch from (now() - new.scheduled_for)), 0) / extract(epoch from reminder_interval))::integer + 1,
        1
      );
      next_scheduled_at := ((((new.scheduled_for at time zone 'Africa/Lagos')::date + reminder_interval * skipped_intervals)::date + time '10:00') at time zone 'Africa/Lagos');
    end if;
  end if;

  update public.payment_plans
     set last_reminder_at = case when new.status = 'sent' then effective_sent_at else prior_last_reminder end,
         next_reminder_at = next_scheduled_at,
         updated_at = now()
   where id = new.payment_plan_id
     and organization_id = new.organization_id;
  return new;
end;
$function$;

revoke all on function public.sync_payment_plan_reminder_state() from public, anon, authenticated;
grant execute on function public.sync_payment_plan_reminder_state() to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.reminder_attempts'::regclass
      and tgname = 'sync_payment_plan_reminder_state'
      and not tgisinternal
  ) then
    create trigger sync_payment_plan_reminder_state
      after insert or update of status on public.reminder_attempts
      for each row execute function public.sync_payment_plan_reminder_state();
  end if;
end;
$$;

-- Linearization point immediately before the external provider call. This locks
-- the exact plan and tenant-owned lead row, serializing with inbound STOP.
create or replace function public.authorize_limitless_installment_reminder_send(
  p_organization_id uuid,
  p_plan_id uuid,
  p_attempt_id uuid,
  p_template_id uuid,
  p_scheduled_for timestamptz,
  p_phone_candidates text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_plan public.payment_plans%rowtype;
  v_attempt public.reminder_attempts%rowtype;
  v_template public.reminder_templates%rowtype;
  v_lead public.leads%rowtype;
  v_candidate public.leads%rowtype;
  v_plan_phone text;
  v_candidate_phone text;
  v_lead_count integer := 0;
  v_expected_scheduled_at timestamptz;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or p_plan_id is null or p_attempt_id is null or p_template_id is null
     or p_scheduled_for is null or coalesce(array_length(p_phone_candidates, 1), 0) = 0 then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_authorization_scope');
  end if;

  select * into v_plan from public.payment_plans p
  where p.organization_id = p_organization_id and p.id = p_plan_id for update;
  if not found or v_plan.payment_type <> 'installment' or v_plan.status <> 'active'
     or not v_plan.reminders_enabled or v_plan.agreed_price is null or v_plan.agreed_price <= 0
     or v_plan.total_paid is null or v_plan.total_paid < 0 or v_plan.total_paid > v_plan.agreed_price
     or v_plan.outstanding_balance is null
     or v_plan.outstanding_balance is distinct from (v_plan.agreed_price - v_plan.total_paid)
     or v_plan.installment_amount is null or v_plan.installment_amount < 0
     or v_plan.installment_amount > v_plan.agreed_price or v_plan.next_due_date is null
     or nullif(trim(v_plan.client_phone), '') is null then
    return jsonb_build_object('authorized', false, 'reason', 'plan_not_sendable');
  end if;

  select * into v_attempt from public.reminder_attempts a
  where a.organization_id = p_organization_id and a.id = p_attempt_id
    and a.payment_plan_id = p_plan_id and a.reminder_template_id = p_template_id
    and a.scheduled_for = p_scheduled_for and a.status = 'pending'
    and a.send_authorized_at is null for update;
  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'attempt_not_pending');
  end if;

  select * into v_template from public.reminder_templates t
  where t.organization_id = p_organization_id and t.id = p_template_id
    and t.enabled and t.channel = 'whatsapp' and t.timing_days >= 0
    and t.timing_direction in ('before', 'on', 'after')
    and (v_plan.reminder_template_id is null or v_plan.reminder_template_id = t.id)
  for update;
  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'template_unavailable');
  end if;
  if v_plan.next_reminder_at is not null
     and (v_plan.next_reminder_at at time zone 'Africa/Lagos')::time is distinct from time '10:00:00' then
    return jsonb_build_object('authorized', false, 'reason', 'cursor_time_invalid');
  end if;
  v_expected_scheduled_at := coalesce(
    v_plan.next_reminder_at,
    (((v_plan.next_due_date + case
        when v_template.timing_direction = 'before' then -v_template.timing_days
        when v_template.timing_direction = 'after' then v_template.timing_days
        else 0 end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos')
  );
  if p_scheduled_for is distinct from v_expected_scheduled_at then
    return jsonb_build_object('authorized', false, 'reason', 'schedule_not_current');
  end if;

  v_plan_phone := regexp_replace(v_plan.client_phone, '[^0-9]', '', 'g');
  if left(v_plan_phone, 4) = '2340' and length(v_plan_phone) = 14 then
    v_plan_phone := '234' || substr(v_plan_phone, 5);
  elsif left(v_plan_phone, 1) = '0' and length(v_plan_phone) = 11 then
    v_plan_phone := '234' || substr(v_plan_phone, 2);
  end if;
  if v_plan_phone = '' or not exists (
    select 1 from unnest(p_phone_candidates) as candidate(phone)
    where regexp_replace(candidate.phone, '[^0-9]', '', 'g') = v_plan_phone
       or ('234' || substr(regexp_replace(candidate.phone, '[^0-9]', '', 'g'), 2)) = v_plan_phone
  ) then
    return jsonb_build_object('authorized', false, 'reason', 'phone_scope_mismatch');
  end if;

  if v_plan.contact_id is not null then
    select * into v_lead from public.leads l
    where l.organization_id = p_organization_id and l.id = v_plan.contact_id for update;
    if not found then return jsonb_build_object('authorized', false, 'reason', 'lead_unavailable'); end if;
    v_candidate_phone := regexp_replace(coalesce(v_lead.phone, ''), '[^0-9]', '', 'g');
    if left(v_candidate_phone, 4) = '2340' and length(v_candidate_phone) = 14 then
      v_candidate_phone := '234' || substr(v_candidate_phone, 5);
    elsif left(v_candidate_phone, 1) = '0' and length(v_candidate_phone) = 11 then
      v_candidate_phone := '234' || substr(v_candidate_phone, 2);
    end if;
    if v_candidate_phone is distinct from v_plan_phone then
      return jsonb_build_object('authorized', false, 'reason', 'lead_phone_mismatch');
    end if;
  else
    for v_candidate in
      select l.* from public.leads l
      where l.organization_id = p_organization_id
        and (case
          when left(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 4) = '2340'
            and length(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')) = 14
            then '234' || substr(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 5)
          when left(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 1) = '0'
            and length(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')) = 11
            then '234' || substr(regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g'), 2)
          else regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
        end) = v_plan_phone
      order by l.id for update
    loop
      v_lead_count := v_lead_count + 1;
      v_lead := v_candidate;
    end loop;
    if v_lead_count <> 1 then
      return jsonb_build_object('authorized', false, 'reason', case when v_lead_count = 0 then 'lead_unavailable' else 'ambiguous_lead_phone' end);
    end if;
  end if;

  if coalesce(v_lead.opted_out, false) then
    return jsonb_build_object('authorized', false, 'reason', 'customer_opted_out');
  end if;

  update public.reminder_attempts set send_authorized_at = now()
  where organization_id = p_organization_id and id = p_attempt_id
    and payment_plan_id = p_plan_id and status = 'pending' and send_authorized_at is null;
  if not found then return jsonb_build_object('authorized', false, 'reason', 'authorization_claim_conflict'); end if;
  return jsonb_build_object('authorized', true, 'authorized_at', now());
end;
$function$;

revoke all on function public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[]) from public, anon, authenticated;
grant execute on function public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[]) to service_role;

-- Final authorization and cursor definitions: non-positive installment plans are never sendable.
-- Reject zero-value installment schedules before they can be authorized for WhatsApp delivery.
begin;
create or replace function public.sync_limitless_payment_plan_reminder_cursor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  next_scheduled_at timestamptz;
begin
  if tg_op = 'UPDATE'
     and old.organization_id is not distinct from new.organization_id
     and old.payment_type is not distinct from new.payment_type
     and old.status is not distinct from new.status
     and old.reminders_enabled is not distinct from new.reminders_enabled
     and old.installment_amount is not distinct from new.installment_amount
     and old.next_due_date is not distinct from new.next_due_date
     and old.final_due_date is not distinct from new.final_due_date
     and old.reminder_template_id is not distinct from new.reminder_template_id then
    return new;
  end if;

  if new.organization_id <> 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or new.payment_type <> 'installment'
     or new.status <> 'active'
     or not new.reminders_enabled
     or greatest(coalesce(new.agreed_price, 0) - coalesce(new.total_paid, 0), 0) <= 0
     or new.next_due_date is null
     or coalesce(new.installment_amount, 0) <= 0 then
    new.next_reminder_at := null;
    return new;
  end if;

  select min(
    (((new.next_due_date + case
        when template.timing_direction = 'before' then -template.timing_days
        when template.timing_direction = 'after' then template.timing_days
        else 0
      end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos')
  )
    into next_scheduled_at
  from public.reminder_templates as template
  where template.organization_id = new.organization_id
    and template.enabled = true
    and template.channel = 'whatsapp'
    and template.timing_days >= 0
    and template.timing_direction in ('before','on','after')
    and (new.reminder_template_id is null or template.id = new.reminder_template_id)
    and (((new.next_due_date + case
        when template.timing_direction = 'before' then -template.timing_days
        when template.timing_direction = 'after' then template.timing_days
        else 0
      end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos') > now();

  new.next_reminder_at := next_scheduled_at;
  return new;
end;
$function$;
revoke all on function public.sync_limitless_payment_plan_reminder_cursor() from public, anon, authenticated;
grant execute on function public.sync_limitless_payment_plan_reminder_cursor() to service_role;
create or replace function public.authorize_limitless_installment_reminder_send(
  p_organization_id uuid,
  p_plan_id uuid,
  p_attempt_id uuid,
  p_template_id uuid,
  p_scheduled_for timestamptz,
  p_phone_candidates text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_plan public.payment_plans%rowtype;
  v_attempt public.reminder_attempts%rowtype;
  v_template public.reminder_templates%rowtype;
  v_lead public.leads%rowtype;
  v_candidate public.leads%rowtype;
  v_plan_phone text;
  v_expected_scheduled_at timestamptz;
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
     or p_plan_id is null or p_attempt_id is null or p_template_id is null
     or p_scheduled_for is null or coalesce(array_length(p_phone_candidates, 1), 0) = 0 then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_authorization_scope');
  end if;

  select * into v_plan from public.payment_plans p
  where p.organization_id = p_organization_id and p.id = p_plan_id for update;
  if not found or v_plan.payment_type <> 'installment' or v_plan.status <> 'active'
     or not v_plan.reminders_enabled or v_plan.agreed_price is null or v_plan.agreed_price <= 0
     or v_plan.total_paid is null or v_plan.total_paid < 0 or v_plan.total_paid > v_plan.agreed_price
     or v_plan.outstanding_balance is null
     or v_plan.outstanding_balance is distinct from (v_plan.agreed_price - v_plan.total_paid)
     or v_plan.installment_amount is null or v_plan.installment_amount <= 0
     or v_plan.installment_amount > v_plan.agreed_price or v_plan.next_due_date is null
     or nullif(trim(v_plan.client_phone), '') is null then
    return jsonb_build_object('authorized', false, 'reason', 'plan_not_sendable');
  end if;

  select * into v_attempt from public.reminder_attempts a
  where a.organization_id = p_organization_id and a.id = p_attempt_id
    and a.payment_plan_id = p_plan_id and a.reminder_template_id = p_template_id
    and a.scheduled_for = p_scheduled_for and a.status = 'pending'
    and a.send_authorized_at is null for update;
  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'attempt_not_pending');
  end if;

  select * into v_template from public.reminder_templates t
  where t.organization_id = p_organization_id and t.id = p_template_id
    and t.enabled and t.channel = 'whatsapp' and t.timing_days >= 0
    and t.timing_direction in ('before', 'on', 'after')
    and (v_plan.reminder_template_id is null or v_plan.reminder_template_id = t.id)
  for update;
  if not found then
    return jsonb_build_object('authorized', false, 'reason', 'template_unavailable');
  end if;

  if v_plan.next_reminder_at is not null
     and (v_plan.next_reminder_at at time zone 'Africa/Lagos')::time is distinct from time '10:00:00' then
    return jsonb_build_object('authorized', false, 'reason', 'cursor_time_invalid');
  end if;

  v_expected_scheduled_at := coalesce(
    v_plan.next_reminder_at,
    (((v_plan.next_due_date + case
      when v_template.timing_direction = 'before' then -v_template.timing_days
      when v_template.timing_direction = 'after' then v_template.timing_days
      else 0
    end)::timestamp + interval '10 hours') at time zone 'Africa/Lagos')
  );
  if p_scheduled_for is distinct from v_expected_scheduled_at then
    return jsonb_build_object('authorized', false, 'reason', 'schedule_not_current');
  end if;

  v_plan_phone := regexp_replace(v_plan.client_phone, '[^0-9]', '', 'g');
  if left(v_plan_phone, 4) = '2340' and length(v_plan_phone) = 14 then
    v_plan_phone := '234' || substr(v_plan_phone, 5);
  elsif left(v_plan_phone, 1) = '0' and length(v_plan_phone) = 11 then
    v_plan_phone := '234' || substr(v_plan_phone, 2);
  end if;

  if v_plan_phone = '' or not exists (
    select 1 from unnest(p_phone_candidates) as candidate(phone)
    where regexp_replace(candidate.phone, '[^0-9]', '', 'g') = v_plan_phone
       or ('234' || substr(regexp_replace(candidate.phone, '[^0-9]', '', 'g'), 2)) = v_plan_phone
  ) then
    return jsonb_build_object('authorized', false, 'reason', 'phone_mismatch');
  end if;

  if v_plan.contact_id is not null then
    select * into v_lead from public.leads
    where id = v_plan.contact_id and organization_id = p_organization_id for update;
    if not found then
      return jsonb_build_object('authorized', false, 'reason', 'lead_not_found');
    end if;
    if coalesce(v_lead.opted_out, false) then
      return jsonb_build_object('authorized', false, 'reason', 'lead_opted_out');
    end if;
  else
    select * into v_candidate from public.leads
    where organization_id = p_organization_id
      and regexp_replace(phone, '[^0-9]', '', 'g') = v_plan_phone
    limit 1 for update;
    if found and coalesce(v_candidate.opted_out, false) then
      return jsonb_build_object('authorized', false, 'reason', 'lead_opted_out');
    end if;
  end if;

  update public.reminder_attempts set send_authorized_at = now()
  where id = p_attempt_id and status = 'pending';
  return jsonb_build_object('authorized', true, 'reason', 'authorized');
end;
$function$;
revoke all on function public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[]) from public, anon, authenticated;
grant execute on function public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[]) to service_role;

-- Clear stale scheduler cursors on existing zero-value plans without changing payment data.
update public.payment_plans
set next_reminder_at = null
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and coalesce(installment_amount, 0) <= 0
  and next_reminder_at is not null;

commit;
