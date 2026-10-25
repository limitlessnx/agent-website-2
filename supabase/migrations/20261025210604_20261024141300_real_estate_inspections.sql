begin;

-- The live legacy tables have primary keys on id only. Composite tenant FKs
-- require a matching unique key; add only the targeted keys needed below.
create unique index if not exists leads_org_id_unique on public.leads(organization_id, id);
create unique index if not exists crm_leads_org_id_unique on public.crm_leads(organization_id, id);
create unique index if not exists crm_customers_org_id_unique on public.crm_customers(organization_id, id);
create unique index if not exists properties_org_id_unique on public.properties(organization_id, id);
create unique index if not exists appointments_org_id_unique on public.appointments(organization_id, id);

create table public.real_estate_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_lead_id uuid,
  crm_lead_id uuid,
  customer_id uuid,
  property_id uuid,
  property_query_text text,
  property_verification_status text not null default 'unresolved'
    check (property_verification_status in ('unresolved','verified')),
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  timezone text not null default 'Africa/Lagos',
  status text not null default 'requested'
    check (status in (
      'requested','requested_verification','booking_pending','unavailable',
      'booked','reschedule_pending','rescheduled','cancellation_pending',
      'completed','cancelled','no_show','failed'
    )),
  source text not null default 'real_estate',
  notes text,
  booking_idempotency_key text,
  booking_request_event_id uuid,
  canonical_appointment_id uuid,
  appointment_external_event_id text,
  approved_by text,
  approved_at timestamptz,
  unavailable_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,booking_idempotency_key),
  foreign key (organization_id,legacy_lead_id)
    references public.leads(organization_id,id) on delete cascade,
  foreign key (organization_id,crm_lead_id)
    references public.crm_leads(organization_id,id) on delete cascade,
  foreign key (organization_id,customer_id)
    references public.crm_customers(organization_id,id) on delete cascade,
  foreign key (organization_id,property_id)
    references public.properties(organization_id,id) on delete set null (property_id),
  foreign key (organization_id,booking_request_event_id)
    references public.domain_events(organization_id,id) on delete set null (booking_request_event_id),
  foreign key (organization_id,canonical_appointment_id)
    references public.appointments(organization_id,id) on delete set null (canonical_appointment_id),
  check (legacy_lead_id is not null or crm_lead_id is not null or customer_id is not null),
  check (property_verification_status = 'unresolved' or property_id is not null),
  check (property_id is not null or nullif(btrim(property_query_text), '') is not null
         or property_verification_status = 'unresolved')
);

create index real_estate_inspections_org_status_start_idx
  on public.real_estate_inspections(organization_id,status,requested_start_at);
create index real_estate_inspections_org_customer_idx
  on public.real_estate_inspections(organization_id,customer_id,created_at desc);
create index real_estate_inspections_org_legacy_lead_idx
  on public.real_estate_inspections(organization_id,legacy_lead_id,created_at desc)
  where legacy_lead_id is not null;
create index real_estate_inspections_org_crm_lead_idx
  on public.real_estate_inspections(organization_id,crm_lead_id,created_at desc)
  where crm_lead_id is not null;

create table public.real_estate_inspection_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_id uuid not null,
  job_type text not null check (job_type in ('reminder_24h','reminder_2h','outcome_followup')),
  status text not null default 'scheduled'
    check (status in ('scheduled','processing','completed','cancelled','failed')),
  due_at timestamptz not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,idempotency_key),
  foreign key (organization_id,inspection_id)
    references public.real_estate_inspections(organization_id,id) on delete cascade
);
create index real_estate_inspection_jobs_due_idx
  on public.real_estate_inspection_jobs(organization_id,status,due_at);

create trigger set_real_estate_inspections_updated_at
before update on public.real_estate_inspections
for each row execute function public.set_updated_at();
create trigger set_real_estate_inspection_jobs_updated_at
before update on public.real_estate_inspection_jobs
for each row execute function public.set_updated_at();

alter table public.real_estate_inspections enable row level security;
alter table public.real_estate_inspection_jobs enable row level security;
revoke all on public.real_estate_inspections, public.real_estate_inspection_jobs from public, anon, authenticated;
grant select on public.real_estate_inspections, public.real_estate_inspection_jobs to authenticated;
grant all on public.real_estate_inspections, public.real_estate_inspection_jobs to service_role;

create policy real_estate_inspections_member_select
on public.real_estate_inspections for select to authenticated
using (public.is_organization_member(organization_id));
create policy real_estate_inspection_jobs_member_select
on public.real_estate_inspection_jobs for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.transition_real_estate_inspection(
  p_organization_id uuid,
  p_inspection_id uuid,
  p_status text,
  p_property_id uuid default null,
  p_requested_start_at timestamptz default null,
  p_requested_end_at timestamptz default null,
  p_booking_request_event_id uuid default null,
  p_canonical_appointment_id uuid default null,
  p_appointment_external_event_id text default null,
  p_approved_by text default null,
  p_unavailable_reason text default null,
  p_notes text default null
) returns public.real_estate_inspections
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.real_estate_inspections%rowtype;
  v_next text := btrim(coalesce(p_status,''));
  v_property_status text;
  v_appointment_status text;
  v_external_event_id text;
  v_appointment_customer_id uuid;
  v_appointment_id uuid;
  v_appointment_start timestamptz;
  v_appointment_end timestamptz;
begin
  select * into v_row from public.real_estate_inspections
  where organization_id=p_organization_id and id=p_inspection_id for update;
  if not found then raise exception 'Inspection was not found in organization'; end if;
  if v_next not in ('requested','requested_verification','booking_pending','unavailable','booked','reschedule_pending','rescheduled','cancellation_pending','completed','cancelled','no_show','failed') then
    raise exception 'Invalid real-estate inspection status';
  end if;
  if v_row.status in ('completed','cancelled','no_show') and v_row.status is distinct from v_next then raise exception 'Inspection is terminal'; end if;
  if v_row.status='requested' and v_next not in ('requested','requested_verification','booking_pending','unavailable','cancelled','failed') then raise exception 'Invalid requested inspection transition'; end if;
  if v_row.status='requested_verification' and v_next not in ('requested','requested_verification','booking_pending','unavailable','cancelled','failed') then raise exception 'Invalid verification inspection transition'; end if;
  if v_row.status='unavailable' and v_next not in ('requested','requested_verification','booking_pending','cancelled','failed') then raise exception 'Invalid unavailable inspection transition'; end if;
  if v_row.status='booking_pending' and v_next not in ('booking_pending','booked','reschedule_pending','cancellation_pending','unavailable','failed','cancelled') then raise exception 'Invalid pending inspection transition'; end if;
  if v_row.status in ('booked','rescheduled') and v_next not in ('booked','reschedule_pending','rescheduled','cancellation_pending','completed','cancelled','no_show','failed') then raise exception 'Invalid booked inspection transition'; end if;
  if v_row.status='reschedule_pending' and v_next not in ('reschedule_pending','rescheduled','unavailable','cancellation_pending','failed','cancelled') then raise exception 'Invalid reschedule transition'; end if;
  if v_row.status='cancellation_pending' and v_next not in ('cancellation_pending','cancelled','failed') then raise exception 'Invalid cancellation transition'; end if;

  if p_property_id is not null then
    select status into v_property_status from public.properties
    where organization_id=p_organization_id and id=p_property_id for update;
    if not found or v_property_status is distinct from 'active' then raise exception 'Property is not an active verified property in organization'; end if;
  end if;

  v_appointment_id:=coalesce(p_canonical_appointment_id,v_row.canonical_appointment_id);
  if v_next in ('booked','rescheduled') and (v_appointment_id is null or v_row.customer_id is null or coalesce(p_property_id,v_row.property_id) is null) then raise exception 'Canonical appointment, verified property and customer are required before booking'; end if;
  if v_next in ('booking_pending','booked','rescheduled') then
    perform 1 from public.properties where organization_id=p_organization_id and id=coalesce(p_property_id,v_row.property_id) and status='active' for key share;
    if not found then raise exception 'An active verified property is required before booking'; end if;
  end if;
  if v_appointment_id is not null then
    select status,external_event_id,customer_id,start_at,end_at into v_appointment_status,v_external_event_id,v_appointment_customer_id,v_appointment_start,v_appointment_end
    from public.appointments where organization_id=p_organization_id and id=v_appointment_id for key share;
    if not found then raise exception 'Canonical appointment is not in organization'; end if;
    if v_row.customer_id is not null and v_appointment_customer_id is distinct from v_row.customer_id then raise exception 'Canonical appointment customer does not match inspection customer'; end if;
    -- The provider event id is read from the locked canonical appointment row.
    -- Never trust the caller's p_appointment_external_event_id for this guard.
    if v_next in ('booked','rescheduled') and (v_appointment_status not in ('confirmed','rescheduled') or nullif(btrim(coalesce(v_external_event_id,'')),'') is null) then
      raise exception 'Cannot mark inspection booked before canonical external calendar event exists';
    end if;
  end if;

  if p_booking_request_event_id is not null and not exists (
    select 1 from public.domain_events where id=p_booking_request_event_id and organization_id=p_organization_id
  ) then raise exception 'Booking request event is not in organization'; end if;
  if v_next in ('completed','no_show') and coalesce(p_requested_start_at,v_row.requested_start_at) is not null and coalesce(p_requested_start_at,v_row.requested_start_at) > clock_timestamp() then
    raise exception 'Inspection outcome cannot be terminal before its start time';
  end if;

  update public.real_estate_inspections set
    status=v_next,
    property_id=coalesce(p_property_id,property_id),
    property_verification_status=case when coalesce(p_property_id,property_id) is not null then 'verified' else property_verification_status end,
    requested_start_at=case when v_next in ('booked','rescheduled') then v_appointment_start else coalesce(p_requested_start_at,requested_start_at) end,
    requested_end_at=case when v_next in ('booked','rescheduled') then v_appointment_end else coalesce(p_requested_end_at,requested_end_at) end,
    booking_request_event_id=coalesce(p_booking_request_event_id,booking_request_event_id),
    canonical_appointment_id=coalesce(p_canonical_appointment_id,canonical_appointment_id),
    appointment_external_event_id=case when v_appointment_id is not null then nullif(btrim(v_external_event_id),'') else appointment_external_event_id end,
    approved_by=coalesce(nullif(btrim(p_approved_by),''),approved_by),
    approved_at=case when p_approved_by is not null then coalesce(approved_at,clock_timestamp()) else approved_at end,
    unavailable_reason=case when p_unavailable_reason is not null then nullif(btrim(p_unavailable_reason),'') else unavailable_reason end,
    notes=case when p_notes is not null then nullif(btrim(p_notes),'') else notes end,
    updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=p_inspection_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_real_estate_inspection(p_organization_id uuid,p_inspection_id uuid,p_reason text default null)
returns public.real_estate_inspections language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.real_estate_inspections%rowtype;
begin
  select * into v_row from public.real_estate_inspections where organization_id=p_organization_id and id=p_inspection_id for update;
  if not found then raise exception 'Inspection was not found in organization'; end if;
  if v_row.status in ('completed','no_show') then raise exception 'Completed inspection cannot be cancelled'; end if;
  update public.real_estate_inspection_jobs set status='cancelled',updated_at=clock_timestamp()
  where organization_id=p_organization_id and inspection_id=p_inspection_id and status in ('scheduled','processing');
  update public.real_estate_inspections set status='cancelled',unavailable_reason=null,notes=case when p_reason is not null then concat_ws(E'\n',notes,nullif(btrim(p_reason),'')) else notes end,updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=p_inspection_id returning * into v_row;
  return v_row;
end;
$$;

-- One row is claimed while locked, so two Trigger workers cannot send the same job.
create or replace function public.claim_real_estate_inspection_job(p_organization_id uuid)
returns setof public.real_estate_inspection_jobs language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_job public.real_estate_inspection_jobs%rowtype;
begin
  select * into v_job from public.real_estate_inspection_jobs
  where organization_id=p_organization_id and status='scheduled' and due_at <= clock_timestamp()
  order by due_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.real_estate_inspection_jobs set status='processing',updated_at=clock_timestamp()
  where organization_id=p_organization_id and id=v_job.id returning * into v_job;
  return next v_job;
end;
$$;

-- Reschedules cancel old reminder rows and reinsert/update the new keyed rows in
-- one transaction. Outcome follow-up is intentionally excluded until an outcome.
create or replace function public.replace_real_estate_inspection_reminders(p_organization_id uuid,p_inspection_id uuid,p_requested_start_at timestamptz,p_customer_id uuid default null,p_canonical_appointment_id uuid default null)
returns setof public.real_estate_inspection_jobs language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_row public.real_estate_inspections%rowtype;
  v_start timestamptz := p_requested_start_at;
  v_due timestamptz;
  v_type text;
  v_key text;
  v_signature text;
  v_revision integer;
  v_job public.real_estate_inspection_jobs%rowtype;
begin
  select * into v_row from public.real_estate_inspections where organization_id=p_organization_id and id=p_inspection_id for update;
  if not found then raise exception 'Inspection was not found in organization'; end if;
  if v_row.status not in ('booked','rescheduled') or v_row.requested_start_at is distinct from p_requested_start_at or v_row.customer_id is distinct from p_customer_id or v_row.canonical_appointment_id is distinct from p_canonical_appointment_id then raise exception 'Reminder schedule must match the canonical booked inspection'; end if;
  v_signature:=concat_ws(':',p_canonical_appointment_id::text,p_requested_start_at::text,v_row.requested_end_at::text);
  v_revision:=coalesce((v_row.metadata->>'reminder_revision')::integer,0);
  if v_row.metadata->>'reminder_signature' is distinct from v_signature then
    v_revision:=v_revision+1;
    update public.real_estate_inspections set metadata=metadata||jsonb_build_object('reminder_signature',v_signature,'reminder_revision',v_revision) where organization_id=p_organization_id and id=p_inspection_id;
  end if;
  update public.real_estate_inspection_jobs set status='cancelled',updated_at=clock_timestamp()
  where organization_id=p_organization_id and inspection_id=p_inspection_id and job_type in ('reminder_24h','reminder_2h') and status in ('scheduled','processing') and payload->>'schedule_revision' is distinct from v_revision::text;
  foreach v_type in array array['reminder_24h','reminder_2h'] loop
    v_due := v_start - case when v_type='reminder_24h' then interval '24 hours' else interval '2 hours' end;
    if v_due > clock_timestamp() then
      v_key:='real-estate-inspection:'||p_inspection_id||':'||v_type||':revision:'||v_revision;
      insert into public.real_estate_inspection_jobs(organization_id,inspection_id,job_type,status,due_at,idempotency_key,payload)
      values(p_organization_id,p_inspection_id,v_type,'scheduled',v_due,v_key,jsonb_build_object('inspection_id',p_inspection_id,'customer_id',p_customer_id,'canonical_appointment_id',p_canonical_appointment_id,'schedule_revision',v_revision))
      on conflict (organization_id,idempotency_key) do nothing returning * into v_job;
      if not found then select * into v_job from public.real_estate_inspection_jobs where organization_id=p_organization_id and idempotency_key=v_key; end if;
      return next v_job;
    end if;
  end loop;
end;
$$;

-- The shared cron only processes tenants that explicitly opt in. Nothing is
-- seeded: unrelated or excluded tenants are never selected by default.
create table public.real_estate_inspection_automation (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status text not null check (status in ('enabled','paused')),
  enabled_by text not null check (length(btrim(enabled_by)) between 1 and 320),
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint real_estate_inspection_automation_enabled_at check (status <> 'enabled' or enabled_at is not null)
);
alter table public.real_estate_inspection_automation enable row level security;
revoke all on public.real_estate_inspection_automation from public,anon,authenticated;
grant all on public.real_estate_inspection_automation to service_role;

create or replace function public.set_real_estate_inspection_automation(
  p_organization_id uuid,p_status text,p_actor_id text,p_explicit_confirmation boolean default false
) returns public.real_estate_inspection_automation
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_org public.organizations%rowtype; v_row public.real_estate_inspection_automation%rowtype;
begin
  if p_status not in ('enabled','paused') then raise exception 'Invalid inspection automation status'; end if;
  if nullif(btrim(p_actor_id),'') is null then raise exception 'Authenticated actor is required'; end if;
  if p_explicit_confirmation is distinct from true then raise exception 'Explicit confirmation is required'; end if;
  select * into v_org from public.organizations where id=p_organization_id for key share;
  if not found or v_org.status <> 'active' or not (
    v_org.slug='limitless-realty' or regexp_replace(lower(coalesce(v_org.metadata->>'industry_slug',v_org.metadata->>'industry','')),'[^a-z]','','g')='realestate'
  ) then raise exception 'An active real-estate organization is required'; end if;
  insert into public.real_estate_inspection_automation(organization_id,status,enabled_by,enabled_at,updated_at)
  values(p_organization_id,p_status,btrim(p_actor_id),case when p_status='enabled' then clock_timestamp() else null end,clock_timestamp())
  on conflict(organization_id) do update set status=excluded.status,enabled_by=excluded.enabled_by,
    enabled_at=excluded.enabled_at,updated_at=clock_timestamp()
  returning * into v_row;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.inspection_automation.'||p_status,'real_estate_inspection_automation',p_organization_id::text,
    jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','status',p_status));
  return v_row;
end;
$$;

-- Called only by the authenticated app scheduler. Return tenant IDs with due
-- work and an explicit active opt-in; do not enumerate the organizations table.
create or replace function public.list_due_real_estate_inspection_organizations(p_limit integer default 25)
returns table(organization_id uuid)
language sql stable security definer set search_path = pg_catalog, public as $$
  select distinct i.organization_id
  from public.real_estate_inspection_automation i
  join public.organizations o on o.id=i.organization_id and o.status='active'
  join public.real_estate_inspection_jobs j on j.organization_id=i.organization_id
  where i.status='enabled' and j.status='scheduled' and j.due_at <= clock_timestamp()
    and (o.slug='limitless-realty' or regexp_replace(lower(coalesce(o.metadata->>'industry_slug',o.metadata->>'industry','')),'[^a-z]','','g')='realestate')
  order by i.organization_id
  limit greatest(1,least(coalesce(p_limit,25),100));
$$;

revoke all on function public.transition_real_estate_inspection(uuid,uuid,text,uuid,timestamptz,timestamptz,uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.cancel_real_estate_inspection(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_real_estate_inspection_job(uuid) from public,anon,authenticated;
revoke all on function public.replace_real_estate_inspection_reminders(uuid,uuid,timestamptz,uuid,uuid) from public,anon,authenticated;
grant execute on function public.transition_real_estate_inspection(uuid,uuid,text,uuid,timestamptz,timestamptz,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.cancel_real_estate_inspection(uuid,uuid,text) to service_role;
grant execute on function public.claim_real_estate_inspection_job(uuid) to service_role;
grant execute on function public.replace_real_estate_inspection_reminders(uuid,uuid,timestamptz,uuid,uuid) to service_role;
revoke all on function public.set_real_estate_inspection_automation(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.list_due_real_estate_inspection_organizations(integer) from public,anon,authenticated;
grant execute on function public.set_real_estate_inspection_automation(uuid,text,text,boolean) to service_role;
grant execute on function public.list_due_real_estate_inspection_organizations(integer) to service_role;

commit;
