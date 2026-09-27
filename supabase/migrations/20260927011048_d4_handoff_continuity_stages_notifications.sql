create table if not exists public.organization_customer_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  category text not null default 'active' check(category in ('active','follow_up','won','lost','closed')),
  position integer not null default 0,
  is_terminal boolean not null default false,
  follow_up_default_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,key),
  unique(organization_id,id)
);

alter table public.crm_customers
  add column if not exists current_stage_id uuid,
  add column if not exists stage_updated_at timestamptz;

do $$ begin
  alter table public.crm_customers
  add constraint crm_customers_stage_tenant_fk
  foreign key(organization_id,current_stage_id)
  references public.organization_customer_stages(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.customer_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  changed_by_type text not null check(changed_by_type in ('system','agent','human')),
  changed_by_id text,
  reason text,
  source text not null default 'runtime',
  metadata jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now(),
  foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
  foreign key(organization_id,from_stage_id) references public.organization_customer_stages(organization_id,id) on delete set null,
  foreign key(organization_id,to_stage_id) references public.organization_customer_stages(organization_id,id) on delete restrict
);

create index if not exists customer_stage_history_customer_idx
  on public.customer_stage_history(organization_id,customer_id,changed_at desc);

create table if not exists public.handoff_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  source_system_id uuid,
  assigned_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  priority integer not null default 100,
  notify_whatsapp boolean not null default true,
  notify_dashboard boolean not null default true,
  status text not null default 'active' check(status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,source_system_id) references public.organization_systems(organization_id,id) on delete cascade
);

create index if not exists handoff_assignment_rules_match_idx
  on public.handoff_assignment_rules(organization_id,status,category,priority);

create table if not exists public.organization_member_notification_preferences (
  membership_id uuid primary key references public.organization_memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_phone text,
  notify_whatsapp_handoffs boolean not null default false,
  notify_dashboard_handoffs boolean not null default true,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,membership_id)
);

create table if not exists public.handoff_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  handoff_id uuid not null,
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  channel text not null check(channel in ('dashboard','whatsapp','email')),
  recipient text,
  status text not null default 'pending' check(status in ('pending','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key(organization_id,handoff_id) references public.human_handoffs(organization_id,id) on delete cascade
);

alter table public.human_handoffs
  add column if not exists conversation_summary text,
  add column if not exists stage_id_at_handoff uuid,
  add column if not exists next_action text,
  add column if not exists outcome text,
  add column if not exists follow_up_required boolean not null default true,
  add column if not exists follow_up_due_at timestamptz,
  add column if not exists follow_up_status text not null default 'pending'
    check(follow_up_status in ('pending','scheduled','completed','not_required','failed')),
  add column if not exists notified_at timestamptz;

do $$ begin
  alter table public.human_handoffs
  add constraint human_handoffs_stage_tenant_fk
  foreign key(organization_id,stage_id_at_handoff)
  references public.organization_customer_stages(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;

alter table public.organization_customer_stages enable row level security;
alter table public.customer_stage_history enable row level security;
alter table public.handoff_assignment_rules enable row level security;
alter table public.organization_member_notification_preferences enable row level security;
alter table public.handoff_notifications enable row level security;

revoke all on public.organization_customer_stages,public.customer_stage_history,public.handoff_assignment_rules,
  public.organization_member_notification_preferences,public.handoff_notifications from anon,authenticated;

grant select on public.organization_customer_stages,public.customer_stage_history,public.handoff_assignment_rules,
  public.organization_member_notification_preferences,public.handoff_notifications to authenticated;
grant all on public.organization_customer_stages,public.customer_stage_history,public.handoff_assignment_rules,
  public.organization_member_notification_preferences,public.handoff_notifications to service_role;

create policy organization_customer_stages_select on public.organization_customer_stages for select to authenticated
using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));

create policy customer_stage_history_select on public.customer_stage_history for select to authenticated
using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));

create policy handoff_assignment_rules_select on public.handoff_assignment_rules for select to authenticated
using(public.has_organization_permission(organization_id,'handoffs.manage'));

create policy member_notification_preferences_select on public.organization_member_notification_preferences for select to authenticated
using(public.has_organization_permission(organization_id,'handoffs.manage') or membership_id in (
  select om.id from public.organization_memberships om
  where om.organization_id=organization_member_notification_preferences.organization_id and om.user_id=auth.uid() and om.status='active'
));

create policy handoff_notifications_select on public.handoff_notifications for select to authenticated
using(public.has_organization_permission(organization_id,'handoffs.view') or public.has_organization_permission(organization_id,'handoffs.manage'));

create or replace function public.update_customer_stage(
  p_organization_id uuid,
  p_customer_id uuid,
  p_stage_id uuid,
  p_changed_by_type text,
  p_changed_by_id text default null,
  p_reason text default null,
  p_source text default 'runtime',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_old uuid; v_name text; v_history_id uuid;
begin
  select current_stage_id into v_old
  from public.crm_customers
  where organization_id=p_organization_id and id=p_customer_id
  for update;
  if not found then raise exception 'Customer not found in organization'; end if;

  select name into v_name
  from public.organization_customer_stages
  where organization_id=p_organization_id and id=p_stage_id and status='active';
  if not found then raise exception 'Stage not found in organization'; end if;

  update public.crm_customers
  set current_stage_id=p_stage_id,stage_updated_at=now(),updated_at=now()
  where organization_id=p_organization_id and id=p_customer_id;

  insert into public.customer_stage_history(
    organization_id,customer_id,from_stage_id,to_stage_id,changed_by_type,changed_by_id,reason,source,metadata
  ) values(
    p_organization_id,p_customer_id,v_old,p_stage_id,p_changed_by_type,p_changed_by_id,p_reason,p_source,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_history_id;

  perform public.add_customer_timeline_event(
    p_organization_id,p_customer_id,'customer.stage_changed','Customer stage changed',
    coalesce(p_reason,'Stage updated to '||v_name),'internal',null,'customer_stage_history',
    v_history_id,null,p_changed_by_type,p_changed_by_id,
    jsonb_build_object('from_stage_id',v_old,'to_stage_id',p_stage_id,'to_stage_name',v_name,'source',p_source),now()
  );

  return jsonb_build_object('customer_id',p_customer_id,'stage_id',p_stage_id,'stage_name',v_name);
end $$;

revoke all on function public.update_customer_stage(uuid,uuid,uuid,text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.update_customer_stage(uuid,uuid,uuid,text,text,text,text,jsonb)
to service_role;

create or replace function public.seed_default_customer_stages(p_organization_id uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
  insert into public.organization_customer_stages(organization_id,key,name,category,position,is_terminal,follow_up_default_minutes)
  values
    (p_organization_id,'new_lead','New Lead','active',10,false,null),
    (p_organization_id,'qualified','Qualified','active',20,false,null),
    (p_organization_id,'needs_follow_up','Needs Follow-Up','follow_up',30,false,1440),
    (p_organization_id,'won','Won / Completed','won',90,true,null),
    (p_organization_id,'lost','Lost / Not Interested','lost',100,true,null)
  on conflict(organization_id,key) do nothing;
  get diagnostics n=row_count;
  return n;
end $$;

revoke all on function public.seed_default_customer_stages(uuid) from public,anon,authenticated;
grant execute on function public.seed_default_customer_stages(uuid) to service_role;

do $$
declare r record;
begin
  for r in select id from public.organizations loop
    perform public.seed_default_customer_stages(r.id);
  end loop;
end $$;
