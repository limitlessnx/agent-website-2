create table if not exists public.maia_inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  channel text not null,
  provider text not null default 'unknown',
  external_event_id text not null,
  external_conversation_id text,
  customer_phone text,
  customer_name text,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received','processing','completed','failed','duplicate','blocked')),
  trigger_run_id text,
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_id, channel, provider, external_event_id)
);

create index if not exists maia_inbound_events_org_status_idx
  on public.maia_inbound_events (organization_id, status, received_at desc);

create index if not exists maia_inbound_events_conversation_idx
  on public.maia_inbound_events (organization_id, agent_id, channel, external_conversation_id, received_at desc);

create table if not exists public.maia_conversation_locks (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  channel text not null,
  external_conversation_id text not null,
  lock_owner text not null,
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, agent_id, channel, external_conversation_id)
);

alter table public.maia_inbound_events enable row level security;
alter table public.maia_conversation_locks enable row level security;

create or replace function public.claim_maia_conversation_lock(
  p_organization_id uuid,
  p_agent_id uuid,
  p_channel text,
  p_external_conversation_id text,
  p_lock_owner text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if p_external_conversation_id is null or btrim(p_external_conversation_id) = '' then
    return true;
  end if;

  insert into public.maia_conversation_locks (
    organization_id, agent_id, channel, external_conversation_id,
    lock_owner, lease_expires_at, updated_at
  )
  values (
    p_organization_id, p_agent_id, p_channel, p_external_conversation_id,
    p_lock_owner, now() + make_interval(secs => greatest(p_lease_seconds, 30)), now()
  )
  on conflict (organization_id, agent_id, channel, external_conversation_id)
  do update set
    lock_owner = excluded.lock_owner,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = now()
  where public.maia_conversation_locks.lease_expires_at <= now()
     or public.maia_conversation_locks.lock_owner = excluded.lock_owner;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

create or replace function public.release_maia_conversation_lock(
  p_organization_id uuid,
  p_agent_id uuid,
  p_channel text,
  p_external_conversation_id text,
  p_lock_owner text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released boolean := false;
begin
  if p_external_conversation_id is null or btrim(p_external_conversation_id) = '' then
    return true;
  end if;

  delete from public.maia_conversation_locks
  where organization_id = p_organization_id
    and agent_id = p_agent_id
    and channel = p_channel
    and external_conversation_id = p_external_conversation_id
    and lock_owner = p_lock_owner;

  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on function public.claim_maia_conversation_lock(uuid,uuid,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.release_maia_conversation_lock(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_maia_conversation_lock(uuid,uuid,text,text,text,integer) to service_role;
grant execute on function public.release_maia_conversation_lock(uuid,uuid,text,text,text) to service_role;
