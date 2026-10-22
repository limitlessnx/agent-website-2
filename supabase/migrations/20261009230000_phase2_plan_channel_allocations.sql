begin;

-- Phase 2: organization-specific commercial allocation control plane.
-- Billing/subscription rows remain the source of plan status; this table stores
-- the operational allocation selected for the organization.
create table if not exists public.organization_plan_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null check (plan_code in ('basic','plus','business','business_plus')),
  monthly_credit_allowance integer not null check (monthly_credit_allowance > 0),
  max_channels integer not null check (max_channels > 0),
  selectable_channels text[] not null default '{}',
  selected_channels text[] not null default '{}',
  setup_status text not null default 'pending' check (setup_status in ('pending','knowledge_submitted','configuring','ready','active','blocked')),
  allocation_status text not null default 'pending' check (allocation_status in ('pending','provisioning','active','paused','blocked')),
  business_knowledge_submitted_at timestamptz,
  configured_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  check (selected_channels <@ selectable_channels),
  check (cardinality(selected_channels) <= max_channels)
);

create index if not exists organization_plan_allocations_plan_idx
  on public.organization_plan_allocations(plan_code, allocation_status);

create table if not exists public.organization_channel_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  allocation_id uuid not null references public.organization_plan_allocations(id) on delete cascade,
  channel text not null check (channel in ('web_chat','whatsapp','voice','email')),
  agent_key text,
  agent_selection_id uuid references public.organization_agent_selections(id) on delete set null,
  status text not null default 'selected' check (status in ('selected','configuring','ready','active','paused','blocked')),
  setup_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel),
  unique (allocation_id, channel)
);

create index if not exists organization_channel_allocations_status_idx
  on public.organization_channel_allocations(organization_id, status);

alter table public.organization_plan_allocations enable row level security;
alter table public.organization_channel_allocations enable row level security;

revoke all on table public.organization_plan_allocations, public.organization_channel_allocations from public, anon, authenticated;
grant select on table public.organization_plan_allocations, public.organization_channel_allocations to authenticated;
grant all on table public.organization_plan_allocations, public.organization_channel_allocations to service_role;

drop policy if exists organization_plan_allocations_member_select on public.organization_plan_allocations;
create policy organization_plan_allocations_member_select
on public.organization_plan_allocations
for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists organization_channel_allocations_member_select on public.organization_channel_allocations;
create policy organization_channel_allocations_member_select
on public.organization_channel_allocations
for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.organization_plan_allocation_snapshot(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_organization_member(p_organization_id) then
    raise exception 'Organization membership required';
  end if;
  return (
    select jsonb_build_object(
    'organization_id', a.organization_id,
    'plan_code', a.plan_code,
    'monthly_credit_allowance', a.monthly_credit_allowance,
    'max_channels', a.max_channels,
    'selectable_channels', to_jsonb(a.selectable_channels),
    'selected_channels', to_jsonb(a.selected_channels),
    'setup_status', a.setup_status,
    'allocation_status', a.allocation_status,
    'business_knowledge_submitted_at', a.business_knowledge_submitted_at,
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'channel', c.channel,
        'agent_key', c.agent_key,
        'agent_selection_id', c.agent_selection_id,
        'status', c.status,
        'setup_metadata', c.setup_metadata
      ) order by c.channel)
      from public.organization_channel_allocations c
      where c.allocation_id = a.id
    ), '[]'::jsonb)
  )
  from public.organization_plan_allocations a
  where a.organization_id = p_organization_id
  );
end;
$$;

revoke all on function public.organization_plan_allocation_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.organization_plan_allocation_snapshot(uuid) to authenticated, service_role;

create or replace function public.sync_organization_plan_allocation(
  p_organization_id uuid,
  p_plan_code text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_credits integer;
  v_max_channels integer;
  v_selectable text[];
  v_allocation public.organization_plan_allocations%rowtype;
  v_selected text[];
begin
  if p_organization_id is null then raise exception 'organization_id is required'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization does not exist';
  end if;

  v_plan := case lower(coalesce(p_plan_code,''))
    when 'plus' then 'plus'
    when 'business' then 'business'
    when 'business_plus' then 'business_plus'
    when 'business-plus' then 'business_plus'
    else 'basic'
  end;
  v_credits := case v_plan when 'plus' then 5000 when 'business' then 12000 when 'business_plus' then 25000 else 2500 end;
  v_max_channels := case v_plan when 'basic' then 1 when 'plus' then 2 else 4 end;
  v_selectable := case when v_plan in ('business','business_plus')
    then array['web_chat','whatsapp','voice','email']::text[]
    else array['web_chat','whatsapp','voice']::text[]
  end;

  select * into v_allocation
  from public.organization_plan_allocations
  where organization_id = p_organization_id
  for update;

  v_selected := coalesce(v_allocation.selected_channels, '{}'::text[]);
  v_selected := array(
    select channel from unnest(v_selected) as channel
    where channel = any(v_selectable)
    limit v_max_channels
  );

  insert into public.organization_plan_allocations (
    organization_id, plan_code, monthly_credit_allowance, max_channels,
    selectable_channels, selected_channels, setup_status, allocation_status,
    configured_by, metadata
  ) values (
    p_organization_id, v_plan, v_credits, v_max_channels,
    v_selectable, v_selected,
    coalesce(v_allocation.setup_status, 'pending'),
    case when cardinality(v_selected) > 0 then coalesce(v_allocation.allocation_status, 'pending') else 'pending' end,
    p_actor_user_id,
    coalesce(v_allocation.metadata, '{}'::jsonb) || jsonb_build_object('last_synced_by','plan_sync')
  )
  on conflict (organization_id) do update set
    plan_code = excluded.plan_code,
    monthly_credit_allowance = excluded.monthly_credit_allowance,
    max_channels = excluded.max_channels,
    selectable_channels = excluded.selectable_channels,
    selected_channels = excluded.selected_channels,
    configured_by = coalesce(excluded.configured_by, public.organization_plan_allocations.configured_by),
    metadata = public.organization_plan_allocations.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_allocation;

  update public.organization_channel_allocations
  set status = 'paused', updated_at = now()
  where allocation_id = v_allocation.id and not (channel = any(v_selected)) and status <> 'paused';

  insert into public.organization_entitlements (organization_id, feature_key, enabled, source, limit_value, configuration)
  values
    (p_organization_id, 'plan.channels.max', true, 'plan', v_max_channels, jsonb_build_object('plan_code',v_plan)),
    (p_organization_id, 'plan.flux_credits.monthly', true, 'plan', v_credits, jsonb_build_object('plan_code',v_plan))
  on conflict (organization_id, feature_key) do update set
    enabled = excluded.enabled,
    source = 'plan',
    limit_value = excluded.limit_value,
    configuration = excluded.configuration,
    updated_at = now();

  return public.organization_plan_allocation_snapshot(p_organization_id);
end;
$$;

revoke all on function public.sync_organization_plan_allocation(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.sync_organization_plan_allocation(uuid,text,uuid) to service_role;

create or replace function public.set_organization_selected_channels(
  p_organization_id uuid,
  p_channels jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocation public.organization_plan_allocations%rowtype;
  v_channels text[];
  v_invalid text[];
  v_channel text;
  v_agent_key text;
begin
  select * into v_allocation from public.organization_plan_allocations
  where organization_id = p_organization_id for update;
  if v_allocation.id is null then raise exception 'Organization plan allocation is not initialized'; end if;
  if jsonb_typeof(coalesce(p_channels, '[]'::jsonb)) <> 'array' then raise exception 'channels must be a JSON array'; end if;

  select coalesce(array_agg(distinct value order by value), '{}'::text[])
  into v_channels
  from jsonb_array_elements_text(p_channels) as item(value);
  select coalesce(array_agg(channel), '{}'::text[])
  into v_invalid
  from unnest(v_channels) as channel
  where not (channel = any(v_allocation.selectable_channels));
  if cardinality(v_invalid) > 0 then raise exception 'Channels are not included in this plan: %', array_to_string(v_invalid, ', '); end if;
  if cardinality(v_channels) > v_allocation.max_channels then raise exception 'Plan allows at most % channel(s)', v_allocation.max_channels; end if;

  update public.organization_plan_allocations
  set selected_channels = v_channels,
      setup_status = case when cardinality(v_channels) = 0 then 'pending' else 'configuring' end,
      allocation_status = case when cardinality(v_channels) = 0 then 'pending' else 'provisioning' end,
      configured_by = p_actor_user_id,
      updated_at = now()
  where id = v_allocation.id
  returning * into v_allocation;

  update public.organization_channel_allocations
  set status = 'paused', updated_at = now()
  where allocation_id = v_allocation.id and not (channel = any(v_channels));

  foreach v_channel in array v_channels loop
    v_agent_key := case v_channel
      when 'web_chat' then 'web_chat_agent'
      when 'whatsapp' then 'whatsapp_agent'
      when 'voice' then 'voice_agent'
      when 'email' then 'email_agent'
    end;
    insert into public.organization_channel_allocations (
      organization_id, allocation_id, channel, agent_key, status, setup_metadata
    ) values (
      p_organization_id, v_allocation.id, v_channel, v_agent_key, 'selected',
      jsonb_build_object('source','phase2_channel_selection')
    )
    on conflict (organization_id, channel) do update set
      allocation_id = excluded.allocation_id,
      agent_key = excluded.agent_key,
      status = case when public.organization_channel_allocations.status = 'paused' then 'selected' else public.organization_channel_allocations.status end,
      updated_at = now();
  end loop;

  return public.organization_plan_allocation_snapshot(p_organization_id);
end;
$$;

revoke all on function public.set_organization_selected_channels(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.set_organization_selected_channels(uuid,jsonb,uuid) to service_role;

commit;
