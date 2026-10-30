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
